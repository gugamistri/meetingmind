//! Tauri commands for transcription functionality

use crate::transcription::{
    TranscriptionService,
    types::{TranscriptionConfig, TranscriptionChunk, TranscriptionResult, LanguageCode, WhisperModel, ProcessingMode},
};
use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

/// Global transcription service state
pub type TranscriptionState = Arc<RwLock<Option<TranscriptionService>>>;

/// Request to start transcription
#[derive(Debug, Deserialize)]
pub struct StartTranscriptionRequest {
    pub session_id: String,
    pub config: Option<TranscriptionConfigDto>,
}

/// Request to process audio chunk
#[derive(Debug, Deserialize)]
pub struct ProcessAudioRequest {
    pub audio_data: Vec<f32>,
    pub sample_rate: u32,
}

/// Request to update configuration
#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub config: TranscriptionConfigDto,
}

/// DTO for transcription configuration (frontend-friendly)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionConfigDto {
    pub language: String,
    pub model: String,
    pub mode: String,
    pub confidence_threshold: f32,
    pub real_time_streaming: bool,
    pub chunk_size_seconds: f32,
    pub chunk_overlap_seconds: f32,
    pub max_latency_ms: u32,
}

impl From<TranscriptionConfigDto> for TranscriptionConfig {
    fn from(dto: TranscriptionConfigDto) -> Self {
        Self {
            language: match dto.language.as_str() {
                "en" => LanguageCode::En,
                "pt" => LanguageCode::Pt,
                _ => LanguageCode::Auto,
            },
            model: match dto.model.as_str() {
                "tiny" => WhisperModel::Tiny,
                "base" => WhisperModel::Base,
                "small" => WhisperModel::Small,
                _ => WhisperModel::Tiny,
            },
            mode: match dto.mode.as_str() {
                "local" => ProcessingMode::LocalOnly,
                "cloud" => ProcessingMode::CloudOnly,
                "hybrid" => ProcessingMode::Hybrid,
                _ => ProcessingMode::Hybrid,
            },
            confidence_threshold: dto.confidence_threshold.clamp(0.0, 1.0),
            real_time_streaming: dto.real_time_streaming,
            chunk_size_seconds: dto.chunk_size_seconds.max(1.0),
            chunk_overlap_seconds: dto.chunk_overlap_seconds.max(0.0),
            max_latency_ms: dto.max_latency_ms.max(100),
        }
    }
}

impl From<TranscriptionConfig> for TranscriptionConfigDto {
    fn from(config: TranscriptionConfig) -> Self {
        Self {
            language: config.language.to_string(),
            model: match config.model {
                WhisperModel::Tiny => "tiny".to_string(),
                WhisperModel::Base => "base".to_string(),
                WhisperModel::Small => "small".to_string(),
            },
            mode: match config.mode {
                ProcessingMode::LocalOnly => "local".to_string(),
                ProcessingMode::CloudOnly => "cloud".to_string(),
                ProcessingMode::Hybrid => "hybrid".to_string(),
            },
            confidence_threshold: config.confidence_threshold,
            real_time_streaming: config.real_time_streaming,
            chunk_size_seconds: config.chunk_size_seconds,
            chunk_overlap_seconds: config.chunk_overlap_seconds,
            max_latency_ms: config.max_latency_ms,
        }
    }
}

/// DTO for transcription chunk (frontend-friendly)
#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionChunkDto {
    pub id: String,
    pub session_id: String,
    pub text: String,
    pub confidence: f32,
    pub language: String,
    pub start_time_ms: u64,
    pub end_time_ms: u64,
    pub word_count: u32,
    pub model_used: String,
    pub processing_time_ms: u32,
    pub processed_locally: bool,
    pub created_at: String,
}

impl From<TranscriptionChunk> for TranscriptionChunkDto {
    fn from(chunk: TranscriptionChunk) -> Self {
        Self {
            id: chunk.id.to_string(),
            session_id: chunk.session_id,
            text: chunk.text,
            confidence: chunk.confidence,
            language: chunk.language.to_string(),
            start_time_ms: chunk.start_time.as_millis() as u64,
            end_time_ms: chunk.end_time.as_millis() as u64,
            word_count: chunk.word_count,
            model_used: chunk.model_used,
            processing_time_ms: chunk.processing_time_ms,
            processed_locally: chunk.processed_locally,
            created_at: chunk.created_at.to_rfc3339(),
        }
    }
}

/// Initialize transcription service
#[tauri::command]
pub async fn initialize_transcription_service(
    transcription_state: State<'_, TranscriptionState>,
) -> Result<()> {
    info!("Initializing transcription service");
    
    let service = TranscriptionService::new().await
        .map_err(|e| AppError::transcription(format!("Failed to initialize transcription service: {}", e)))?;
    
    let mut state = transcription_state.write().await;
    *state = Some(service);
    
    info!("Transcription service initialized successfully");
    Ok(())
}

/// Start transcription for a session
#[tauri::command]
pub async fn start_transcription(
    request: StartTranscriptionRequest,
    transcription_state: State<'_, TranscriptionState>,
) -> Result<()> {
    debug!("Starting transcription for session: {}", request.session_id);
    
    let state = transcription_state.read().await;
    let service = state.as_ref().ok_or_else(|| {
        AppError::transcription("Transcription service not initialized")
    })?;
    
    // Update config if provided
    if let Some(config_dto) = request.config {
        let config = TranscriptionConfig::from(config_dto);
        service.update_config(config).await
            .map_err(|e| AppError::transcription(format!("Failed to update config: {}", e)))?;
    }
    
    service.start_session(&request.session_id).await
        .map_err(|e| AppError::transcription(format!("Failed to start session: {}", e)))?;
    
    info!("Transcription started for session: {}", request.session_id);
    Ok(())
}

/// Stop transcription
#[tauri::command]
pub async fn stop_transcription(
    transcription_state: State<'_, TranscriptionState>,
) -> Result<()> {
    debug!("Stopping transcription");
    
    let state = transcription_state.read().await;
    let service = state.as_ref().ok_or_else(|| {
        AppError::transcription("Transcription service not initialized")
    })?;
    
    service.stop_session().await
        .map_err(|e| AppError::transcription(format!("Failed to stop session: {}", e)))?;
    
    info!("Transcription stopped");
    Ok(())
}

/// Process audio chunk
#[tauri::command]
pub async fn process_audio_chunk(
    request: ProcessAudioRequest,
    transcription_state: State<'_, TranscriptionState>,
) -> Result<Vec<TranscriptionChunkDto>> {
    debug!("Processing audio chunk: {} samples at {}Hz", request.audio_data.len(), request.sample_rate);
    
    let state = transcription_state.read().await;
    let service = state.as_ref().ok_or_else(|| {
        AppError::transcription("Transcription service not initialized")
    })?;
    
    let chunks = service.process_audio_chunk(&request.audio_data, request.sample_rate).await
        .map_err(|e| AppError::transcription(format!("Failed to process audio: {}", e)))?;
    
    let chunk_dtos: Vec<TranscriptionChunkDto> = chunks
        .into_iter()
        .map(TranscriptionChunkDto::from)
        .collect();
    
    debug!("Processed audio chunk, got {} transcription chunks", chunk_dtos.len());
    Ok(chunk_dtos)
}

/// Get current transcription configuration
#[tauri::command]
pub async fn get_transcription_config(
    transcription_state: State<'_, TranscriptionState>,
) -> Result<TranscriptionConfigDto> {
    debug!("Getting transcription configuration");
    
    let state = transcription_state.read().await;
    let _service = state.as_ref().ok_or_else(|| {
        AppError::transcription("Transcription service not initialized")
    })?;
    
    // Return default config for now (in full implementation, this would come from the service)
    let config = TranscriptionConfig::default();
    Ok(TranscriptionConfigDto::from(config))
}

/// Update transcription configuration
#[tauri::command]
pub async fn update_transcription_config(
    request: UpdateConfigRequest,
    transcription_state: State<'_, TranscriptionState>,
) -> Result<()> {
    debug!("Updating transcription configuration");
    
    let state = transcription_state.read().await;
    let service = state.as_ref().ok_or_else(|| {
        AppError::transcription("Transcription service not initialized")
    })?;
    
    let config = TranscriptionConfig::from(request.config);
    service.update_config(config).await
        .map_err(|e| AppError::transcription(format!("Failed to update config: {}", e)))?;
    
    info!("Transcription configuration updated");
    Ok(())
}

/// Get confidence threshold
#[tauri::command]
pub async fn get_confidence_threshold(
    transcription_state: State<'_, TranscriptionState>,
) -> Result<f32> {
    debug!("Getting confidence threshold");
    
    let state = transcription_state.read().await;
    let service = state.as_ref().ok_or_else(|| {
        AppError::transcription("Transcription service not initialized")
    })?;
    
    let threshold = service.get_confidence_threshold().await;
    Ok(threshold)
}

/// Check if transcription service is ready
#[tauri::command]
pub async fn is_transcription_ready(
    transcription_state: State<'_, TranscriptionState>,
) -> Result<bool> {
    let state = transcription_state.read().await;
    match state.as_ref() {
        Some(_service) => {
            // In full implementation, check if service is actually ready
            Ok(true)
        }
        None => Ok(false),
    }
}

/// Get available models
#[tauri::command]
pub async fn get_available_models() -> std::result::Result<Vec<String>, String> {
    debug!("Getting available models");
    
    // Return list of supported models
    let models = vec![
        "tiny".to_string(),
        "base".to_string(),
        "small".to_string(),
    ];
    
    Ok(models)
}

/// Get supported languages
#[tauri::command]
pub async fn get_supported_languages() -> std::result::Result<Vec<String>, String> {
    debug!("Getting supported languages");
    
    // Return list of supported languages
    let languages = vec![
        "auto".to_string(),
        "en".to_string(),
        "pt".to_string(),
    ];
    
    Ok(languages)
}

/// Health check for transcription service
#[tauri::command]
pub async fn transcription_health_check(
    transcription_state: State<'_, TranscriptionState>,
) -> std::result::Result<serde_json::Value, String> {
    debug!("Performing transcription health check");
    
    let state = transcription_state.read().await;
    let is_initialized = state.is_some();
    
    let health_info = serde_json::json!({
        "service_initialized": is_initialized,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "version": env!("CARGO_PKG_VERSION"),
    });
    
    Ok(health_info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_dto_conversion() {
        let dto = TranscriptionConfigDto {
            language: "en".to_string(),
            model: "base".to_string(),
            mode: "hybrid".to_string(),
            confidence_threshold: 0.8,
            real_time_streaming: true,
            chunk_size_seconds: 25.0,
            chunk_overlap_seconds: 3.0,
            max_latency_ms: 2000,
        };
        
        let config = TranscriptionConfig::from(dto.clone());
        assert_eq!(config.language, LanguageCode::En);
        assert_eq!(config.model, WhisperModel::Base);
        assert_eq!(config.mode, ProcessingMode::Hybrid);
        assert_eq!(config.confidence_threshold, 0.8);
        
        let dto_back = TranscriptionConfigDto::from(config);
        assert_eq!(dto_back.language, dto.language);
        assert_eq!(dto_back.model, dto.model);
        assert_eq!(dto_back.mode, dto.mode);
    }

    #[tokio::test]
    async fn test_transcription_state() {
        let state: TranscriptionState = Arc::new(RwLock::new(None));
        
        // Initially no service
        {
            let read_state = state.read().await;
            assert!(read_state.is_none());
        }
        
        // Can write to state
        {
            let mut write_state = state.write().await;
            *write_state = None; // Just testing the structure
        }
    }
}