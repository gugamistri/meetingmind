//! Cost tracking and transparency system for AI operations

use std::collections::HashMap;
use chrono::{DateTime, Utc, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::ai::types::{AIProvider, UsageRecord, OperationType};
use crate::error::Result;
use crate::storage::repositories::usage::UsageRepository;

/// Cost tracker for monitoring AI service usage and budgets
pub struct CostTracker {
    repository: UsageRepository,
    daily_budget: f64,
    monthly_budget: f64,
    warning_threshold: f64, // Percentage (0.0 to 1.0) at which to warn
}

impl CostTracker {
    /// Create a new cost tracker
    pub fn new(
        repository: UsageRepository,
        daily_budget: f64,
        monthly_budget: f64,
        warning_threshold: f64,
    ) -> Self {
        Self {
            repository,
            daily_budget,
            monthly_budget,
            warning_threshold,
        }
    }
    
    /// Record usage for an AI operation
    pub async fn record_usage(&self, record: &UsageRecord) -> Result<()> {
        self.repository.create_usage_record(record).await?;
        
        // Check if we should send warnings
        let current_usage = self.get_current_usage().await?;
        self.check_budget_warnings(&current_usage).await;
        
        Ok(())
    }
    
    /// Get current usage statistics
    pub async fn get_current_usage(&self) -> Result<UsageStats> {
        let today = chrono::Local::now().date_naive();
        let month_start = NaiveDate::from_ymd_opt(today.year(), today.month(), 1)
            .unwrap_or(today);
        
        // Get daily usage
        let daily_usage = self.repository
            .get_usage_by_date_range(today, today)
            .await?;
        
        // Get monthly usage
        let monthly_usage = self.repository
            .get_usage_by_date_range(month_start, today)
            .await?;
        
        let daily_spend = calculate_total_cost(&daily_usage);
        let monthly_spend = calculate_total_cost(&monthly_usage);
        
        let provider_breakdown = calculate_provider_breakdown(&daily_usage);
        let operation_breakdown = calculate_operation_breakdown(&daily_usage);
        
        Ok(UsageStats {
            daily_spend,
            monthly_spend,
            daily_budget: self.daily_budget,
            monthly_budget: self.monthly_budget,
            daily_remaining: (self.daily_budget - daily_spend).max(0.0),
            monthly_remaining: (self.monthly_budget - monthly_spend).max(0.0),
            daily_utilization: daily_spend / self.daily_budget,
            monthly_utilization: monthly_spend / self.monthly_budget,
            provider_breakdown,
            operation_breakdown,
            warning_level: self.calculate_warning_level(daily_spend, monthly_spend),
        })
    }
    
    /// Estimate cost for a planned operation
    pub async fn estimate_operation_cost(
        &self,
        provider: AIProvider,
        operation_type: OperationType,
        input_tokens: u32,
        output_tokens: u32,
    ) -> Result<CostEstimation> {
        let cost_per_operation = self.calculate_cost_for_operation(
            &provider,
            &operation_type,
            input_tokens,
            output_tokens,
        );
        
        let current_usage = self.get_current_usage().await?;
        
        let new_daily_spend = current_usage.daily_spend + cost_per_operation;
        let new_monthly_spend = current_usage.monthly_spend + cost_per_operation;
        
        let can_afford = new_daily_spend <= self.daily_budget 
            && new_monthly_spend <= self.monthly_budget;
        
        Ok(CostEstimation {
            estimated_cost: cost_per_operation,
            provider,
            operation_type,
            input_tokens,
            output_tokens,
            can_afford,
            budget_impact: BudgetImpact {
                daily_before: current_usage.daily_spend,
                daily_after: new_daily_spend,
                monthly_before: current_usage.monthly_spend,
                monthly_after: new_monthly_spend,
                daily_budget: self.daily_budget,
                monthly_budget: self.monthly_budget,
            },
        })
    }
    
    /// Get usage history for a specific time period
    pub async fn get_usage_history(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<UsageRecord>> {
        self.repository.get_usage_by_date_range(start_date, end_date).await
    }
    
    /// Get usage statistics by provider
    pub async fn get_provider_statistics(
        &self,
        provider: AIProvider,
        days: u32,
    ) -> Result<ProviderStats> {
        let end_date = chrono::Local::now().date_naive();
        let start_date = end_date - chrono::Duration::days(days as i64);
        
        let usage_records = self.repository
            .get_usage_by_provider_and_date_range(provider, start_date, end_date)
            .await?;
        
        let total_cost = calculate_total_cost(&usage_records);
        let total_operations = usage_records.len() as u32;
        let total_input_tokens: u32 = usage_records
            .iter()
            .filter_map(|r| r.input_tokens)
            .sum();
        let total_output_tokens: u32 = usage_records
            .iter()
            .filter_map(|r| r.output_tokens)
            .sum();
        
        let avg_cost_per_operation = if total_operations > 0 {
            total_cost / total_operations as f64
        } else {
            0.0
        };
        
        Ok(ProviderStats {
            provider,
            total_cost,
            total_operations,
            total_input_tokens,
            total_output_tokens,
            avg_cost_per_operation,
            period_days: days,
        })
    }
    
    /// Export usage data for external analysis
    pub async fn export_usage_data(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
        format: ExportFormat,
    ) -> Result<String> {
        let usage_records = self.get_usage_history(start_date, end_date).await?;
        
        match format {
            ExportFormat::Csv => self.export_as_csv(&usage_records),
            ExportFormat::Json => self.export_as_json(&usage_records),
        }
    }
    
    /// Calculate warning level based on current usage
    fn calculate_warning_level(&self, daily_spend: f64, monthly_spend: f64) -> WarningLevel {
        let daily_utilization = daily_spend / self.daily_budget;
        let monthly_utilization = monthly_spend / self.monthly_budget;
        
        let max_utilization = daily_utilization.max(monthly_utilization);
        
        if max_utilization >= 1.0 {
            WarningLevel::Critical
        } else if max_utilization >= self.warning_threshold {
            WarningLevel::Warning
        } else if max_utilization >= self.warning_threshold * 0.8 {
            WarningLevel::Info
        } else {
            WarningLevel::Normal
        }
    }
    
    /// Check if budget warnings should be sent
    async fn check_budget_warnings(&self, usage: &UsageStats) {
        match usage.warning_level {
            WarningLevel::Critical => {
                tracing::error!(
                    "Budget exceeded! Daily: ${:.2}/${:.2}, Monthly: ${:.2}/${:.2}",
                    usage.daily_spend,
                    usage.daily_budget,
                    usage.monthly_spend,
                    usage.monthly_budget
                );
                // TODO: Send notification to user
            }
            WarningLevel::Warning => {
                tracing::warn!(
                    "Budget warning! Daily: ${:.2}/${:.2} ({:.1}%), Monthly: ${:.2}/${:.2} ({:.1}%)",
                    usage.daily_spend,
                    usage.daily_budget,
                    usage.daily_utilization * 100.0,
                    usage.monthly_spend,
                    usage.monthly_budget,
                    usage.monthly_utilization * 100.0
                );
                // TODO: Send notification to user
            }
            _ => {} // No warning needed
        }
    }
    
    /// Calculate cost for a specific operation
    fn calculate_cost_for_operation(
        &self,
        provider: &AIProvider,
        operation_type: &OperationType,
        input_tokens: u32,
        output_tokens: u32,
    ) -> f64 {
        // This would normally use the same pricing logic as in the clients
        // For now, we'll use approximate values
        match provider {
            AIProvider::OpenAI => {
                let (input_cost_per_1k, output_cost_per_1k) = match operation_type {
                    OperationType::Summarization => (0.01, 0.03), // GPT-4 Turbo pricing
                    _ => (0.01, 0.03),
                };
                (input_tokens as f64 / 1000.0) * input_cost_per_1k +
                (output_tokens as f64 / 1000.0) * output_cost_per_1k
            }
            AIProvider::Claude => {
                let (input_cost_per_1m, output_cost_per_1m) = match operation_type {
                    OperationType::Summarization => (3.0, 15.0), // Claude 3 Sonnet pricing
                    _ => (3.0, 15.0),
                };
                (input_tokens as f64 / 1_000_000.0) * input_cost_per_1m +
                (output_tokens as f64 / 1_000_000.0) * output_cost_per_1m
            }
        }
    }
    
    /// Export usage records as CSV
    fn export_as_csv(&self, records: &[UsageRecord]) -> Result<String> {
        let mut csv = String::new();
        csv.push_str("Date,Provider,Operation,Model,Input Tokens,Output Tokens,Cost USD\n");
        
        for record in records {
            csv.push_str(&format!(
                "{},{},{},{},{},{},{:.6}\n",
                record.created_at.format("%Y-%m-%d %H:%M:%S"),
                record.service_provider.as_str(),
                record.operation_type.as_str(),
                record.model_name,
                record.input_tokens.unwrap_or(0),
                record.output_tokens.unwrap_or(0),
                record.cost_usd
            ));
        }
        
        Ok(csv)
    }
    
    /// Export usage records as JSON
    fn export_as_json(&self, records: &[UsageRecord]) -> Result<String> {
        serde_json::to_string_pretty(records)
            .map_err(|e| crate::error::Error::Internal {
                message: format!("Failed to serialize usage records: {}", e),
                source: Some(e.into()),
            })
    }
}

/// Calculate total cost from usage records
fn calculate_total_cost(records: &[UsageRecord]) -> f64 {
    records.iter().map(|r| r.cost_usd).sum()
}

/// Calculate cost breakdown by provider
fn calculate_provider_breakdown(records: &[UsageRecord]) -> HashMap<AIProvider, f64> {
    let mut breakdown = HashMap::new();
    
    for record in records {
        *breakdown.entry(record.service_provider).or_insert(0.0) += record.cost_usd;
    }
    
    breakdown
}

/// Calculate cost breakdown by operation type
fn calculate_operation_breakdown(records: &[UsageRecord]) -> HashMap<OperationType, f64> {
    let mut breakdown = HashMap::new();
    
    for record in records {
        *breakdown.entry(record.operation_type.clone()).or_insert(0.0) += record.cost_usd;
    }
    
    breakdown
}

/// Usage statistics with comprehensive breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub daily_spend: f64,
    pub monthly_spend: f64,
    pub daily_budget: f64,
    pub monthly_budget: f64,
    pub daily_remaining: f64,
    pub monthly_remaining: f64,
    pub daily_utilization: f64,
    pub monthly_utilization: f64,
    pub provider_breakdown: HashMap<AIProvider, f64>,
    pub operation_breakdown: HashMap<OperationType, f64>,
    pub warning_level: WarningLevel,
}

/// Cost estimation for a planned operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEstimation {
    pub estimated_cost: f64,
    pub provider: AIProvider,
    pub operation_type: OperationType,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub can_afford: bool,
    pub budget_impact: BudgetImpact,
}

/// Budget impact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetImpact {
    pub daily_before: f64,
    pub daily_after: f64,
    pub monthly_before: f64,
    pub monthly_after: f64,
    pub daily_budget: f64,
    pub monthly_budget: f64,
}

/// Provider-specific statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStats {
    pub provider: AIProvider,
    pub total_cost: f64,
    pub total_operations: u32,
    pub total_input_tokens: u32,
    pub total_output_tokens: u32,
    pub avg_cost_per_operation: f64,
    pub period_days: u32,
}

/// Warning level for budget monitoring
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WarningLevel {
    Normal,
    Info,
    Warning,
    Critical,
}

/// Export format for usage data
#[derive(Debug, Clone)]
pub enum ExportFormat {
    Csv,
    Json,
}