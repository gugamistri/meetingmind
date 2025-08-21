//! Database connection and setup utilities

use crate::error::{AppError, Result};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Row};
use std::path::Path;
use tracing::{debug, info, warn};

/// Database connection pool type
pub type DatabasePool = Pool<Sqlite>;

/// Database manager for SQLite operations
pub struct DatabaseManager {
    pool: DatabasePool,
    database_path: String,
}

impl DatabaseManager {
    /// Create a new database manager and initialize the database
    pub async fn new() -> Result<Self> {
        let database_path = Self::get_database_path().await?;
        
        info!("Initializing database at: {}", database_path);
        
        // Ensure parent directory exists
        if let Some(parent) = Path::new(&database_path).parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                AppError::database(format!("Failed to create database directory: {}", e))
            })?;
        }

        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&format!("sqlite:{}", database_path))
            .await
            .map_err(|e| AppError::database(format!("Failed to connect to database: {}", e)))?;

        let manager = Self {
            pool,
            database_path,
        };

        // Run migrations
        manager.run_migrations().await?;

        info!("Database initialized successfully");
        Ok(manager)
    }

    /// Get the database file path
    async fn get_database_path() -> Result<String> {
        // Try to get from environment variable first
        if let Ok(db_path) = std::env::var("MEETINGMIND_DB_PATH") {
            return Ok(db_path);
        }

        // Use default path
        let app_data_dir = Self::get_app_data_directory().await?;
        let db_path = Path::new(&app_data_dir).join("meetingmind.db");
        
        Ok(db_path.to_string_lossy().to_string())
    }

    /// Get application data directory
    async fn get_app_data_directory() -> Result<String> {
        // For now, use a simple local directory
        // In production, this would use platform-specific app data directories
        let current_dir = std::env::current_dir()
            .map_err(|e| AppError::database(format!("Failed to get current directory: {}", e)))?;
        
        let app_data = current_dir.join("data");
        Ok(app_data.to_string_lossy().to_string())
    }

    /// Run database migrations
    pub async fn run_migrations(&self) -> Result<()> {
        info!("Running database migrations");

        // Create migrations table if it doesn't exist
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to create migrations table: {}", e)))?;

        // Run individual migrations
        self.run_migration("001_initial", include_str!("migrations/001_initial.sql")).await?;
        self.run_migration("002_transcriptions", include_str!("migrations/002_transcriptions.sql")).await?;
        self.run_migration("003_search_index", include_str!("migrations/003_search_index.sql")).await?;

        info!("Database migrations completed");
        Ok(())
    }

    /// Run a single migration
    async fn run_migration(&self, name: &str, sql: &str) -> Result<()> {
        // Check if migration already applied
        let applied = sqlx::query("SELECT COUNT(*) as count FROM _migrations WHERE name = ?")
            .bind(name)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to check migration status: {}", e)))?
            .get::<i64, _>("count") > 0;

        if applied {
            debug!("Migration '{}' already applied", name);
            return Ok(());
        }

        info!("Applying migration: {}", name);

        // Execute migration SQL
        sqlx::query(sql)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to apply migration '{}': {}", name, e)))?;

        // Record migration as applied
        sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
            .bind(name)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to record migration '{}': {}", name, e)))?;

        info!("Migration '{}' applied successfully", name);
        Ok(())
    }

    /// Get database connection pool
    pub fn pool(&self) -> &DatabasePool {
        &self.pool
    }

    /// Get database file path
    pub fn database_path(&self) -> &str {
        &self.database_path
    }

    /// Check database health
    pub async fn health_check(&self) -> Result<DatabaseHealthInfo> {
        debug!("Performing database health check");

        // Test basic connectivity
        let start_time = std::time::Instant::now();
        sqlx::query("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Database connectivity failed: {}", e)))?;
        let connectivity_time = start_time.elapsed();

        // Get database file size
        let file_size = tokio::fs::metadata(&self.database_path)
            .await
            .map(|m| m.len())
            .unwrap_or(0);

        // Get pool statistics
        let pool_size = self.pool.size();
        let idle_connections = self.pool.num_idle();

        // Get table counts
        let transcription_count = self.get_table_count("transcriptions").await.unwrap_or(0);
        let meeting_count = self.get_table_count("meetings").await.unwrap_or(0);

        let health_info = DatabaseHealthInfo {
            connected: true,
            connectivity_time_ms: connectivity_time.as_millis() as u64,
            file_size_bytes: file_size,
            pool_size,
            idle_connections,
            transcription_count,
            meeting_count,
            database_path: self.database_path.clone(),
        };

        debug!("Database health check completed: {:?}", health_info);
        Ok(health_info)
    }

    /// Get count of records in a table
    async fn get_table_count(&self, table_name: &str) -> Result<i64> {
        let count = sqlx::query(&format!("SELECT COUNT(*) as count FROM {}", table_name))
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to count {} records: {}", table_name, e)))?
            .get::<i64, _>("count");

        Ok(count)
    }

    /// Vacuum the database to reclaim space
    pub async fn vacuum(&self) -> Result<()> {
        info!("Running database vacuum");
        
        sqlx::query("VACUUM")
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to vacuum database: {}", e)))?;

        info!("Database vacuum completed");
        Ok(())
    }

    /// Backup the database to a specified path
    pub async fn backup(&self, backup_path: &str) -> Result<()> {
        info!("Creating database backup to: {}", backup_path);

        // Ensure backup directory exists
        if let Some(parent) = Path::new(backup_path).parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                AppError::database(format!("Failed to create backup directory: {}", e))
            })?;
        }

        // Simple file copy for SQLite
        tokio::fs::copy(&self.database_path, backup_path)
            .await
            .map_err(|e| AppError::database(format!("Failed to copy database file: {}", e)))?;

        info!("Database backup completed");
        Ok(())
    }

    /// Close the database connection pool
    pub async fn close(&self) {
        self.pool.close().await;
        info!("Database connection pool closed");
    }

    /// Execute a custom query
    pub async fn execute_query(&self, sql: &str) -> Result<u64> {
        let result = sqlx::query(sql)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::database(format!("Failed to execute query: {}", e)))?;

        Ok(result.rows_affected())
    }

    /// Check if a table exists
    pub async fn table_exists(&self, table_name: &str) -> Result<bool> {
        let count = sqlx::query(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
        )
        .bind(table_name)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to check table existence: {}", e)))?
        .get::<i64, _>("count");

        Ok(count > 0)
    }

    /// Get database schema information
    pub async fn get_schema_info(&self) -> Result<Vec<TableInfo>> {
        let rows = sqlx::query(
            "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::database(format!("Failed to get schema info: {}", e)))?;

        let mut tables = Vec::new();
        for row in rows {
            let name: String = row.get("name");
            let sql: Option<String> = row.get("sql");
            
            tables.push(TableInfo {
                name,
                create_sql: sql,
            });
        }

        Ok(tables)
    }
}

/// Database health information
#[derive(Debug, Clone)]
pub struct DatabaseHealthInfo {
    pub connected: bool,
    pub connectivity_time_ms: u64,
    pub file_size_bytes: u64,
    pub pool_size: u32,
    pub idle_connections: usize,
    pub transcription_count: i64,
    pub meeting_count: i64,
    pub database_path: String,
}

/// Table schema information
#[derive(Debug, Clone)]
pub struct TableInfo {
    pub name: String,
    pub create_sql: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_database_manager_creation() {
        // Set temporary database path
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        std::env::set_var("MEETINGMIND_DB_PATH", db_path.to_str().unwrap());

        let result = DatabaseManager::new().await;
        assert!(result.is_ok());

        let manager = result.unwrap();
        assert!(manager.database_path().contains("test.db"));

        // Clean up
        std::env::remove_var("MEETINGMIND_DB_PATH");
    }

    #[tokio::test]
    async fn test_health_check() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("health_test.db");
        std::env::set_var("MEETINGMIND_DB_PATH", db_path.to_str().unwrap());

        let manager = DatabaseManager::new().await.unwrap();
        let health = manager.health_check().await;
        
        assert!(health.is_ok());
        let health_info = health.unwrap();
        assert!(health_info.connected);
        assert!(health_info.connectivity_time_ms < 1000); // Should be fast

        std::env::remove_var("MEETINGMIND_DB_PATH");
    }

    #[tokio::test]
    async fn test_table_operations() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("table_test.db");
        std::env::set_var("MEETINGMIND_DB_PATH", db_path.to_str().unwrap());

        let manager = DatabaseManager::new().await.unwrap();
        
        // Check if transcriptions table exists (should exist after migrations)
        let exists = manager.table_exists("transcriptions").await.unwrap();
        assert!(exists);

        // Check if non-existent table doesn't exist
        let exists = manager.table_exists("non_existent_table").await.unwrap();
        assert!(!exists);

        std::env::remove_var("MEETINGMIND_DB_PATH");
    }
}