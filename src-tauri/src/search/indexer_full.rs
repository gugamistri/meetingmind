use sqlx::SqlitePool;
use tracing::{debug, error, info, warn};

use crate::search::types::{SearchError, SearchServiceResult};

/// Search indexer for maintaining FTS5 indexes
#[derive(Debug, Clone)]
pub struct SearchIndexer {
    pool: SqlitePool,
}

impl SearchIndexer {
    /// Create a new search indexer
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Rebuild all search indexes from scratch
    pub async fn rebuild_indexes(&self) -> SearchServiceResult<()> {
        info!("Starting complete rebuild of search indexes");

        // Clear existing FTS data
        self.clear_fts_indexes().await?;

        // Rebuild transcriptions FTS index
        self.rebuild_transcriptions_index().await?;

        // TODO: Add other indexes (meetings, summaries, etc.)

        // Optimize indexes
        self.optimize_indexes().await?;

        info!("Search index rebuild completed successfully");
        Ok(())
    }

    /// Rebuild transcriptions FTS index
    async fn rebuild_transcriptions_index(&self) -> SearchServiceResult<()> {
        debug!("Rebuilding transcriptions FTS index");

        let result = sqlx::query!(
            r#"
            INSERT INTO transcriptions_fts(rowid, content, meeting_title, language, model_used)
            SELECT 
                t.id,
                t.content,
                m.title,
                t.language,
                t.model_used
            FROM transcriptions t
            JOIN meetings m ON t.meeting_id = m.id
            "#
        )
        .execute(&self.pool)
        .await?;

        info!(
            "Rebuilt transcriptions FTS index: {} entries indexed",
            result.rows_affected()
        );

        Ok(())
    }

    /// Add a new transcription to the search index
    pub async fn index_transcription(
        &self,
        transcription_id: i64,
        content: &str,
        meeting_title: &str,
        language: &str,
        model_used: &str,
    ) -> SearchServiceResult<()> {
        debug!("Indexing transcription {}", transcription_id);

        sqlx::query!(
            r#"
            INSERT OR REPLACE INTO transcriptions_fts(rowid, content, meeting_title, language, model_used)
            VALUES (?, ?, ?, ?, ?)
            "#,
            transcription_id,
            content,
            meeting_title,
            language,
            model_used
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update an existing transcription in the search index
    pub async fn update_transcription_index(
        &self,
        transcription_id: i64,
        content: &str,
        meeting_title: &str,
        language: &str,
        model_used: &str,
    ) -> SearchServiceResult<()> {
        debug!("Updating transcription index for {}", transcription_id);

        sqlx::query!(
            r#"
            UPDATE transcriptions_fts 
            SET content = ?, meeting_title = ?, language = ?, model_used = ?
            WHERE rowid = ?
            "#,
            content,
            meeting_title,
            language,
            model_used,
            transcription_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Remove a transcription from the search index
    pub async fn remove_transcription_from_index(
        &self,
        transcription_id: i64,
    ) -> SearchServiceResult<()> {
        debug!("Removing transcription {} from index", transcription_id);

        sqlx::query!(
            "DELETE FROM transcriptions_fts WHERE rowid = ?",
            transcription_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update meeting title across all related transcriptions in FTS
    pub async fn update_meeting_title_in_index(
        &self,
        meeting_id: i64,
        new_title: &str,
    ) -> SearchServiceResult<()> {
        debug!("Updating meeting title in index for meeting {}", meeting_id);

        let result = sqlx::query!(
            r#"
            UPDATE transcriptions_fts 
            SET meeting_title = ?
            WHERE rowid IN (
                SELECT id FROM transcriptions WHERE meeting_id = ?
            )
            "#,
            new_title,
            meeting_id
        )
        .execute(&self.pool)
        .await?;

        debug!(
            "Updated {} transcription entries with new meeting title",
            result.rows_affected()
        );

        Ok(())
    }

    /// Optimize FTS indexes for better performance
    pub async fn optimize_indexes(&self) -> Result<(), SearchError> {
        info!("Optimizing search indexes");

        // Optimize the FTS5 index
        sqlx::query!("INSERT INTO transcriptions_fts(transcriptions_fts) VALUES('optimize')")
            .execute(&self.pool)
            .await?;

        // Analyze tables for better query planning
        sqlx::query!("ANALYZE transcriptions_fts")
            .execute(&self.pool)
            .await?;

        sqlx::query!("ANALYZE search_history")
            .execute(&self.pool)
            .await?;

        sqlx::query!("ANALYZE saved_searches")
            .execute(&self.pool)
            .await?;

        info!("Index optimization completed");
        Ok(())
    }

    /// Get index statistics
    pub async fn get_index_stats(&self) -> SearchServiceResult<IndexStats> {
        let transcription_count: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM transcriptions_fts"
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let search_history_count: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM search_history"
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let saved_searches_count: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM saved_searches"
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        // Get database size (approximation)
        let db_size: i64 = sqlx::query_scalar!(
            "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0) as i64;

        Ok(IndexStats {
            transcription_entries: transcription_count,
            search_history_entries: search_history_count,
            saved_searches: saved_searches_count,
            database_size_bytes: db_size,
            last_optimization: None, // TODO: Track optimization timestamps
        })
    }

    /// Check index integrity
    pub async fn check_index_integrity(&self) -> SearchServiceResult<IndexIntegrityReport> {
        let mut issues = Vec::new();

        // Check for orphaned FTS entries
        let orphaned_fts: i64 = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM transcriptions_fts 
            WHERE rowid NOT IN (SELECT id FROM transcriptions)
            "#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        if orphaned_fts > 0 {
            issues.push(format!("{} orphaned FTS entries found", orphaned_fts));
        }

        // Check for missing FTS entries
        let missing_fts: i64 = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM transcriptions t
            WHERE t.id NOT IN (SELECT rowid FROM transcriptions_fts WHERE rowid IS NOT NULL)
            "#
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        if missing_fts > 0 {
            issues.push(format!("{} transcriptions missing from FTS index", missing_fts));
        }

        Ok(IndexIntegrityReport {
            is_healthy: issues.is_empty(),
            issues,
            checked_at: chrono::Utc::now(),
        })
    }

    /// Repair index integrity issues
    pub async fn repair_indexes(&self) -> SearchServiceResult<IndexRepairReport> {
        let integrity_report = self.check_index_integrity().await?;
        
        if integrity_report.is_healthy {
            return Ok(IndexRepairReport {
                repairs_performed: Vec::new(),
                success: true,
            });
        }

        let mut repairs = Vec::new();

        // Remove orphaned FTS entries
        let orphaned_removed = sqlx::query!(
            r#"
            DELETE FROM transcriptions_fts 
            WHERE rowid NOT IN (SELECT id FROM transcriptions)
            "#
        )
        .execute(&self.pool)
        .await?
        .rows_affected();

        if orphaned_removed > 0 {
            repairs.push(format!("Removed {} orphaned FTS entries", orphaned_removed));
        }

        // Add missing FTS entries
        let missing_added = sqlx::query!(
            r#"
            INSERT INTO transcriptions_fts(rowid, content, meeting_title, language, model_used)
            SELECT 
                t.id,
                t.content,
                m.title,
                t.language,
                t.model_used
            FROM transcriptions t
            JOIN meetings m ON t.meeting_id = m.id
            WHERE t.id NOT IN (SELECT rowid FROM transcriptions_fts WHERE rowid IS NOT NULL)
            "#
        )
        .execute(&self.pool)
        .await?
        .rows_affected();

        if missing_added > 0 {
            repairs.push(format!("Added {} missing FTS entries", missing_added));
        }

        // Optimize after repair
        self.optimize_indexes().await?;
        repairs.push("Optimized indexes after repair".to_string());

        Ok(IndexRepairReport {
            repairs_performed: repairs,
            success: true,
        })
    }

    /// Clear all FTS indexes
    async fn clear_fts_indexes(&self) -> SearchServiceResult<()> {
        debug!("Clearing FTS indexes");

        sqlx::query!("DELETE FROM transcriptions_fts")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Perform maintenance tasks
    pub async fn perform_maintenance(&self) -> SearchServiceResult<MaintenanceReport> {
        info!("Starting search index maintenance");

        let start_time = std::time::Instant::now();
        let mut tasks_completed = Vec::new();

        // Check integrity
        let integrity_report = self.check_index_integrity().await?;
        tasks_completed.push("Index integrity check".to_string());

        // Repair if needed
        if !integrity_report.is_healthy {
            let repair_report = self.repair_indexes().await?;
            if repair_report.success {
                tasks_completed.push("Index repair".to_string());
            }
        }

        // Optimize indexes
        self.optimize_indexes().await?;
        tasks_completed.push("Index optimization".to_string());

        // Clean old search history (keep last 1000 entries)
        let cleaned_history = sqlx::query!(
            r#"
            DELETE FROM search_history 
            WHERE id NOT IN (
                SELECT id FROM search_history 
                ORDER BY created_at DESC 
                LIMIT 1000
            )
            "#
        )
        .execute(&self.pool)
        .await?
        .rows_affected();

        if cleaned_history > 0 {
            tasks_completed.push(format!("Cleaned {} old search history entries", cleaned_history));
        }

        let duration = start_time.elapsed();
        info!("Search index maintenance completed in {:?}", duration);

        Ok(MaintenanceReport {
            tasks_completed,
            duration_ms: duration.as_millis() as u64,
            integrity_issues_found: !integrity_report.is_healthy,
            success: true,
        })
    }
}

/// Statistics about search indexes
#[derive(Debug, Clone)]
pub struct IndexStats {
    pub transcription_entries: i64,
    pub search_history_entries: i64,
    pub saved_searches: i64,
    pub database_size_bytes: i64,
    pub last_optimization: Option<chrono::DateTime<chrono::Utc>>,
}

/// Report on index integrity
#[derive(Debug, Clone)]
pub struct IndexIntegrityReport {
    pub is_healthy: bool,
    pub issues: Vec<String>,
    pub checked_at: chrono::DateTime<chrono::Utc>,
}

/// Report on index repair operations
#[derive(Debug, Clone)]
pub struct IndexRepairReport {
    pub repairs_performed: Vec<String>,
    pub success: bool,
}

/// Report on maintenance operations
#[derive(Debug, Clone)]
pub struct MaintenanceReport {
    pub tasks_completed: Vec<String>,
    pub duration_ms: u64,
    pub integrity_issues_found: bool,
    pub success: bool,
}