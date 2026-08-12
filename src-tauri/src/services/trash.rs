use std::path::Path;

const PROTECTED_SYSTEM_PATHS: &[&str] = &[
    "/",
    "/System",
    "/Library",
    "/Applications",
    "/bin",
    "/sbin",
    "/usr",
    "/var",
    "/private",
    "/dev",
    "/proc",
    "/sys",
    "/etc",
    "/tmp",
    "/boot",
    "C:\\",
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\System Volume Information",
];

pub fn normalize_path(path_str: &str) -> String {
    let mut s = path_str.trim().replace('\\', "/").to_lowercase();
    while s.len() > 1 && s.ends_with('/') {
        s.pop();
    }
    s
}

pub fn is_protected_system_path(target_path: &str) -> bool {
    let target = normalize_path(target_path);
    PROTECTED_SYSTEM_PATHS.iter().any(|&prot| {
        let p = normalize_path(prot);
        target == p
    })
}

pub fn delete_item(target_path: &str) -> Result<(), String> {
    if is_protected_system_path(target_path) {
        return Err(format!(
            "Cannot move system directory to Trash: {}",
            target_path
        ));
    }

    let path = Path::new(target_path);
    if !path.exists() {
        return Err(format!("Target path does not exist: {}", target_path));
    }

    trash::delete(path).map_err(|e| format!("Failed to move to trash: {}", e))
}

pub fn reveal_in_folder(target_path: &str) -> Result<(), String> {
    let path = Path::new(target_path);
    if !path.exists() {
        return Err(format!("Target path does not exist: {}", target_path));
    }

    crate::platform::reveal_in_folder(target_path)
}

pub fn create_folder(parent_path: &str, folder_name: &str) -> Result<String, String> {
    let parent = Path::new(parent_path);
    if !parent.exists() || !parent.is_dir() {
        return Err(format!("Parent directory does not exist: {}", parent_path));
    }

    let new_folder_path = parent.join(folder_name);
    if new_folder_path.exists() {
        return Err(format!("Folder already exists: {:?}", new_folder_path));
    }

    std::fs::create_dir_all(&new_folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(new_folder_path.to_string_lossy().to_string())
}
