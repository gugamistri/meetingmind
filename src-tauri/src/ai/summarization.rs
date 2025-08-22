//! Meeting summarization service and pipeline

use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::ai::{
    AIServiceManager, TemplateManager, CostTracker, 
    SummaryResult, AIOperation, OperationType, ProcessingProgress, ProcessingStage,
    TemplateContext, MeetingType, UsageRecord
};
use crate::error::Result;
use crate::storage::repositories::{
    summary::SummaryRepository,
    transcription::TranscriptionRepository,
};

/// Summarization service for processing meeting transcriptions
pub struct SummarizationService {
    ai_manager: Arc<AIServiceManager>,
    template_manager: Arc<TemplateManager>,
    cost_tracker: Arc<CostTracker>,
    summary_repository: SummaryRepository,
    transcription_repository: TranscriptionRepository,
    processing_queue: Arc<RwLock<ProcessingQueue>>,
}

/// Processing queue for background summarization tasks
struct ProcessingQueue {
    sender: mpsc::UnboundedSender<SummarizationTask>,
    active_tasks: std::collections::HashMap<Uuid, ProcessingProgress>,
}

/// Summarization task for background processing
#[derive(Debug, Clone)]
struct SummarizationTask {
    pub id: Uuid,
    pub meeting_id: Uuid,
    pub template_id: Option<i64>,
    pub meeting_type: Option<MeetingType>,
    pub priority: TaskPriority,
    pub context: Option<TemplateContext>,
}

/// Task priority for queue management
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

impl SummarizationService {
    /// Create a new summarization service
    pub fn new(
        ai_manager: Arc<AIServiceManager>,
        template_manager: Arc<TemplateManager>,
        cost_tracker: Arc<CostTracker>,
        summary_repository: SummaryRepository,
        transcription_repository: TranscriptionRepository,
    ) -> Self {
        let (sender, receiver) = mpsc::unbounded_channel();
        
        let processing_queue = Arc::new(RwLock::new(ProcessingQueue {
            sender,
            active_tasks: std::collections::HashMap::new(),
        }));
        
        let service = Self {
            ai_manager,
            template_manager,
            cost_tracker,
            summary_repository,
            transcription_repository,
            processing_queue,
        };
        
        // Start background processor
        service.start_background_processor(receiver);
        
        service
    }
    
    /// Generate summary for a meeting (async processing)
    pub async fn generate_summary_async(
        &self,
        meeting_id: Uuid,
        template_id: Option<i64>,
        meeting_type: Option<MeetingType>,
        context: Option<TemplateContext>,
    ) -> Result<Uuid> {
        let task_id = Uuid::new_v4();
        
        let task = SummarizationTask {
            id: task_id,
            meeting_id,
            template_id,
            meeting_type,
            priority: TaskPriority::Normal,
            context,
        };
        
        // Add to processing queue
        {
            let mut queue = self.processing_queue.write().await;
            queue.active_tasks.insert(task_id, ProcessingProgress {
                operation_id: task_id,
                stage: ProcessingStage::Initializing,
                progress: 0.0,
                estimated_time_remaining_ms: None,
                message: "Queued for processing".to_string(),
            });
            
            queue.sender.send(task)
                .map_err(|e| crate::error::Error::Internal {
                    message: format!("Failed to queue summarization task: {}", e),
                    source: Some(e.into()),
                })?;
        }
        
        Ok(task_id)
    }
    
    /// Generate summary immediately (synchronous processing)
    pub async fn generate_summary_sync(
        &self,
        meeting_id: Uuid,
        template_id: Option<i64>,
        meeting_type: Option<MeetingType>,
        context: Option<TemplateContext>,
    ) -> Result<SummaryResult> {
        let task_id = Uuid::new_v4();
        
        // Update progress
        self.update_progress(task_id, ProcessingStage::Initializing, 0.1, 
                           Some(30000), "Starting summarization process").await;
        
        // Get transcription
        let transcription = self.transcription_repository
            .get_transcription_by_meeting_id(meeting_id)
            .await?
            .ok_or_else(|| crate::error::Error::Database {
                message: format!("No transcription found for meeting {}", meeting_id),
                source: None,
            })?;
        
        self.update_progress(task_id, ProcessingStage::TextPreprocessing, 0.2, 
                           Some(25000), "Retrieved transcription").await;
        
        // Get or create template
        let template = if let Some(template_id) = template_id {
            self.template_manager.get_template(template_id).await?
        } else if let Some(meeting_type) = meeting_type {
            self.template_manager.get_default_template(meeting_type).await?
        } else {
            self.template_manager.get_default_template(MeetingType::Custom).await?
        };
        
        let template = template.ok_or_else(|| crate::error::Error::Configuration {
            message: "No suitable template found for summarization".to_string(),
            source: None,
        })?;
        
        self.update_progress(task_id, ProcessingStage::CostEstimation, 0.3, 
                           Some(20000), "Processing template").await;
        
        // Process template with context
        let processed_template = if let Some(context) = &context {
            self.template_manager.process_template(&template, context).await?
        } else {
            template.prompt_template.clone()
        };
        
        // Create AI operation
        let operation = AIOperation {
            operation_type: OperationType::Summarization,
            input_text: transcription.content.clone(),
            template: Some(processed_template),
            model_preference: None,
            max_output_tokens: Some(1000),
        };
        
        // Estimate cost
        let cost_estimate = self.ai_manager.estimate_cost(&operation).await?;
        
        self.update_progress(task_id, ProcessingStage::SendingToProvider, 0.4, 
                           Some(15000), format!("Estimated cost: ${:.4}", cost_estimate.estimated_cost_usd)).await;
        
        // Generate summary
        let mut summary_result = self.ai_manager.summarize(&operation).await?;
        
        self.update_progress(task_id, ProcessingStage::PostProcessing, 0.8, 
                           Some(5000), "Processing AI response").await;
        
        // Update summary with correct IDs
        summary_result.id = Uuid::new_v4();
        summary_result.meeting_id = meeting_id;
        summary_result.template_id = template_id;
        
        // Save summary to database
        self.summary_repository.create_summary(&summary_result).await?;
        
        // Record usage for cost tracking
        let usage_record = UsageRecord {
            id: 0, // Will be assigned by database
            service_provider: summary_result.provider,
            operation_type: OperationType::Summarization,
            model_name: summary_result.model_used.clone(),
            input_tokens: Some(cost_estimate.estimated_input_tokens),
            output_tokens: summary_result.token_count,
            cost_usd: summary_result.cost_usd,
            meeting_id: Some(meeting_id),
            summary_id: Some(summary_result.id),
            created_at: summary_result.created_at,
        };
        
        self.cost_tracker.record_usage(&usage_record).await?;
        
        self.update_progress(task_id, ProcessingStage::Completed, 1.0, 
                           Some(0), "Summary completed successfully").await;
        
        // Remove from active tasks
        {
            let mut queue = self.processing_queue.write().await;
            queue.active_tasks.remove(&task_id);
        }
        
        Ok(summary_result)
    }
    
    /// Get processing progress for a task
    pub async fn get_processing_progress(&self, task_id: Uuid) -> Option<ProcessingProgress> {
        let queue = self.processing_queue.read().await;
        queue.active_tasks.get(&task_id).cloned()
    }
    
    /// Get all active processing tasks
    pub async fn get_active_tasks(&self) -> Vec<ProcessingProgress> {
        let queue = self.processing_queue.read().await;
        queue.active_tasks.values().cloned().collect()
    }
    
    /// Cancel a processing task
    pub async fn cancel_task(&self, task_id: Uuid) -> Result<bool> {
        let mut queue = self.processing_queue.write().await;
        if let Some(mut progress) = queue.active_tasks.remove(&task_id) {
            progress.stage = ProcessingStage::Failed;
            progress.message = "Task cancelled by user".to_string();
            Ok(true)
        } else {
            Ok(false)
        }
    }
    
    /// Regenerate summary with different template
    pub async fn regenerate_summary(
        &self,
        meeting_id: Uuid,
        new_template_id: i64,
        context: Option<TemplateContext>,
    ) -> Result<SummaryResult> {
        // Delete existing summaries for this meeting
        let existing_summaries = self.summary_repository
            .get_summaries_by_meeting(meeting_id)
            .await?;
        
        for summary in existing_summaries {
            self.summary_repository.delete_summary(summary.id).await?;
        }
        
        // Generate new summary
        self.generate_summary_sync(meeting_id, Some(new_template_id), None, context).await
    }
    
    /// Get summary for a meeting
    pub async fn get_meeting_summary(&self, meeting_id: Uuid) -> Result<Option<SummaryResult>> {
        let summaries = self.summary_repository.get_summaries_by_meeting(meeting_id).await?;
        Ok(summaries.into_iter().next()) // Return the most recent summary
    }
    
    /// Search summaries
    pub async fn search_summaries(&self, query: &str, limit: u32) -> Result<Vec<SummaryResult>> {
        self.summary_repository.search_summaries(query, limit).await
    }
    
    /// Get recent summaries
    pub async fn get_recent_summaries(&self, limit: u32) -> Result<Vec<SummaryResult>> {
        self.summary_repository.get_recent_summaries(limit).await
    }
    
    /// Update processing progress
    async fn update_progress(
        &self,
        task_id: Uuid,
        stage: ProcessingStage,
        progress: f32,
        estimated_time_remaining_ms: Option<u64>,
        message: String,
    ) {
        let mut queue = self.processing_queue.write().await;
        if let Some(task_progress) = queue.active_tasks.get_mut(&task_id) {
            task_progress.stage = stage;
            task_progress.progress = progress;
            task_progress.estimated_time_remaining_ms = estimated_time_remaining_ms;
            task_progress.message = message;
        }
    }
    
    /// Start background processor for async tasks
    fn start_background_processor(&self, mut receiver: mpsc::UnboundedReceiver<SummarizationTask>) {
        let ai_manager = self.ai_manager.clone();
        let template_manager = self.template_manager.clone();
        let cost_tracker = self.cost_tracker.clone();
        let summary_repository = self.summary_repository.clone();
        let transcription_repository = self.transcription_repository.clone();
        let processing_queue = self.processing_queue.clone();
        
        tokio::spawn(async move {
            while let Some(task) = receiver.recv().await {
                let service = SummarizationService {
                    ai_manager: ai_manager.clone(),
                    template_manager: template_manager.clone(),
                    cost_tracker: cost_tracker.clone(),
                    summary_repository: summary_repository.clone(),
                    transcription_repository: transcription_repository.clone(),
                    processing_queue: processing_queue.clone(),
                };
                
                // Process task in background
                tokio::spawn(async move {
                    let result = service.generate_summary_sync(
                        task.meeting_id,
                        task.template_id,
                        task.meeting_type,
                        task.context,
                    ).await;
                    
                    match result {
                        Ok(_) => {
                            tracing::info!("Background summarization completed for meeting {}", task.meeting_id);
                        }
                        Err(e) => {
                            tracing::error!("Background summarization failed for meeting {}: {}", task.meeting_id, e);
                            
                            // Update progress to failed state
                            let mut queue = service.processing_queue.write().await;
                            if let Some(progress) = queue.active_tasks.get_mut(&task.id) {
                                progress.stage = ProcessingStage::Failed;
                                progress.message = format!("Failed: {}", e);
                            }
                        }
                    }
                });
            }
        });
    }
}

/// Summarization statistics and metrics
#[derive(Debug, Clone, serde::Serialize)]
pub struct SummarizationStats {
    pub total_summaries: u32,
    pub avg_processing_time_ms: u64,
    pub avg_cost: f64,
    pub avg_confidence_score: f32,
    pub provider_breakdown: std::collections::HashMap<crate::ai::types::AIProvider, u32>,
    pub template_usage: std::collections::HashMap<i64, u32>,
}

/// Summary generation options
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SummaryOptions {
    pub template_id: Option<i64>,
    pub meeting_type: Option<MeetingType>,
    pub custom_template: Option<String>,
    pub length_preference: Option<String>, // "brief", "detailed", "comprehensive"
    pub include_action_items: bool,
    pub include_decisions: bool,
    pub include_insights: bool,
    pub context: Option<TemplateContext>,
}