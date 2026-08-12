use crate::models::{
    DirectoryEntry, DiskSpaceInfo, SystemDrive, UserFolder
};
use rayon::prelude::*;
#[cfg(target_os = "linux")]
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::Disks;

const PSEUDO_FILESYSTEMS: &[&str] = &[
    "binderfs",
    "cgroup",
    "cgroup2",
    "configfs",
    "debugfs",
    "devpts",
    "devtmpfs",
    "fusectl",
    "mqueue",
    "overlay",
    "proc",
    "securityfs",
    "squashfs",
    "sysfs",
    "tmpfs",
    "tracefs",
];

const SENSITIVE_MOUNT_PREFIXES: &[&str] = &[
    "/boot",
    "/boot/efi",
    "/dev",
    "/etc",
    "/lib",
    "/lib64",
    "/proc",
    "/root",
    "/run",
    "/sbin",
    "/sys",
    "/usr",
    "/var",
];

fn normalize_path_string(path: &str) -> String {
    let mut normalized = path.trim().replace('\\', "/").to_lowercase();
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

fn is_sensitive_mount_point(path: &str) -> bool {
    let normalized = normalize_path_string(path);

    SENSITIVE_MOUNT_PREFIXES.iter().any(|prefix| {
        let prefix_norm = normalize_path_string(prefix);
        normalized == prefix_norm || normalized.starts_with(&format!("{}/", prefix_norm))
    })
}

fn is_pseudo_filesystem(file_system: &str) -> bool {
    let normalized = file_system.trim().to_lowercase();
    PSEUDO_FILESYSTEMS.iter().any(|fs| normalized == *fs)
}

fn is_external_mount(path: &str) -> bool {
    let normalized = normalize_path_string(path);
    normalized.starts_with("/media/")
        || normalized.starts_with("/run/media/")
        || normalized.starts_with("/mnt/")
}

fn device_basename(device: &str) -> String {
    let device = device.trim();
    if device.is_empty() {
        return String::new();
    }

    let mut base = device.to_string();
    if let Some(stripped) = base.strip_suffix(|c: char| c.is_ascii_digit()) {
        base = stripped.to_string();
    }

    if let Some(stripped) = base.strip_suffix('p') {
        if stripped.chars().any(|c| c.is_ascii_digit()) {
            base = stripped.to_string();
        }
    }

    base
}

fn sysfs_removable(device: &str) -> Option<bool> {
    let candidates = [device.to_string(), device_basename(device)]
        .into_iter()
        .filter(|s| !s.is_empty());

    for candidate in candidates {
        let path = Path::new("/sys/class/block").join(&candidate).join("removable");
        if let Ok(contents) = fs::read_to_string(&path) {
            return Some(contents.trim() == "1");
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn read_trimmed_file(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok().map(|value| value.trim().to_string())
}

#[cfg(target_os = "linux")]
fn read_u64_file(path: &Path) -> Option<u64> {
    read_trimmed_file(path)?.parse::<u64>().ok()
}

#[cfg(target_os = "linux")]
fn linux_device_total_space(device: &str) -> Option<u64> {
    let base = Path::new("/sys/class/block").join(device);
    let sectors = read_u64_file(&base.join("size"))?;
    let block_size = read_u64_file(&base.join("queue/logical_block_size")).unwrap_or(512);
    Some(sectors.saturating_mul(block_size))
}

#[cfg(target_os = "linux")]
fn linux_mount_info(device: &str) -> Option<(String, String)> {
    let mounts = fs::read_to_string("/proc/mounts").ok()?;
    let device_variants = [
        format!("/dev/{}", device),
        device.to_string(),
    ];

    for line in mounts.lines() {
        let mut parts = line.split_whitespace();
        let source = parts.next()?;
        let mount_point = parts.next()?;
        let fs_type = parts.next().unwrap_or("unknown");

        if device_variants.iter().any(|candidate| source == candidate) {
            return Some((mount_point.to_string(), fs_type.to_string()));
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn linux_existing_device_names(drives: &[SystemDrive]) -> HashSet<String> {
    drives
        .iter()
        .flat_map(|drive| {
            let raw = drive.name.trim().to_string();
            let mount = drive.mount_point.trim().to_string();
            let mut names = Vec::new();

            if !raw.is_empty() {
                names.push(normalize_path_string(&device_basename(&raw)));
                names.push(normalize_path_string(&raw));
            }

            if !mount.is_empty() {
                names.push(normalize_path_string(&mount));
            }

            names
        })
        .filter(|value| !value.is_empty())
        .collect()
}

#[cfg(target_os = "linux")]
fn collect_linux_removable_drives(drives: &mut Vec<SystemDrive>) {
    let seen = linux_existing_device_names(drives);
    let Ok(entries) = fs::read_dir("/sys/class/block") else {
        return;
    };

    for entry in entries.flatten() {
        let device_name = entry.file_name().to_string_lossy().to_string();
        if device_name.is_empty() || seen.contains(&normalize_path_string(&device_name)) {
            continue;
        }

        let device_path = entry.path();
        if device_path.join("partition").exists() {
            continue;
        }

        let removable = read_trimmed_file(&device_path.join("removable")).map_or(false, |value| value == "1");
        if !removable {
            continue;
        }

        let (mount_point, file_system) = linux_mount_info(&device_name)
            .unwrap_or_else(|| (String::new(), String::from("unknown")));
        let total_space = linux_device_total_space(&device_name).unwrap_or(0);
        let available_space = if mount_point.is_empty() {
            0
        } else {
            get_disk_space(&mount_point).map(|info| info.available).unwrap_or(0)
        };

        drives.push(SystemDrive {
            name: format!("/dev/{}", device_name),
            mount_point,
            total_space,
            available_space,
            file_system,
            is_removable: true,
            is_read_only: false,
            smart_status: String::from("Unknown"),
        });
    }
}

fn is_root_mount(path: &str) -> bool {
    let normalized = normalize_path_string(path);
    if normalized == "/" {
        return true;
    }

    #[cfg(target_os = "windows")]
    {
        normalized.len() == 3 && normalized.ends_with(":/")
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

pub fn get_disk_space(target_path: &str) -> Option<DiskSpaceInfo> {
    let disks = Disks::new_with_refreshed_list();
    let target = Path::new(target_path);

    let mut best_match: Option<(&sysinfo::Disk, usize)> = None;

    
    for disk in disks.iter() {
        let mount = disk.mount_point();
        if target.starts_with(mount) {
            let match_len = mount.to_string_lossy().len();
            if best_match.map_or(true, |(_, len)| match_len > len) {
                best_match = Some((disk, match_len));
            }
        }
    }

    if let Some((disk, _)) = best_match {
        return Some(DiskSpaceInfo {
            total: disk.total_space(),
            available: disk.available_space(),
        });
    }

    if let Some(disk) = disks.iter().next() {
        return Some(DiskSpaceInfo {
            total: disk.total_space(),
            available: disk.available_space(),
        });
    }

    None
}

pub fn get_system_drives() -> Vec<SystemDrive> {
    let disks = Disks::new_with_refreshed_list();
    let mut drives = Vec::new();

    for disk in disks.iter() {
        let raw_name = disk.name().to_string_lossy().to_string();
        let mount_str = disk.mount_point().to_string_lossy().to_string();
        let file_system = disk.file_system().to_string_lossy().to_string();
        let is_removable = sysfs_removable(&raw_name).unwrap_or_else(|| disk.is_removable());

        let name = if raw_name.trim().is_empty() {
            if mount_str == "/" {
                "Root Drive (/)"
            } else {
                &mount_str
            }
            .to_string()
        } else {
            raw_name
        };

        if is_pseudo_filesystem(&file_system) {
            continue;
        }

        let external_like = is_removable || is_external_mount(&mount_str);
        let keep = external_like || is_root_mount(&mount_str);

        if !keep || (!external_like && is_sensitive_mount_point(&mount_str)) {
            continue;
        }

        drives.push(SystemDrive {
            name,
            mount_point: mount_str.clone(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            file_system,
            is_removable: external_like,
            is_read_only: disk.is_read_only(),
            smart_status: get_disk_smart_status(&mount_str),
        });
    }

    #[cfg(target_os = "linux")]
    collect_linux_removable_drives(&mut drives);

    drives.sort_by(|a, b| {
        a.is_removable
            .cmp(&b.is_removable)
            .then_with(|| a.mount_point.cmp(&b.mount_point))
    });

    drives
}

pub fn list_directory_entries(target_path: &str) -> Result<Vec<DirectoryEntry>, String> {
    let path = Path::new(target_path);
    if !path.exists() {
        return Err(format!("Target path does not exist: {}", target_path));
    }

    if !path.is_dir() {
        return Err(format!("Target path is not a directory: {}", target_path));
    }

    let mut entries = Vec::new();

    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let entry_path: PathBuf = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        let file_type = entry.file_type().map_err(|err| err.to_string())?;
        let is_directory = file_type.is_dir();
        let size = if is_directory {
            0
        } else {
            entry.metadata().map(|meta| meta.len()).unwrap_or(0)
        };

        entries.push(DirectoryEntry {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_directory,
            size,
        });
    }

    entries.sort_by(|a, b| {
        b.size
            .cmp(&a.size)
            .then_with(|| b.is_directory.cmp(&a.is_directory))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

pub fn has_full_disk_access() -> bool {
    crate::platform::has_full_disk_access()
}

pub fn get_user_folders(app: &tauri::AppHandle) -> Vec<UserFolder> {
    crate::platform::get_user_folders(app)
}

pub fn get_system_root_folders() -> Vec<UserFolder> {
    crate::platform::get_system_root_folders()
}

pub fn assemble_user_folders(standard_paths: Vec<(String, PathBuf)>) -> Vec<UserFolder> {
    let mut all_paths = Vec::new();
    // Add standard ones that exist
    for (name, path) in standard_paths.clone() {
        if path.exists() && path.is_dir() {
            all_paths.push((name, path));
        }
    }

    // Scan home directory for all other non-hidden directories
    let home_res = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from);

    if let Ok(home_path) = home_res {
        if let Ok(entries) = fs::read_dir(&home_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name_str) = path.file_name().and_then(|n| n.to_str()) {
                        // Skip hidden directories (starting with '.')
                        if name_str.starts_with('.') {
                            continue;
                        }
                        // Skip if it's already in the standard paths
                        let is_standard = standard_paths.iter().any(|(_, sp)| {
                            if let (Ok(p1), Ok(p2)) = (path.canonicalize(), sp.canonicalize()) {
                                p1 == p2
                            } else {
                                false
                            }
                        });
                        if !is_standard {
                            all_paths.push((name_str.to_string(), path));
                        }
                    }
                }
            }
        }
    }

    collect_user_folders(all_paths)
}

pub fn collect_user_folders(all_paths: Vec<(String, PathBuf)>) -> Vec<UserFolder> {
    all_paths
        .into_par_iter()
        .map(|(name, path_buf)| {
            UserFolder {
                name,
                path: path_buf.to_string_lossy().to_string(),
                exists: true,
                size: None,
            }
        })
        .collect()
}

pub fn get_dir_size_parallel(path: &Path) -> u64 {
    if !path.exists() || !path.is_dir() {
        return 0;
    }

    if crate::platform::is_dir_size_parallel_excluded(&path.to_string_lossy()) {
        return 0;
    }

    let mut size: u64 = 0;
    let mut dirs = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_symlink() {
                    continue;
                }
                if ft.is_dir() {
                    dirs.push(entry.path());
                } else if let Ok(meta) = entry.metadata() {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::MetadataExt;
                        let physical = meta.blocks().saturating_mul(512);
                        size += std::cmp::min(meta.len(), physical);
                    }
                    #[cfg(not(unix))]
                    {
                        size += meta.len();
                    }
                }
            }
        }
    }

    let sub_size: u64 = dirs.into_par_iter().map(|p| get_dir_size_parallel(&p)).sum();
    size + sub_size
}

#[allow(unused_variables)]
fn get_disk_smart_status(mount_point: &str) -> String {
    crate::platform::get_disk_smart_status(mount_point)
}

