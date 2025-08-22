//! AI-related Tauri command handlers

use std::sync::Arc;
use serde_json::Value;
use uuid::Uuid;

use crate::ai::{
    SummarizationService, TemplateManager, CostTracker, AIServiceManager,
    SummaryResult, SummaryTemplate, MeetingType, TemplateContext, SummaryOptions,
    ProcessingProgress, CostEstimation, UsageStats, ProviderStats, TemplatePreview,
    ImportResult, TemplateTestResult
};
use crate::error::{AppError, AppResult};

/// Generate a meeting summary asynchronously
#[tauri::command]
pub async fn generate_summary_async(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    meeting_id: String,
    template_id: Option<i64>,
    meeting_type: Option<String>,
    context: Option<Value>,
) -> AppResult<String> {
    let meeting_uuid = Uuid::parse_str(&meeting_id)
        .map_err(|_| AppError::config("Invalid meeting ID format"))?;
    
    let meeting_type = meeting_type
        .and_then(|t| MeetingType::from_str(&t));
    
    let context = context
        .map(|v| serde_json::from_value::<TemplateContext>(v))
        .transpose()
        .map_err(|e| AppError::config(format!("Invalid context format: {}", e)))?;
    
    let task_id = summarization_service
        .generate_summary_async(meeting_uuid, template_id, meeting_type, context)
        .await
        .map_err(AppError::from)?;
    
    Ok(task_id.to_string())
}

/// Generate a meeting summary synchronously
#[tauri::command]
pub async fn generate_summary_sync(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    meeting_id: String,
    template_id: Option<i64>,
    meeting_type: Option<String>,
    context: Option<Value>,
) -> AppResult<SummaryResult> {
    let meeting_uuid = Uuid::parse_str(&meeting_id)
        .map_err(|_| AppError::config("Invalid meeting ID format"))?;
    
    let meeting_type = meeting_type
        .and_then(|t| MeetingType::from_str(&t));
    
    let context = context
        .map(|v| serde_json::from_value::<TemplateContext>(v))
        .transpose()
        .map_err(|e| AppError::config(format!("Invalid context format: {}", e)))?;
    
    let summary = summarization_service
        .generate_summary_sync(meeting_uuid, template_id, meeting_type, context)
        .await
        .map_err(AppError::from)?;
    
    Ok(summary)
}

/// Get processing progress for a task
#[tauri::command]
pub async fn get_processing_progress(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    task_id: String,
) -> AppResult<Option<ProcessingProgress>> {
    let task_uuid = Uuid::parse_str(&task_id)
        .map_err(|_| AppError::config("Invalid task ID format"))?;
    
    let progress = summarization_service.get_processing_progress(task_uuid).await;
    Ok(progress)
}

/// Get all active processing tasks
#[tauri::command]
pub async fn get_active_tasks(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
) -> AppResult<Vec<ProcessingProgress>> {
    let tasks = summarization_service.get_active_tasks().await;
    Ok(tasks)
}

/// Cancel a processing task
#[tauri::command]
pub async fn cancel_task(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    task_id: String,
) -> AppResult<bool> {
    let task_uuid = Uuid::parse_str(&task_id)
        .map_err(|_| AppError::config("Invalid task ID format"))?;
    
    let cancelled = summarization_service
        .cancel_task(task_uuid)
        .await
        .map_err(AppError::from)?;
    
    Ok(cancelled)
}

/// Get summary for a meeting
#[tauri::command]
pub async fn get_meeting_summary(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    meeting_id: String,
) -> AppResult<Option<SummaryResult>> {
    let meeting_uuid = Uuid::parse_str(&meeting_id)
        .map_err(|_| AppError::config("Invalid meeting ID format"))?;
    
    let summary = summarization_service
        .get_meeting_summary(meeting_uuid)
        .await
        .map_err(AppError::from)?;
    
    Ok(summary)
}

/// Search summaries
#[tauri::command]
pub async fn search_summaries(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    query: String,
    limit: Option<u32>,
) -> AppResult<Vec<SummaryResult>> {
    let limit = limit.unwrap_or(20);
    
    let summaries = summarization_service
        .search_summaries(&query, limit)
        .await
        .map_err(AppError::from)?;
    
    Ok(summaries)
}

/// Get recent summaries
#[tauri::command]
pub async fn get_recent_summaries(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    limit: Option<u32>,
) -> AppResult<Vec<SummaryResult>> {
    let limit = limit.unwrap_or(10);
    
    let summaries = summarization_service
        .get_recent_summaries(limit)
        .await
        .map_err(AppError::from)?;
    
    Ok(summaries)
}

/// Regenerate summary with different template
#[tauri::command]
pub async fn regenerate_summary(
    summarization_service: tauri::State<'_, Arc<SummarizationService>>,
    meeting_id: String,
    new_template_id: i64,
    context: Option<Value>,
) -> AppResult<SummaryResult> {
    let meeting_uuid = Uuid::parse_str(&meeting_id)
        .map_err(|_| AppError::config("Invalid meeting ID format"))?;
    
    let context = context
        .map(|v| serde_json::from_value::<TemplateContext>(v))
        .transpose()
        .map_err(|e| AppError::config(format!("Invalid context format: {}", e)))?;
    
    let summary = summarization_service
        .regenerate_summary(meeting_uuid, new_template_id, context)
        .await
        .map_err(AppError::from)?;
    
    Ok(summary)
}

// Template Management Commands

/// Create a new template
#[tauri::command]
pub async fn create_template(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    name: String,
    description: Option<String>,
    prompt_template: String,
    meeting_type: String,
    is_default: bool,
) -> AppResult<i64> {
    let meeting_type = MeetingType::from_str(&meeting_type)
        .ok_or_else(|| AppError::config("Invalid meeting type"))?;
    
    let template_id = template_manager
        .create_template(name, description, prompt_template, meeting_type, is_default)
        .await
        .map_err(AppError::from)?;
    
    Ok(template_id)
}

/// Get all templates
#[tauri::command]
pub async fn get_all_templates(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
) -> AppResult<Vec<SummaryTemplate>> {
    let templates = template_manager
        .get_all_templates()
        .await
        .map_err(AppError::from)?;
    
    Ok(templates)
}

/// Get templates by meeting type
#[tauri::command]
pub async fn get_templates_by_type(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    meeting_type: String,
) -> AppResult<Vec<SummaryTemplate>> {
    let meeting_type = MeetingType::from_str(&meeting_type)
        .ok_or_else(|| AppError::config("Invalid meeting type"))?;
    
    let templates = template_manager
        .get_templates_by_type(meeting_type)
        .await
        .map_err(AppError::from)?;
    
    Ok(templates)
}

/// Get template by ID
#[tauri::command]
pub async fn get_template(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    template_id: i64,
) -> AppResult<Option<SummaryTemplate>> {
    let template = template_manager
        .get_template(template_id)
        .await
        .map_err(AppError::from)?;
    
    Ok(template)
}

/// Update a template
#[tauri::command]
pub async fn update_template(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    template: SummaryTemplate,
) -> AppResult<()> {
    template_manager
        .update_template(template)
        .await
        .map_err(AppError::from)?;
    
    Ok(())
}

/// Delete a template
#[tauri::command]
pub async fn delete_template(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    template_id: i64,
) -> AppResult<()> {
    template_manager
        .delete_template(template_id)
        .await
        .map_err(AppError::from)?;
    
    Ok(())
}

/// Preview a template
#[tauri::command]
pub async fn preview_template(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    template: SummaryTemplate,
    context: Option<Value>,
) -> AppResult<TemplatePreview> {
    let context = context
        .map(|v| serde_json::from_value::<TemplateContext>(v))
        .transpose()
        .map_err(|e| AppError::config(format!("Invalid context format: {}", e)))?;
    
    let preview = template_manager
        .preview_template(&template, context.as_ref())
        .await
        .map_err(AppError::from)?;
    
    Ok(preview)
}

/// Test a template
#[tauri::command]
pub async fn test_template(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    template: SummaryTemplate,
    transcription: String,
    context: Value,
) -> AppResult<TemplateTestResult> {
    let context = serde_json::from_value::<TemplateContext>(context)
        .map_err(|e| AppError::config(format!("Invalid context format: {}", e)))?;
    
    let test_result = template_manager
        .test_template(&template, &transcription, &context)
        .await
        .map_err(AppError::from)?;
    
    Ok(test_result)
}

/// Export templates
#[tauri::command]
pub async fn export_templates(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
) -> AppResult<String> {
    let exported = template_manager
        .export_templates()
        .await
        .map_err(AppError::from)?;
    
    Ok(exported)
}

/// Import templates
#[tauri::command]
pub async fn import_templates(
    template_manager: tauri::State<'_, Arc<TemplateManager>>,
    json_data: String,
) -> AppResult<ImportResult> {
    let result = template_manager
        .import_templates(&json_data)
        .await
        .map_err(AppError::from)?;
    
    Ok(result)
}

// Cost Tracking Commands

/// Estimate cost for an operation
#[tauri::command]
pub async fn estimate_cost(
    ai_manager: tauri::State<'_, Arc<AIServiceManager>>,
    transcription_text: String,
    template_text: Option<String>,
    max_output_tokens: Option<u32>,
) -> AppResult<crate::ai::CostEstimate> {
    let operation = crate::ai::AIOperation {
        operation_type: crate::ai::OperationType::Summarization,
        input_text: transcription_text,
        template: template_text,
        model_preference: None,
        max_output_tokens,
    };
    
    let estimate = ai_manager
        .estimate_cost(&operation)
        .await
        .map_err(AppError::from)?;
    
    Ok(estimate)
}

/// Get current usage statistics
#[tauri::command]
pub async fn get_usage_stats(
    cost_tracker: tauri::State<'_, Arc<CostTracker>>,
) -> AppResult<crate::ai::cost_tracking::UsageStats> {
    let stats = cost_tracker
        .get_current_usage()
        .await
        .map_err(AppError::from)?;
    
    Ok(stats)
}

/// Get provider statistics
#[tauri::command]
pub async fn get_provider_stats(
    cost_tracker: tauri::State<'_, Arc<CostTracker>>,
    provider: String,
    days: u32,
) -> AppResult<ProviderStats> {
    let provider = match provider.as_str() {
        "openai" => crate::ai::AIProvider::OpenAI,
        "claude" => crate::ai::AIProvider::Claude,
        _ => return Err(AppError::config("Invalid provider")),
    };
    
    let stats = cost_tracker
        .get_provider_statistics(provider, days)
        .await
        .map_err(AppError::from)?;
    
    Ok(stats)
}

/// Export usage data
#[tauri::command]
pub async fn export_usage_data(
    cost_tracker: tauri::State<'_, Arc<CostTracker>>,
    start_date: String,
    end_date: String,
    format: String,
) -> AppResult<String> {
    let start_date = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|_| AppError::config("Invalid start date format"))?;
    
    let end_date = chrono::NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|_| AppError::config("Invalid end date format"))?;
    
    let export_format = match format.as_str() {
        "csv" => crate::ai::ExportFormat::Csv,
        "json" => crate::ai::ExportFormat::Json,
        _ => return Err(AppError::config("Invalid export format")),
    };
    
    let data = cost_tracker
        .export_usage_data(start_date, end_date, export_format)
        .await
        .map_err(AppError::from)?;
    
    Ok(data)
}

/// Health check all AI services
#[tauri::command]
pub async fn health_check_ai_services(
    ai_manager: tauri::State<'_, Arc<AIServiceManager>>,
) -> AppResult<Vec<crate::ai::ServiceHealth>> {
    let health = ai_manager.health_check_all().await;
    Ok(health)
}