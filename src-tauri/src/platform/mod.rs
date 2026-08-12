pub mod linux;
pub mod macos;
pub mod windows;

#[cfg(target_os = "linux")]
use linux as os;
#[cfg(target_os = "macos")]
use macos as os;
#[cfg(target_os = "windows")]
use windows as os;

pub fn has_full_disk_access() -> bool {
    os::has_full_disk_access()
}

pub fn request_full_disk_access(app: &tauri::AppHandle) -> Result<(), String> {
    os::request_full_disk_access(app)
}

pub fn open_in_terminal(dir_path: &str) -> Result<(), String> {
    os::open_in_terminal(dir_path)
}

pub fn reveal_in_folder(target_path: &str) -> Result<(), String> {
    os::reveal_in_folder(target_path)
}

pub fn get_disk_smart_status(mount_point: &str) -> String {
    os::get_disk_smart_status(mount_point)
}

pub fn get_user_folders(app: &tauri::AppHandle) -> Vec<crate::models::UserFolder> {
    os::get_user_folders(app)
}

pub fn get_system_root_folders() -> Vec<crate::models::UserFolder> {
    os::get_system_root_folders()
}

pub fn is_dir_size_parallel_excluded(path_str: &str) -> bool {
    os::is_dir_size_parallel_excluded(path_str)
}

pub fn is_tcc_protected_folder(path: &str) -> bool {
    os::is_tcc_protected_folder(path)
}
