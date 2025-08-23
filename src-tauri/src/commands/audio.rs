//! Tauri command handlers for audio operations

use std::sync::{Arc, Mutex};
use tauri::{State, AppHandle, Window, Emitter};
use serde::{Serialize, Deserialize};
use tracing::{info, error, debug, warn};

use crate::audio::{
    AudioCaptureService, AudioDevice, AudioCaptureStatus, AudioStats,
    AudioConfig, AudioFormat, AudioError
};
use crate::transcription::TranscriptionService;
use super::transcription::TranscriptionState;

/// Audio service state managed by Tauri
pub type AudioServiceState = Arc<Mutex<Option<AudioCaptureService>>>;

/// Request to start audio capture
#[derive(Debug, Deserialize)]
pub struct StartCaptureRequest {
    pub device_name: Option<String>,
    pub config: Option<AudioCaptureConfig>,
}

/// Audio configuration for frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioCaptureConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

impl From<AudioCaptureConfig> for AudioConfig {
    fn from(config: AudioCaptureConfig) -> Self {
        Self {
            sample_rate: config.sample_rate,
            channels: config.channels,
            buffer_size: config.buffer_size,
            format: AudioFormat::F32,
        }
    }
}

impl From<AudioConfig> for AudioCaptureConfig {
    fn from(config: AudioConfig) -> Self {
        Self {
            sample_rate: config.sample_rate,
            channels: config.channels,
            buffer_size: config.buffer_size,
        }
    }
}

/// Audio level update event
#[derive(Debug, Serialize, Clone)]
pub struct AudioLevelEvent {
    pub rms_level: f32,
    pub peak_level: f32,
    pub rms_level_db: f32,
    pub timestamp: u64,
}

/// Audio status change event
#[derive(Debug, Serialize, Clone)]
pub struct AudioStatusEvent {
    pub status: AudioCaptureStatus,
    pub timestamp: u64,
}

/// Audio device change event
#[derive(Debug, Serialize, Clone)]
pub struct AudioDeviceChangeEvent {
    pub devices: Vec<AudioDevice>,
    pub timestamp: u64,
}

/// Initialize audio service
#[tauri::command]
pub async fn init_audio_service(
    audio_state: State<'_, AudioServiceState>,
    transcription_state: State<'_, TranscriptionState>,
) -> Result<(), String> {
    info!("Initializing audio service");
    
    // First check if already initialized
    {
        let audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        
        if audio_service_guard.is_some() {
            debug!("Audio service already initialized");
            return Ok(());
        }
    } // Drop the guard before async operations
    
    // Get transcription service without holding audio lock
    let transcription_service = {
        let transcription_service_guard = transcription_state.read().await;
        transcription_service_guard.as_ref().cloned()
    };
    
    // Create audio service
    match AudioCaptureService::new() {
        Ok(mut service) => {
            // Attach transcription service if available
            if let Some(ref transcription_service) = transcription_service {
                service.set_transcription_service(Arc::new(transcription_service.clone()));
                info!("Audio service integrated with transcription service");
            } else {
                info!("Transcription service not available, audio service initialized without transcription");
            }
            
            // Now acquire the lock and set the service
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            info!("Audio service initialized successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to initialize audio service: {}", e);
            Err(format!("Failed to initialize audio service: {}", e))
        }
    }
}

/// Get available audio input devices
#[tauri::command]
pub async fn get_audio_input_devices(
    audio_state: State<'_, AudioServiceState>,
) -> Result<Vec<AudioDevice>, String> {
    debug!("Getting audio input devices");
    
    // Take the service out of the mutex to avoid holding lock across await
    let service = {
        let mut audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        
        match audio_service_guard.take() {
            Some(service) => service,
            None => {
                error!("Audio service not initialized");
                return Err("Audio service not initialized".to_string());
            }
        }
    };
    
    // Get devices without holding the lock
    let result = service.get_input_devices().await;
    
    // Put the service back in the mutex
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    *audio_service_guard = Some(service);
    
    // Return the result
    match result {
        Ok(devices) => {
            info!("Found {} input devices", devices.len());
            Ok(devices)
        }
        Err(e) => {
            error!("Failed to get input devices: {}", e);
            Err(format!("Failed to get input devices: {}", e))
        }
    }
}

/// Start audio capture
#[tauri::command]
pub async fn start_audio_capture(
    request: StartCaptureRequest,
    audio_state: State<'_, AudioServiceState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    info!("Starting audio capture with request: {:?}", request);
    
    // FIRST: Check audio permissions before proceeding
    info!("Checking audio permissions before starting capture");
    let permission_status = check_audio_permissions().await?;
    
    if !permission_status.microphone_allowed || permission_status.needs_permission_request {
        error!("Audio permissions not granted: {:?}", permission_status);
        return Err(format!(
            "Audio permissions required: {}", 
            permission_status.permission_message.unwrap_or(
                "Microphone access is required to start recording. Please grant microphone permissions and try again.".to_string()
            )
        ));
    }
    
    info!("Audio permissions verified, proceeding with capture start");
    
    // We need to refactor the audio service to work without holding locks across awaits
    // For now, implement a simplified version that gets the audio service out of the mutex
    
    let audio_service = {
        let mut audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        
        match audio_service_guard.take() {
            Some(service) => service,
            None => {
                error!("Audio service not initialized");
                return Err("Audio service not initialized".to_string());
            }
        }
    };
    
    // Now we can work with the service without holding the lock
    let mut service = audio_service;
    
    // Update configuration if provided
    if let Some(config) = request.config {
        service.set_config(config.into());
    }
    
    // Switch device if specified
    if let Some(device_name) = request.device_name {
        if let Err(e) = service.switch_device(&device_name).await {
            error!("Failed to switch audio device: {}", e);
            // Put the service back before returning error
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            return Err(format!("Failed to switch audio device: {}", e));
        }
    }
    
    // Start capture
    match service.start_capture().await {
        Ok(()) => {
            info!("Audio capture started successfully");
            
            // Start event broadcasting
            start_audio_event_broadcasting(&mut service, &app_handle).await;
            
            // Put the service back in the mutex
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Ok(())
        }
        Err(e) => {
            error!("Failed to start audio capture: {}", e);
            
            // Put the service back before returning error
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Err(format!("Failed to start audio capture: {}", e))
        }
    }
}

/// Stop audio capture
#[tauri::command]
pub async fn stop_audio_capture(
    audio_state: State<'_, AudioServiceState>,
) -> Result<(), String> {
    info!("Stopping audio capture");
    
    let audio_service = {
        let mut audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        
        match audio_service_guard.take() {
            Some(service) => service,
            None => {
                error!("Audio service not initialized");
                return Err("Audio service not initialized".to_string());
            }
        }
    };
    
    let mut service = audio_service;
    
    match service.stop_capture().await {
        Ok(()) => {
            info!("Audio capture stopped successfully");
            
            // Put the service back in the mutex
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Ok(())
        }
        Err(e) => {
            error!("Failed to stop audio capture: {}", e);
            
            // Put the service back before returning error
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Err(format!("Failed to stop audio capture: {}", e))
        }
    }
}

/// Get current audio capture status
#[tauri::command]
pub async fn get_audio_capture_status(
    audio_state: State<'_, AudioServiceState>,
) -> Result<AudioCaptureStatus, String> {
    debug!("Getting audio capture status");
    
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(service) => {
            Ok(service.status())
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Get current audio levels
#[tauri::command]
pub async fn get_audio_levels(
    audio_state: State<'_, AudioServiceState>,
) -> Result<AudioLevelEvent, String> {
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(service) => {
            Ok(AudioLevelEvent {
                rms_level: service.current_audio_level(),
                peak_level: service.current_peak_level(),
                rms_level_db: service.current_audio_level_db(),
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
            })
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Get audio capture statistics
#[tauri::command]
pub async fn get_audio_stats(
    audio_state: State<'_, AudioServiceState>,
) -> Result<AudioStats, String> {
    debug!("Getting audio statistics");
    
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(service) => {
            Ok(service.get_stats())
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Set audio device
#[tauri::command]
pub async fn set_audio_device(
    device_name: String,
    audio_state: State<'_, AudioServiceState>,
) -> Result<(), String> {
    info!("Setting audio device to: {}", device_name);
    
    // Take the service out of the mutex to avoid holding lock across await
    let audio_service = {
        let mut audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        
        match audio_service_guard.take() {
            Some(service) => service,
            None => {
                error!("Audio service not initialized");
                return Err("Audio service not initialized".to_string());
            }
        }
    };
    
    let mut service = audio_service;
    
    // Switch device without holding the lock
    match service.switch_device(&device_name).await {
        Ok(()) => {
            info!("Audio device switched successfully");
            
            // Put the service back in the mutex
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Ok(())
        }
        Err(e) => {
            error!("Failed to switch audio device: {}", e);
            
            // Put the service back before returning error
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Err(format!("Failed to switch audio device: {}", e))
        }
    }
}

/// Get current audio configuration
#[tauri::command]
pub async fn get_audio_config(
    audio_state: State<'_, AudioServiceState>,
) -> Result<AudioCaptureConfig, String> {
    debug!("Getting audio configuration");
    
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(service) => {
            Ok(service.config().clone().into())
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Update audio configuration
#[tauri::command]
pub async fn set_audio_config(
    config: AudioCaptureConfig,
    audio_state: State<'_, AudioServiceState>,
) -> Result<(), String> {
    info!("Updating audio configuration: {:?}", config);
    
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_mut() {
        Some(service) => {
            service.set_config(config.into());
            info!("Audio configuration updated successfully");
            Ok(())
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Refresh audio device list
#[tauri::command]
pub async fn refresh_audio_devices(
    audio_state: State<'_, AudioServiceState>,
    app_handle: AppHandle,
) -> Result<Vec<AudioDevice>, String> {
    info!("Refreshing audio devices");
    
    // Take the service out of the mutex to avoid holding lock across await
    let audio_service = {
        let mut audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        
        match audio_service_guard.take() {
            Some(service) => service,
            None => {
                error!("Audio service not initialized");
                return Err("Audio service not initialized".to_string());
            }
        }
    };
    
    let service = audio_service;
    
    // Refresh devices without holding the lock
    if let Err(e) = service.refresh_devices().await {
        error!("Failed to refresh devices: {}", e);
        
        // Put the service back before returning error
        let mut audio_service_guard = audio_state.lock()
            .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
        *audio_service_guard = Some(service);
        
        return Err(format!("Failed to refresh devices: {}", e));
    }
    
    // Get updated device list
    match service.get_input_devices().await {
        Ok(devices) => {
            info!("Refreshed {} audio devices", devices.len());
            
            // Emit device change event
            let event = AudioDeviceChangeEvent {
                devices: devices.clone(),
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
            };
            
            if let Err(e) = app_handle.emit("audio_devices_changed", &event) {
                error!("Failed to emit device change event: {}", e);
            }
            
            // Put the service back in the mutex
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Ok(devices)
        }
        Err(e) => {
            error!("Failed to get updated device list: {}", e);
            
            // Put the service back before returning error
            let mut audio_service_guard = audio_state.lock()
                .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
            *audio_service_guard = Some(service);
            
            Err(format!("Failed to get updated device list: {}", e))
        }
    }
}

/// Check audio permissions
// Temporarily disabled due to Send trait issues
// #[tauri::command]
// pub async fn check_audio_permissions() -> Result<AudioPermissionStatus, String> {
//     info!("Checking audio permissions");
//     
//     // For now, return a mock response - this would need platform-specific implementation
//     // On macOS, this would check AVAudioSession and system permissions
//     // On Windows, this would check system microphone access
//     // On Linux, this would check PulseAudio/ALSA permissions
//     
//     let status = AudioPermissionStatus {
//         microphone_allowed: true, // Mock - should check actual permissions
//         system_audio_allowed: true, // Mock - should check actual permissions
//         needs_permission_request: false,
//         permission_message: None,
//     };
//     
//     Ok(status)
// }

/// Request audio permissions
// Temporarily disabled due to Send trait issues
// #[tauri::command]
// pub async fn request_audio_permissions() -> Result<AudioPermissionStatus, String> {
//     info!("Requesting audio permissions");
//     
//     // For now, return a mock response - this would need platform-specific implementation
//     // On macOS, this would trigger AVAudioSession permission request
//     // On Windows, this would guide user to system settings
//     // On Linux, this would check and potentially configure audio access
//     
//     let status = AudioPermissionStatus {
//         microphone_allowed: true, // Mock - should request and check actual permissions
//         system_audio_allowed: true, // Mock - should request and check actual permissions
//         needs_permission_request: false,
//         permission_message: Some("Audio permissions granted successfully".to_string()),
//     };
//     
//     Ok(status)
// }

/// Audio permission status structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPermissionStatus {
    pub microphone_allowed: bool,
    pub system_audio_allowed: bool,
    pub needs_permission_request: bool,
    pub permission_message: Option<String>,
}

/// Check audio permissions
#[tauri::command]
pub async fn check_audio_permissions() -> Result<AudioPermissionStatus, String> {
    info!("Checking audio permissions");
    
    let mut microphone_allowed = false;
    let mut system_audio_allowed = false;
    let mut needs_permission_request = false;
    let mut permission_message = None;
    
    // Try to create an audio service to test device access
    match crate::audio::AudioCaptureService::new() {
        Ok(service) => {
            // Try to get input devices to test microphone access
            match service.get_input_devices().await {
                Ok(devices) => {
                    if devices.is_empty() {
                        microphone_allowed = false;
                        needs_permission_request = true;
                        permission_message = Some("No audio input devices found. Please connect a microphone or check your audio device settings.".to_string());
                        info!("No audio input devices found");
                    } else {
                        // Found devices, but we need to test if we can actually access them
                        let available_devices: Vec<_> = devices.iter().filter(|d| d.is_available).collect();
                        
                        if available_devices.is_empty() {
                            microphone_allowed = false;
                            needs_permission_request = true;
                            permission_message = Some(format!(
                                "Found {} audio devices but none are available. Please grant microphone permissions in System Preferences.",
                                devices.len()
                            ));
                            info!("Found {} devices but none are available", devices.len());
                        } else {
                            microphone_allowed = true;
                            info!("Found {} available input devices", available_devices.len());
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to get input devices: {}", e);
                    microphone_allowed = false;
                    needs_permission_request = true;
                    
                    // Provide more specific error messages based on error type
                    let error_string = format!("{}", e);
                    if error_string.contains("permission") || error_string.contains("denied") {
                        permission_message = Some("Microphone access denied. Please grant microphone permissions in System Preferences > Security & Privacy > Microphone.".to_string());
                    } else if error_string.contains("device") || error_string.contains("not found") {
                        permission_message = Some("No audio devices found. Please connect a microphone and check your audio settings.".to_string());
                    } else {
                        permission_message = Some(format!("Audio system error: {}. Please check your audio device settings.", e));
                    }
                }
            }
            
            // For system audio, we assume it's available if microphone is available
            // In a real implementation, this would check for system audio capture permissions
            system_audio_allowed = microphone_allowed;
        }
        Err(e) => {
            error!("Failed to create audio service: {}", e);
            microphone_allowed = false;
            system_audio_allowed = false;
            needs_permission_request = true;
            permission_message = Some(format!("Failed to initialize audio system: {}. Please restart the application and check your audio device settings.", e));
        }
    }
    
    let status = AudioPermissionStatus {
        microphone_allowed,
        system_audio_allowed,
        needs_permission_request,
        permission_message,
    };
    
    info!("Audio permission status: microphone_allowed={}, needs_permission_request={}", 
          status.microphone_allowed, status.needs_permission_request);
    Ok(status)
}

/// Request audio permissions
#[tauri::command]
pub async fn request_audio_permissions() -> Result<AudioPermissionStatus, String> {
    info!("Requesting audio permissions");
    
    // On macOS, attempting to access audio devices will automatically trigger permission request
    // On Windows, this would guide user to system settings
    // On Linux, this would check and potentially configure audio access
    
    // The most effective way to trigger permission dialogs is to actually try to create an audio stream
    let mut permission_granted = false;
    let mut permission_message = None;
    
    match crate::audio::AudioCaptureService::new() {
        Ok(mut service) => {
            info!("Created audio service, attempting to start capture to trigger permissions");
            
            // Try to start capture briefly to trigger permission dialog
            match service.start_capture().await {
                Ok(()) => {
                    info!("Successfully started capture - permissions granted");
                    permission_granted = true;
                    
                    // Stop capture immediately since this is just for permission testing
                    if let Err(e) = service.stop_capture().await {
                        warn!("Failed to stop test capture: {}", e);
                    }
                    
                    permission_message = Some("Audio permissions granted successfully".to_string());
                }
                Err(e) => {
                    error!("Failed to start test capture: {}", e);
                    
                    // Check the specific error to provide better feedback
                    let error_string = format!("{}", e);
                    if error_string.contains("permission") || error_string.contains("denied") {
                        permission_message = Some("Microphone permission denied. Please go to System Preferences > Security & Privacy > Microphone and enable access for this application.".to_string());
                    } else if error_string.contains("device") || error_string.contains("not found") {
                        permission_message = Some("No audio devices available. Please connect a microphone and try again.".to_string());
                    } else {
                        permission_message = Some(format!("Audio access failed: {}. Please check your microphone settings.", e));
                    }
                }
            }
        }
        Err(e) => {
            error!("Failed to create audio service for permission request: {}", e);
            permission_message = Some(format!("Failed to initialize audio system: {}. Please restart the application.", e));
        }
    }
    
    // Wait a moment to allow system dialogs to complete
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Re-check permissions after potential system dialog
    let final_status = check_audio_permissions().await?;
    
    // If we got explicit permission feedback, use that message
    if let Some(msg) = permission_message {
        return Ok(AudioPermissionStatus {
            microphone_allowed: permission_granted || final_status.microphone_allowed,
            system_audio_allowed: permission_granted || final_status.system_audio_allowed,
            needs_permission_request: !permission_granted && final_status.needs_permission_request,
            permission_message: Some(msg),
        });
    }
    
    Ok(final_status)
}

/// Start broadcasting audio events to the frontend
async fn start_audio_event_broadcasting(
    service: &mut AudioCaptureService,
    app_handle: &AppHandle,
) {
    let mut status_rx = service.subscribe_status();
    let mut level_rx = service.subscribe_levels();
    
    let app_handle_status = app_handle.clone();
    let app_handle_level = app_handle.clone();
    
    // Spawn status event broadcaster
    tokio::spawn(async move {
        while let Ok(status) = status_rx.recv().await {
            let event = AudioStatusEvent {
                status,
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
            };
            
            if let Err(e) = app_handle_status.emit("audio_status_changed", &event) {
                error!("Failed to emit status change event: {}", e);
            }
        }
    });
    
    // Spawn level event broadcaster
    tokio::spawn(async move {
        let mut last_emit = std::time::Instant::now();
        const LEVEL_UPDATE_INTERVAL: std::time::Duration = std::time::Duration::from_millis(50); // 20fps
        
        while let Ok(rms_level) = level_rx.recv().await {
            // Throttle level updates to avoid overwhelming the frontend
            if last_emit.elapsed() >= LEVEL_UPDATE_INTERVAL {
                let event = AudioLevelEvent {
                    rms_level,
                    peak_level: rms_level, // For now, use RMS as peak
                    rms_level_db: if rms_level > 0.0 {
                        20.0 * rms_level.log10()
                    } else {
                        -100.0
                    },
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                };
                
                if let Err(e) = app_handle_level.emit("audio_level_update", &event) {
                    error!("Failed to emit level update event: {}", e);
                } else {
                    last_emit = std::time::Instant::now();
                }
            }
        }
    });
}

/// Enable or disable transcription during audio capture
#[tauri::command]
pub async fn set_audio_transcription_enabled(
    enabled: bool,
    audio_state: State<'_, AudioServiceState>,
) -> Result<(), String> {
    info!("Setting audio transcription enabled: {}", enabled);
    
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_mut() {
        Some(service) => {
            service.set_transcription_enabled(enabled);
            Ok(())
        }
        None => {
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Get transcription status for audio capture
#[tauri::command]
pub async fn is_audio_transcription_enabled(
    audio_state: State<'_, AudioServiceState>,
) -> Result<bool, String> {
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(_service) => {
            // For now, assume transcription is enabled if service exists
            // TODO: Add getter method to AudioCaptureService to check transcription status
            Ok(true)
        }
        None => {
            Ok(false)
        }
    }
}