use crate::models::{
    FileNode, ProgressPayload, ScanCompletePayload, ScanDeltaPayload,
};
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[cfg(unix)]
use std::os::unix::fs::MetadataExt;

fn get_file_physical_size(meta: &fs::Metadata) -> u64 {
    #[cfg(unix)]
    {
        let physical = meta.blocks().saturating_mul(512);
        if physical > 0 {
            std::cmp::min(meta.len(), physical)
        } else {
            meta.len()
        }
    }
    #[cfg(not(unix))]
    {
        meta.len()
    }
}

// ─── Shared scan cache for on-demand path resolution ────────────────────────

pub struct ScanCache {
    nodes: Arc<Mutex<Vec<FileNode>>>,
}

impl Clone for ScanCache {
    fn clone(&self) -> Self {
        Self {
            nodes: Arc::clone(&self.nodes),
        }
    }
}

impl ScanCache {
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn get_path(&self, id: usize) -> Option<String> {
        let nodes = self.nodes.lock().unwrap();
        if id >= nodes.len() {
            return None;
        }

        let mut path_parts = Vec::new();
        let mut curr_id = id;
        let mut visited = std::collections::HashSet::new();

        loop {
            if !visited.insert(curr_id) {
                break;
            }
            let node = &nodes[curr_id];

            if node.parent_id.is_none() {
                if !node.path.is_empty() {
                    path_parts.push(node.path.clone());
                } else {
                    path_parts.push(node.name.clone());
                }
                break;
            } else {
                path_parts.push(node.name.clone());
                curr_id = node.parent_id.unwrap();
            }
        }

        path_parts.reverse();

        #[cfg(target_os = "windows")]
        {
            let mut pb = PathBuf::new();
            for part in path_parts {
                pb.push(part);
            }
            Some(pb.to_string_lossy().into_owned())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let mut result = String::new();
            for (i, part) in path_parts.iter().enumerate() {
                if i == 0 {
                    result.push_str(part);
                } else {
                    if !result.ends_with('/') {
                        result.push('/');
                    }
                    result.push_str(part);
                }
            }
            Some(result)
        }
    }

    fn store_nodes(&self, nodes: Vec<FileNode>) {
        let mut cache = self.nodes.lock().unwrap();
        *cache = nodes;
    }

    pub fn append_nodes(&self, parent_id: usize, new_nodes: Vec<FileNode>) {
        let mut cache = self.nodes.lock().unwrap();
        
        // Update parent's child_ids in the cache
        if parent_id < cache.len() {
            let child_ids: Vec<usize> = new_nodes.iter().map(|n| n.id).collect();
            cache[parent_id].child_ids = child_ids;
        }

        for node in new_nodes {
            let id = node.id;

            if id >= cache.len() {
                cache.resize(id + 1, FileNode {
                    id: 0,
                    name: String::new(),
                    path: String::new(),
                    is_directory: false,
                    is_symlink: false,
                    size: 0,
                    child_ids: Vec::new(),
                    parent_id: None,
                    created_at: None,
                });
            }
            cache[id] = node;
        }
    }
}

// ─── Scanner ────────────────────────────────────────────────────────────────

pub struct Scanner;

impl Scanner {
    pub fn new() -> Self {
        Self
    }

    pub fn scan(
        &mut self,
        target_path: &str,
        app: Option<&AppHandle>,
        cache: Option<&ScanCache>,
        scan_id: Option<&str>,
    ) -> Result<Vec<FileNode>, String> {
        let root_path = Path::new(target_path);
        if !root_path.exists() {
            return Err(format!("Target path does not exist: {}", target_path));
        }


        let root_created_at = fs::metadata(root_path).ok().and_then(|m| {
            m.created()
                .or_else(|_| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
        });
        
        let root_name = root_path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| target_path.to_string());

        // Read direct children of target_path
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
                        let name = entry.file_name();
                        if !Self::should_skip_directory(root_path, &name) {
                            dir_entries.push((entry, is_symlink));
                        }
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
                    meta.as_ref().map(get_file_physical_size).unwrap_or(0)
                };
                let name = entry.file_name().to_string_lossy().into_owned();
                (name, size, is_sym)
            })
            .collect();

        let root_size: u64 = dirs.iter().map(|d| d.2).sum::<u64>() + files.iter().map(|f| f.1).sum::<u64>();

        let mut nodes = Vec::new();
        // Push root node
        nodes.push(FileNode {
            id: 0,
            name: root_name,
            path: target_path.to_string(),
            is_directory: true,
            is_symlink: false,
            size: root_size,
            child_ids: Vec::new(),
            parent_id: None,
            created_at: root_created_at,
        });

        let mut child_ids = Vec::new();

        // Sort directories by size descending
        let mut sorted_dirs = dirs;
        sorted_dirs.sort_unstable_by(|a, b| b.2.cmp(&a.2));

        for (name, _path_buf, size, is_symlink) in sorted_dirs {
            let child_id = nodes.len();
            child_ids.push(child_id);
            nodes.push(FileNode {
                id: child_id,
                name,
                path: String::new(),
                is_directory: true,
                is_symlink,
                size,
                child_ids: Vec::new(),
                parent_id: Some(0),
                created_at: None,
            });
        }

        // Sort files by size descending
        let mut sorted_files = files;
        sorted_files.sort_unstable_by(|a, b| b.1.cmp(&a.1));

        for (name, size, is_symlink) in sorted_files {
            let child_id = nodes.len();
            child_ids.push(child_id);
            nodes.push(FileNode {
                id: child_id,
                name,
                path: String::new(),
                is_directory: false,
                is_symlink,
                size,
                child_ids: Vec::new(),
                parent_id: Some(0),
                created_at: None,
            });
        }

        nodes[0].child_ids = child_ids;

        // Emit final progress for UI updates
        if let Some(handle) = app {
            if let Some(sid) = scan_id {
                let _ = handle.emit(
                    "scan-progress",
                    ProgressPayload {
                        scan_id: Some(sid.to_string()),
                        path: target_path.to_string(),
                        count: nodes.len(),
                    },
                );
            }
        }

        if let Some(c) = cache {
            c.store_nodes(nodes.clone());
        }

        Ok(nodes)
    }

    pub fn scan_stream(
        &mut self,
        target_path: &str,
        app: &AppHandle,
        cache: Option<&ScanCache>,
        scan_id: String,
    ) -> Result<(), String> {
        let root_path = Path::new(target_path);
        if !root_path.exists() {
            return Err(format!("Target path does not exist: {}", target_path));
        }

        let nodes = self.scan(target_path, Some(app), cache, Some(&scan_id))?;
        let total_count = nodes.len();

        let chunk_size = 50000;
        let mut chunks = nodes.chunks(chunk_size);

        while let Some(chunk) = chunks.next() {
            let _ = app.emit(
                "scan-delta",
                ScanDeltaPayload {
                    scan_id: scan_id.clone(),
                    added: chunk.to_vec(),
                    updated: Vec::new(),
                    path: target_path.to_string(),
                    count: total_count,
                    done: false,
                },
            );
        }

        let _ = app.emit(
            "scan-delta",
            ScanDeltaPayload {
                scan_id: scan_id.clone(),
                added: Vec::new(),
                updated: Vec::new(),
                path: target_path.to_string(),
                count: total_count,
                done: true,
            },
        );

        let _ = app.emit(
            "scan-complete",
            ScanCompletePayload {
                scan_id,
                count: total_count,
                total_nodes: total_count,
            },
        );

        Ok(())
    }
}

// ─── Phase 1: Parallel Walk ─────────────────────────────────────────────────

impl Scanner {
    #[allow(unused_variables)]
    fn should_skip_directory(dir: &Path, entry_name: &std::ffi::OsStr) -> bool {
        #[cfg(not(target_os = "windows"))]
        {
            if let Some(name_str) = entry_name.to_str() {
                if dir == Path::new("/") {
                    return name_str == "Volumes"
                        || name_str == "dev"
                        || name_str == "proc"
                        || name_str == "sys";
                } else if dir == Path::new("/System") {
                    return name_str == "Volumes";
                }
            }
        }
        false
    }
}
