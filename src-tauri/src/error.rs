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

    #[error("AI service error: {message}")]
    AI { message: String },
}

/// Comprehensive error type for better error handling
#[derive(Debug, thiserror::Error, Serialize)]
pub enum Error {
    #[error("Configuration error: {message}")]
    Configuration {
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Database error: {message}")]
    Database {
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Audio error: {message}")]
    Audio {
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Transcription error: {message}")]
    Transcription {
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("AI service error [{provider}]: {message}")]
    AIService {
        provider: String,
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Budget exceeded for {budget_type}: ${current:.2} >= ${limit:.2}")]
    BudgetExceeded {
        budget_type: String,
        limit: f64,
        current: f64,
    },

    #[error("HTTP error: {message}")]
    Http {
        message: String,
        #[serde(skip)]
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    #[error("IO error: {message}")]
    Io {
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("Internal error: {message}")]
    Internal {
        message: String,
        #[serde(skip)]
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
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

/// Convert from Error to AppError for Tauri commands
impl From<Error> for AppError {
    fn from(err: Error) -> Self {
        match err {
            Error::Configuration { message, .. } => Self::Config { message },
            Error::Database { message, .. } => Self::Database { message },
            Error::Audio { message, .. } => Self::Audio { message },
            Error::Transcription { message, .. } => Self::Transcription { message },
            Error::AIService { message, .. } => Self::AI { message },
            Error::BudgetExceeded { budget_type, limit, current } => Self::AI { 
                message: format!("Budget exceeded for {}: ${:.2} >= ${:.2}", budget_type, current, limit)
            },
            Error::Http { message, .. } => Self::Integration { message },
            Error::Io { message, .. } => Self::Io { message },
            Error::Internal { message, .. } => Self::Internal { message },
        }
    }
}

/// Result type alias for convenience
pub type AppResult<T> = std::result::Result<T, AppError>;

/// Convert from AppError to Error
impl From<AppError> for Error {
    fn from(err: AppError) -> Self {
        match err {
            AppError::Config { message } => Self::Configuration { 
                message, 
                source: None 
            },
            AppError::Database { message } => Self::Database { 
                message, 
                source: None 
            },
            AppError::Audio { message } => Self::Audio { 
                message, 
                source: None 
            },
            AppError::Transcription { message } => Self::Transcription { 
                message, 
                source: None 
            },
            AppError::Security { message } => Self::Internal { 
                message: format!("Security error: {}", message), 
                source: None 
            },
            AppError::Integration { message } => Self::Internal { 
                message: format!("Integration error: {}", message), 
                source: None 
            },
            AppError::Io { message } => Self::Io { 
                message, 
                source: None 
            },
            AppError::Internal { message } => Self::Internal { 
                message, 
                source: None 
            },
            AppError::AI { message } => Self::AIService { 
                provider: "unknown".to_string(), 
                message, 
                source: None 
            },
        }
    }
}

/// Convert from TranscriptionError to Error
impl From<crate::transcription::types::TranscriptionError> for Error {
    fn from(err: crate::transcription::types::TranscriptionError) -> Self {
        Self::Transcription {
            message: err.to_string(),
            source: Some(Box::new(err)),
        }
    }
}

/// Convert from sqlx::Error to Error
impl From<sqlx::Error> for Error {
    fn from(err: sqlx::Error) -> Self {
        Self::Database {
            message: err.to_string(),
            source: Some(Box::new(err)),
        }
    }
}

/// Convert from std::io::Error to Error
impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Self::Io {
            message: err.to_string(),
            source: Some(Box::new(err)),
        }
    }
}

/// Result type alias using comprehensive Error type
pub type Result<T> = std::result::Result<T, Error>;

/// Legacy result type alias using AppError (backwards compatibility)
pub type LegacyResult<T> = std::result::Result<T, AppError>;