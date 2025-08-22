//! Global error types and error handling utilities

use serde::{Deserialize, Serialize};

/// Main application error type that encompasses all possible errors in the system
#[derive(Debug, thiserror::Error, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum AppError {
    #[error("Configuration error: {message}")]
    Config { message: String },

    #[error("Database error: {message}")]
    Database { message: String },

    #[error("Audio error: {message}")]
    Audio { message: String },

    #[error("Transcription error: {message}")]
    Transcription { message: String },

    #[error("Security error: {message}")]
    Security { message: String },

    #[error("Integration error: {message}")]
    Integration { message: String },

    #[error("IO error: {message}")]
    Io { message: String },

    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl AppError {
    /// Create a new configuration error
    pub fn config(message: impl Into<String>) -> Self {
        Self::Config {
            message: message.into(),
        }
    }

    /// Create a new database error
    pub fn database(message: impl Into<String>) -> Self {
        Self::Database {
            message: message.into(),
        }
    }

    /// Create a new audio error
    pub fn audio(message: impl Into<String>) -> Self {
        Self::Audio {
            message: message.into(),
        }
    }

    /// Create a new transcription error
    pub fn transcription(message: impl Into<String>) -> Self {
        Self::Transcription {
            message: message.into(),
        }
    }

    /// Create a new security error
    pub fn security(message: impl Into<String>) -> Self {
        Self::Security {
            message: message.into(),
        }
    }

    /// Create a new integration error
    pub fn integration(message: impl Into<String>) -> Self {
        Self::Integration {
            message: message.into(),
        }
    }

    /// Create a new IO error
    pub fn io(message: impl Into<String>) -> Self {
        Self::Io {
            message: message.into(),
        }
    }

    /// Create a new internal error
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
}

/// Convert from anyhow::Error
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        Self::Internal {
            message: err.to_string(),
        }
    }
}

/// Convert from std::io::Error
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::Io {
            message: err.to_string(),
        }
    }
}

/// Convert from sqlx::Error
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        Self::Database {
            message: err.to_string(),
        }
    }
}

/// Convert from transcription::TranscriptionError
impl From<crate::transcription::types::TranscriptionError> for AppError {
    fn from(err: crate::transcription::types::TranscriptionError) -> Self {
        Self::Transcription {
            message: err.to_string(),
        }
    }
}

/// Result type alias for convenience
pub type AppResult<T> = std::result::Result<T, AppError>;

/// Result type alias using AppError (backwards compatibility)
pub type Result<T> = std::result::Result<T, AppError>;