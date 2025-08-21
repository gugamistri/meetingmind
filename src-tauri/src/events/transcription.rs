//! Real-time transcription events for frontend communication

use crate::transcription::types::{TranscriptionChunk, SessionId};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tracing::{debug, error};
use uuid::Uuid;

/// Events emitted by the transcription system
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum TranscriptionEvent {
    /// New transcription chunk available
    TranscriptionChunk {
        session_id: SessionId,
        chunk: TranscriptionChunkData,
    },
    /// Transcription session started
    SessionStarted {
        session_id: SessionId,
        timestamp: String,
    },
    /// Transcription session stopped
    SessionStopped {
        session_id: SessionId,
        timestamp: String,
        total_chunks: u32,
    },
    /// Processing status update
    ProcessingStatus {
        session_id: SessionId,
        status: ProcessingStatusData,
    },
    /// Confidence score update
    ConfidenceUpdate {
        session_id: SessionId,
        confidence: f32,
        threshold: f32,
    },
    /// Error occurred during transcription
    TranscriptionError {
        session_id: Option<SessionId>,
        error: String,
        timestamp: String,
    },
    /// Model status update
    ModelStatus {
        model: String,
        status: ModelStatusData,
    },
}

/// Serializable transcription chunk data for events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionChunkData {
    pub id: String,
    pub text: String,
    pub confidence: f32,
    pub language: String,
    pub start_time_ms: u64,
    pub end_time_ms: u64,
    pub word_count: u32,
    pub processing_time_ms: u32,
    pub processed_locally: bool,
    pub model_used: String,
}

impl From<TranscriptionChunk> for TranscriptionChunkData {
    fn from(chunk: TranscriptionChunk) -> Self {
        Self {
            id: chunk.id.to_string(),
            text: chunk.text,
            confidence: chunk.confidence,
            language: chunk.language.to_string(),
            start_time_ms: chunk.start_time.as_millis() as u64,
            end_time_ms: chunk.end_time.as_millis() as u64,
            word_count: chunk.word_count,
            processing_time_ms: chunk.processing_time_ms,
            processed_locally: chunk.processed_locally,
            model_used: chunk.model_used,
        }
    }
}

/// Processing status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingStatusData {
    pub queue_size: usize,
    pub processing_chunk_id: Option<String>,
    pub processing_mode: String, // "local", "cloud", "hybrid"
    pub latency_ms: Option<u32>,
}

/// Model status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatusData {
    pub loaded: bool,
    pub loading: bool,
    pub error: Option<String>,
    pub memory_usage_mb: Option<u32>,
}

/// Event emitter for transcription events
pub struct TranscriptionEventEmitter {
    app_handle: AppHandle,
}

impl TranscriptionEventEmitter {
    /// Create a new event emitter
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Emit a transcription chunk event
    pub fn emit_transcription_chunk(&self, session_id: SessionId, chunk: TranscriptionChunk) {
        let event = TranscriptionEvent::TranscriptionChunk {
            session_id: session_id.clone(),
            chunk: TranscriptionChunkData::from(chunk),
        };

        self.emit_event("transcription-chunk", &event);
        debug!("Emitted transcription chunk event for session: {}", session_id);
    }

    /// Emit session started event
    pub fn emit_session_started(&self, session_id: SessionId) {
        let event = TranscriptionEvent::SessionStarted {
            session_id: session_id.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        self.emit_event("transcription-session-started", &event);
        debug!("Emitted session started event: {}", session_id);
    }

    /// Emit session stopped event
    pub fn emit_session_stopped(&self, session_id: SessionId, total_chunks: u32) {
        let event = TranscriptionEvent::SessionStopped {
            session_id: session_id.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            total_chunks,
        };

        self.emit_event("transcription-session-stopped", &event);
        debug!("Emitted session stopped event: {} ({} chunks)", session_id, total_chunks);
    }

    /// Emit processing status update
    pub fn emit_processing_status(&self, session_id: SessionId, status: ProcessingStatusData) {
        let event = TranscriptionEvent::ProcessingStatus {
            session_id: session_id.clone(),
            status,
        };

        self.emit_event("transcription-processing-status", &event);
        debug!("Emitted processing status for session: {}", session_id);
    }

    /// Emit confidence update
    pub fn emit_confidence_update(&self, session_id: SessionId, confidence: f32, threshold: f32) {
        let event = TranscriptionEvent::ConfidenceUpdate {
            session_id: session_id.clone(),
            confidence,
            threshold,
        };

        self.emit_event("transcription-confidence-update", &event);
        debug!("Emitted confidence update for session: {} ({:.2})", session_id, confidence);
    }

    /// Emit transcription error
    pub fn emit_transcription_error(&self, session_id: Option<SessionId>, error: String) {
        let event = TranscriptionEvent::TranscriptionError {
            session_id: session_id.clone(),
            error: error.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        self.emit_event("transcription-error", &event);
        error!("Emitted transcription error for session {:?}: {}", session_id, error);
    }

    /// Emit model status update
    pub fn emit_model_status(&self, model: String, status: ModelStatusData) {
        let event = TranscriptionEvent::ModelStatus {
            model: model.clone(),
            status,
        };

        self.emit_event("transcription-model-status", &event);
        debug!("Emitted model status for: {}", model);
    }

    /// Generic event emission
    fn emit_event(&self, event_name: &str, event_data: &TranscriptionEvent) {
        if let Err(e) = self.app_handle.emit_all(event_name, event_data) {
            error!("Failed to emit transcription event '{}': {}", event_name, e);
        }
    }

    /// Emit heartbeat to indicate service is alive
    pub fn emit_heartbeat(&self, session_id: SessionId) {
        let heartbeat_data = serde_json::json!({
            "session_id": session_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "service": "transcription"
        });

        if let Err(e) = self.app_handle.emit_all("transcription-heartbeat", heartbeat_data) {
            error!("Failed to emit transcription heartbeat: {}", e);
        }
    }

    /// Emit batch of transcription chunks for efficiency
    pub fn emit_transcription_batch(&self, session_id: SessionId, chunks: Vec<TranscriptionChunk>) {
        if chunks.is_empty() {
            return;
        }

        let chunk_data: Vec<TranscriptionChunkData> = chunks
            .into_iter()
            .map(TranscriptionChunkData::from)
            .collect();

        let batch_event = serde_json::json!({
            "session_id": session_id,
            "chunks": chunk_data,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "count": chunk_data.len()
        });

        if let Err(e) = self.app_handle.emit_all("transcription-chunk-batch", batch_event) {
            error!("Failed to emit transcription batch: {}", e);
        } else {
            debug!("Emitted batch of {} transcription chunks for session: {}", chunk_data.len(), session_id);
        }
    }
}

/// Event listener trait for transcription events
pub trait TranscriptionEventListener {
    /// Handle new transcription chunk
    fn on_transcription_chunk(&self, session_id: &str, chunk: &TranscriptionChunkData);
    
    /// Handle session started
    fn on_session_started(&self, session_id: &str);
    
    /// Handle session stopped
    fn on_session_stopped(&self, session_id: &str, total_chunks: u32);
    
    /// Handle processing status update
    fn on_processing_status(&self, session_id: &str, status: &ProcessingStatusData);
    
    /// Handle confidence update
    fn on_confidence_update(&self, session_id: &str, confidence: f32, threshold: f32);
    
    /// Handle transcription error
    fn on_transcription_error(&self, session_id: Option<&str>, error: &str);
    
    /// Handle model status update
    fn on_model_status(&self, model: &str, status: &ModelStatusData);
}

/// Event filtering for selective subscriptions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionEventFilter {
    /// Only emit events for specific sessions
    pub session_ids: Option<Vec<SessionId>>,
    /// Minimum confidence threshold for chunk events
    pub min_confidence: Option<f32>,
    /// Only emit events for specific models
    pub models: Option<Vec<String>>,
    /// Rate limiting: maximum events per second
    pub max_events_per_second: Option<u32>,
}

impl Default for TranscriptionEventFilter {
    fn default() -> Self {
        Self {
            session_ids: None,
            min_confidence: None,
            models: None,
            max_events_per_second: Some(10), // Default rate limit
        }
    }
}

/// Filtered event emitter that respects subscription preferences
pub struct FilteredTranscriptionEventEmitter {
    emitter: TranscriptionEventEmitter,
    filter: TranscriptionEventFilter,
    last_emit_time: std::sync::Arc<std::sync::Mutex<std::time::Instant>>,
}

impl FilteredTranscriptionEventEmitter {
    /// Create a new filtered event emitter
    pub fn new(app_handle: AppHandle, filter: TranscriptionEventFilter) -> Self {
        Self {
            emitter: TranscriptionEventEmitter::new(app_handle),
            filter,
            last_emit_time: std::sync::Arc::new(std::sync::Mutex::new(std::time::Instant::now())),
        }
    }

    /// Emit transcription chunk with filtering
    pub fn emit_transcription_chunk(&self, session_id: SessionId, chunk: TranscriptionChunk) {
        // Check session filter
        if let Some(ref allowed_sessions) = self.filter.session_ids {
            if !allowed_sessions.contains(&session_id) {
                return;
            }
        }

        // Check confidence filter
        if let Some(min_confidence) = self.filter.min_confidence {
            if chunk.confidence < min_confidence {
                return;
            }
        }

        // Check model filter
        if let Some(ref allowed_models) = self.filter.models {
            if !allowed_models.contains(&chunk.model_used) {
                return;
            }
        }

        // Check rate limiting
        if let Some(max_rate) = self.filter.max_events_per_second {
            let mut last_time = self.last_emit_time.lock().unwrap();
            let now = std::time::Instant::now();
            let time_since_last = now.duration_since(*last_time);
            let min_interval = std::time::Duration::from_millis(1000 / max_rate as u64);
            
            if time_since_last < min_interval {
                return; // Rate limited
            }
            
            *last_time = now;
        }

        self.emitter.emit_transcription_chunk(session_id, chunk);
    }

    /// Update filter settings
    pub fn update_filter(&mut self, filter: TranscriptionEventFilter) {
        self.filter = filter;
        debug!("Updated transcription event filter");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transcription::types::{LanguageCode, TranscriptionChunk};
    use std::time::Duration;

    #[test]
    fn test_transcription_chunk_data_conversion() {
        let chunk = TranscriptionChunk::new(
            "test_session".to_string(),
            "Hello world".to_string(),
            0.95,
            LanguageCode::En,
            Duration::from_secs(0),
            Duration::from_secs(2),
            "whisper-tiny".to_string(),
            150,
            true,
        );

        let chunk_data = TranscriptionChunkData::from(chunk.clone());
        
        assert_eq!(chunk_data.id, chunk.id.to_string());
        assert_eq!(chunk_data.text, "Hello world");
        assert_eq!(chunk_data.confidence, 0.95);
        assert_eq!(chunk_data.language, "en");
        assert_eq!(chunk_data.start_time_ms, 0);
        assert_eq!(chunk_data.end_time_ms, 2000);
        assert_eq!(chunk_data.word_count, 2);
        assert_eq!(chunk_data.processing_time_ms, 150);
        assert!(chunk_data.processed_locally);
        assert_eq!(chunk_data.model_used, "whisper-tiny");
    }

    #[test]
    fn test_event_filter() {
        let filter = TranscriptionEventFilter {
            session_ids: Some(vec!["session1".to_string(), "session2".to_string()]),
            min_confidence: Some(0.8),
            models: Some(vec!["whisper-base".to_string()]),
            max_events_per_second: Some(5),
        };

        assert!(filter.session_ids.as_ref().unwrap().contains(&"session1".to_string()));
        assert_eq!(filter.min_confidence.unwrap(), 0.8);
        assert_eq!(filter.max_events_per_second.unwrap(), 5);
    }

    #[test]
    fn test_processing_status_data() {
        let status = ProcessingStatusData {
            queue_size: 3,
            processing_chunk_id: Some("chunk-123".to_string()),
            processing_mode: "hybrid".to_string(),
            latency_ms: Some(250),
        };

        assert_eq!(status.queue_size, 3);
        assert_eq!(status.processing_chunk_id.as_ref().unwrap(), "chunk-123");
        assert_eq!(status.processing_mode, "hybrid");
        assert_eq!(status.latency_ms.unwrap(), 250);
    }

    #[test]
    fn test_model_status_data() {
        let status = ModelStatusData {
            loaded: true,
            loading: false,
            error: None,
            memory_usage_mb: Some(128),
        };

        assert!(status.loaded);
        assert!(!status.loading);
        assert!(status.error.is_none());
        assert_eq!(status.memory_usage_mb.unwrap(), 128);
    }
}