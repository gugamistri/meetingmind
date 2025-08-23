//! Summary repository for AI-generated meeting summaries

use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDateTime};

use crate::ai::types::{SummaryResult, SummaryTemplate, MeetingType, AIProvider};
use crate::error::Result;

/// Repository for managing meeting summaries
#[derive(Clone)]
pub struct SummaryRepository {
    pool: SqlitePool,
}

impl SummaryRepository {
    /// Create a new summary repository
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
    
    /// Create a new summary
    pub async fn create_summary(&self, summary: &SummaryResult) -> Result<()> {
        let id = summary.id.to_string();
        let meeting_id = summary.meeting_id.to_string();
        let provider = summary.provider.as_str();
        let processing_time_ms = summary.processing_time_ms as i64;
        let token_count = summary.token_count.map(|t| t as i64);
        
        sqlx::query!(
            r#"
            INSERT INTO summaries (
                id, meeting_id, template_id, content, model_used, provider,
                cost_usd, processing_time_ms, token_count, confidence_score,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            id,
            meeting_id,
            summary.template_id,
            summary.content,
            summary.model_used,
            provider,
            summary.cost_usd,
            processing_time_ms,
            token_count,
            summary.confidence_score,
            summary.created_at,
            summary.created_at, // updated_at same as created_at initially
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to create summary: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(())
    }
    
    pub async fn get_summary_by_id(&self, id: Uuid) -> Result<Option<SummaryResult>> {
        let id_str = id.to_string();
        let record = sqlx::query!(
            r#"
            SELECT id, meeting_id, template_id, content, model_used, provider,
                   cost_usd, processing_time_ms, token_count, confidence_score,
                   created_at, updated_at
            FROM summaries 
            WHERE id = ?
            "#,
            id_str
        )
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some(record) = record {
            let provider: AIProvider = match record.provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => AIProvider::OpenAI, // Default
            };
            
            Ok(Some(SummaryResult {
                id: Uuid::parse_str(record.id.as_deref().unwrap_or("")).map_err(|e| crate::error::Error::Database {
                    message: format!("Invalid UUID format for summary ID: {}", e),
                    source: Some(e.into()),
                })?,
                meeting_id: Uuid::parse_str(&record.meeting_id).map_err(|e| crate::error::Error::Database {
                    message: format!("Invalid UUID format for meeting ID: {}", e),
                    source: Some(e.into()),
                })?,
                template_id: record.template_id,
                content: record.content,
                model_used: record.model_used,
                provider,
                cost_usd: record.cost_usd,
                processing_time_ms: record.processing_time_ms as u64,
                token_count: record.token_count.map(|t| t as u32),
                confidence_score: record.confidence_score.map(|s| s as f32),
                created_at: record.created_at
                    .and_then(|dt| Some(dt.and_utc()))
                    .unwrap_or_else(|| Utc::now()),
            }))
        } else {
            Ok(None)
        }
    }
    
    pub async fn get_summaries_by_meeting(&self, meeting_id: Uuid) -> Result<Vec<SummaryResult>> {
        let meeting_id_str = meeting_id.to_string();
        let records = sqlx::query!(
            r#"
            SELECT id, meeting_id, template_id, content, model_used, provider,
                   cost_usd, processing_time_ms, token_count, confidence_score,
                   created_at
            FROM summaries
            WHERE meeting_id = ?
            ORDER BY created_at DESC
            "#,
            meeting_id_str
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch summaries for meeting: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut summaries = Vec::new();
        for record in records {
            let provider: AIProvider = match record.provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => AIProvider::OpenAI,
            };
            
            summaries.push(SummaryResult {
                    id: Uuid::parse_str(record.id.as_deref().unwrap_or("")).map_err(|e| crate::error::Error::Database {
                        message: format!("Invalid UUID format for summary ID: {}", e),
                        source: Some(e.into()),
                    })?,
                    meeting_id: Uuid::parse_str(&record.meeting_id).map_err(|e| crate::error::Error::Database {
                        message: format!("Invalid UUID format for meeting ID: {}", e),
                        source: Some(e.into()),
                    })?,
                    template_id: record.template_id,
                    content: record.content,
                    model_used: record.model_used,
                    provider,
                    cost_usd: record.cost_usd,
                    processing_time_ms: record.processing_time_ms as u64,
                    token_count: record.token_count.map(|t| t as u32),
                    confidence_score: record.confidence_score.map(|s| s as f32),
                created_at: record.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
                });
        }
        
        Ok(summaries)
    }
    
    pub async fn search_summaries(&self, query: &str, limit: u32) -> Result<Vec<SummaryResult>> {
        let records = sqlx::query!(
            r#"
            SELECT s.id, s.meeting_id, s.template_id, s.content, s.model_used, s.provider,
                   s.cost_usd, s.processing_time_ms, s.token_count, s.confidence_score,
                   s.created_at
            FROM summaries s
            JOIN summaries_fts ON summaries_fts.rowid = s.rowid
            WHERE summaries_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            "#,
            query,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to search summaries: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut summaries = Vec::new();
        for record in records {
            let provider: AIProvider = match record.provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => AIProvider::OpenAI,
            };
            
            summaries.push(SummaryResult {
                    id: Uuid::parse_str(record.id.as_deref().unwrap_or("")).map_err(|e| crate::error::Error::Database {
                        message: format!("Invalid UUID format for summary ID: {}", e),
                        source: Some(e.into()),
                    })?,
                    meeting_id: Uuid::parse_str(&record.meeting_id).map_err(|e| crate::error::Error::Database {
                        message: format!("Invalid UUID format for meeting ID: {}", e),
                        source: Some(e.into()),
                    })?,
                    template_id: record.template_id,
                    content: record.content,
                    model_used: record.model_used,
                    provider,
                    cost_usd: record.cost_usd,
                    processing_time_ms: record.processing_time_ms as u64,
                    token_count: record.token_count.map(|t| t as u32),
                    confidence_score: record.confidence_score.map(|s| s as f32),
                created_at: record.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
                });
        }
        
        Ok(summaries)
    }
    
    /// Update a summary
    pub async fn update_summary(&self, summary: &SummaryResult) -> Result<()> {
        let summary_id_str = summary.id.to_string();
        sqlx::query!(
            r#"
            UPDATE summaries
            SET content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            "#,
            summary.content,
            summary_id_str
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to update summary: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(())
    }
    
    /// Delete a summary
    pub async fn delete_summary(&self, id: Uuid) -> Result<()> {
        let id_str = id.to_string();
        sqlx::query!(
            "DELETE FROM summaries WHERE id = ?",
            id_str
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to delete summary: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(())
    }
    
    pub async fn get_recent_summaries(&self, limit: u32) -> Result<Vec<SummaryResult>> {
        let records = sqlx::query!(
            r#"
            SELECT id, meeting_id, template_id, content, model_used, provider,
                   cost_usd, processing_time_ms, token_count, confidence_score,
                   created_at
            FROM summaries
            ORDER BY created_at DESC
            LIMIT ?
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch recent summaries: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut summaries = Vec::new();
        for record in records {
            let provider: AIProvider = match record.provider.as_str() {
                "openai" => AIProvider::OpenAI,
                "claude" => AIProvider::Claude,
                _ => AIProvider::OpenAI,
            };
            
            summaries.push(SummaryResult {
                    id: Uuid::parse_str(record.id.as_deref().unwrap_or("")).map_err(|e| crate::error::Error::Database {
                        message: format!("Invalid UUID format for summary ID: {}", e),
                        source: Some(e.into()),
                    })?,
                    meeting_id: Uuid::parse_str(&record.meeting_id).map_err(|e| crate::error::Error::Database {
                        message: format!("Invalid UUID format for meeting ID: {}", e),
                        source: Some(e.into()),
                    })?,
                    template_id: record.template_id,
                    content: record.content,
                    model_used: record.model_used,
                    provider,
                    cost_usd: record.cost_usd,
                    processing_time_ms: record.processing_time_ms as u64,
                    token_count: record.token_count.map(|t| t as u32),
                    confidence_score: record.confidence_score.map(|s| s as f32),
                created_at: record.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
                });
        }
        
        Ok(summaries)
    }
}

/// Repository for managing summary templates
#[derive(Clone)]
pub struct TemplateRepository {
    pool: SqlitePool,
}

impl TemplateRepository {
    /// Create a new template repository
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
    
    /// Create a new template
    pub async fn create_template(&self, template: &SummaryTemplate) -> Result<i64> {
        let meeting_type_str = template.meeting_type.as_str();
        let id = sqlx::query!(
            r#"
            INSERT INTO summary_templates (
                name, description, prompt_template, meeting_type, is_default,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
            template.name,
            template.description,
            template.prompt_template,
            meeting_type_str,
            template.is_default,
            template.created_at,
            template.updated_at
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to create template: {}", e),
            source: Some(e.into()),
        })?
        .last_insert_rowid();
        
        Ok(id)
    }
    
    pub async fn get_template_by_id(&self, id: i64) -> Result<Option<SummaryTemplate>> {
        let record = sqlx::query!(
            r#"
            SELECT id, name, description, prompt_template, meeting_type,
                   is_default, created_at, updated_at
            FROM summary_templates
            WHERE id = ?
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch template: {}", e),
            source: Some(e.into()),
        })?;
        
        if let Some(record) = record {
            let meeting_type = MeetingType::from_str(&record.meeting_type)
                .unwrap_or(MeetingType::Custom);
            
            Ok(Some(SummaryTemplate {
                id: record.id,
                name: record.name,
                description: record.description,
                prompt_template: record.prompt_template,
                meeting_type,
                is_default: record.is_default.unwrap_or(false),
                created_at: record.created_at
                    .and_then(|dt| Some(dt.and_utc()))
                    .unwrap_or_else(|| Utc::now()),
                updated_at: record.updated_at
                    .and_then(|dt| Some(dt.and_utc()))
                    .unwrap_or_else(|| Utc::now()),
            }))
        } else {
            Ok(None)
        }
    }
    
    pub async fn get_all_templates(&self) -> Result<Vec<SummaryTemplate>> {
        let records = sqlx::query!(
            r#"
            SELECT id, name, description, prompt_template, meeting_type,
                   is_default, created_at, updated_at
            FROM summary_templates
            ORDER BY is_default DESC, name ASC
            "#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch templates: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut templates = Vec::new();
        for record in records {
            let name = record.name;
            let prompt_template = record.prompt_template;
            let meeting_type_str = record.meeting_type;
            let meeting_type = MeetingType::from_str(&meeting_type_str)
                .unwrap_or(MeetingType::Custom);
            
            templates.push(SummaryTemplate {
                id: record.id,
                name: name.to_string(),
                description: record.description,
                prompt_template: prompt_template.to_string(),
                meeting_type,
                is_default: record.is_default.unwrap_or(false),
                created_at: record.created_at
                        .and_then(|dt| Some(dt.and_utc()))
                        .unwrap_or_else(|| Utc::now()),
                updated_at: record.updated_at
                        .and_then(|dt| Some(dt.and_utc()))
                        .unwrap_or_else(|| Utc::now()),
                });
        }
        
        Ok(templates)
    }
    
    pub async fn get_templates_by_type(&self, meeting_type: MeetingType) -> Result<Vec<SummaryTemplate>> {
        let meeting_type_clone = meeting_type.clone();
        let meeting_type_str = meeting_type.as_str();
        let records = sqlx::query!(
            r#"
            SELECT id, name, description, prompt_template, meeting_type,
                   is_default, created_at, updated_at
            FROM summary_templates
            WHERE meeting_type = ?
            ORDER BY is_default DESC, name ASC
            "#,
            meeting_type_str
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch templates by type: {}", e),
            source: Some(e.into()),
        })?;
        
        let mut templates = Vec::new();
        for record in records {
            let name = record.name;
            let prompt_template = record.prompt_template;
            templates.push(SummaryTemplate {
                id: record.id.unwrap_or(0),
                name: name.to_string(),
                description: record.description,
                prompt_template: prompt_template.to_string(),
                meeting_type: meeting_type_clone.clone(),
                    is_default: record.is_default.unwrap_or(false),
                created_at: record.created_at
                        .and_then(|dt| Some(dt.and_utc()))
                        .unwrap_or_else(|| Utc::now()),
                updated_at: record.updated_at
                        .and_then(|dt| Some(dt.and_utc()))
                        .unwrap_or_else(|| Utc::now()),
                });
        }
        
        Ok(templates)
    }
    
    /// Update a template
    pub async fn update_template(&self, template: &SummaryTemplate) -> Result<()> {
        let meeting_type_str = template.meeting_type.as_str();
        sqlx::query!(
            r#"
            UPDATE summary_templates
            SET name = ?, description = ?, prompt_template = ?,
                meeting_type = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            "#,
            template.name,
            template.description,
            template.prompt_template,
            meeting_type_str,
            template.is_default,
            template.id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to update template: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(())
    }
    
    /// Delete a template
    pub async fn delete_template(&self, id: i64) -> Result<()> {
        sqlx::query!(
            "DELETE FROM summary_templates WHERE id = ?",
            id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to delete template: {}", e),
            source: Some(e.into()),
        })?;
        
        Ok(())
    }
    
    pub async fn get_default_template(&self, meeting_type: MeetingType) -> Result<Option<SummaryTemplate>> {
        let meeting_type_str = meeting_type.as_str();
        let record = sqlx::query!(
            r#"
            SELECT id, name, description, prompt_template, meeting_type,
                   is_default, created_at, updated_at
            FROM summary_templates
            WHERE meeting_type = ? AND is_default = TRUE
            LIMIT 1
            "#,
            meeting_type_str
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::Error::Database {
            message: format!("Failed to fetch default template: {}", e),
            source: Some(e.into()),
        })?;
        
        if let Some(record) = record {
            let name = record.name;
            let prompt_template = record.prompt_template;
            if !name.is_empty() && !prompt_template.is_empty() {
                Ok(Some(SummaryTemplate {
                    id: record.id.unwrap_or(0),
                    name,
                    description: record.description,
                    prompt_template,
                    meeting_type,
                    is_default: record.is_default.unwrap_or(false),
                created_at: record.created_at
                        .and_then(|dt| Some(dt.and_utc()))
                        .unwrap_or_else(|| Utc::now()),
                updated_at: record.updated_at
                        .and_then(|dt| Some(dt.and_utc()))
                        .unwrap_or_else(|| Utc::now()),
                }))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }
}