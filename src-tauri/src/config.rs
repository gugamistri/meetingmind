//! Application configuration management

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::{AppError, AppResult};

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Application metadata
    pub app: AppInfo,
    
    /// Audio capture settings
    pub audio: AudioConfig,
    
    /// Database configuration
    pub database: DatabaseConfig,
    
    /// AI/ML model settings
    pub ai: AIConfig,
    
    /// Security settings
    pub security: SecurityConfig,
}

/// Application information and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

/// Audio capture configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    /// Default sample rate for audio capture
    pub sample_rate: u32,
    
    /// Buffer size in samples
    pub buffer_size: u32,
    
    /// Number of audio channels
    pub channels: u16,
    
    /// Preferred audio device name (None for system default)
    pub preferred_device: Option<String>,
}

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// Database file path
    pub path: PathBuf,
    
    /// Maximum number of connections in the pool
    pub max_connections: u32,
    
    /// Enable WAL mode for better concurrent access
    pub enable_wal: bool,
}

/// AI/ML configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    /// Local Whisper model path
    pub whisper_model_path: PathBuf,
    
    /// Whisper model size (tiny, base, small, medium, large)
    pub whisper_model_size: String,
    
    /// Enable cloud API fallback
    pub enable_cloud_fallback: bool,
    
    /// OpenAI API key (optional)
    pub openai_api_key: Option<String>,
}

/// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Enable data encryption at rest
    pub enable_encryption: bool,
    
    /// Encryption key derivation rounds
    pub key_derivation_rounds: u32,
    
    /// Enable PII detection and redaction
    pub enable_pii_protection: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app: AppInfo {
                name: "MeetingMind".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                description: "Privacy-first AI Meeting Assistant".to_string(),
            },
            audio: AudioConfig {
                sample_rate: 16000,  // 16kHz for Whisper
                buffer_size: 1024,
                channels: 1,         // Mono for speech recognition
                preferred_device: None,
            },
            database: DatabaseConfig {
                path: PathBuf::from("meetings.db"),
                max_connections: 10,
                enable_wal: true,
            },
            ai: AIConfig {
                whisper_model_path: PathBuf::from("models/whisper-base.onnx"),
                whisper_model_size: "base".to_string(),
                enable_cloud_fallback: false,
                openai_api_key: None,
            },
            security: SecurityConfig {
                enable_encryption: true,
                key_derivation_rounds: 100_000,
                enable_pii_protection: true,
            },
        }
    }
}

impl AppConfig {
    /// Load configuration from file or create default
    pub fn load() -> AppResult<Self> {
        // For now, return default configuration
        // TODO: Implement file-based configuration loading
        Ok(Self::default())
    }
    
    /// Save configuration to file
    pub fn save(&self) -> AppResult<()> {
        // TODO: Implement configuration saving
        Ok(())
    }
    
    /// Validate configuration settings
    pub fn validate(&self) -> AppResult<()> {
        if self.audio.sample_rate == 0 {
            return Err(AppError::config("Sample rate must be greater than 0"));
        }
        
        if self.audio.channels == 0 {
            return Err(AppError::config("Number of channels must be greater than 0"));
        }
        
        if self.database.max_connections == 0 {
            return Err(AppError::config("Maximum connections must be greater than 0"));
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests;