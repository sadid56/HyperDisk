use std::sync::Mutex;
use std::collections::HashSet;
use tauri::Manager;

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct MonitorSettings {
    pub auto_start: bool,
    pub system_tray: bool,
    pub disk_monitor: bool,
    pub malware_monitor: bool,
}

impl Default for MonitorSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            system_tray: true,
            disk_monitor: true,
            malware_monitor: true,
        }
    }
}

pub struct MonitorState {
    pub settings: Mutex<MonitorSettings>,
    pub analyzed_downloads: Mutex<HashSet<String>>,
}

impl MonitorState {
    pub fn new() -> Self {
        Self {
            settings: Mutex::new(MonitorSettings::default()),
            analyzed_downloads: Mutex::new(HashSet::new()),
        }
    }

    // Populate initial download files list on startup to avoid spamming alerts for existing files
    pub fn initialize_downloads(&self, app: &tauri::AppHandle) {
        if let Ok(downloads_path) = app.path().download_dir() {
            if let Ok(entries) = std::fs::read_dir(downloads_path) {
                let mut analyzed = self.analyzed_downloads.lock().unwrap();
                for entry in entries.flatten() {
                    let path_str = entry.path().to_string_lossy().into_owned();
                    analyzed.insert(path_str);
                }
            }
        }
    }
}

pub async fn run_disk_space_check(_app: &tauri::AppHandle) -> Result<(), String> {
    let drives = crate::services::get_system_drives();
    let primary = drives.iter().find(|d| d.mount_point == "/" || d.mount_point.to_lowercase().starts_with("c:"));
    
    if let Some(drive) = primary {
        let total = drive.total_space;
        let free = drive.available_space;
        if total > 0 {
            let pct = (free as f64 / total as f64) * 100.0;
            // Send warning if drive space is below 10% OR under 5 GB (5,000,000,000 bytes)
            if pct < 10.0 || free < 5_000_000_000 {
                let free_gb = free as f64 / 1_000_000_000.0;
                let _ = notify_rust::Notification::new()
                    .summary("Low Disk Space Alert")
                    .body(&format!(
                        "Your main disk is running low on space! Only {:.1} GB ({:.1}%) remaining. Open HyperDisk to clean up junk.",
                        free_gb, pct
                    ))
                    .show();
            }
        }
    }
    Ok(())
}

pub async fn run_malware_check(app: &tauri::AppHandle) -> Result<(), String> {
    if let Ok(downloads_path) = app.path().download_dir() {
        if let Ok(entries) = std::fs::read_dir(downloads_path) {
            let state = app.state::<MonitorState>();
            let mut analyzed = state.analyzed_downloads.lock().unwrap();
            
            for entry in entries.flatten() {
                let path = entry.path();
                let path_str = path.to_string_lossy().into_owned();
                
                if !analyzed.contains(&path_str) {
                    analyzed.insert(path_str.clone());
                    
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        let name_lower = file_name.to_lowercase();
                        
                        let is_suspicious = {
                            // Rule 1: Double extension (e.g. invoice.pdf.exe, update.dmg.sh)
                            let parts: Vec<&str> = file_name.split('.').collect();
                            let double_ext = if parts.len() >= 3 {
                                let last = parts[parts.len() - 1];
                                let mid = parts[parts.len() - 2];
                                let execs = ["exe", "msi", "sh", "bat", "cmd", "pkg", "dmg", "app"];
                                let documents = ["pdf", "doc", "docx", "xls", "xlsx", "zip", "tar", "gz"];
                                execs.contains(&last) && documents.contains(&mid)
                            } else {
                                false
                            };

                            // Rule 2: Fake system update tools or helpers spoofing extension names
                            let system_spoof = name_lower.contains("system_update") 
                                || name_lower.contains("security_patch")
                                || name_lower.contains("helper_tool");
                            
                            double_ext || system_spoof
                        };

                        if is_suspicious {
                            let _ = notify_rust::Notification::new()
                                .summary("⚠️ Suspicious File Detected")
                                .body(&format!(
                                    "HyperDisk found a potentially dangerous file in your Downloads: \"{}\". We recommend scanning it.",
                                    file_name
                                ))
                                .show();
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
