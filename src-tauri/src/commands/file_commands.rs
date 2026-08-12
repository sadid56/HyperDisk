use crate::services::trash;

#[tauri::command]
pub async fn delete_target_item(target_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        trash::delete_item(&target_path)
    })
    .await
    .map_err(|e| format!("Tokio task join error: {}", e))?
}

#[tauri::command]
pub async fn delete_item_permanently(target_path: String) -> Result<(), String> {
    if crate::services::trash::is_protected_system_path(&target_path) {
        return Err("Cannot delete system directory permanently".to_string());
    }
    tokio::task::spawn_blocking(move || {
        let path = std::path::Path::new(&target_path);
        if !path.exists() {
            return Err("Target path does not exist".to_string());
        }
        if path.is_dir() {
            std::fs::remove_dir_all(path).map_err(|e| format!("Failed to delete folder: {}", e))
        } else {
            std::fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))
        }
    })
    .await
    .map_err(|e| format!("Tokio task join error: {}", e))?
}

#[tauri::command]
pub fn reveal_target_item(target_path: String) -> Result<(), String> {
    trash::reveal_in_folder(&target_path)
}

#[tauri::command]
pub fn create_new_folder(parent_path: String, folder_name: String) -> Result<String, String> {
    trash::create_folder(&parent_path, &folder_name)
}

#[tauri::command]
pub fn open_in_terminal(target_path: String) -> Result<(), String> {
    let dir_path = {
        let p = std::path::Path::new(&target_path);
        if p.is_dir() {
            target_path.clone()
        } else {
            p.parent()
                .map(|pp| pp.to_string_lossy().to_string())
                .unwrap_or(target_path.clone())
        }
    };

    crate::platform::open_in_terminal(&dir_path)
}
