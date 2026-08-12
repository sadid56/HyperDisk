use crate::services::trash;

#[tauri::command]
pub fn check_is_protected_path(target_path: String) -> bool {
    trash::is_protected_system_path(&target_path)
}

#[tauri::command]
pub fn check_full_disk_access() -> bool {
    crate::services::has_full_disk_access()
}

#[tauri::command]
pub fn request_full_disk_access(app: tauri::AppHandle) -> Result<(), String> {
    crate::platform::request_full_disk_access(&app)
}
