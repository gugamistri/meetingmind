//! AI-powered features (summarization, insights, cost tracking)

pub mod types;
pub mod client;
pub mod openai;
pub mod claude;
pub mod manager;
pub mod cost_tracking;
pub mod templates;
pub mod summarization;

pub use types::*;
pub use client::AIServiceClient;
pub use openai::OpenAIClient;
pub use claude::ClaudeClient;
pub use manager::{AIServiceManager, UsageStats, ServiceHealth};
pub use cost_tracking::{CostTracker, CostEstimation, BudgetImpact, ProviderStats, WarningLevel, ExportFormat};
pub use templates::{TemplateManager, TemplateContext, TemplatePreview, ImportResult, TemplateTestResult};
pub use summarization::{SummarizationService, SummarizationStats, SummaryOptions};

#[cfg(test)]
mod tests;