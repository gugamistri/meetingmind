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
pub mod search;


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

    // Initialize database pool
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    let database_manager = rt.block_on(async {
        storage::DatabaseManager::new().await
            .expect("Failed to initialize database")
    });
    let db_pool = database_manager.pool().clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(db_pool)
        .manage(commands::transcription::TranscriptionState::default())
        .manage(commands::audio::AudioServiceState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            // App commands
            commands::get_app_info,
            commands::health_check,
            // Meeting commands
            commands::get_dashboard_data,
            commands::create_meeting,
            commands::get_meeting_detail,
            commands::update_meeting,
            commands::delete_meeting,
            commands::duplicate_meeting,
            commands::archive_meeting,
            commands::update_transcription_segment,
            commands::update_speaker_assignment,
            commands::get_meeting_transcription,
            commands::create_speaker,
            commands::update_speaker,
            commands::delete_speaker,
            commands::generate_meeting_summary,
            commands::export_meeting,
            commands::show_in_folder,
            // Audio commands
            commands::init_audio_service,
            commands::get_audio_input_devices,
            commands::start_audio_capture,
            commands::stop_audio_capture,
            commands::get_audio_capture_status,
            commands::get_audio_levels,
            commands::get_audio_stats,
            commands::set_audio_device,
            commands::get_audio_config,
            commands::set_audio_config,
            commands::refresh_audio_devices,
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
            // Audio permission commands
            commands::check_audio_permissions,
            commands::request_audio_permissions,
            // Audio transcription integration commands
            commands::set_audio_transcription_enabled,
            commands::is_audio_transcription_enabled,
            // Search commands
            commands::search_meetings,
            commands::search_within_meeting,
            commands::get_search_suggestions,
            commands::save_search_query,
            commands::get_saved_searches,
            commands::delete_saved_search,
            commands::use_saved_search,
            commands::get_search_history,
            commands::clear_search_history,
            commands::export_search_results,
            commands::rebuild_search_indexes,
            // Tagging commands
            commands::add_meeting_tag,
            commands::remove_meeting_tag,
            commands::get_all_tags,
            commands::get_meeting_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}