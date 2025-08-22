//! AI service client trait and common functionality

use async_trait::async_trait;
use crate::ai::types::*;
use crate::error::Result;

/// Trait for AI service clients providing standardized operations
#[async_trait]
pub trait AIServiceClient: Send + Sync {
    /// Generate a summary using the specified template
    async fn summarize(&self, operation: &AIOperation) -> Result<SummaryResult>;
    
    /// Estimate the cost of an operation before execution
    fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimate>;
    
    /// Get the provider name for this client
    fn get_provider(&self) -> AIProvider;
    
    /// Get the model name being used
    fn get_model(&self) -> &str;
    
    /// Check if the service is healthy and available
    async fn health_check(&self) -> Result<bool>;
    
    /// Get current rate limit status
    async fn get_rate_limit_status(&self) -> Result<RateLimitStatus>;
}

/// Rate limiting status information
#[derive(Debug, Clone)]
pub struct RateLimitStatus {
    pub requests_remaining: Option<u32>,
    pub tokens_remaining: Option<u32>,
    pub reset_time: Option<chrono::DateTime<chrono::Utc>>,
    pub retry_after_seconds: Option<u64>,
}

/// Configuration for HTTP requests to AI services
#[derive(Debug, Clone)]
pub struct HttpConfig {
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub user_agent: String,
}

impl Default for HttpConfig {
    fn default() -> Self {
        Self {
            timeout_seconds: 60,
            max_retries: 3,
            retry_delay_ms: 1000,
            user_agent: "MeetingMind/1.0".to_string(),
        }
    }
}

/// Utility functions for AI clients
pub mod utils {
    use super::*;
    
    /// Count approximate tokens in text (rough estimation)
    pub fn estimate_tokens(text: &str) -> u32 {
        // Rough approximation: 1 token ≈ 4 characters
        // This is conservative and will be overestimated for most cases
        (text.len() as f32 / 4.0).ceil() as u32
    }
    
    /// Create HTTP client with standard configuration
    pub fn create_http_client(config: &HttpConfig) -> Result<reqwest::Client> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .user_agent(&config.user_agent)
            .build()
            .map_err(|e| crate::error::Error::Http {
                message: format!("Failed to create HTTP client: {}", e),
                source: e.into(),
            })
    }
    
    /// Implement exponential backoff for retries
    pub async fn exponential_backoff(attempt: u32, base_delay_ms: u64) {
        if attempt == 0 {
            return;
        }
        
        let delay = base_delay_ms * 2_u64.pow(attempt.saturating_sub(1));
        let jitter = fastrand::u64(0..=delay / 4); // Add up to 25% jitter
        let total_delay = delay + jitter;
        
        tokio::time::sleep(std::time::Duration::from_millis(total_delay)).await;
    }
    
    /// Parse rate limit headers from HTTP response
    pub fn parse_rate_limit_headers(headers: &reqwest::header::HeaderMap) -> RateLimitStatus {
        let requests_remaining = headers
            .get("x-ratelimit-remaining-requests")
            .or_else(|| headers.get("x-ratelimit-remaining"))
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok());
            
        let tokens_remaining = headers
            .get("x-ratelimit-remaining-tokens")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok());
            
        let reset_time = headers
            .get("x-ratelimit-reset")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<i64>().ok())
            .and_then(|timestamp| chrono::DateTime::from_timestamp(timestamp, 0));
            
        let retry_after_seconds = headers
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok());
        
        RateLimitStatus {
            requests_remaining,
            tokens_remaining,
            reset_time,
            retry_after_seconds,
        }
    }
}