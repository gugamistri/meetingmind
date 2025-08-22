//! Transcription-related type definitions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

/// Unique identifier for transcription sessions
pub type SessionId = String;

/// Unique identifier for transcription chunks
pub type ChunkId = Uuid;

/// Language code using ISO 639-1 standard
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LanguageCode {
    /// English
    En,
    /// Portuguese
    Pt,
    /// Auto-detect language
    Auto,
}

impl Default for LanguageCode {
    fn default() -> Self {
        Self::Auto
    }
}

impl std::fmt::Display for LanguageCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LanguageCode::En => write!(f, "en"),
            LanguageCode::Pt => write!(f, "pt"),
            LanguageCode::Auto => write!(f, "auto"),
        }
    }
}

/// Whisper model types available for local processing
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WhisperModel {
    /// Tiny model (~39MB, fastest, lowest accuracy)
    Tiny,
    /// Base model (~74MB, balanced performance)
    Base,
    /// Small model (~244MB, better accuracy)
    Small,
}

impl Default for WhisperModel {
    fn default() -> Self {
        Self::Tiny
    }
}

impl WhisperModel {
    /// Get the model file name
    pub fn filename(&self) -> &'static str {
        match self {
            WhisperModel::Tiny => "whisper-tiny.onnx",
            WhisperModel::Base => "whisper-base.onnx", 
            WhisperModel::Small => "whisper-small.onnx",
        }
    }
    
    /// Get approximate model size in MB
    pub fn size_mb(&self) -> u32 {
        match self {
            WhisperModel::Tiny => 39,
            WhisperModel::Base => 74,
            WhisperModel::Small => 244,
        }
    }
}

/// Processing mode for transcription
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProcessingMode {
    /// Local-only processing using ONNX models
    LocalOnly,
    /// Cloud-only processing using external APIs
    CloudOnly,
    /// Hybrid mode with local processing and cloud fallback
    Hybrid,
}

impl Default for ProcessingMode {
    fn default() -> Self {
        Self::Hybrid
    }
}

/// Configuration for transcription processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionConfig {
    /// Primary language for transcription
    pub language: LanguageCode,
    /// Whisper model to use for local processing
    pub model: WhisperModel,
    /// Processing mode (local, cloud, or hybrid)
    pub mode: ProcessingMode,
    /// Confidence threshold for cloud fallback (0.0-1.0)
    pub confidence_threshold: f32,
    /// Enable real-time streaming of transcription results
    pub real_time_streaming: bool,
    /// Audio chunk size in seconds for processing
    pub chunk_size_seconds: f32,
    /// Overlap between audio chunks in seconds
    pub chunk_overlap_seconds: f32,
    /// Maximum processing latency in milliseconds
    pub max_latency_ms: u32,
}

impl Default for TranscriptionConfig {
    fn default() -> Self {
        Self {
            language: LanguageCode::default(),
            model: WhisperModel::default(),
            mode: ProcessingMode::default(),
            confidence_threshold: 0.8,
            real_time_streaming: true,
            chunk_size_seconds: 30.0,
            chunk_overlap_seconds: 5.0,
            max_latency_ms: 3000,
        }
    }
}

/// Single transcription chunk with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionChunk {
    /// Unique identifier for this chunk
    pub id: ChunkId,
    /// Session this chunk belongs to
    pub session_id: SessionId,
    /// Transcribed text content
    pub text: String,
    /// Confidence score (0.0-1.0)
    pub confidence: f32,
    /// Detected or configured language
    pub language: LanguageCode,
    /// Start timestamp relative to session start
    pub start_time: Duration,
    /// End timestamp relative to session start
    pub end_time: Duration,
    /// Number of words in the transcription
    pub word_count: u32,
    /// Model used for processing
    pub model_used: String,
    /// Processing time in milliseconds
    pub processing_time_ms: u32,
    /// Timestamp when chunk was created
    pub created_at: DateTime<Utc>,
    /// Whether this chunk was processed locally or via cloud
    pub processed_locally: bool,
}

impl TranscriptionChunk {
    /// Create a new transcription chunk
    pub fn new(
        session_id: SessionId,
        text: String,
        confidence: f32,
        language: LanguageCode,
        start_time: Duration,
        end_time: Duration,
        model_used: String,
        processing_time_ms: u32,
        processed_locally: bool,
    ) -> Self {
        let word_count = text.split_whitespace().count() as u32;
        
        Self {
            id: Uuid::new_v4(),
            session_id,
            text,
            confidence,
            language,
            start_time,
            end_time,
            word_count,
            model_used,
            processing_time_ms,
            created_at: Utc::now(),
            processed_locally,
        }
    }
    
    /// Get the duration of this chunk
    pub fn duration(&self) -> Duration {
        self.end_time - self.start_time
    }
    
    /// Check if confidence is above threshold
    pub fn is_high_confidence(&self, threshold: f32) -> bool {
        self.confidence >= threshold
    }
}

/// Complete transcription result for a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    /// Session identifier
    pub session_id: SessionId,
    /// All transcription chunks
    pub chunks: Vec<TranscriptionChunk>,
    /// Overall confidence score
    pub overall_confidence: f32,
    /// Primary detected language
    pub primary_language: LanguageCode,
    /// Total processing time
    pub total_processing_time_ms: u32,
    /// Number of chunks processed locally
    pub local_chunks: u32,
    /// Number of chunks processed via cloud
    pub cloud_chunks: u32,
    /// Session start time
    pub session_start: DateTime<Utc>,
    /// Session end time  
    pub session_end: Option<DateTime<Utc>>,
}

impl TranscriptionResult {
    /// Create a new transcription result
    pub fn new(session_id: SessionId) -> Self {
        Self {
            session_id,
            chunks: Vec::new(),
            overall_confidence: 0.0,
            primary_language: LanguageCode::Auto,
            total_processing_time_ms: 0,
            local_chunks: 0,
            cloud_chunks: 0,
            session_start: Utc::now(),
            session_end: None,
        }
    }
    
    /// Add a chunk to the result
    pub fn add_chunk(&mut self, chunk: TranscriptionChunk) {
        self.total_processing_time_ms += chunk.processing_time_ms;
        
        if chunk.processed_locally {
            self.local_chunks += 1;
        } else {
            self.cloud_chunks += 1;
        }
        
        self.chunks.push(chunk);
        self.update_overall_confidence();
    }
    
    /// Get full text from all chunks
    pub fn full_text(&self) -> String {
        self.chunks
            .iter()
            .map(|chunk| chunk.text.as_str())
            .collect::<Vec<_>>()
            .join(" ")
    }
    
    /// Get total duration
    pub fn total_duration(&self) -> Duration {
        self.chunks
            .iter()
            .map(|chunk| chunk.duration())
            .sum()
    }
    
    /// Complete the session
    pub fn complete(&mut self) {
        self.session_end = Some(Utc::now());
    }
    
    /// Update overall confidence based on chunks
    fn update_overall_confidence(&mut self) {
        if self.chunks.is_empty() {
            self.overall_confidence = 0.0;
            return;
        }
        
        let total_confidence: f32 = self.chunks
            .iter()
            .map(|chunk| chunk.confidence)
            .sum();
            
        self.overall_confidence = total_confidence / self.chunks.len() as f32;
    }
}

/// Audio preprocessing parameters for Whisper
#[derive(Debug, Clone)]
pub struct AudioPreprocessingParams {
    /// Target sample rate (16kHz for Whisper)
    pub sample_rate: u32,
    /// Number of channels (1 for mono)
    pub channels: u16,
    /// Chunk size in samples
    pub chunk_size: usize,
    /// Overlap size in samples
    pub overlap_size: usize,
    /// Apply noise reduction
    pub noise_reduction: bool,
    /// Normalize audio levels
    pub normalize: bool,
}

impl Default for AudioPreprocessingParams {
    fn default() -> Self {
        Self {
            sample_rate: 16000, // Whisper requires 16kHz
            channels: 1,        // Mono
            chunk_size: 480000, // 30 seconds at 16kHz
            overlap_size: 80000, // 5 seconds at 16kHz
            noise_reduction: true,
            normalize: true,
        }
    }
}

/// Error types specific to transcription operations
#[derive(Debug, thiserror::Error)]
pub enum TranscriptionError {
    #[error("Model loading failed: {model_path}")]
    ModelLoadFailed { model_path: String },
    
    #[error("Audio preprocessing error: {details}")]
    AudioPreprocessing { details: String },
    
    #[error("ONNX inference error: {message}")]
    OnnxInference { message: String },
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Cloud API error: {provider} - {message}")]
    CloudApi { provider: String, message: String },
    
    #[error("Audio format not supported: {format}")]
    UnsupportedFormat { format: String },
    
    #[error("Session not found: {session_id}")]
    SessionNotFound { session_id: String },
    
    #[error("Configuration error: {message}")]
    Configuration { message: String },
    
    #[error("Processing timeout: exceeded {timeout_ms}ms")]
    ProcessingTimeout { timeout_ms: u32 },
    
    #[error("Model not available: {model}")]
    ModelNotAvailable { model: String },
    
    #[error("Insufficient confidence: {confidence}, threshold: {threshold}")]
    InsufficientConfidence { confidence: f32, threshold: f32 },
}

/// Result type for transcription operations
pub type Result<T> = std::result::Result<T, TranscriptionError>;