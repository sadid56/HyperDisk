use crate::models::{
    DirectoryEntry, DiskSpaceInfo, SystemDrive, UserFolder, LargeFile, CleanupSuggestion, DuplicateGroup
};
use crate::services::{
    get_disk_space, get_system_drives, get_user_folders, list_directory_entries,
    get_large_files, get_cleanup_suggestions, get_duplicate_files, perform_system_cleanup,
    get_cleanup_details, search_system_directory, get_system_root_folders,
};

#[tauri::command]
pub async fn execute_system_cleanup(app: tauri::AppHandle, id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        perform_system_cleanup(&app, id)
    })
    .await
    .map_err(|e| format!("Tokio task join error: {}", e))?
}

#[tauri::command]
pub fn fetch_cleanup_details(app: tauri::AppHandle, id: String) -> Vec<DirectoryEntry> {
    get_cleanup_details(&app, &id)
}

#[tauri::command]
pub fn search_system(app: tauri::AppHandle, query: String) -> Vec<DirectoryEntry> {
    search_system_directory(&app, &query)
}

#[tauri::command]
pub fn get_disk_info(target_path: String) -> Option<DiskSpaceInfo> {
    get_disk_space(&target_path)
}

#[tauri::command]
pub fn fetch_system_drives() -> Vec<SystemDrive> {
    get_system_drives()
}

#[tauri::command]
pub async fn fetch_user_folders(app: tauri::AppHandle) -> Result<Vec<UserFolder>, String> {
    tokio::task::spawn_blocking(move || {
        get_user_folders(&app)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_system_root_folders() -> Result<Vec<UserFolder>, String> {
    tokio::task::spawn_blocking(move || {
        get_system_root_folders()
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_folder_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        crate::services::get_dir_size_parallel(std::path::Path::new(&path))
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_large_files(app: tauri::AppHandle) -> Result<Vec<LargeFile>, String> {
    tokio::task::spawn_blocking(move || {
        get_large_files(&app)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_cleanup_suggestions(app: tauri::AppHandle) -> Result<Vec<CleanupSuggestion>, String> {
    tokio::task::spawn_blocking(move || {
        get_cleanup_suggestions(&app)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_duplicate_files(app: tauri::AppHandle) -> Result<Vec<DuplicateGroup>, String> {
    tokio::task::spawn_blocking(move || {
        get_duplicate_files(&app)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fetch_directory_entries(target_path: String) -> Result<Vec<DirectoryEntry>, String> {
    list_directory_entries(&target_path)
}

#[tauri::command]
pub fn get_home_folder() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())
}
