//! Data storage and database operations
//!
//! This module provides the complete data storage layer for MeetingMind,
//! including database management, repositories, and data models.

pub mod database;
pub mod models;
pub mod repositories;

// Re-export commonly used types
pub use database::{DatabaseManager, DatabasePool, DatabaseHealthInfo};
pub use models::*;
pub use repositories::*;

use crate::error::Result;
use std::sync::Arc;

/// Central storage service that coordinates all data operations
pub struct StorageService {
    /// Database manager
    pub database: Arc<DatabaseManager>,
    /// Transcription repository
    pub transcription: TranscriptionRepository,
}

impl StorageService {
    /// Create a new storage service
    pub async fn new() -> Result<Self> {
        let database = Arc::new(DatabaseManager::new().await?);
        let transcription = TranscriptionRepository::new(database.pool().clone());

        Ok(Self {
            database,
            transcription,
        })
    }

    /// Get database health information
    pub async fn health_check(&self) -> Result<DatabaseHealthInfo> {
        self.database.health_check().await
    }

    /// Close all database connections
    pub async fn shutdown(&self) {
        self.database.close().await;
    }
}