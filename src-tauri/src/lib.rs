pub mod commands;
pub mod models;
pub mod services;
pub mod platform;

pub use models::FileNode;
pub use services::ScanCache;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ScanCache::new())
        .manage(crate::services::monitor::MonitorState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Show App", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide App", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&show_item, &hide_item, &separator, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new();
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Initialize background monitoring loop
            let app_handle = app.handle().clone();
            let monitor_state = app_handle.state::<crate::services::monitor::MonitorState>();
            monitor_state.initialize_downloads(&app_handle);

            tauri::async_runtime::spawn(async move {
                // Initial sleep to let app startup settle
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                loop {
                    let state = app_handle.state::<crate::services::monitor::MonitorState>();
                    let settings = state.settings.lock().unwrap().clone();

                    if settings.disk_monitor {
                        let _ = crate::services::monitor::run_disk_space_check(&app_handle).await;
                    }

                    if settings.malware_monitor {
                        let _ = crate::services::monitor::run_malware_check(&app_handle).await;
                    }

                    // Poll every 5 minutes
                    tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<crate::services::monitor::MonitorState>();
                let settings = state.settings.lock().unwrap().clone();
                if settings.system_tray {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
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
            commands::open_in_terminal,
            commands::apply_background_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
