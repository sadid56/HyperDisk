use std::path::{Path, PathBuf};
use crate::models::UserFolder;
use std::fs;
use tauri::Manager;

pub fn has_full_disk_access() -> bool {
    let path = Path::new("/Library/Application Support/com.apple.TCC/TCC.db");
    match std::fs::File::open(path) {
        Ok(_) => true,
        Err(err) => err.kind() != std::io::ErrorKind::PermissionDenied,
    }
}

pub fn request_full_disk_access(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
    app.opener().open_url(url, None::<String>).map_err(|e| e.to_string())
}

pub fn open_in_terminal(dir_path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-a", "Terminal", dir_path])
        .spawn()
        .map_err(|e| format!("Failed to open Terminal: {}", e))?;
    Ok(())
}

pub fn reveal_in_folder(target_path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", target_path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_disk_smart_status(mount_point: &str) -> String {
    if mount_point.is_empty() {
        return "Unknown".to_string();
    }
    let output = std::process::Command::new("diskutil")
        .args(["info", mount_point])
        .output();

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        for line in stdout.lines() {
            if line.contains("SMART Status:") {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() > 1 {
                    return parts[1].trim().to_string();
                }
            }
        }
    }
    "Unknown".to_string()
}

pub fn is_dir_size_parallel_excluded(path_str: &str) -> bool {
    path_str == "/System/Volumes" || path_str == "/Volumes" || path_str == "/dev"
}

pub fn should_skip_size_check(path: &str) -> bool {
    let path_buf = PathBuf::from(path);
    if let Some(home_path) = dirs::home_dir() {
        let path_buf = path_buf.canonicalize().unwrap_or(path_buf);
        let home_path = home_path.canonicalize().unwrap_or(home_path);
        
        let media_or_library = ["Pictures", "Movies", "Music", "Library"];
        if media_or_library.iter().any(|subdir| {
            let p = home_path.join(subdir);
            let p = p.canonicalize().unwrap_or(p);
            path_buf.starts_with(&p) || path_buf == p
        }) {
            return true;
        }

        // Standard user folders require FDA. Skip if FDA is not granted.
        // During development (debug_assertions), we also skip them to prevent recompiled binaries from triggering TCC prompts.
        let skip_tcc = cfg!(debug_assertions) || !has_full_disk_access();
        if skip_tcc {
            let tcc_dirs = ["Desktop", "Documents", "Downloads"];
            if tcc_dirs.iter().any(|subdir| {
                let p = home_path.join(subdir);
                let p = p.canonicalize().unwrap_or(p);
                path_buf.starts_with(&p) || path_buf == p
            }) {
                return true;
            }
        }
    }
    false
}

pub fn is_tcc_protected_folder(path: &str) -> bool {
    let path_buf = PathBuf::from(path);
    if let Ok(home) = std::env::var("HOME") {
        let home_path = PathBuf::from(home);
        let protected_subdirs = ["Desktop", "Documents", "Downloads", "Pictures", "Movies", "Music", "Library"];
        protected_subdirs.iter().any(|subdir| {
            let p = home_path.join(subdir);
            path_buf.starts_with(&p) || path_buf == p
        })
    } else {
        false
    }
}

pub fn get_user_folders(app: &tauri::AppHandle) -> Vec<UserFolder> {
    let mut standard_paths = Vec::new();
    standard_paths.push(("Applications".to_string(), PathBuf::from("/Applications")));

    let has_fda = has_full_disk_access();
    if has_fda {
        if let Ok(p) = app.path().document_dir() { standard_paths.push(("Documents".to_string(), p)); }
        if let Ok(p) = app.path().download_dir() { standard_paths.push(("Downloads".to_string(), p)); }
        if let Ok(p) = app.path().desktop_dir() { standard_paths.push(("Desktop".to_string(), p)); }
        if let Ok(p) = app.path().picture_dir() { standard_paths.push(("Pictures".to_string(), p)); }
        if let Ok(p) = app.path().video_dir()   { standard_paths.push(("Movies".to_string(), p)); }
        if let Ok(p) = app.path().audio_dir()   { standard_paths.push(("Music".to_string(), p)); }
    } else {
        if let Ok(home) = std::env::var("HOME") {
            let home = PathBuf::from(home);
            for (label, dir_name) in &[
                ("Documents", "Documents"),
                ("Downloads", "Downloads"),
                ("Desktop", "Desktop"),
                ("Pictures", "Pictures"),
                ("Movies", "Movies"),
                ("Music", "Music"),
            ] {
                let p = home.join(dir_name);
                if p.exists() && p.is_dir() {
                    standard_paths.push((label.to_string(), p));
                }
            }
        }
    }

    crate::services::disk::assemble_user_folders(standard_paths)
}

pub fn get_system_root_folders() -> Vec<UserFolder> {
    let root_path = PathBuf::from("/");
    let mut folders = Vec::new();

    if let Ok(entries) = fs::read_dir(&root_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name_str) = path.file_name().and_then(|n| n.to_str()) {
                    if name_str.starts_with('.') {
                        continue;
                    }
                    let name_lower = name_str.to_lowercase();
                    if name_lower == "proc"
                        || name_lower == "sys"
                        || name_lower == "dev"
                        || name_lower == "run"
                        || name_lower == "tmp"
                        || name_lower == "mnt"
                        || name_lower == "media"
                        || name_lower == "lost+found"
                        || name_lower == "etc"
                        || name_lower == "bin"
                        || name_lower == "sbin"
                        || name_lower == "boot"
                        || name_lower == "lib"
                        || name_lower == "lib64"
                    {
                        continue;
                    }
                    folders.push((name_str.to_string(), path));
                }
            }
        }
    }

    crate::services::disk::collect_user_folders(folders)
}

pub fn toggle_autostart(app_name: &str, enabled: bool) -> Result<(), String> {
    if let Some(home) = dirs::home_dir() {
        let plist_dir = home.join("Library/LaunchAgents");
        let plist_path = plist_dir.join(format!("com.{}.app.plist", app_name.to_lowercase()));

        if enabled {
            if !plist_dir.exists() {
                std::fs::create_dir_all(&plist_dir).map_err(|e| e.to_string())?;
            }
            let exe_path = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned();

            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.{}.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"#,
                app_name.to_lowercase(),
                exe_path
            );
            std::fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
        } else if plist_path.exists() {
            std::fs::remove_file(plist_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
