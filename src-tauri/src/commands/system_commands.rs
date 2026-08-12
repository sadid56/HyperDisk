use crate::services::trash;
use crate::services::monitor::{MonitorState, MonitorSettings};
use tauri::State;

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

#[tauri::command]
pub fn apply_background_settings(
    state: State<'_, MonitorState>,
    settings: MonitorSettings,
) -> Result<(), String> {
    {
        let mut monitor_settings = state.settings.lock().unwrap();
        *monitor_settings = settings.clone();
    }

    // Set autostart registry/plist/desktop shortcut
    crate::platform::toggle_autostart("HyperDisk", settings.auto_start)?;

    Ok(())
}
