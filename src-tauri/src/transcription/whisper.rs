//! Local Whisper processing using ONNX Runtime
//!
//! This module provides the interface for local Whisper model processing,
//! including audio preprocessing and inference management.

use crate::transcription::models::{InferenceResult, ModelManager, ModelSession};
use crate::transcription::types::{
    AudioPreprocessingParams, LanguageCode, Result, TranscriptionChunk, TranscriptionError,
    WhisperModel,
};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Whisper processor for local transcription
pub struct WhisperProcessor {
    model_manager: Arc<ModelManager>,
    current_model: Arc<RwLock<Option<Arc<ModelSession>>>>,
    preprocessing_params: AudioPreprocessingParams,
    confidence_threshold: f32,
}

impl WhisperProcessor {
    /// Create a new Whisper processor
    pub async fn new(model_manager: Arc<ModelManager>) -> Result<Self> {
        info!("Initializing Whisper processor");
        
        Ok(Self {
            model_manager,
            current_model: Arc::new(RwLock::new(None)),
            preprocessing_params: AudioPreprocessingParams::default(),
            confidence_threshold: 0.7,
        })
    }

    /// Initialize with a specific model
    pub async fn initialize_model(&self, model_type: WhisperModel) -> Result<()> {
        info!("Loading Whisper {} model", model_type.filename());
        
        let model_session = self.model_manager.load_model(model_type).await?;
        
        let mut current = self.current_model.write().await;
        *current = Some(model_session);
        
        info!("Whisper model initialized successfully");
        Ok(())
    }

    /// Process audio chunk and return transcription
    pub async fn process_audio_chunk(
        &self,
        audio_data: &[f32],
        sample_rate: u32,
        start_time: Duration,
        session_id: String,
    ) -> Result<Option<TranscriptionChunk>> {
        let start_processing = Instant::now();
        
        debug!(
            "Processing audio chunk: {} samples at {}Hz",
            audio_data.len(),
            sample_rate
        );

        // Ensure model is loaded
        let model_session = {
            let current = self.current_model.read().await;
            match current.as_ref() {
                Some(session) => session.clone(),
                None => {
                    // Try to load default model
                    drop(current);
                    let default_session = self.model_manager.get_default_model().await?;
                    let mut current = self.current_model.write().await;
                    *current = Some(default_session.clone());
                    default_session
                }
            }
        };

        // Preprocess audio
        let preprocessed_audio = self.preprocess_audio(audio_data, sample_rate).await?;
        
        // Run inference
        let inference_result = model_session.run_inference(&preprocessed_audio).await?;
        
        let processing_time = start_processing.elapsed();
        
        // Convert to transcription chunk if confidence is sufficient
        if inference_result.confidence >= self.confidence_threshold {
            let chunk = self.create_transcription_chunk(
                session_id,
                inference_result,
                start_time,
                processing_time,
                model_session.model_type().filename().to_string(),
            )?;
            
            debug!(
                "Transcription completed: '{}' (confidence: {:.2})",
                chunk.text.chars().take(50).collect::<String>(),
                chunk.confidence
            );
            
            Ok(Some(chunk))
        } else {
            warn!(
                "Low confidence transcription: {:.2} < {:.2}",
                inference_result.confidence, self.confidence_threshold
            );
            Ok(None)
        }
    }

    /// Preprocess audio data for Whisper input
    async fn preprocess_audio(&self, audio_data: &[f32], sample_rate: u32) -> Result<Vec<f32>> {
        debug!("Preprocessing audio: {} samples at {}Hz", audio_data.len(), sample_rate);
        
        let mut processed = audio_data.to_vec();

        // Resample to 16kHz if needed
        if sample_rate != self.preprocessing_params.sample_rate {
            processed = self.resample_audio(&processed, sample_rate, self.preprocessing_params.sample_rate)?;
        }

        // Convert to mono if needed
        if self.preprocessing_params.channels == 1 {
            processed = self.convert_to_mono(&processed);
        }

        // Normalize audio levels
        if self.preprocessing_params.normalize {
            self.normalize_audio(&mut processed);
        }

        // Apply noise reduction if enabled
        if self.preprocessing_params.noise_reduction {
            self.apply_noise_reduction(&mut processed);
        }

        // Ensure proper length (pad or truncate to 30 seconds for Whisper)
        let target_length = self.preprocessing_params.chunk_size;
        if processed.len() < target_length {
            processed.resize(target_length, 0.0);
        } else if processed.len() > target_length {
            processed.truncate(target_length);
        }

        debug!("Audio preprocessing completed: {} samples", processed.len());
        Ok(processed)
    }

    /// Resample audio from source to target sample rate
    fn resample_audio(&self, audio: &[f32], source_rate: u32, target_rate: u32) -> Result<Vec<f32>> {
        if source_rate == target_rate {
            return Ok(audio.to_vec());
        }

        debug!("Resampling from {}Hz to {}Hz", source_rate, target_rate);
        
        // Simple linear interpolation resampling (placeholder)
        // In production, use a proper resampling library like `rubato`
        let ratio = target_rate as f64 / source_rate as f64;
        let new_length = (audio.len() as f64 * ratio) as usize;
        let mut resampled = Vec::with_capacity(new_length);

        for i in 0..new_length {
            let source_index = (i as f64 / ratio) as usize;
            if source_index < audio.len() {
                resampled.push(audio[source_index]);
            } else {
                resampled.push(0.0);
            }
        }

        Ok(resampled)
    }

    /// Convert stereo to mono by averaging channels
    fn convert_to_mono(&self, audio: &[f32]) -> Vec<f32> {
        if audio.len() % 2 != 0 {
            // Already mono or odd number of samples
            return audio.to_vec();
        }

        let mut mono = Vec::with_capacity(audio.len() / 2);
        for chunk in audio.chunks_exact(2) {
            let mono_sample = (chunk[0] + chunk[1]) / 2.0;
            mono.push(mono_sample);
        }

        mono
    }

    /// Normalize audio levels to [-1, 1] range
    fn normalize_audio(&self, audio: &mut [f32]) {
        if audio.is_empty() {
            return;
        }

        let max_amplitude = audio
            .iter()
            .map(|&sample| sample.abs())
            .fold(0.0f32, f32::max);

        if max_amplitude > 0.0 {
            let scale = 1.0 / max_amplitude;
            for sample in audio.iter_mut() {
                *sample *= scale;
            }
        }
    }

    /// Apply basic noise reduction (placeholder implementation)
    fn apply_noise_reduction(&self, audio: &mut [f32]) {
        // Simple high-pass filter to remove low-frequency noise
        // In production, use proper DSP libraries
        const CUTOFF = 0.01;
        let mut prev_sample = 0.0;
        
        for sample in audio.iter_mut() {
            let filtered = *sample - prev_sample * CUTOFF;
            prev_sample = *sample;
            *sample = filtered;
        }
    }

    /// Create transcription chunk from inference result
    fn create_transcription_chunk(
        &self,
        session_id: String,
        inference_result: InferenceResult,
        start_time: Duration,
        processing_time: Duration,
        model_used: String,
    ) -> Result<TranscriptionChunk> {
        let end_time = start_time + Duration::from_secs_f32(self.preprocessing_params.chunk_size_seconds);
        
        // Detect language from inference result
        let language = match inference_result.language_detected.as_str() {
            "en" => LanguageCode::En,
            "pt" => LanguageCode::Pt,
            _ => LanguageCode::Auto,
        };

        let chunk = TranscriptionChunk::new(
            session_id,
            inference_result.text,
            inference_result.confidence,
            language,
            start_time,
            end_time,
            model_used,
            processing_time.as_millis() as u32,
            true, // processed_locally = true for Whisper
        );

        Ok(chunk)
    }

    /// Detect language from audio (using Whisper's built-in detection)
    pub async fn detect_language(&self, audio_data: &[f32], sample_rate: u32) -> Result<LanguageCode> {
        // Use a small audio chunk for language detection
        let detection_chunk_size = self.preprocessing_params.sample_rate * 10; // 10 seconds
        let chunk = if audio_data.len() > detection_chunk_size {
            &audio_data[..detection_chunk_size]
        } else {
            audio_data
        };

        let preprocessed = self.preprocess_audio(chunk, sample_rate).await?;
        
        // Get current model
        let model_session = {
            let current = self.current_model.read().await;
            match current.as_ref() {
                Some(session) => session.clone(),
                None => self.model_manager.get_default_model().await?,
            }
        };

        let inference_result = model_session.run_inference(&preprocessed).await?;
        
        let detected_language = match inference_result.language_detected.as_str() {
            "en" => LanguageCode::En,
            "pt" => LanguageCode::Pt,
            _ => LanguageCode::En, // Default to English
        };

        info!("Detected language: {}", detected_language);
        Ok(detected_language)
    }

    /// Update preprocessing parameters
    pub fn update_preprocessing_params(&mut self, params: AudioPreprocessingParams) {
        self.preprocessing_params = params;
        info!("Updated audio preprocessing parameters");
    }

    /// Set confidence threshold
    pub fn set_confidence_threshold(&mut self, threshold: f32) {
        self.confidence_threshold = threshold.clamp(0.0, 1.0);
        info!("Updated confidence threshold to {:.2}", self.confidence_threshold);
    }

    /// Get current confidence threshold
    pub fn get_confidence_threshold(&self) -> f32 {
        self.confidence_threshold
    }

    /// Check if processor is ready
    pub async fn is_ready(&self) -> bool {
        let current = self.current_model.read().await;
        current.as_ref().map_or(false, |session| session.is_ready())
    }

    /// Get current model information
    pub async fn get_current_model_info(&self) -> Option<WhisperModel> {
        let current = self.current_model.read().await;
        current.as_ref().map(|session| session.model_type().clone())
    }

    /// Switch to a different model
    pub async fn switch_model(&self, model_type: WhisperModel) -> Result<()> {
        info!("Switching to {} model", model_type.filename());
        
        let new_session = self.model_manager.load_model(model_type).await?;
        
        let mut current = self.current_model.write().await;
        *current = Some(new_session);
        
        info!("Model switch completed");
        Ok(())
    }

    /// Unload current model to free memory
    pub async fn unload_model(&self) {
        let mut current = self.current_model.write().await;
        *current = None;
        info!("Whisper model unloaded");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transcription::models::ModelManager;

    #[tokio::test]
    async fn test_whisper_processor_creation() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let processor = WhisperProcessor::new(model_manager).await;
        assert!(processor.is_ok());
    }

    #[tokio::test]
    async fn test_audio_preprocessing() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let processor = WhisperProcessor::new(model_manager).await.unwrap();
        
        // Test audio: 1 second at 44.1kHz
        let audio_data: Vec<f32> = (0..44100).map(|i| (i as f32 * 0.001).sin()).collect();
        
        let result = processor.preprocess_audio(&audio_data, 44100).await;
        assert!(result.is_ok());
        
        let processed = result.unwrap();
        // Should be resampled to 16kHz and padded/truncated to 30 seconds
        assert_eq!(processed.len(), 480000); // 30 seconds at 16kHz
    }

    #[tokio::test]
    async fn test_mono_conversion() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let processor = WhisperProcessor::new(model_manager).await.unwrap();
        
        // Stereo audio: L, R, L, R...
        let stereo_audio = vec![0.5, -0.5, 0.3, -0.3, 0.1, -0.1];
        let mono_audio = processor.convert_to_mono(&stereo_audio);
        
        assert_eq!(mono_audio.len(), 3);
        assert_eq!(mono_audio[0], 0.0); // (0.5 + -0.5) / 2
        assert_eq!(mono_audio[1], 0.0); // (0.3 + -0.3) / 2
        assert_eq!(mono_audio[2], 0.0); // (0.1 + -0.1) / 2
    }

    #[tokio::test]
    async fn test_audio_normalization() {
        let model_manager = Arc::new(ModelManager::new().await.unwrap());
        let processor = WhisperProcessor::new(model_manager).await.unwrap();
        
        let mut audio = vec![0.5, -2.0, 1.0, -0.5];
        processor.normalize_audio(&mut audio);
        
        // Should be normalized to [-1, 1] range
        let max_val = audio.iter().map(|&x| x.abs()).fold(0.0f32, f32::max);
        assert!((max_val - 1.0).abs() < 0.001);
    }
}