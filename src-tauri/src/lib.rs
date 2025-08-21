// Core modules
pub mod audio;
pub mod transcription;
pub mod storage;
pub mod meeting;
pub mod ai;
pub mod security;
pub mod integrations;
pub mod events;
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
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(commands::transcription::TranscriptionState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Transcription commands
            commands::initialize_transcription_service,
            commands::start_transcription,
            commands::stop_transcription,
            commands::process_audio_chunk,
            commands::get_transcription_config,
            commands::update_transcription_config,
            commands::get_confidence_threshold,
            commands::is_transcription_ready,
            commands::get_available_models,
            commands::get_supported_languages,
            commands::transcription_health_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}