// Disable these modules temporarily for basic testing
// pub mod audio;
// pub mod transcription;
// pub mod storage;
// pub mod meeting;
// pub mod ai;
// pub mod security;
// pub mod integrations;
// pub mod events;
pub mod config;
pub mod commands;
pub mod error;


// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}