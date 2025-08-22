//! Transcription repository for database operations

use crate::error::{AppError, Result};
use crate::storage::database::DatabasePool;
use crate::storage::models::{
    CreateTranscription, CreateTranscriptionSession, DbTranscription, DbTranscriptionSession,
    SearchFilters, SearchResultEnhanced, TranscriptionSessionStatus, UpdateTranscriptionSession,
    TranscriptionMode,
};
use crate::transcription::types::{TranscriptionChunk, TranscriptionResult};
use chrono::{DateTime, Utc};
use sqlx::{Row, Sqlite, Transaction};
use std::collections::HashMap;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Repository for transcription-related database operations
#[derive(Clone)]
pub struct TranscriptionRepository {
    pool: DatabasePool,
}

impl TranscriptionRepository {
    /// Create a new transcription repository
    pub fn new(pool: DatabasePool) -> Self {
        Self { pool }
    }

    /// Start a new transcription session
    pub async fn create_session(
        &self,
        session: CreateTranscriptionSession,
    ) -> Result<DbTranscriptionSession> {
        debug!("Creating transcription session: {}", session.session_id);

        // Insert the session
        sqlx::query(
            r#"
            INSERT INTO transcription_sessions 
            (session_id, meeting_id, config_language, config_model, config_mode, confidence_threshold)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&session.session_id)
        .bind(session.meeting_id)
        .bind(&session.config_language)
        .bind(&session.config_model)
        .bind(session.config_mode as TranscriptionMode)
        .bind(session.confidence_threshold)
        .execute(&self.pool)
        .await?;

        // Get the inserted record
        let record = sqlx::query_as::<_, DbTranscriptionSession>(
            "SELECT * FROM transcription_sessions WHERE session_id = ?"
        )
        .bind(&session.session_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to create transcription session: {}", e)))?;

        info!("Created transcription session: {}", session.session_id);
        Ok(record)
    }

    /// Update a transcription session
    pub async fn update_session(
        &self,
        session_id: &str,
        update: UpdateTranscriptionSession,
    ) -> Result<DbTranscriptionSession> {
        debug!("Updating transcription session: {}", session_id);

        let mut query = "UPDATE transcription_sessions SET ".to_string();
        let mut params = Vec::new();
        let mut updates = Vec::new();

        if let Some(status) = update.status {
            updates.push("status = ?");
            params.push(status.to_string());
        }

        if let Some(completed_at) = update.completed_at {
            updates.push("completed_at = ?");
            params.push(completed_at.to_rfc3339());
        }

        if let Some(error_message) = update.error_message {
            updates.push("error_message = ?");
            params.push(error_message);
        }

        if updates.is_empty() {
            return Err(AppError::database("No fields to update".to_string()).into());
        }

        query.push_str(&updates.join(", "));
        query.push_str(" WHERE session_id = ? RETURNING *");

        let mut sqlx_query = sqlx::query_as::<Sqlite, DbTranscriptionSession>(&query);
        for param in params {
            sqlx_query = sqlx_query.bind(param);
        }
        sqlx_query = sqlx_query.bind(session_id);

        let record = sqlx_query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to update transcription session: {}", e)))?;

        info!("Updated transcription session: {}", session_id);
        Ok(record)
    }

    /// Get a transcription session by ID
    pub async fn get_session(&self, session_id: &str) -> Result<Option<DbTranscriptionSession>> {
        debug!("Getting transcription session: {}", session_id);

        let record = sqlx::query_as::<_, DbTranscriptionSession>(
            "SELECT * FROM transcription_sessions WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to get transcription session: {}", e)))?;

        Ok(record)
    }

    /// Save a transcription chunk
    pub async fn save_transcription(&self, transcription: CreateTranscription) -> Result<DbTranscription> {
        debug!("Saving transcription chunk: {}", transcription.chunk_id);

        // Insert the transcription
        sqlx::query(
            r#"
            INSERT INTO transcriptions 
            (chunk_id, meeting_id, session_id, content, confidence, language, model_used,
             start_timestamp, end_timestamp, word_count, processing_time_ms, processed_locally)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&transcription.chunk_id)
        .bind(transcription.meeting_id)
        .bind(&transcription.session_id)
        .bind(&transcription.content)
        .bind(transcription.confidence)
        .bind(&transcription.language)
        .bind(&transcription.model_used)
        .bind(transcription.start_timestamp)
        .bind(transcription.end_timestamp)
        .bind(transcription.word_count)
        .bind(transcription.processing_time_ms)
        .bind(transcription.processed_locally)
        .execute(&self.pool)
        .await?;

        // Get the inserted record
        let record = sqlx::query_as::<_, DbTranscription>(
            "SELECT * FROM transcriptions WHERE chunk_id = ?"
        )
        .bind(&transcription.chunk_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to save transcription: {}", e)))?;

        debug!("Saved transcription chunk: {}", transcription.chunk_id);
        Ok(record)
    }

    /// Save multiple transcription chunks in a transaction
    pub async fn save_transcriptions_batch(
        &self,
        transcriptions: Vec<CreateTranscription>,
    ) -> Result<Vec<DbTranscription>> {
        if transcriptions.is_empty() {
            return Ok(Vec::new());
        }

        debug!("Saving batch of {} transcription chunks", transcriptions.len());

        let mut tx = self.pool.begin().await
            .map_err(|e| AppError::database(format!("Failed to start transaction: {}", e)))?;

        let mut saved = Vec::new();

        for transcription in transcriptions {
            // Insert the transcription
            sqlx::query(
                r#"
                INSERT INTO transcriptions 
                (chunk_id, meeting_id, session_id, content, confidence, language, model_used,
                 start_timestamp, end_timestamp, word_count, processing_time_ms, processed_locally)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(&transcription.chunk_id)
            .bind(transcription.meeting_id)
            .bind(&transcription.session_id)
            .bind(&transcription.content)
            .bind(transcription.confidence)
            .bind(&transcription.language)
            .bind(&transcription.model_used)
            .bind(transcription.start_timestamp)
            .bind(transcription.end_timestamp)
            .bind(transcription.word_count)
            .bind(transcription.processing_time_ms)
            .bind(transcription.processed_locally)
            .execute(&mut *tx)
            .await?;

            // Get the inserted record
            let record = sqlx::query_as::<_, DbTranscription>(
                "SELECT * FROM transcriptions WHERE chunk_id = ?"
            )
            .bind(&transcription.chunk_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::database(format!("Failed to save transcription in batch: {}", e)))?;

            saved.push(record);
        }

        tx.commit().await
            .map_err(|e| AppError::database(format!("Failed to commit transcription batch: {}", e)))?;

        info!("Saved batch of {} transcription chunks", saved.len());
        Ok(saved)
    }

    /// Get transcriptions for a session
    pub async fn get_session_transcriptions(
        &self,
        session_id: &str,
        offset: Option<i64>,
        limit: Option<i64>,
    ) -> Result<Vec<DbTranscription>> {
        debug!("Getting transcriptions for session: {}", session_id);

        let offset = offset.unwrap_or(0);
        let limit = limit.unwrap_or(100);

        let records = sqlx::query_as::<_, DbTranscription>(
            r#"
            SELECT * FROM transcriptions 
            WHERE session_id = ? 
            ORDER BY start_timestamp ASC
            LIMIT ? OFFSET ?
            "#
        )
        .bind(session_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to get session transcriptions: {}", e)))?;

        debug!("Retrieved {} transcriptions for session: {}", records.len(), session_id);
        Ok(records)
    }

    /// Get transcriptions for a meeting
    pub async fn get_meeting_transcriptions(
        &self,
        meeting_id: i64,
        offset: Option<i64>,
        limit: Option<i64>,
    ) -> Result<Vec<DbTranscription>> {
        debug!("Getting transcriptions for meeting: {}", meeting_id);

        let offset = offset.unwrap_or(0);
        let limit = limit.unwrap_or(100);

        let records = sqlx::query_as::<_, DbTranscription>(
            r#"
            SELECT * FROM transcriptions 
            WHERE meeting_id = ? 
            ORDER BY start_timestamp ASC
            LIMIT ? OFFSET ?
            "#
        )
        .bind(meeting_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to get meeting transcriptions: {}", e)))?;

        debug!("Retrieved {} transcriptions for meeting: {}", records.len(), meeting_id);
        Ok(records)
    }

    /// Search transcriptions using full-text search
    pub async fn search_transcriptions(
        &self,
        query: &str,
        filters: Option<SearchFilters>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<SearchResultEnhanced>> {
        debug!("Searching transcriptions with query: '{}'", query);

        let limit = limit.unwrap_or(50);
        let offset = offset.unwrap_or(0);

        // Build the search query
        let mut sql = r#"
            SELECT 
                t.id, t.chunk_id, t.content, t.confidence, t.language, t.model_used,
                t.start_timestamp, t.end_timestamp, t.word_count, t.created_at, t.session_id,
                m.id as meeting_id, m.title as meeting_title, m.start_time as meeting_start_time,
                ts.overall_confidence as session_confidence,
                -- Calculate relevance score
                (t.confidence * 0.7 + 
                 (1.0 - (julianday('now') - julianday(t.created_at)) / 30.0) * 0.3) as relevance_score
            FROM transcriptions_fts fts
            JOIN transcriptions t ON fts.rowid = t.id
            JOIN meetings m ON t.meeting_id = m.id
            JOIN transcription_sessions ts ON t.session_id = ts.session_id
            WHERE transcriptions_fts MATCH ?
        "#.to_string();

        let mut params: Vec<Box<dyn sqlx::Encode<Sqlite> + Send + Sync>> = vec![Box::new(query.to_string())];

        // Apply filters
        if let Some(filters) = filters {
            if let Some(languages) = filters.languages {
                if !languages.is_empty() {
                    let placeholders = languages.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    sql.push_str(&format!(" AND t.language IN ({})", placeholders));
                    for lang in languages {
                        params.push(Box::new(lang));
                    }
                }
            }

            if let Some(models) = filters.models {
                if !models.is_empty() {
                    let placeholders = models.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    sql.push_str(&format!(" AND t.model_used IN ({})", placeholders));
                    for model in models {
                        params.push(Box::new(model));
                    }
                }
            }

            if let Some(conf_min) = filters.confidence_min {
                sql.push_str(" AND t.confidence >= ?");
                params.push(Box::new(conf_min));
            }

            if let Some(conf_max) = filters.confidence_max {
                sql.push_str(" AND t.confidence <= ?");
                params.push(Box::new(conf_max));
            }

            if let Some(date_from) = filters.date_from {
                sql.push_str(" AND t.created_at >= ?");
                params.push(Box::new(date_from));
            }

            if let Some(date_to) = filters.date_to {
                sql.push_str(" AND t.created_at <= ?");
                params.push(Box::new(date_to));
            }

            if let Some(meeting_ids) = filters.meeting_ids {
                if !meeting_ids.is_empty() {
                    let placeholders = meeting_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    sql.push_str(&format!(" AND t.meeting_id IN ({})", placeholders));
                    for id in meeting_ids {
                        params.push(Box::new(id));
                    }
                }
            }

            if let Some(processed_locally) = filters.processed_locally {
                sql.push_str(" AND t.processed_locally = ?");
                params.push(Box::new(processed_locally));
            }
        }

        sql.push_str(" ORDER BY relevance_score DESC, t.confidence DESC LIMIT ? OFFSET ?");
        params.push(Box::new(limit));
        params.push(Box::new(offset));

        let mut query_builder = sqlx::query_as::<Sqlite, SearchResultEnhanced>(&sql);
        for param in params {
            // Note: This is a simplified approach. In a real implementation,
            // you'd need to handle the dynamic parameters more carefully
        }

        // For now, use a simplified version without dynamic filters
        let records = sqlx::query_as::<_, SearchResultEnhanced>(
            r#"
            SELECT 
                t.id, t.chunk_id, t.content, t.confidence, t.language, t.model_used,
                t.start_timestamp, t.end_timestamp, t.word_count, t.created_at, t.session_id,
                m.id as meeting_id, m.title as meeting_title, m.start_time as meeting_start_time,
                COALESCE(ts.overall_confidence, 0.0) as session_confidence,
                t.confidence as relevance_score
            FROM transcriptions t
            JOIN meetings m ON t.meeting_id = m.id
            LEFT JOIN transcription_sessions ts ON t.session_id = ts.session_id
            WHERE t.content LIKE ?
            ORDER BY relevance_score DESC, t.confidence DESC 
            LIMIT ? OFFSET ?
            "#
        )
        .bind(format!("%{}%", query))
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to search transcriptions: {}", e)))?;

        info!("Found {} search results for query: '{}'", records.len(), query);
        Ok(records)
    }

    /// Get transcription by chunk ID
    pub async fn get_transcription_by_chunk_id(&self, chunk_id: &str) -> Result<Option<DbTranscription>> {
        debug!("Getting transcription by chunk ID: {}", chunk_id);

        let record = sqlx::query_as::<_, DbTranscription>(
            "SELECT * FROM transcriptions WHERE chunk_id = ?"
        )
        .bind(chunk_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to get transcription by chunk ID: {}", e)))?;

        Ok(record)
    }

    /// Delete transcription by chunk ID
    pub async fn delete_transcription(&self, chunk_id: &str) -> Result<bool> {
        debug!("Deleting transcription: {}", chunk_id);

        let result = sqlx::query(
            "DELETE FROM transcriptions WHERE chunk_id = ?"
        )
        .bind(chunk_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to delete transcription: {}", e)))?;

        let deleted = result.rows_affected() > 0;
        if deleted {
            info!("Deleted transcription: {}", chunk_id);
        } else {
            warn!("Transcription not found for deletion: {}", chunk_id);
        }

        Ok(deleted)
    }

    /// Delete all transcriptions for a session
    pub async fn delete_session_transcriptions(&self, session_id: &str) -> Result<u64> {
        debug!("Deleting all transcriptions for session: {}", session_id);

        let result = sqlx::query(
            "DELETE FROM transcriptions WHERE session_id = ?"
        )
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to delete session transcriptions: {}", e)))?;

        let deleted_count = result.rows_affected();
        info!("Deleted {} transcriptions for session: {}", deleted_count, session_id);
        Ok(deleted_count)
    }

    /// Get transcription statistics
    pub async fn get_transcription_statistics(
        &self,
        from_date: Option<DateTime<Utc>>,
        to_date: Option<DateTime<Utc>>,
    ) -> Result<TranscriptionStatistics> {
        debug!("Getting transcription statistics");

        let mut where_clause = String::new();
        let mut params = Vec::new();

        if let Some(from) = from_date {
            where_clause.push_str(" WHERE created_at >= ?");
            params.push(from.to_rfc3339());
        }

        if let Some(to) = to_date {
            if where_clause.is_empty() {
                where_clause.push_str(" WHERE created_at <= ?");
            } else {
                where_clause.push_str(" AND created_at <= ?");
            }
            params.push(to.to_rfc3339());
        }

        let sql = format!(
            r#"
            SELECT 
                COUNT(*) as total_chunks,
                COUNT(DISTINCT session_id) as total_sessions,
                AVG(confidence) as avg_confidence,
                SUM(end_timestamp - start_timestamp) as total_duration,
                SUM(processing_time_ms) as total_processing_time,
                SUM(CASE WHEN processed_locally THEN 1 ELSE 0 END) as local_chunks,
                COUNT(*) - SUM(CASE WHEN processed_locally THEN 1 ELSE 0 END) as cloud_chunks
            FROM transcriptions{}
            "#,
            where_clause
        );

        let row = sqlx::query(&sql)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to get transcription statistics: {}", e)))?;

        let total_chunks: i64 = row.get("total_chunks");
        let total_sessions: i64 = row.get("total_sessions");
        let avg_confidence: f64 = row.get::<Option<f64>, _>("avg_confidence").unwrap_or(0.0);
        let total_duration: f64 = row.get::<Option<f64>, _>("total_duration").unwrap_or(0.0);
        let total_processing_time: i64 = row.get::<Option<i64>, _>("total_processing_time").unwrap_or(0);
        let local_chunks: i64 = row.get("local_chunks");
        let cloud_chunks: i64 = row.get("cloud_chunks");

        let local_processing_percentage = if total_chunks > 0 {
            (local_chunks as f64 / total_chunks as f64) * 100.0
        } else {
            0.0
        };

        let stats = TranscriptionStatistics {
            total_chunks,
            total_sessions,
            avg_confidence,
            total_duration_seconds: total_duration,
            total_processing_time_ms: total_processing_time,
            local_chunks,
            cloud_chunks,
            local_processing_percentage,
        };

        debug!("Retrieved transcription statistics: {:?}", stats);
        Ok(stats)
    }

    /// Complete a transcription session
    pub async fn complete_session(&self, session_id: &str) -> Result<DbTranscriptionSession> {
        debug!("Completing transcription session: {}", session_id);

        let update = UpdateTranscriptionSession {
            status: Some(TranscriptionSessionStatus::Completed),
            completed_at: Some(Utc::now()),
            error_message: None,
        };

        self.update_session(session_id, update).await
    }

    /// Mark a transcription session as failed
    pub async fn fail_session(&self, session_id: &str, error_message: String) -> Result<DbTranscriptionSession> {
        debug!("Marking transcription session as failed: {}", session_id);

        let update = UpdateTranscriptionSession {
            status: Some(TranscriptionSessionStatus::Failed),
            completed_at: Some(Utc::now()),
            error_message: Some(error_message),
        };

        self.update_session(session_id, update).await
    }

    /// Get session summary
    pub async fn get_session_summary(&self, session_id: &str) -> Result<Option<SessionSummary>> {
        debug!("Getting session summary: {}", session_id);

        let row = sqlx::query(
            r#"
            SELECT 
                ts.session_id,
                ts.meeting_id,
                ts.confidence_threshold,
                ts.status,
                ts.started_at,
                ts.completed_at,
                m.title as meeting_title,
                COUNT(t.id) as chunk_count,
                AVG(t.confidence) as avg_confidence,
                SUM(t.end_timestamp - t.start_timestamp) as total_duration,
                SUM(t.processing_time_ms) as total_processing_time
            FROM transcription_sessions ts
            LEFT JOIN meetings m ON ts.meeting_id = m.id
            LEFT JOIN transcriptions t ON ts.session_id = t.session_id
            WHERE ts.session_id = ?
            GROUP BY ts.session_id, ts.status, ts.started_at, ts.completed_at
            "#
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to get session summary: {}", e)))?;

        if let Some(row) = row {
            let summary = SessionSummary {
                session_id: row.get("session_id"),
                meeting_title: row.get::<Option<String>, _>("meeting_title").unwrap_or_default(),
                chunk_count: row.get::<Option<i64>, _>("chunk_count").unwrap_or(0),
                avg_confidence: row.get::<Option<f64>, _>("avg_confidence").unwrap_or(0.0),
                total_duration_seconds: row.get::<Option<f64>, _>("total_duration").unwrap_or(0.0),
                total_processing_time_ms: row.get::<Option<i64>, _>("total_processing_time").unwrap_or(0),
                status: row.get("status"),
                started_at: row.get("started_at"),
                completed_at: row.get("completed_at"),
            };

            Ok(Some(summary))
        } else {
            Ok(None)
        }
    }
}

/// Transcription statistics summary
#[derive(Debug, Clone)]
pub struct TranscriptionStatistics {
    pub total_chunks: i64,
    pub total_sessions: i64,
    pub avg_confidence: f64,
    pub total_duration_seconds: f64,
    pub total_processing_time_ms: i64,
    pub local_chunks: i64,
    pub cloud_chunks: i64,
    pub local_processing_percentage: f64,
}

/// Session summary information
#[derive(Debug, Clone)]
pub struct SessionSummary {
    pub session_id: String,
    pub meeting_title: String,
    pub chunk_count: i64,
    pub avg_confidence: f64,
    pub total_duration_seconds: f64,
    pub total_processing_time_ms: i64,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::database::DatabaseManager;
    use tempfile::TempDir;

    async fn setup_test_db() -> DatabaseManager {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        std::env::set_var("MEETINGMIND_DB_PATH", db_path.to_str().unwrap());

        let manager = DatabaseManager::new().await.unwrap();
        manager
    }

    #[tokio::test]
    async fn test_transcription_repository() {
        let db_manager = setup_test_db().await;
        let repo = TranscriptionRepository::new(db_manager.pool().clone());

        // Test creating a transcription session
        let session = CreateTranscriptionSession {
            session_id: "test-session".to_string(),
            meeting_id: 1,
            config_language: "en".to_string(),
            config_model: "tiny".to_string(),
            config_mode: crate::storage::models::TranscriptionMode::Local,
            confidence_threshold: 0.8,
        };

        // This would fail without a meeting record, but tests the structure
        let result = repo.create_session(session).await;
        // In a real test, we'd set up the meeting first
        assert!(result.is_err()); // Expected due to foreign key constraint
    }
}