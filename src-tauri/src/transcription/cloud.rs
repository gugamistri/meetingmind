//! Cloud API integration for transcription fallback
//!
//! This module provides integration with external transcription APIs
//! when local processing confidence is insufficient.

use crate::transcription::types::{
    LanguageCode, Result, TranscriptionChunk, TranscriptionError,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tracing::{debug, error, info, warn};

/// Supported cloud transcription providers
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CloudProvider {
    /// OpenAI Whisper API
    OpenAI,
    /// Future: Other providers can be added here
    // Anthropic,
    // Azure,
    // Google,
}

impl std::fmt::Display for CloudProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CloudProvider::OpenAI => write!(f, "OpenAI"),
        }
    }
}

/// Configuration for cloud API access
#[derive(Debug, Clone)]
pub struct CloudConfig {
    /// API provider
    pub provider: CloudProvider,
    /// API key (stored securely)
    pub api_key: String,
    /// API endpoint URL
    pub endpoint: String,
    /// Request timeout in seconds
    pub timeout_seconds: u64,
    /// Maximum retries for failed requests
    pub max_retries: u32,
    /// Cost tracking enabled
    pub track_costs: bool,
    /// Maximum cost per month in dollars
    pub max_monthly_cost: f64,
}

impl Default for CloudConfig {
    fn default() -> Self {
        Self {
            provider: CloudProvider::OpenAI,
            api_key: String::new(),
            endpoint: "https://api.openai.com/v1/audio/transcriptions".to_string(),
            timeout_seconds: 30,
            max_retries: 3,
            track_costs: true,
            max_monthly_cost: 50.0,
        }
    }
}

/// OpenAI API request format
#[derive(Debug, Serialize)]
struct OpenAITranscriptionRequest {
    model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    prompt: Option<String>,
    response_format: String,
    temperature: f32,
}

/// OpenAI API response format
#[derive(Debug, Deserialize)]
struct OpenAITranscriptionResponse {
    text: String,
}

/// Usage tracking for cost management
#[derive(Debug, Clone)]
pub struct UsageStats {
    /// Total API requests made this month
    pub requests_this_month: u32,
    /// Total audio seconds processed this month
    pub audio_seconds_this_month: f64,
    /// Estimated cost this month in USD
    pub estimated_cost_this_month: f64,
    /// Last reset date
    pub last_reset: chrono::DateTime<chrono::Utc>,
}

impl Default for UsageStats {
    fn default() -> Self {
        Self {
            requests_this_month: 0,
            audio_seconds_this_month: 0.0,
            estimated_cost_this_month: 0.0,
            last_reset: chrono::Utc::now(),
        }
    }
}

/// Cloud transcription processor
pub struct CloudProcessor {
    /// HTTP client for API requests
    client: Client,
    /// Cloud configuration
    config: CloudConfig,
    /// Usage statistics
    usage_stats: std::sync::Arc<std::sync::Mutex<UsageStats>>,
}

impl CloudProcessor {
    /// Create a new cloud processor
    pub fn new(config: CloudConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .map_err(|e| TranscriptionError::Configuration {
                message: format!("Failed to create HTTP client: {}", e),
            })?;

        info!("Cloud processor initialized for provider: {}", config.provider);

        Ok(Self {
            client,
            config,
            usage_stats: std::sync::Arc::new(std::sync::Mutex::new(UsageStats::default())),
        })
    }

    /// Process audio chunk via cloud API
    pub async fn process_audio_chunk(
        &self,
        audio_data: &[f32],
        sample_rate: u32,
        start_time: Duration,
        session_id: String,
    ) -> Result<Option<TranscriptionChunk>> {
        let start_processing = Instant::now();
        
        debug!(
            "Processing audio chunk via {} API: {} samples at {}Hz",
            self.config.provider,
            audio_data.len(),
            sample_rate
        );

        // Check usage limits before processing
        self.check_usage_limits(audio_data, sample_rate).await?;

        // Convert audio to format required by API
        let audio_bytes = self.convert_audio_to_bytes(audio_data, sample_rate).await?;
        
        // Process based on provider
        let transcription_text = match self.config.provider {
            CloudProvider::OpenAI => self.process_with_openai(&audio_bytes).await?,
        };

        let processing_time = start_processing.elapsed();

        // Update usage statistics
        self.update_usage_stats(audio_data.len() as f64 / sample_rate as f64).await;

        // Create transcription chunk
        let chunk = TranscriptionChunk::new(
            session_id,
            transcription_text,
            0.9, // Cloud APIs typically have high confidence
            LanguageCode::Auto, // Language detection handled by cloud
            start_time,
            start_time + Duration::from_secs_f32(audio_data.len() as f32 / sample_rate as f32),
            format!("{} Cloud API", self.config.provider),
            processing_time.as_millis() as u32,
            false, // processed_locally = false
        );

        info!(
            "Cloud transcription completed via {}: '{}' in {:?}",
            self.config.provider,
            chunk.text.chars().take(50).collect::<String>(),
            processing_time
        );

        Ok(Some(chunk))
    }

    /// Process audio with OpenAI Whisper API
    async fn process_with_openai(&self, audio_bytes: &[u8]) -> Result<String> {
        debug!("Sending request to OpenAI Whisper API");

        let form = reqwest::multipart::Form::new()
            .part(
                "file",
                reqwest::multipart::Part::bytes(audio_bytes.to_vec())
                    .file_name("audio.wav")
                    .mime_str("audio/wav")
                    .map_err(|e| TranscriptionError::CloudApi {
                        provider: "OpenAI".to_string(),
                        message: format!("Failed to create multipart form: {}", e),
                    })?,
            )
            .text("model", "whisper-1")
            .text("response_format", "text");

        let mut attempt = 0;
        let mut last_error = None;

        while attempt < self.config.max_retries {
            let response = self
                .client
                .post(&self.config.endpoint)
                .header("Authorization", format!("Bearer {}", self.config.api_key))
                .multipart(form.try_clone().ok_or_else(|| TranscriptionError::CloudApi {
                    provider: "OpenAI".to_string(),
                    message: "Failed to clone multipart form".to_string(),
                })?)
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let text = resp.text().await.map_err(|e| TranscriptionError::CloudApi {
                            provider: "OpenAI".to_string(),
                            message: format!("Failed to read response text: {}", e),
                        })?;

                        debug!("OpenAI API response received: {} characters", text.len());
                        return Ok(text.trim().to_string());
                    } else {
                        let status = resp.status();
                        let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                        
                        let error = TranscriptionError::CloudApi {
                            provider: "OpenAI".to_string(),
                            message: format!("HTTP {}: {}", status, error_text),
                        };

                        warn!("OpenAI API request failed (attempt {}): {}", attempt + 1, error);
                        last_error = Some(error);
                    }
                }
                Err(e) => {
                    let error = TranscriptionError::CloudApi {
                        provider: "OpenAI".to_string(),
                        message: format!("Request failed: {}", e),
                    };

                    warn!("OpenAI API request failed (attempt {}): {}", attempt + 1, error);
                    last_error = Some(error);
                }
            }

            attempt += 1;
            
            // Exponential backoff
            if attempt < self.config.max_retries {
                let delay = Duration::from_millis(1000 * (1 << attempt));
                tokio::time::sleep(delay).await;
            }
        }

        error!("All OpenAI API attempts failed after {} retries", self.config.max_retries);
        Err(last_error.unwrap_or_else(|| TranscriptionError::CloudApi {
            provider: "OpenAI".to_string(),
            message: "All retry attempts exhausted".to_string(),
        }))
    }

    /// Convert f32 audio samples to WAV bytes
    async fn convert_audio_to_bytes(&self, audio_data: &[f32], sample_rate: u32) -> Result<Vec<u8>> {
        // Simple WAV file creation
        // In production, use a proper audio library like `hound`
        
        let num_samples = audio_data.len() as u32;
        let num_channels = 1u16; // Mono
        let bits_per_sample = 16u16;
        let byte_rate = sample_rate * num_channels as u32 * bits_per_sample as u32 / 8;
        let block_align = num_channels * bits_per_sample / 8;
        let data_size = num_samples * bits_per_sample as u32 / 8;
        let file_size = 36 + data_size;

        let mut wav_data = Vec::with_capacity((44 + data_size) as usize);

        // WAV header
        wav_data.extend_from_slice(b"RIFF");
        wav_data.extend_from_slice(&file_size.to_le_bytes());
        wav_data.extend_from_slice(b"WAVE");
        wav_data.extend_from_slice(b"fmt ");
        wav_data.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
        wav_data.extend_from_slice(&1u16.to_le_bytes()); // audio format (PCM)
        wav_data.extend_from_slice(&num_channels.to_le_bytes());
        wav_data.extend_from_slice(&sample_rate.to_le_bytes());
        wav_data.extend_from_slice(&byte_rate.to_le_bytes());
        wav_data.extend_from_slice(&block_align.to_le_bytes());
        wav_data.extend_from_slice(&bits_per_sample.to_le_bytes());
        wav_data.extend_from_slice(b"data");
        wav_data.extend_from_slice(&data_size.to_le_bytes());

        // Convert f32 samples to i16 and add to WAV data
        for &sample in audio_data {
            let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            wav_data.extend_from_slice(&sample_i16.to_le_bytes());
        }

        debug!("Converted {} samples to {} bytes WAV format", audio_data.len(), wav_data.len());
        Ok(wav_data)
    }

    /// Check usage limits before processing
    async fn check_usage_limits(&self, audio_data: &[f32], sample_rate: u32) -> Result<()> {
        if !self.config.track_costs {
            return Ok(());
        }

        let audio_duration = audio_data.len() as f64 / sample_rate as f64;
        let estimated_cost = self.estimate_cost(audio_duration).await;

        let stats = self.usage_stats.lock().unwrap();
        let projected_monthly_cost = stats.estimated_cost_this_month + estimated_cost;

        if projected_monthly_cost > self.config.max_monthly_cost {
            return Err(TranscriptionError::CloudApi {
                provider: self.config.provider.to_string(),
                message: format!(
                    "Monthly cost limit exceeded: ${:.2} > ${:.2}",
                    projected_monthly_cost,
                    self.config.max_monthly_cost
                ),
            });
        }

        Ok(())
    }

    /// Estimate cost for audio processing
    async fn estimate_cost(&self, audio_duration_seconds: f64) -> f64 {
        match self.config.provider {
            CloudProvider::OpenAI => {
                // OpenAI Whisper API pricing: $0.006 per minute
                let minutes = audio_duration_seconds / 60.0;
                minutes * 0.006
            }
        }
    }

    /// Update usage statistics
    async fn update_usage_stats(&self, audio_duration_seconds: f64) {
        let mut stats = self.usage_stats.lock().unwrap();
        
        // Check if we need to reset monthly stats
        let now = chrono::Utc::now();
        if now.format("%Y-%m").to_string() != stats.last_reset.format("%Y-%m").to_string() {
            *stats = UsageStats::default();
        }

        stats.requests_this_month += 1;
        stats.audio_seconds_this_month += audio_duration_seconds;
        stats.estimated_cost_this_month += self.estimate_cost(audio_duration_seconds).await;

        debug!(
            "Updated usage stats: {} requests, {:.1}s audio, ${:.3} cost this month",
            stats.requests_this_month,
            stats.audio_seconds_this_month,
            stats.estimated_cost_this_month
        );
    }

    /// Get current usage statistics
    pub fn get_usage_stats(&self) -> UsageStats {
        self.usage_stats.lock().unwrap().clone()
    }

    /// Update configuration
    pub fn update_config(&mut self, config: CloudConfig) -> Result<()> {
        // Recreate client with new timeout if changed
        if config.timeout_seconds != self.config.timeout_seconds {
            self.client = Client::builder()
                .timeout(Duration::from_secs(config.timeout_seconds))
                .build()
                .map_err(|e| TranscriptionError::Configuration {
                    message: format!("Failed to recreate HTTP client: {}", e),
                })?;
        }

        self.config = config;
        info!("Cloud processor configuration updated");
        Ok(())
    }

    /// Test API connectivity
    pub async fn test_connection(&self) -> Result<()> {
        debug!("Testing {} API connectivity", self.config.provider);
        
        // Create minimal test audio (1 second of silence)
        let test_audio: Vec<f32> = vec![0.0; 16000]; // 1 second at 16kHz
        let audio_bytes = self.convert_audio_to_bytes(&test_audio, 16000).await?;

        match self.config.provider {
            CloudProvider::OpenAI => {
                let form = reqwest::multipart::Form::new()
                    .part(
                        "file",
                        reqwest::multipart::Part::bytes(audio_bytes)
                            .file_name("test.wav")
                            .mime_str("audio/wav")
                            .map_err(|e| TranscriptionError::CloudApi {
                                provider: "OpenAI".to_string(),
                                message: format!("Failed to create test form: {}", e),
                            })?,
                    )
                    .text("model", "whisper-1")
                    .text("response_format", "text");

                let response = self
                    .client
                    .post(&self.config.endpoint)
                    .header("Authorization", format!("Bearer {}", self.config.api_key))
                    .multipart(form)
                    .send()
                    .await
                    .map_err(|e| TranscriptionError::CloudApi {
                        provider: "OpenAI".to_string(),
                        message: format!("Connection test failed: {}", e),
                    })?;

                if response.status().is_success() {
                    info!("OpenAI API connectivity test successful");
                    Ok(())
                } else {
                    Err(TranscriptionError::CloudApi {
                        provider: "OpenAI".to_string(),
                        message: format!("API test failed with status: {}", response.status()),
                    })
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cloud_config_creation() {
        let config = CloudConfig::default();
        assert_eq!(config.provider, CloudProvider::OpenAI);
        assert_eq!(config.max_retries, 3);
    }

    #[test]
    fn test_usage_stats() {
        let stats = UsageStats::default();
        assert_eq!(stats.requests_this_month, 0);
        assert_eq!(stats.audio_seconds_this_month, 0.0);
    }

    #[tokio::test]
    async fn test_wav_conversion() {
        let config = CloudConfig::default();
        let processor = CloudProcessor::new(config).unwrap();
        
        let audio_data = vec![0.5, -0.5, 0.0, 1.0]; // Simple test audio
        let wav_bytes = processor.convert_audio_to_bytes(&audio_data, 16000).await;
        
        assert!(wav_bytes.is_ok());
        let bytes = wav_bytes.unwrap();
        assert!(bytes.len() > 44); // WAV header is 44 bytes minimum
    }
}