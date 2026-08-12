use crate::models::{DirectoryEntry, LargeFile, CleanupSuggestion, DuplicateGroup};
use crate::services::disk::get_dir_size_parallel;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub fn get_large_files(app: &tauri::AppHandle) -> Vec<LargeFile> {
    let mut raw_files = Vec::new();
    let has_fda = crate::services::disk::has_full_disk_access();

    let should_scan = if cfg!(target_os = "macos") {
        has_fda && !cfg!(debug_assertions)
    } else {
        true
    };

    if should_scan {
        let targets = vec![
            app.path().download_dir(),
            app.path().document_dir(),
            app.path().desktop_dir(),
        ];

        for target_res in targets {
            if let Ok(path) = target_res {
                if path.exists() && path.is_dir() {
                    collect_files_in_dir(&path, &mut raw_files);
                }
            }
        }
    }

    raw_files.sort_by(|a, b| b.2.cmp(&a.2));
    raw_files.truncate(20);

    raw_files
        .into_iter()
        .map(|(name, path, size)| {
            let ext = path.extension().unwrap_or_default().to_string_lossy().to_string();
            let file_type = match ext.to_lowercase().as_str() {
                "dmg" | "iso" | "pkg" | "exe" | "msi" => "Installer",
                "zip" | "tar" | "gz" | "rar" | "7z" | "xip" => "Archive",
                "mp4" | "mkv" | "mov" | "avi" | "webm" => "Video",
                "mp3" | "wav" | "flac" | "m4a" => "Audio",
                "png" | "jpg" | "jpeg" | "webp" | "gif" => "Image",
                "pdf" | "doc" | "docx" | "xlsx" | "pptx" => "Document",
                _ => "File",
            }.to_string();

            LargeFile {
                name,
                path: path.to_string_lossy().to_string(),
                size,
                file_type,
            }
        })
        .collect()
}

fn get_log_paths(home: &Path) -> Vec<PathBuf> {
    let mut log_paths = Vec::new();
    if cfg!(target_os = "macos") {
        log_paths.push(home.join("Library/Logs"));
    } else if cfg!(target_os = "windows") {
        log_paths.push(home.join("AppData\\Local\\Microsoft\\Windows\\WER\\ReportArchive"));
        log_paths.push(home.join("AppData\\Local\\Microsoft\\Windows\\WER\\ReportQueue"));
        log_paths.push(PathBuf::from("C:\\Windows\\Logs"));
    } else {
        log_paths.push(PathBuf::from("/var/log"));
        log_paths.push(home.join(".cache/logs"));
    }
    log_paths
}

fn get_pkg_paths(home: &Path) -> Vec<PathBuf> {
    let mut pkg_paths = Vec::new();
    if cfg!(target_os = "macos") {
        pkg_paths.push(home.join("Library/Caches/Homebrew"));
        pkg_paths.push(home.join(".cache/pip"));
    } else if cfg!(target_os = "windows") {
        pkg_paths.push(home.join("AppData\\Local\\pip\\cache"));
        pkg_paths.push(home.join("AppData\\Local\\Yarn\\Cache"));
    } else {
        pkg_paths.push(home.join(".cache/pip"));
    }
    pkg_paths
}

fn get_thumbnail_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if cfg!(target_os = "macos") {
        paths.push(home.join("Library/Caches/com.apple.iconservices.store"));
    } else if cfg!(target_os = "windows") {
        paths.push(home.join("AppData\\Local\\Microsoft\\Windows\\Explorer"));
    } else {
        paths.push(home.join(".cache/thumbnails"));
    }
    paths
}

fn get_crash_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if cfg!(target_os = "macos") {
        paths.push(home.join("Library/Logs/DiagnosticReports"));
    } else if cfg!(target_os = "windows") {
        paths.push(home.join("AppData\\Local\\CrashDumps"));
    } else {
        paths.push(home.join(".cache/crash"));
        paths.push(PathBuf::from("/var/crash"));
    }
    paths
}

fn get_cache_paths(home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if cfg!(target_os = "windows") {
        if let Ok(temp) = std::env::var("TEMP") {
            paths.push(PathBuf::from(temp));
        }
        paths.push(home.join("AppData\\Local\\Microsoft\\Windows\\INetCache"));
    } else if cfg!(target_os = "macos") {
        paths.push(home.join("Library/Caches"));
    } else {
        paths.push(home.join(".cache"));
    }
    paths
}

pub fn get_cleanup_suggestions(app: &tauri::AppHandle) -> Vec<CleanupSuggestion> {
    let mut suggestions = Vec::new();
    let has_fda = crate::services::disk::has_full_disk_access();
    let home = app.path().home_dir().unwrap_or_default();

    // 1. Trash Bin
    let trash_path = if cfg!(target_os = "windows") {
        PathBuf::from("C:\\$Recycle.Bin")
    } else {
        home.join(".Trash")
    };
    let scan_library_paths = if cfg!(target_os = "macos") {
        has_fda && !cfg!(debug_assertions)
    } else {
        true
    };
    let trash_size = if scan_library_paths {
        get_dir_size_parallel(&trash_path)
    } else {
        0
    };
    suggestions.push(CleanupSuggestion {
        id: "trash".to_string(),
        title: "Trash Bin".to_string(),
        desc: "Files and folders you have moved to the system Trash".to_string(),
        size: trash_size,
    });

    // 2. System & App Caches
    let mut cache_size = 0;
    if scan_library_paths {
        for path in get_cache_paths(&home) {
            if path.exists() {
                cache_size += get_dir_size_parallel(&path);
            }
        }
    }
    suggestions.push(CleanupSuggestion {
        id: "caches".to_string(),
        title: "System & App Caches".to_string(),
        desc: "Temporary system files and application cached data".to_string(),
        size: cache_size,
    });

    // 3. Downloads Folder
    let downloads_path = app.path().download_dir().unwrap_or_default();
    let downloads_size = if scan_library_paths {
        get_dir_size_parallel(&downloads_path)
    } else {
        0
    };
    suggestions.push(CleanupSuggestion {
        id: "downloads".to_string(),
        title: "Downloads Folder".to_string(),
        desc: "Review older setup files and documents left in Downloads".to_string(),
        size: downloads_size,
    });

    // 4. Developer & Dependency Caches
    let mut dev_cache_size = 0;
    let cargo_cache = home.join(".cargo/registry/cache");
    if cargo_cache.exists() {
        dev_cache_size += get_dir_size_parallel(&cargo_cache);
    }
    let npm_cache = home.join(".npm");
    if npm_cache.exists() {
        dev_cache_size += get_dir_size_parallel(&npm_cache);
    }
    let pnpm_cache = home.join(".local/share/pnpm/store");
    if pnpm_cache.exists() {
        dev_cache_size += get_dir_size_parallel(&pnpm_cache);
    }
    if scan_library_paths {
        let xcode_derived = home.join("Library/Developer/Xcode/DerivedData");
        if xcode_derived.exists() {
            dev_cache_size += get_dir_size_parallel(&xcode_derived);
        }
    }
    suggestions.push(CleanupSuggestion {
        id: "dev_caches".to_string(),
        title: "Developer & Dependency Caches".to_string(),
        desc: "Cached package dependencies, registries, and Xcode build data".to_string(),
        size: dev_cache_size,
    });

    // 5. System Logs
    let mut log_size = 0;
    if scan_library_paths {
        for path in get_log_paths(&home) {
            if path.exists() {
                log_size += get_dir_size_parallel(&path);
            }
        }
    }
    suggestions.push(CleanupSuggestion {
        id: "system_logs".to_string(),
        title: "Application & System Logs".to_string(),
        desc: "Diagnostic crash reports and software event logs".to_string(),
        size: log_size,
    });

    // 6. Package Caches
    let mut pkg_size = 0;
    if scan_library_paths {
        for path in get_pkg_paths(&home) {
            if path.exists() {
                pkg_size += get_dir_size_parallel(&path);
            }
        }
    }
    suggestions.push(CleanupSuggestion {
        id: "package_caches".to_string(),
        title: "Package Caches".to_string(),
        desc: "Cached formula downloads and installer package files (pip, yarn, brew)".to_string(),
        size: pkg_size,
    });

    // 7. Thumbnail Caches
    let mut thumb_size = 0;
    if scan_library_paths {
        for path in get_thumbnail_paths(&home) {
            if path.exists() {
                thumb_size += get_dir_size_parallel(&path);
            }
        }
    }
    suggestions.push(CleanupSuggestion {
        id: "thumbnail_caches".to_string(),
        title: "Thumbnail Caches".to_string(),
        desc: "Cached icon and folder preview images generated by the system".to_string(),
        size: thumb_size,
    });

    // 8. Crash Reports
    let mut crash_size = 0;
    if scan_library_paths {
        for path in get_crash_paths(&home) {
            if path.exists() {
                crash_size += get_dir_size_parallel(&path);
            }
        }
    }
    suggestions.push(CleanupSuggestion {
        id: "crash_reports".to_string(),
        title: "User Crash Reports".to_string(),
        desc: "Diagnostic crash logs and system core dumps from software crashes".to_string(),
        size: crash_size,
    });

    suggestions
}

pub fn get_duplicate_files(app: &tauri::AppHandle) -> Vec<DuplicateGroup> {
    let mut raw_files = Vec::new();
    let has_fda = crate::services::disk::has_full_disk_access();

    let should_scan = if cfg!(target_os = "macos") {
        has_fda && !cfg!(debug_assertions)
    } else {
        true
    };

    if should_scan {
        let targets = vec![
            app.path().download_dir(),
            app.path().document_dir(),
            app.path().desktop_dir(),
        ];

        for target_res in targets {
            if let Ok(path) = target_res {
                if path.exists() && path.is_dir() {
                    collect_files_in_dir(&path, &mut raw_files);
                }
            }
        }
    }

    let mut groups: HashMap<(String, u64), Vec<String>> = HashMap::new();
    for (name, path, size) in raw_files {
        if size > 100_000 {
            let norm = normalize_filename(&name);
            groups.entry((norm, size)).or_default().push(path.to_string_lossy().to_string());
        }
    }

    let mut dup_groups = Vec::new();
    for ((name, size), paths) in groups {
        if paths.len() > 1 {
            let count = paths.len() as u32;
            let total_waste = size * (count - 1) as u64;
            dup_groups.push(DuplicateGroup {
                name,
                size,
                count,
                total_waste,
                paths,
            });
        }
    }

    dup_groups.sort_by(|a, b| b.total_waste.cmp(&a.total_waste));
    dup_groups.truncate(15);

    dup_groups
}

pub fn perform_system_cleanup(app: &tauri::AppHandle, id: String) -> Result<(), String> {
    let home = app.path().home_dir().unwrap_or_default();
    match id.as_str() {
        "trash" => {
            let trash_path = if cfg!(target_os = "windows") {
                PathBuf::from("C:\\$Recycle.Bin")
            } else {
                home.join(".Trash")
            };
            empty_directory_contents(&trash_path);
        }
        "caches" => {
            let cache_path = if cfg!(target_os = "windows") {
                std::env::var("TEMP").map(PathBuf::from).unwrap_or_default()
            } else {
                home.join("Library/Caches")
            };
            empty_directory_contents(&cache_path);
        }
        "downloads" => {
            let downloads_path = app.path().download_dir().unwrap_or_default();
            if let Ok(entries) = fs::read_dir(&downloads_path) {
                for entry in entries.filter_map(Result::ok) {
                    let p = entry.path();
                    if p.is_file() {
                        if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                            let ext_lower = ext.to_lowercase();
                            if vec!["dmg", "pkg", "exe", "msi", "zip", "rar", "7z", "tar", "gz"].contains(&ext_lower.as_str()) {
                                let _ = fs::remove_file(&p);
                            }
                        }
                    }
                }
            }
        }
        "dev_caches" => {
            let cargo_cache = home.join(".cargo/registry/cache");
            if cargo_cache.exists() {
                empty_directory_contents(&cargo_cache);
            }
            let npm_cache = home.join(".npm");
            if npm_cache.exists() {
                empty_directory_contents(&npm_cache);
            }
            let pnpm_cache = home.join(".local/share/pnpm/store");
            if pnpm_cache.exists() {
                empty_directory_contents(&pnpm_cache);
            }
            let xcode_derived = home.join("Library/Developer/Xcode/DerivedData");
            if xcode_derived.exists() {
                empty_directory_contents(&xcode_derived);
            }
        }
        "system_logs" => {
            for path in get_log_paths(&home) {
                if path.exists() {
                    empty_directory_contents(&path);
                }
            }
        }
        "package_caches" => {
            for path in get_pkg_paths(&home) {
                if path.exists() {
                    empty_directory_contents(&path);
                }
            }
        }
        "thumbnail_caches" => {
            for path in get_thumbnail_paths(&home) {
                if path.exists() {
                    empty_directory_contents(&path);
                }
            }
        }
        "crash_reports" => {
            for path in get_crash_paths(&home) {
                if path.exists() {
                    empty_directory_contents(&path);
                }
            }
        }

        _ => return Err(format!("Unknown cleanup category: {}", id)),
    }
    Ok(())
}

fn collect_files_in_dir(path: &Path, files: &mut Vec<(String, PathBuf, u64)>) {
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_dir() {
                if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                    if name.starts_with('.') || name == "Library" || name == "node_modules" || name.ends_with(".app") {
                        continue;
                    }
                }
                collect_files_in_dir(&p, files);
            } else if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                    files.push((name, p, meta.len()));
                }
            }
        }
    }
}

fn normalize_filename(name: &str) -> String {
    let lower = name.to_lowercase();
    lower
        .replace(" (1)", "")
        .replace(" (2)", "")
        .replace(" (3)", "")
        .replace(" (4)", "")
        .replace(" copy", "")
        .replace(" - copy", "")
}

fn empty_directory_contents(dir_path: &Path) {
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.filter_map(Result::ok) {
            let p = entry.path();
            if p.is_dir() {
                let _ = fs::remove_dir_all(&p);
            } else {
                let _ = fs::remove_file(&p);
            }
        }
    }
}

pub fn get_cleanup_details(app: &tauri::AppHandle, id: &str) -> Vec<DirectoryEntry> {
    let home = app.path().home_dir().unwrap_or_default();
    let paths = match id {
        "trash" => {
            let trash_path = if cfg!(target_os = "windows") {
                PathBuf::from("C:\\$Recycle.Bin")
            } else {
                home.join(".Trash")
            };
            vec![trash_path]
        }
        "caches" => get_cache_paths(&home),
        "downloads" => {
            vec![app.path().download_dir().unwrap_or_default()]
        }
        "dev_caches" => {
            let mut p = Vec::new();
            let cargo_cache = home.join(".cargo/registry/cache");
            if cargo_cache.exists() {
                p.push(cargo_cache);
            }
            let npm_cache = home.join(".npm");
            if npm_cache.exists() {
                p.push(npm_cache);
            }
            let pnpm_cache = home.join(".local/share/pnpm/store");
            if pnpm_cache.exists() {
                p.push(pnpm_cache);
            }
            let xcode_derived = home.join("Library/Developer/Xcode/DerivedData");
            if xcode_derived.exists() {
                p.push(xcode_derived);
            }
            p
        }
        "system_logs" => get_log_paths(&home),
        "package_caches" => get_pkg_paths(&home),
        "thumbnail_caches" => get_thumbnail_paths(&home),
        "crash_reports" => get_crash_paths(&home),
        _ => Vec::new(),
    };

    let mut entries = Vec::new();
    for root in paths {
        if root.exists() && root.is_dir() {
            if let Ok(dir_entries) = fs::read_dir(root) {
                for entry in dir_entries.filter_map(Result::ok) {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let is_directory = path.is_dir();
                    let size = if is_directory {
                        get_dir_size_parallel(&path)
                    } else {
                        entry.metadata().map(|m| m.len()).unwrap_or(0)
                    };
                    if size > 0 {
                        entries.push(DirectoryEntry {
                            name,
                            path: path.to_string_lossy().to_string(),
                            is_directory,
                            size,
                        });
                    }
                }
            }
        }
    }

    entries.sort_by(|a, b| b.size.cmp(&a.size));
    entries.truncate(50);
    entries
}

pub fn search_system_directory(app: &tauri::AppHandle, query: &str) -> Vec<DirectoryEntry> {
    let mut matches = Vec::new();
    let q = query.to_lowercase();
    if q.is_empty() {
        return matches;
    }

    let home = app.path().home_dir().unwrap_or_default();
    let has_fda = crate::services::disk::has_full_disk_access();
    let mut targets = Vec::new();

    if !cfg!(target_os = "macos") || has_fda {
        targets.push(app.path().download_dir().unwrap_or_default());
        targets.push(app.path().document_dir().unwrap_or_default());
        targets.push(app.path().desktop_dir().unwrap_or_default());
        targets.push(home.join("Pictures"));
        targets.push(home.join("Movies"));

        // Also search other custom/non-hidden folders in user's home directory (e.g. Projects)
        if let Ok(entries) = fs::read_dir(&home) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name_str) = path.file_name().and_then(|n| n.to_str()) {
                        if !name_str.starts_with('.')
                            && name_str != "Library"
                            && name_str != "Pictures"
                            && name_str != "Movies"
                            && name_str != "Music"
                            && name_str != "Downloads"
                            && name_str != "Documents"
                            && name_str != "Desktop"
                        {
                            targets.push(path);
                        }
                    }
                }
            }
        }
    }

    for root in targets {
        if root.exists() && root.is_dir() {
            search_in_path_recursive(&root, &q, &mut matches, 0);
            if matches.len() >= 10 {
                break;
            }
        }
    }

    matches.truncate(10);
    matches
}

fn search_in_path_recursive(dir: &Path, q: &str, matches: &mut Vec<DirectoryEntry>, depth: u32) {
    if depth > 4 || matches.len() >= 10 {
        return;
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            
            if name.starts_with('.') || name == "Library" || name == "node_modules" || name.ends_with(".app") {
                continue;
            }

            if name.to_lowercase().contains(q) {
                let is_directory = path.is_dir();
                let size = if is_directory {
                    0
                } else {
                    entry.metadata().map(|m| m.len()).unwrap_or(0)
                };

                matches.push(DirectoryEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_directory,
                    size,
                });

                if matches.len() >= 10 {
                    return;
                }
            }

            if path.is_dir() {
                search_in_path_recursive(&path, q, matches, depth + 1);
            }
        }
    }
}
