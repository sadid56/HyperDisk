pub mod commands;
pub mod models;
pub mod services;
pub mod platform;

pub use models::FileNode;
pub use services::ScanCache;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ScanCache::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder,
            commands::scan_folder_live,
            commands::scan_directory_shallow,
            commands::resolve_node_path,
            commands::get_disk_info,
            commands::fetch_system_drives,
            commands::fetch_user_folders,
            commands::fetch_system_root_folders,
            commands::fetch_folder_size,
            commands::fetch_large_files,
            commands::fetch_cleanup_suggestions,
            commands::fetch_duplicate_files,
            commands::execute_system_cleanup,
            commands::fetch_cleanup_details,
            commands::search_system,
            commands::fetch_directory_entries,
            commands::get_home_folder,
            commands::delete_target_item,
            commands::delete_item_permanently,
            commands::reveal_target_item,
            commands::create_new_folder,
            commands::check_is_protected_path,
            commands::check_full_disk_access,
            commands::request_full_disk_access,
            commands::open_in_terminal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
