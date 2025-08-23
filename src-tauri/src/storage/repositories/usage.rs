//! Usage records repository for cost tracking and analytics

use chrono::{DateTime, Utc, NaiveDate};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::ai::types::{UsageRecord, AIProvider, OperationType};
use crate::error::Result;

/// Repository for managing AI usage records
#[derive(Clone)]
pub struct UsageRepository {
    pool: SqlitePool,
}

impl UsageRepository {
    /// Create a new usage repository
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
    
    pub async fn create_usage_record(&self, record: &UsageRecord) -> Result<i64> {
        let service_provider = record.service_provider.as_str();
        let operation_type = record.operation_type.as_str();
        let meeting_id_str = record.meeting_id.map(|id| id.to_string());
        let summary_id_str = record.summary_id.map(|id| id.to_string());
        
        let id = sqlx::query!(
            r#"
            INSERT INTO usage_records (
                service_provider, operation_type, model_name,
                input_tokens, output_tokens, cost_usd,
                meeting_id, summary_id, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            service_provider,
            operation_type,
            record.model_name,
            record.input_tokens,
            record.output_tokens,
            record.cost_usd,
            meeting_id_str,
            summary_id_str,
            record.created_at
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to create usage record: {}", e),
            source: Some(e.into()),
        })?
        .last_insert_rowid();
        
        Ok(id)
    }
    
    pub async fn get_usage_by_date_range(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<UsageRecord>> {
        let start_datetime = start_date.and_hms_opt(0, 0, 0).unwrap();
        let end_datetime = end_date.and_hms_opt(23, 59, 59).unwrap();
        
        let records = sqlx::query!(
            r#"
            SELECT id, service_provider, operation_type, model_name,
                   input_tokens, output_tokens, cost_usd,
                   meeting_id, summary_id, created_at
            FROM usage_records
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            ORDER BY created_at DESC
            "#,
            start_datetime,
            end_datetime
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch usage records: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut usage_records = Vec::new();
        for record in records {
            let provider = AIProvider::OpenAI; // Default, will be corrected below
            let provider = match record.service_provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => provider,
            };
            
            let operation_type = match record.operation_type.as_str() {
                "summarization" => OperationType::Summarization,
                "transcription" => OperationType::Transcription,
                "insight_generation" => OperationType::InsightGeneration,
                "action_item_extraction" => OperationType::ActionItemExtraction,
                _ => OperationType::Summarization, // Default
            };
            
            let meeting_id = record.meeting_id
                .as_ref()
                .and_then(|id| Uuid::parse_str(id).ok());
            let summary_id = record.summary_id
                .as_ref()
                .and_then(|id| Uuid::parse_str(id).ok());
            
            usage_records.push(UsageRecord {
                id: record.id.unwrap_or(0),
                service_provider: provider.clone(),
                operation_type,
                model_name: record.model_name,
                input_tokens: record.input_tokens.map(|t| t as u32),
                output_tokens: record.output_tokens.map(|t| t as u32),
                cost_usd: record.cost_usd,
                meeting_id,
                summary_id,
                created_at: record.created_at.and_then(|dt| Some(dt.and_utc())).unwrap_or_else(|| Utc::now()),
            });
        }
        
        Ok(usage_records)
    }
    
    pub async fn get_usage_by_provider_and_date_range(
        &self,
        provider: AIProvider,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<UsageRecord>> {
        let start_datetime = start_date.and_hms_opt(0, 0, 0).unwrap();
        let end_datetime = end_date.and_hms_opt(23, 59, 59).unwrap();
        let provider_str = provider.as_str();
        
        let records = sqlx::query!(
            r#"
            SELECT id, service_provider, operation_type, model_name,
                   input_tokens, output_tokens, cost_usd,
                   meeting_id, summary_id, created_at
            FROM usage_records
            WHERE service_provider = ?
              AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            ORDER BY created_at DESC
            "#,
            provider_str,
            start_datetime,
            end_datetime
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch usage records by provider: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut usage_records = Vec::new();
        for record in records {
            let operation_type = match record.operation_type.as_str() {
                "summarization" => OperationType::Summarization,
                "transcription" => OperationType::Transcription,
                "insight_generation" => OperationType::InsightGeneration,
                "action_item_extraction" => OperationType::ActionItemExtraction,
                _ => OperationType::Summarization, // Default
            };
            
            let meeting_id = record.meeting_id
                .as_ref()
                .and_then(|id| Uuid::parse_str(id).ok());
            let summary_id = record.summary_id
                .as_ref()
                .and_then(|id| Uuid::parse_str(id).ok());
            
            usage_records.push(UsageRecord {
                id: record.id.unwrap_or(0),
                service_provider: provider.clone(),
                operation_type,
                model_name: record.model_name,
                input_tokens: record.input_tokens.map(|t| t as u32),
                output_tokens: record.output_tokens.map(|t| t as u32),
                cost_usd: record.cost_usd,
                meeting_id,
                summary_id,
                created_at: record.created_at.and_then(|dt| Some(dt.and_utc())).unwrap_or_else(|| Utc::now()),
            });
        }
        
        Ok(usage_records)
    }
    
    /// Get usage statistics for a specific period
    pub async fn get_usage_statistics(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<UsageStatistics> {
        let start_datetime = start_date.and_hms_opt(0, 0, 0).unwrap();
        let end_datetime = end_date.and_hms_opt(23, 59, 59).unwrap();
        
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_operations,
                SUM(cost_usd) as total_cost,
                SUM(COALESCE(input_tokens, 0)) as total_input_tokens,
                SUM(COALESCE(output_tokens, 0)) as total_output_tokens,
                AVG(cost_usd) as avg_cost_per_operation
            FROM usage_records
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            "#,
            start_datetime,
            end_datetime
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch usage statistics: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(UsageStatistics {
            total_operations: stats.total_operations as u32,
            total_cost: stats.total_cost.unwrap_or(0.0),
            total_input_tokens: stats.total_input_tokens.unwrap_or(0) as u32,
            total_output_tokens: stats.total_output_tokens.unwrap_or(0) as u32,
            avg_cost_per_operation: stats.avg_cost_per_operation.unwrap_or(0.0),
        })
    }
    
    /// Get usage breakdown by provider
    pub async fn get_provider_breakdown(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<ProviderBreakdown>> {
        let start_datetime = start_date.and_hms_opt(0, 0, 0).unwrap();
        let end_datetime = end_date.and_hms_opt(23, 59, 59).unwrap();
        
        let breakdown = sqlx::query!(
            r#"
            SELECT 
                service_provider,
                COUNT(*) as operation_count,
                SUM(cost_usd) as total_cost,
                AVG(cost_usd) as avg_cost
            FROM usage_records
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            GROUP BY service_provider
            ORDER BY total_cost DESC
            "#,
            start_datetime,
            end_datetime
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch provider breakdown: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut result = Vec::new();
        for record in breakdown {
            let provider = match record.service_provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => continue, // Skip unknown providers
            };
            
            result.push(ProviderBreakdown {
                provider,
                operation_count: record.operation_count as u32,
                total_cost: record.total_cost,
                avg_cost: record.avg_cost,
            });
        }
        
        Ok(result)
    }
    
    pub async fn get_usage_by_meeting(
        &self,
        meeting_id: Uuid,
        limit: u32,
    ) -> Result<Vec<UsageRecord>> {
        let meeting_id_str = meeting_id.to_string();
        let records = sqlx::query!(
            r#"
            SELECT id, service_provider, operation_type, model_name,
                   input_tokens, output_tokens, cost_usd,
                   meeting_id, summary_id, created_at
            FROM usage_records
            WHERE meeting_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#,
            meeting_id_str,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch usage records by meeting: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut usage_records = Vec::new();
        for record in records {
            let provider = match record.service_provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => continue,
            };
            
            let operation_type = match record.operation_type.as_str() {
                "summarization" => OperationType::Summarization,
                "transcription" => OperationType::Transcription,
                "insight_generation" => OperationType::InsightGeneration,
                "action_item_extraction" => OperationType::ActionItemExtraction,
                _ => OperationType::Summarization,
            };
            
            let meeting_id = record.meeting_id
                .as_ref()
                .and_then(|id| Uuid::parse_str(id).ok());
            let summary_id = record.summary_id
                .as_ref()
                .and_then(|id| Uuid::parse_str(id).ok());
            
            usage_records.push(UsageRecord {
                id: record.id.unwrap_or(0),
                service_provider: provider.clone(),
                operation_type,
                model_name: record.model_name,
                input_tokens: record.input_tokens.map(|t| t as u32),
                output_tokens: record.output_tokens.map(|t| t as u32),
                cost_usd: record.cost_usd,
                meeting_id,
                summary_id,
                created_at: record.created_at.and_then(|dt| Some(dt.and_utc())).unwrap_or_else(|| Utc::now()),
            });
        }
        
        Ok(usage_records)
    }
    
    /// Delete old usage records (for data retention)
    pub async fn delete_old_records(&self, older_than: NaiveDate) -> Result<u64> {
        let cutoff_datetime = older_than.and_hms_opt(0, 0, 0).unwrap();
        
        let result = sqlx::query!(
            r#"
            DELETE FROM usage_records
            WHERE DATE(created_at) < DATE(?)
            "#,
            cutoff_datetime
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to delete old usage records: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(result.rows_affected())
    }
}

/// Usage statistics summary
#[derive(Debug, Clone)]
pub struct UsageStatistics {
    pub total_operations: u32,
    pub total_cost: f64,
    pub total_input_tokens: u32,
    pub total_output_tokens: u32,
    pub avg_cost_per_operation: f64,
}

/// Provider usage breakdown
#[derive(Debug, Clone)]
pub struct ProviderBreakdown {
    pub provider: AIProvider,
    pub operation_count: u32,
    pub total_cost: f64,
    pub avg_cost: f64,
}