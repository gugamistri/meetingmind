//! AI Service Manager with fallback logic and circuit breaker pattern

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::ai::client::{AIServiceClient, RateLimitStatus};
use crate::ai::types::*;
use crate::error::{Error, Result};

/// AI service manager that handles multiple providers with fallback
pub struct AIServiceManager {
    clients: Vec<Arc<dyn AIServiceClient>>,
    circuit_breakers: Arc<RwLock<HashMap<AIProvider, CircuitBreaker>>>,
    cost_tracker: Arc<RwLock<CostTracker>>,
}

/// Circuit breaker for service health monitoring
#[derive(Debug, Clone)]
struct CircuitBreaker {
    state: CircuitState,
    failure_count: u32,
    last_failure_time: Option<Instant>,
    last_success_time: Option<Instant>,
    failure_threshold: u32,
    timeout_duration: Duration,
    half_open_retry_timeout: Duration,
}

#[derive(Debug, Clone, PartialEq)]
enum CircuitState {
    Closed,   // Normal operation
    Open,     // Service is down, don't try
    HalfOpen, // Testing if service is back up
}

/// Cost tracking for budget management
#[derive(Debug, Default)]
struct CostTracker {
    daily_spend: HashMap<AIProvider, f64>,
    monthly_spend: HashMap<AIProvider, f64>,
    daily_budget: f64,
    monthly_budget: f64,
    last_reset_date: Option<chrono::NaiveDate>,
}

impl AIServiceManager {
    /// Create a new AI service manager
    pub fn new(
        clients: Vec<Arc<dyn AIServiceClient>>,
        daily_budget: f64,
        monthly_budget: f64,
    ) -> Self {
        let circuit_breakers = Arc::new(RwLock::new(
            clients.iter()
                .map(|client| (client.get_provider(), CircuitBreaker::new()))
                .collect()
        ));
        
        let cost_tracker = Arc::new(RwLock::new(CostTracker {
            daily_budget,
            monthly_budget,
            ..Default::default()
        }));
        
        Self {
            clients,
            circuit_breakers,
            cost_tracker,
        }
    }
    
    /// Generate a summary using the best available service
    pub async fn summarize(&self, operation: &AIOperation) -> Result<SummaryResult> {
        // Check budget before proceeding
        self.check_budget_constraints(operation).await?;
        
        let mut last_error = None;
        
        for client in &self.clients {
            let provider = client.get_provider();
            
            // Check circuit breaker
            if !self.is_service_available(&provider).await {
                tracing::warn!("Service {} is unavailable (circuit breaker open)", provider.as_str());
                continue;
            }
            
            // Estimate cost for this provider
            match client.estimate_cost(operation) {
                Ok(estimate) => {
                    if !self.can_afford_operation(&estimate).await {
                        tracing::warn!(
                            "Cannot afford operation with {} (${:.4})",
                            provider.as_str(),
                            estimate.estimated_cost_usd
                        );
                        continue;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to estimate cost for {}: {}", provider.as_str(), e);
                    continue;
                }
            }
            
            // Attempt the operation
            match client.summarize(operation).await {
                Ok(mut result) => {
                    // Record successful operation
                    self.record_success(&provider).await;
                    self.record_usage(&provider, result.cost_usd).await;
                    
                    // Update result with actual IDs that should be set by caller
                    result.id = uuid::Uuid::new_v4();
                    
                    tracing::info!(
                        "Successfully generated summary using {} (${:.4})",
                        provider.as_str(),
                        result.cost_usd
                    );
                    
                    return Ok(result);
                }
                Err(e) => {
                    tracing::error!("Failed to summarize with {}: {}", provider.as_str(), e);
                    self.record_failure(&provider).await;
                    last_error = Some(e);
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| Error::AIService {
            provider: "all".to_string(),
            message: "All AI services failed or are unavailable".to_string(),
            source: None,
        }))
    }
    
    /// Get cost estimate from the best available service
    pub async fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimate> {
        for client in &self.clients {
            let provider = client.get_provider();
            
            if self.is_service_available(&provider).await {
                match client.estimate_cost(operation) {
                    Ok(estimate) => return Ok(estimate),
                    Err(e) => {
                        tracing::error!("Failed to estimate cost with {}: {}", provider.as_str(), e);
                    }
                }
            }
        }
        
        Err(Error::AIService {
            provider: "all".to_string(),
            message: "No services available for cost estimation".to_string(),
            source: None,
        })
    }
    
    /// Check if a service is available based on circuit breaker state
    async fn is_service_available(&self, provider: &AIProvider) -> bool {
        let breakers = self.circuit_breakers.read().await;
        if let Some(breaker) = breakers.get(provider) {
            breaker.can_attempt()
        } else {
            true // If no circuit breaker exists, assume available
        }
    }
    
    /// Record a successful operation
    async fn record_success(&self, provider: &AIProvider) {
        let mut breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = breakers.get_mut(provider) {
            breaker.record_success();
        }
    }
    
    /// Record a failed operation
    async fn record_failure(&self, provider: &AIProvider) {
        let mut breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = breakers.get_mut(provider) {
            breaker.record_failure();
        }
    }
    
    /// Check budget constraints
    async fn check_budget_constraints(&self, operation: &AIOperation) -> Result<()> {
        let tracker = self.cost_tracker.read().await;
        
        // Reset daily/monthly counters if needed
        drop(tracker);
        self.reset_budgets_if_needed().await;
        let tracker = self.cost_tracker.read().await;
        
        let total_daily_spend: f64 = tracker.daily_spend.values().sum();
        let total_monthly_spend: f64 = tracker.monthly_spend.values().sum();
        
        if total_daily_spend >= tracker.daily_budget {
            return Err(Error::BudgetExceeded {
                budget_type: "daily".to_string(),
                limit: tracker.daily_budget,
                current: total_daily_spend,
            });
        }
        
        if total_monthly_spend >= tracker.monthly_budget {
            return Err(Error::BudgetExceeded {
                budget_type: "monthly".to_string(),
                limit: tracker.monthly_budget,
                current: total_monthly_spend,
            });
        }
        
        Ok(())
    }
    
    /// Check if we can afford a specific operation
    async fn can_afford_operation(&self, estimate: &CostEstimate) -> bool {
        let tracker = self.cost_tracker.read().await;
        
        let total_daily_spend: f64 = tracker.daily_spend.values().sum();
        let total_monthly_spend: f64 = tracker.monthly_spend.values().sum();
        
        (total_daily_spend + estimate.estimated_cost_usd <= tracker.daily_budget) &&
        (total_monthly_spend + estimate.estimated_cost_usd <= tracker.monthly_budget)
    }
    
    /// Record usage for cost tracking
    async fn record_usage(&self, provider: &AIProvider, cost: f64) {
        let mut tracker = self.cost_tracker.write().await;
        
        *tracker.daily_spend.entry(*provider).or_insert(0.0) += cost;
        *tracker.monthly_spend.entry(*provider).or_insert(0.0) += cost;
    }
    
    /// Reset budget counters if we've moved to a new day/month
    async fn reset_budgets_if_needed(&self) {
        let mut tracker = self.cost_tracker.write().await;
        let today = chrono::Local::now().date_naive();
        
        if let Some(last_reset) = tracker.last_reset_date {
            // Reset daily spend if it's a new day
            if last_reset < today {
                tracker.daily_spend.clear();
                
                // Reset monthly spend if it's a new month
                if last_reset.month() != today.month() || last_reset.year() != today.year() {
                    tracker.monthly_spend.clear();
                }
            }
        }
        
        tracker.last_reset_date = Some(today);
    }
    
    /// Get current usage statistics
    pub async fn get_usage_stats(&self) -> UsageStats {
        let tracker = self.cost_tracker.read().await;
        
        let total_daily_spend: f64 = tracker.daily_spend.values().sum();
        let total_monthly_spend: f64 = tracker.monthly_spend.values().sum();
        
        UsageStats {
            daily_spend: total_daily_spend,
            monthly_spend: total_monthly_spend,
            daily_budget: tracker.daily_budget,
            monthly_budget: tracker.monthly_budget,
            daily_remaining: (tracker.daily_budget - total_daily_spend).max(0.0),
            monthly_remaining: (tracker.monthly_budget - total_monthly_spend).max(0.0),
            provider_breakdown: tracker.daily_spend.clone(),
        }
    }
    
    /// Health check all services
    pub async fn health_check_all(&self) -> Vec<ServiceHealth> {
        let mut results = Vec::new();
        
        for client in &self.clients {
            let provider = client.get_provider();
            let is_healthy = client.health_check().await.unwrap_or(false);
            
            let rate_limit_status = client.get_rate_limit_status().await.ok();
            
            results.push(ServiceHealth {
                provider,
                is_healthy,
                rate_limit_status,
                circuit_breaker_state: self.get_circuit_breaker_state(&provider).await,
            });
        }
        
        results
    }
    
    /// Get circuit breaker state for a provider
    async fn get_circuit_breaker_state(&self, provider: &AIProvider) -> String {
        let breakers = self.circuit_breakers.read().await;
        if let Some(breaker) = breakers.get(provider) {
            format!("{:?}", breaker.state)
        } else {
            "Unknown".to_string()
        }
    }
}

impl CircuitBreaker {
    fn new() -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            last_failure_time: None,
            last_success_time: None,
            failure_threshold: 3,
            timeout_duration: Duration::from_secs(60),
            half_open_retry_timeout: Duration::from_secs(30),
        }
    }
    
    fn can_attempt(&self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if let Some(last_failure) = self.last_failure_time {
                    last_failure.elapsed() > self.timeout_duration
                } else {
                    true
                }
            }
            CircuitState::HalfOpen => {
                if let Some(last_failure) = self.last_failure_time {
                    last_failure.elapsed() > self.half_open_retry_timeout
                } else {
                    true
                }
            }
        }
    }
    
    fn record_success(&mut self) {
        self.failure_count = 0;
        self.last_success_time = Some(Instant::now());
        self.state = CircuitState::Closed;
    }
    
    fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure_time = Some(Instant::now());
        
        if self.failure_count >= self.failure_threshold {
            self.state = match self.state {
                CircuitState::Closed => CircuitState::Open,
                CircuitState::HalfOpen => CircuitState::Open,
                CircuitState::Open => CircuitState::Open,
            };
        } else if self.state == CircuitState::Open {
            self.state = CircuitState::HalfOpen;
        }
    }
}

/// Usage statistics for budget tracking
#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageStats {
    pub daily_spend: f64,
    pub monthly_spend: f64,
    pub daily_budget: f64,
    pub monthly_budget: f64,
    pub daily_remaining: f64,
    pub monthly_remaining: f64,
    pub provider_breakdown: HashMap<AIProvider, f64>,
}

/// Health status of an AI service
#[derive(Debug, Clone, serde::Serialize)]
pub struct ServiceHealth {
    pub provider: AIProvider,
    pub is_healthy: bool,
    pub rate_limit_status: Option<RateLimitStatus>,
    pub circuit_breaker_state: String,
}