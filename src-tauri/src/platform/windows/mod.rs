use std::path::PathBuf;
use crate::models::UserFolder;
use std::fs;
use tauri::Manager;

pub fn has_full_disk_access() -> bool {
    true
}

pub fn request_full_disk_access(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

pub fn open_in_terminal(dir_path: &str) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/c", "start", "cmd", "/k", &format!("cd /d \"{}\"", dir_path)])
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;
    Ok(())
}

pub fn reveal_in_folder(target_path: &str) -> Result<(), String> {
    std::process::Command::new("explorer")
        .args(["/select,", target_path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_disk_smart_status(_mount_point: &str) -> String {
    let output = std::process::Command::new("powershell")
        .args(["-Command", "Get-WmiObject -Namespace root\\wmi -Class MSStorageDriver_FailurePredictStatus | Select-Object -ExpandProperty PredictFailure"])
        .output();
    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
        if stdout == "false" {
            return "Verified".to_string();
        } else if stdout == "true" {
            return "Failing".to_string();
        }
    }
    "Unknown".to_string()
}

pub fn is_dir_size_parallel_excluded(_path_str: &str) -> bool {
    false
}

pub fn is_tcc_protected_folder(_path: &str) -> bool {
    false
}

pub fn get_user_folders(app: &tauri::AppHandle) -> Vec<UserFolder> {
    let mut standard_paths = Vec::new();
    standard_paths.push(("Applications".to_string(), PathBuf::from("C:\\Program Files")));

    if let Ok(p) = app.path().document_dir() { standard_paths.push(("Documents".to_string(), p)); }
    if let Ok(p) = app.path().download_dir() { standard_paths.push(("Downloads".to_string(), p)); }
    if let Ok(p) = app.path().desktop_dir() { standard_paths.push(("Desktop".to_string(), p)); }
    if let Ok(p) = app.path().picture_dir() { standard_paths.push(("Pictures".to_string(), p)); }
    if let Ok(p) = app.path().video_dir()   { standard_paths.push(("Movies".to_string(), p)); }
    if let Ok(p) = app.path().audio_dir()   { standard_paths.push(("Music".to_string(), p)); }

    crate::services::disk::assemble_user_folders(standard_paths)
}

pub fn get_system_root_folders() -> Vec<UserFolder> {
    let root_path = PathBuf::from("C:\\");
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
                    if name_lower.starts_with('$')
                        || name_lower == "system volume information"
                        || name_lower == "documents and settings"
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
