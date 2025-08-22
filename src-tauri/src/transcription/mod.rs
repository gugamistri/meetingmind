//! Transcription and speech-to-text processing
//!
//! This module provides the core transcription pipeline for MeetingMind,
//! supporting both local Whisper models via ONNX Runtime and cloud API fallback.

pub mod models;
pub mod pipeline;
pub mod types;
pub mod whisper;

#[cfg(feature = "cloud-apis")]
pub mod cloud;

#[cfg(test)]
mod tests;

// Re-export key types and services
pub use models::ModelManager;
pub use pipeline::TranscriptionPipeline;
pub use types::*;
pub use whisper::WhisperProcessor;

#[cfg(feature = "cloud-apis")]
pub use cloud::CloudProcessor;

use crate::error::Result;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Main transcription service coordinating all transcription operations
pub struct TranscriptionService {
    pipeline: Arc<RwLock<TranscriptionPipeline>>,
    model_manager: Arc<ModelManager>,
}

impl TranscriptionService {
    /// Create a new transcription service
    pub async fn new() -> Result<Self> {
        let model_manager = Arc::new(ModelManager::new().await?);
        let pipeline = Arc::new(RwLock::new(
            TranscriptionPipeline::new(model_manager.clone()).await?
        ));
        
        Ok(Self {
            pipeline,
            model_manager,
        })
    }
    
    /// Start transcription processing for a meeting session
    pub async fn start_session(&self, session_id: &str) -> Result<()> {
        let mut pipeline = self.pipeline.write().await;
        pipeline.start_session(session_id).await.map_err(Into::into)
    }
    
    /// Stop transcription processing
    pub async fn stop_session(&self) -> Result<()> {
        let mut pipeline = self.pipeline.write().await;
        pipeline.stop_session().await.map_err(Into::into)
    }
    
    /// Process audio chunk and return transcription
    pub async fn process_audio_chunk(
        &self,
        audio_data: &[f32],
        sample_rate: u32,
    ) -> Result<Vec<TranscriptionChunk>> {
        let pipeline = self.pipeline.read().await;
        pipeline.process_audio_chunk(audio_data, sample_rate).await.map_err(Into::into)
    }
    
    /// Get transcription confidence threshold
    pub async fn get_confidence_threshold(&self) -> f32 {
        let pipeline = self.pipeline.read().await;
        pipeline.get_confidence_threshold().await
    }
    
    /// Update transcription configuration
    pub async fn update_config(&self, config: TranscriptionConfig) -> Result<()> {
        let mut pipeline = self.pipeline.write().await;
        pipeline.update_config(config).await.map_err(Into::into)
    }
}