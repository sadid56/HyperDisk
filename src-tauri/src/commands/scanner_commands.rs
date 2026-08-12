use crate::models::{FileNode, ScanErrorPayload};
use crate::services::{ScanCache, Scanner};
use std::thread;
use tauri::Emitter;

#[tauri::command]
pub async fn scan_folder(
    app: tauri::AppHandle,
    cache: tauri::State<'_, ScanCache>,
    target_path: String,
) -> Result<Vec<FileNode>, String> {
    let cache_ref = cache.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut scanner = Scanner::new();
        scanner.scan(&target_path, Some(&app), Some(&cache_ref), None)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn scan_folder_live(
    app: tauri::AppHandle,
    cache: tauri::State<'_, ScanCache>,
    target_path: String,
    scan_id: String,
) -> Result<(), String> {
    let cache_ref = cache.inner().clone();
    thread::spawn(move || {
        let mut scanner = Scanner::new();
        if let Err(err) = scanner.scan_stream(&target_path, &app, Some(&cache_ref), scan_id.clone()) {
            let _ = app.emit(
                "scan-error",
                ScanErrorPayload {
                    scan_id,
                    message: err,
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub fn resolve_node_path(cache: tauri::State<'_, ScanCache>, node_id: usize) -> Option<String> {
    cache.get_path(node_id)
}

#[tauri::command]
pub async fn scan_directory_shallow(
    cache: tauri::State<'_, ScanCache>,
    target_path: String,
    parent_id: usize,
    start_id: usize,
) -> Result<Vec<FileNode>, String> {
    use std::fs;
    use std::path::{Path, PathBuf};
    use rayon::prelude::*;

    let cache_ref = cache.inner().clone();
    let result = tokio::task::spawn_blocking(move || {
        let root_path = Path::new(&target_path);
        if !root_path.exists() {
            return Err(format!("Target path does not exist: {}", target_path));
        }

        let mut file_entries = Vec::new();
        let mut dir_entries = Vec::new();

        if let Ok(read_dir) = fs::read_dir(root_path) {
            for entry in read_dir.flatten() {
                if let Ok(ft) = entry.file_type() {
                    let is_symlink = ft.is_symlink();
                    let mut is_dir = ft.is_dir();
                    let mut is_file = ft.is_file();

                    if is_symlink {
                        if let Ok(target) = fs::canonicalize(entry.path()) {
                            is_dir = target.is_dir();
                            is_file = target.is_file();
                        }
                    }

                    if is_dir {
                        dir_entries.push((entry, is_symlink));
                    } else if is_file {
                        file_entries.push((entry, is_symlink));
                    }
                }
            }
        }

        // Process child subdirectories in parallel using Rayon
        let dirs: Vec<(String, PathBuf, u64, bool)> = dir_entries
            .into_par_iter()
            .map(|(entry, is_sym)| {
                let entry_path = entry.path();
                let name = entry.file_name().to_string_lossy().into_owned();
                let size = if is_sym {
                    0
                } else {
                    crate::services::get_dir_size_parallel(&entry_path)
                };
                (name, entry_path, size, is_sym)
            })
            .collect();

        // Process child files
        let files: Vec<(String, u64, bool)> = file_entries
            .into_iter()
            .map(|(entry, is_sym)| {
                let size = if is_sym {
                    0
                } else {
                    let meta = entry.metadata().ok();
                    #[cfg(unix)]
                    let s = meta.as_ref().map(|m| {
                        use std::os::unix::fs::MetadataExt;
                        let physical = m.blocks().saturating_mul(512);
                        if physical > 0 {
                            std::cmp::min(m.len(), physical)
                        } else {
                            m.len()
                        }
                    }).unwrap_or(0);
                    #[cfg(not(unix))]
                    let s = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    s
                };

                let name = entry.file_name().to_string_lossy().into_owned();
                (name, size, is_sym)
            })
            .collect();

        let mut nodes = Vec::new();
        let mut next_id = start_id;

        // Sort directories by size descending
        let mut sorted_dirs = dirs;
        sorted_dirs.sort_unstable_by(|a, b| b.2.cmp(&a.2));

        for (name, _path_buf, size, is_symlink) in sorted_dirs {
            nodes.push(FileNode {
                id: next_id,
                name,
                path: String::new(),
                is_directory: true,
                is_symlink,
                size,
                child_ids: Vec::new(),
                parent_id: Some(parent_id),
                created_at: None,
            });
            next_id += 1;
        }

        // Sort files by size descending
        let mut sorted_files = files;
        sorted_files.sort_unstable_by(|a, b| b.1.cmp(&a.1));

        for (name, size, is_symlink) in sorted_files {
            nodes.push(FileNode {
                id: next_id,
                name,
                path: String::new(),
                is_directory: false,
                is_symlink,
                size,
                child_ids: Vec::new(),
                parent_id: Some(parent_id),
                created_at: None,
            });
            next_id += 1;
        }

        Ok(nodes)
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Ok(ref new_nodes) = result {
        cache_ref.append_nodes(parent_id, new_nodes.clone());
    }

    result
}
