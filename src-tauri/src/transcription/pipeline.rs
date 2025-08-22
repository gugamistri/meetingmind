//! Main transcription processing pipeline
//!
//! This module coordinates the complete transcription workflow, managing
//! audio chunking, processing, confidence evaluation, and result streaming.

use crate::transcription::models::ModelManager;
use crate::transcription::types::{
    Result, SessionId, TranscriptionChunk, TranscriptionConfig, TranscriptionError,
    TranscriptionResult,
};
use crate::transcription::whisper::WhisperProcessor;

#[cfg(feature = "cloud-apis")]
use crate::transcription::cloud::CloudProcessor;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, RwLock};
use tokio::time::timeout;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Audio chunk for processing
#[derive(Debug, Clone)]
pub struct AudioChunk {
    /// Unique identifier for this chunk
    pub id: Uuid,
    /// Session this chunk belongs to
    pub session_id: SessionId,
    /// Audio data (16kHz mono f32 samples)
    pub data: Vec<f32>,
    /// Sample rate of the audio
    pub sample_rate: u32,
    /// Start time relative to session start
    pub start_time: Duration,
    /// End time relative to session start
    pub end_time: Duration,
    /// Chunk sequence number
    pub sequence: u32,
}

/// Processing status for a chunk
#[derive(Debug, Clone)]
pub enum ChunkProcessingStatus {
    /// Chunk is queued for processing
    Queued,
    /// Chunk is being processed locally
    ProcessingLocal,
    /// Chunk is being processed via cloud API
    ProcessingCloud,
    /// Chunk processing completed successfully
    Completed(TranscriptionChunk),
    /// Chunk processing failed
    Failed(String),
}

/// Active transcription session
#[derive(Debug)]
pub struct TranscriptionSession {
    /// Session identifier
    pub id: SessionId,
    /// Session configuration
    pub config: TranscriptionConfig,
    /// Start time of the session
    pub start_time: Instant,
    /// Current chunk sequence number
    pub sequence: u32,
    /// Total chunks processed
    pub chunks_processed: u32,
    /// Total processing time
    pub total_processing_time: Duration,
    /// Session result accumulator
    pub result: TranscriptionResult,
}

impl TranscriptionSession {
    /// Create a new transcription session
    pub fn new(id: SessionId, config: TranscriptionConfig) -> Self {
        Self {
            id: id.clone(),
            config,
            start_time: Instant::now(),
            sequence: 0,
            chunks_processed: 0,
            total_processing_time: Duration::ZERO,
            result: TranscriptionResult::new(id),
        }
    }

    /// Get next chunk sequence number
    pub fn next_sequence(&mut self) -> u32 {
        self.sequence += 1;
        self.sequence
    }

    /// Record chunk processing completion
    pub fn record_chunk_processed(&mut self, processing_time: Duration) {
        self.chunks_processed += 1;
        self.total_processing_time += processing_time;
    }

    /// Add transcription chunk to result
    pub fn add_chunk(&mut self, chunk: TranscriptionChunk) {
        self.result.add_chunk(chunk);
    }

    /// Get session duration
    pub fn duration(&self) -> Duration {
        self.start_time.elapsed()
    }

    /// Complete the session
    pub fn complete(&mut self) {
        self.result.complete();
    }
}

/// Main transcription processing pipeline
pub struct TranscriptionPipeline {
    /// Local Whisper processor
    whisper_processor: Arc<WhisperProcessor>,
    
    /// Cloud processor (optional)
    #[cfg(feature = "cloud-apis")]
    cloud_processor: Option<Arc<CloudProcessor>>,
    
    /// Active sessions
    sessions: Arc<RwLock<HashMap<SessionId, TranscriptionSession>>>,
    
    /// Processing queue
    processing_queue: Arc<RwLock<Vec<AudioChunk>>>,
    
    /// Current configuration
    config: Arc<RwLock<TranscriptionConfig>>,
    
    /// Processing status tracker
    chunk_status: Arc<RwLock<HashMap<Uuid, ChunkProcessingStatus>>>,
    
    /// Result sender for real-time streaming
    result_sender: Option<mpsc::UnboundedSender<TranscriptionChunk>>,
}

impl TranscriptionPipeline {
    /// Create a new transcription pipeline
    pub async fn new(model_manager: Arc<ModelManager>) -> Result<Self> {
        info!("Initializing transcription pipeline");
        
        let whisper_processor = Arc::new(WhisperProcessor::new(model_manager).await?);
        
        // Initialize with default model
        whisper_processor
            .initialize_model(Default::default())
            .await?;

        Ok(Self {
            whisper_processor,
            #[cfg(feature = "cloud-apis")]
            cloud_processor: None,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            processing_queue: Arc::new(RwLock::new(Vec::new())),
            config: Arc::new(RwLock::new(TranscriptionConfig::default())),
            chunk_status: Arc::new(RwLock::new(HashMap::new())),
            result_sender: None,
        })
    }

    /// Start a new transcription session
    pub async fn start_session(&mut self, session_id: &str) -> Result<()> {
        info!("Starting transcription session: {}", session_id);
        
        let config = self.config.read().await.clone();
        let session = TranscriptionSession::new(session_id.to_string(), config);
        
        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.to_string(), session);
        
        info!("Transcription session {} started", session_id);
        Ok(())
    }

    /// Stop a transcription session
    pub async fn stop_session(&mut self) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        
        // Complete all active sessions
        for (session_id, session) in sessions.iter_mut() {
            session.complete();
            info!("Completed transcription session: {}", session_id);
        }
        
        // Clear processing queue
        let mut queue = self.processing_queue.write().await;
        queue.clear();
        
        // Clear chunk status
        let mut status = self.chunk_status.write().await;
        status.clear();
        
        info!("All transcription sessions stopped");
        Ok(())
    }

    /// Process audio chunk
    pub async fn process_audio_chunk(
        &self,
        audio_data: &[f32],
        sample_rate: u32,
    ) -> Result<Vec<TranscriptionChunk>> {
        let start_time = Instant::now();
        
        // Get the first active session (in real implementation, might need session selection logic)
        let session_id = {
            let sessions = self.sessions.read().await;
            sessions.keys().next().map(|id| id.clone())
        };

        let session_id = match session_id {
            Some(id) => id,
            None => {
                return Err(TranscriptionError::SessionNotFound {
                    session_id: "no_active_session".to_string(),
                });
            }
        };

        // Create audio chunks with overlap
        let chunks = self.create_audio_chunks(audio_data, sample_rate, &session_id).await?;
        let mut results = Vec::new();

        for chunk in chunks {
            // Add chunk to processing queue
            {
                let mut queue = self.processing_queue.write().await;
                queue.push(chunk.clone());
            }

            // Process chunk
            let result = self.process_single_chunk(chunk).await?;
            if let Some(transcription_chunk) = result {
                results.push(transcription_chunk);
            }
        }

        let processing_time = start_time.elapsed();
        debug!("Processed audio chunk in {:?}", processing_time);

        Ok(results)
    }

    /// Create audio chunks with overlap for continuous processing
    async fn create_audio_chunks(
        &self,
        audio_data: &[f32],
        sample_rate: u32,
        session_id: &str,
    ) -> Result<Vec<AudioChunk>> {
        let config = self.config.read().await;
        let chunk_size_samples = (config.chunk_size_seconds * sample_rate as f32) as usize;
        let overlap_samples = (config.chunk_overlap_seconds * sample_rate as f32) as usize;
        let step_size = chunk_size_samples - overlap_samples;

        let mut chunks = Vec::new();
        let mut start_sample = 0;
        let mut start_time = Duration::ZERO;

        // Get session sequence
        let sequence = {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.next_sequence()
            } else {
                return Err(TranscriptionError::SessionNotFound {
                    session_id: session_id.to_string(),
                });
            }
        };

        while start_sample < audio_data.len() {
            let end_sample = (start_sample + chunk_size_samples).min(audio_data.len());
            let chunk_data = audio_data[start_sample..end_sample].to_vec();

            let end_time = start_time + Duration::from_secs_f32(
                chunk_data.len() as f32 / sample_rate as f32
            );

            let chunk = AudioChunk {
                id: Uuid::new_v4(),
                session_id: session_id.to_string(),
                data: chunk_data,
                sample_rate,
                start_time,
                end_time,
                sequence,
            };

            chunks.push(chunk);

            // Move to next chunk
            start_sample += step_size;
            start_time += Duration::from_secs_f32(step_size as f32 / sample_rate as f32);

            // Prevent infinite loop for very small audio
            if step_size == 0 {
                break;
            }
        }

        debug!("Created {} audio chunks for processing", chunks.len());
        Ok(chunks)
    }

    /// Process a single audio chunk
    async fn process_single_chunk(&self, chunk: AudioChunk) -> Result<Option<TranscriptionChunk>> {
        let chunk_id = chunk.id;
        
        // Update status
        {
            let mut status = self.chunk_status.write().await;
            status.insert(chunk_id, ChunkProcessingStatus::ProcessingLocal);
        }

        let config = self.config.read().await.clone();
        
        // Try local processing first
        let local_result = timeout(
            Duration::from_millis(config.max_latency_ms as u64),
            self.whisper_processor.process_audio_chunk(
                &chunk.data,
                chunk.sample_rate,
                chunk.start_time,
                chunk.session_id.clone(),
            ),
        ).await;

        match local_result {
            Ok(Ok(Some(transcription_chunk))) => {
                // Local processing succeeded
                {
                    let mut status = self.chunk_status.write().await;
                    status.insert(chunk_id, ChunkProcessingStatus::Completed(transcription_chunk.clone()));
                }

                // Add to session result
                self.add_chunk_to_session(&chunk.session_id, transcription_chunk.clone()).await?;

                // Send to real-time stream if enabled
                if let Some(sender) = &self.result_sender {
                    let _ = sender.send(transcription_chunk.clone());
                }

                info!(
                    "Local transcription completed: confidence {:.2}",
                    transcription_chunk.confidence
                );

                return Ok(Some(transcription_chunk));
            }
            Ok(Ok(None)) => {
                // Local processing returned low confidence
                warn!("Local transcription returned low confidence");
            }
            Ok(Err(e)) => {
                // Local processing failed
                error!("Local transcription failed: {}", e);
            }
            Err(_) => {
                // Local processing timed out
                warn!("Local transcription timed out");
            }
        }

        // Try cloud processing if hybrid mode and local failed
        #[cfg(feature = "cloud-apis")]
        if config.mode == ProcessingMode::Hybrid || config.mode == ProcessingMode::CloudOnly {
            if let Some(cloud_processor) = &self.cloud_processor {
                return self.process_chunk_with_cloud(chunk, cloud_processor.clone()).await;
            }
        }

        // Mark as failed
        {
            let mut status = self.chunk_status.write().await;
            status.insert(chunk_id, ChunkProcessingStatus::Failed("All processing methods failed".to_string()));
        }

        Ok(None)
    }

    /// Process chunk with cloud API
    #[cfg(feature = "cloud-apis")]
    async fn process_chunk_with_cloud(
        &self,
        chunk: AudioChunk,
        cloud_processor: Arc<CloudProcessor>,
    ) -> Result<Option<TranscriptionChunk>> {
        let chunk_id = chunk.id;
        
        // Update status
        {
            let mut status = self.chunk_status.write().await;
            status.insert(chunk_id, ChunkProcessingStatus::ProcessingCloud);
        }

        let result = cloud_processor
            .process_audio_chunk(&chunk.data, chunk.sample_rate, chunk.start_time, chunk.session_id.clone())
            .await;

        match result {
            Ok(Some(transcription_chunk)) => {
                {
                    let mut status = self.chunk_status.write().await;
                    status.insert(chunk_id, ChunkProcessingStatus::Completed(transcription_chunk.clone()));
                }

                self.add_chunk_to_session(&chunk.session_id, transcription_chunk.clone()).await?;

                if let Some(sender) = &self.result_sender {
                    let _ = sender.send(transcription_chunk.clone());
                }

                info!("Cloud transcription completed: confidence {:.2}", transcription_chunk.confidence);
                Ok(Some(transcription_chunk))
            }
            Ok(None) => {
                warn!("Cloud transcription returned low confidence");
                Ok(None)
            }
            Err(e) => {
                error!("Cloud transcription failed: {}", e);
                {
                    let mut status = self.chunk_status.write().await;
                    status.insert(chunk_id, ChunkProcessingStatus::Failed(e.to_string()));
                }
                Ok(None)
            }
        }
    }

    /// Add transcription chunk to session result
    async fn add_chunk_to_session(
        &self,
        session_id: &str,
        chunk: TranscriptionChunk,
    ) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.add_chunk(chunk);
            Ok(())
        } else {
            Err(TranscriptionError::SessionNotFound {
                session_id: session_id.to_string(),
            })
        }
    }

    /// Get confidence threshold
    pub async fn get_confidence_threshold(&self) -> f32 {
        self.whisper_processor.get_confidence_threshold().await
    }

    /// Update configuration
    pub async fn update_config(&mut self, config: TranscriptionConfig) -> Result<()> {
        {
            let mut current_config = self.config.write().await;
            *current_config = config.clone();
        }

        // Update whisper processor settings
        self.whisper_processor.set_confidence_threshold(config.confidence_threshold).await;

        // Switch model if needed
        self.whisper_processor.switch_model(config.model).await?;

        info!("Transcription configuration updated");
        Ok(())
    }

    /// Set result streaming sender
    pub fn set_result_sender(&mut self, sender: mpsc::UnboundedSender<TranscriptionChunk>) {
        self.result_sender = Some(sender);
        info!("Real-time result streaming enabled");
    }

    /// Get session result
    pub async fn get_session_result(&self, session_id: &str) -> Result<TranscriptionResult> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(session_id) {
            Ok(session.result.clone())
        } else {
            Err(TranscriptionError::SessionNotFound {
                session_id: session_id.to_string(),
            })
        }
    }

    /// Get processing queue size
    pub async fn get_queue_size(&self) -> usize {
        let queue = self.processing_queue.read().await;
        queue.len()
    }

    /// Get chunk processing status
    pub async fn get_chunk_status(&self, chunk_id: &Uuid) -> Option<ChunkProcessingStatus> {
        let status = self.chunk_status.read().await;
        status.get(chunk_id).cloned()
    }

    /// Clear completed chunks from status tracker
    pub async fn cleanup_completed_chunks(&self) {
        let mut status = self.chunk_status.write().await;
        status.retain(|_, status| !matches!(status, ChunkProcessingStatus::Completed(_)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transcription::models::ModelManager;

    #[tokio::test]
    async fn test_pipeline_creation() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let pipeline = TranscriptionPipeline::new(model_manager).await;
        assert!(pipeline.is_ok());
    }

    #[tokio::test]
    async fn test_session_management() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let mut pipeline = TranscriptionPipeline::new(model_manager).await.unwrap();
        
        // Start session
        let result = pipeline.start_session("test_session").await;
        assert!(result.is_ok());
        
        // Stop session
        let result = pipeline.stop_session().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_audio_chunking() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let pipeline = TranscriptionPipeline::new(model_manager).await.unwrap();
        
        // Start a session first
        {
            let mut sessions = pipeline.sessions.write().await;
            sessions.insert("test".to_string(), TranscriptionSession::new("test".to_string(), Default::default()));
        }
        
        // Create test audio (1 second at 16kHz)
        let audio_data: Vec<f32> = (0..16000).map(|i| (i as f32 * 0.01).sin()).collect();
        
        let chunks = pipeline.create_audio_chunks(&audio_data, 16000, "test").await;
        assert!(chunks.is_ok());
        
        let chunks = chunks.unwrap();
        assert!(!chunks.is_empty());
    }
}