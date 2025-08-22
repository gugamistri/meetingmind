//! Tauri command handlers for audio operations

use std::sync::{Arc, Mutex};
use tauri::{State, AppHandle, Window, Emitter};
use serde::{Serialize, Deserialize};
use tracing::{info, error, debug};

use crate::audio::{
    AudioCaptureService, AudioDevice, AudioCaptureStatus, AudioStats,
    AudioConfig, AudioFormat, AudioError
};

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
) -> Result<(), String> {
    info!("Initializing audio service");
    
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    if audio_service_guard.is_some() {
        debug!("Audio service already initialized");
        return Ok(());
    }
    
    match AudioCaptureService::new() {
        Ok(service) => {
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
    
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(service) => {
            match service.get_input_devices().await {
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
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
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
    
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_mut() {
        Some(service) => {
            // Update configuration if provided
            if let Some(config) = request.config {
                service.set_config(config.into());
            }
            
            // Switch device if specified
            if let Some(device_name) = request.device_name {
                if let Err(e) = service.switch_device(&device_name).await {
                    error!("Failed to switch audio device: {}", e);
                    return Err(format!("Failed to switch audio device: {}", e));
                }
            }
            
            // Start capture
            match service.start_capture().await {
                Ok(()) => {
                    info!("Audio capture started successfully");
                    
                    // Start event broadcasting
                    start_audio_event_broadcasting(service, &app_handle).await;
                    
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to start audio capture: {}", e);
                    Err(format!("Failed to start audio capture: {}", e))
                }
            }
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
}

/// Stop audio capture
#[tauri::command]
pub async fn stop_audio_capture(
    audio_state: State<'_, AudioServiceState>,
) -> Result<(), String> {
    info!("Stopping audio capture");
    
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_mut() {
        Some(service) => {
            match service.stop_capture().await {
                Ok(()) => {
                    info!("Audio capture stopped successfully");
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to stop audio capture: {}", e);
                    Err(format!("Failed to stop audio capture: {}", e))
                }
            }
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
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
    
    let mut audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_mut() {
        Some(service) => {
            match service.switch_device(&device_name).await {
                Ok(()) => {
                    info!("Audio device switched successfully");
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to switch audio device: {}", e);
                    Err(format!("Failed to switch audio device: {}", e))
                }
            }
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
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
    
    let audio_service_guard = audio_state.lock()
        .map_err(|e| format!("Failed to acquire audio service lock: {}", e))?;
    
    match audio_service_guard.as_ref() {
        Some(service) => {
            // Refresh devices
            if let Err(e) = service.refresh_devices().await {
                error!("Failed to refresh devices: {}", e);
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
                    
                    Ok(devices)
                }
                Err(e) => {
                    error!("Failed to get updated device list: {}", e);
                    Err(format!("Failed to get updated device list: {}", e))
                }
            }
        }
        None => {
            error!("Audio service not initialized");
            Err("Audio service not initialized".to_string())
        }
    }
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