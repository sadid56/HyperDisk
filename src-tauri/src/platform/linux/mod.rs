use std::path::{Path, PathBuf};
use crate::models::UserFolder;
use std::collections::HashSet;
use std::fs;
use tauri::Manager;
use crate::models::SystemDrive;

pub fn has_full_disk_access() -> bool {
    true
}

pub fn request_full_disk_access(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

pub fn open_in_terminal(dir_path: &str) -> Result<(), String> {
    if let Ok(env_term) = std::env::var("TERMINAL") {
        if !env_term.trim().is_empty() {
            if let Ok(status) = std::process::Command::new(&env_term)
                .current_dir(dir_path)
                .status()
            {
                if status.success() {
                    return Ok(());
                }
            }
        }
    }

    if let Ok(status) = std::process::Command::new("xdg-terminal-exec")
        .current_dir(dir_path)
        .status()
    {
        if status.success() {
            return Ok(());
        }
    }

    if std::process::Command::new("sensible-terminal")
        .current_dir(dir_path)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    if std::process::Command::new("x-terminal-emulator")
        .current_dir(dir_path)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    let fallback_terminals = [
        "ptyxis",
        "gnome-terminal",
        "konsole",
        "xfce4-terminal",
        "alacritty",
        "kitty",
        "foot",
        "terminator",
        "tilix",
        "xterm",
    ];

    for term in fallback_terminals.iter() {
        if std::process::Command::new(term)
            .current_dir(dir_path)
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
    }

    Err("Failed to open terminal: Could not launch system terminal emulator".to_string())
}

pub fn reveal_in_folder(target_path: &str) -> Result<(), String> {
    let path = Path::new(target_path);
    let dir = if path.is_dir() {
        target_path
    } else {
        path.parent()
            .map(|p| p.to_str().unwrap_or("."))
            .unwrap_or(".")
    };

    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_disk_smart_status(_mount_point: &str) -> String {
    "Unknown".to_string()
}

pub fn is_dir_size_parallel_excluded(_path_str: &str) -> bool {
    false
}

pub fn is_tcc_protected_folder(_path: &str) -> bool {
    false
}

// Linux-specific drive discovery helpers
pub fn read_trimmed_file(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok().map(|value| value.trim().to_string())
}

pub fn read_u64_file(path: &Path) -> Option<u64> {
    read_trimmed_file(path)?.parse::<u64>().ok()
}

pub fn linux_device_total_space(device: &str) -> Option<u64> {
    let base = Path::new("/sys/class/block").join(device);
    let sectors = read_u64_file(&base.join("size"))?;
    let block_size = read_u64_file(&base.join("queue/logical_block_size")).unwrap_or(512);
    Some(sectors.saturating_mul(block_size))
}

pub fn linux_mount_info(device: &str) -> Option<(String, String)> {
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

fn normalize_path_string(path: &str) -> String {
    let mut normalized = path.trim().replace('\\', "/").to_lowercase();
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

pub fn linux_existing_device_names(drives: &[SystemDrive]) -> HashSet<String> {
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

pub fn collect_linux_removable_drives(drives: &mut Vec<SystemDrive>) {
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
            crate::services::disk::get_disk_space(&mount_point).map(|info| info.available).unwrap_or(0)
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

pub fn get_user_folders(app: &tauri::AppHandle) -> Vec<UserFolder> {
    let mut standard_paths = Vec::new();
    standard_paths.push(("Applications".to_string(), PathBuf::from("/Applications")));

    if let Ok(p) = app.path().document_dir() { standard_paths.push(("Documents".to_string(), p)); }
    if let Ok(p) = app.path().download_dir() { standard_paths.push(("Downloads".to_string(), p)); }
    if let Ok(p) = app.path().desktop_dir() { standard_paths.push(("Desktop".to_string(), p)); }
    if let Ok(p) = app.path().picture_dir() { standard_paths.push(("Pictures".to_string(), p)); }
    if let Ok(p) = app.path().video_dir()   { standard_paths.push(("Movies".to_string(), p)); }
    if let Ok(p) = app.path().audio_dir()   { standard_paths.push(("Music".to_string(), p)); }

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
