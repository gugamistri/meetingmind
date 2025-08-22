//! AI-related types and data structures

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// AI service provider identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AIProvider {
    OpenAI,
    Claude,
}

impl AIProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            AIProvider::OpenAI => "openai",
            AIProvider::Claude => "claude",
        }
    }
}

/// Summary generation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryResult {
    pub id: Uuid,
    pub meeting_id: Uuid,
    pub template_id: Option<i64>,
    pub content: String,
    pub model_used: String,
    pub provider: AIProvider,
    pub cost_usd: f64,
    pub processing_time_ms: u64,
    pub token_count: Option<u32>,
    pub confidence_score: Option<f32>,
    pub created_at: DateTime<Utc>,
}

/// Cost estimation for AI operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEstimate {
    pub provider: AIProvider,
    pub model: String,
    pub operation_type: OperationType,
    pub estimated_input_tokens: u32,
    pub estimated_output_tokens: u32,
    pub estimated_cost_usd: f64,
    pub confidence: f32, // 0.0 to 1.0
}

/// Type of AI operation being performed
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OperationType {
    Summarization,
    Transcription,
    InsightGeneration,
    ActionItemExtraction,
}

impl OperationType {
    pub fn as_str(&self) -> &'static str {
        match self {
            OperationType::Summarization => "summarization",
            OperationType::Transcription => "transcription", 
            OperationType::InsightGeneration => "insight_generation",
            OperationType::ActionItemExtraction => "action_item_extraction",
        }
    }
}

/// AI operation request
#[derive(Debug, Clone)]
pub struct AIOperation {
    pub operation_type: OperationType,
    pub input_text: String,
    pub template: Option<String>,
    pub model_preference: Option<String>,
    pub max_output_tokens: Option<u32>,
}

/// Summary template for different meeting types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryTemplate {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub prompt_template: String,
    pub meeting_type: MeetingType,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Type of meeting for template selection
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MeetingType {
    Standup,
    Client,
    Brainstorm,
    AllHands,
    Custom,
}

impl MeetingType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MeetingType::Standup => "standup",
            MeetingType::Client => "client",
            MeetingType::Brainstorm => "brainstorm",
            MeetingType::AllHands => "all_hands",
            MeetingType::Custom => "custom",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "standup" => Some(MeetingType::Standup),
            "client" => Some(MeetingType::Client),
            "brainstorm" => Some(MeetingType::Brainstorm),
            "all_hands" => Some(MeetingType::AllHands),
            "custom" => Some(MeetingType::Custom),
            _ => None,
        }
    }
}

/// Usage record for cost tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub id: i64,
    pub service_provider: AIProvider,
    pub operation_type: OperationType,
    pub model_name: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub cost_usd: f64,
    pub meeting_id: Option<Uuid>,
    pub summary_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// AI service configuration
#[derive(Debug, Clone)]
pub struct AIServiceConfig {
    pub provider: AIProvider,
    pub api_key: secrecy::Secret<String>,
    pub model: String,
    pub base_url: Option<String>,
    pub max_retries: u32,
    pub timeout_seconds: u64,
    pub rate_limit_per_minute: u32,
}

/// Progress update for long-running operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingProgress {
    pub operation_id: Uuid,
    pub stage: ProcessingStage,
    pub progress: f32, // 0.0 to 1.0
    pub estimated_time_remaining_ms: Option<u64>,
    pub message: String,
}

/// Stages of AI processing
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProcessingStage {
    Initializing,
    CostEstimation,
    TextPreprocessing,
    SendingToProvider,
    AwaitingResponse,
    PostProcessing,
    Completed,
    Failed,
}

impl ProcessingStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProcessingStage::Initializing => "initializing",
            ProcessingStage::CostEstimation => "cost_estimation",
            ProcessingStage::TextPreprocessing => "text_preprocessing",
            ProcessingStage::SendingToProvider => "sending_to_provider",
            ProcessingStage::AwaitingResponse => "awaiting_response", 
            ProcessingStage::PostProcessing => "post_processing",
            ProcessingStage::Completed => "completed",
            ProcessingStage::Failed => "failed",
        }
    }
}