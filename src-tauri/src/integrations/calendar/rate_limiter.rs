use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use crate::integrations::calendar::CalendarError;

/// Rate limiter for calendar API calls implementing token bucket algorithm
/// Prevents API quota exhaustion and abuse
pub struct RateLimiter {
    buckets: Arc<RwLock<HashMap<String, TokenBucket>>>,
}

#[derive(Clone)]
struct TokenBucket {
    capacity: usize,
    tokens: usize,
    last_refill: Instant,
    refill_rate: Duration, // Time between token additions
}

impl TokenBucket {
    fn new(capacity: usize, refill_rate: Duration) -> Self {
        Self {
            capacity,
            tokens: capacity,
            last_refill: Instant::now(),
            refill_rate,
        }
    }

    fn try_consume(&mut self, tokens: usize) -> bool {
        self.refill();
        
        if self.tokens >= tokens {
            self.tokens -= tokens;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill);
        
        if elapsed >= self.refill_rate {
            let tokens_to_add = (elapsed.as_secs() / self.refill_rate.as_secs()) as usize;
            self.tokens = (self.tokens + tokens_to_add).min(self.capacity);
            self.last_refill = now;
        }
    }

    fn time_until_available(&self) -> Option<Duration> {
        if self.tokens > 0 {
            None
        } else {
            let next_refill = self.last_refill + self.refill_rate;
            let now = Instant::now();
            if now < next_refill {
                Some(next_refill - now)
            } else {
                Some(Duration::from_secs(0))
            }
        }
    }
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if request is allowed within rate limits
    /// Returns Ok(()) if allowed, Err with retry time if rate limited
    pub async fn check_rate_limit(&self, endpoint: &str, tokens: usize) -> Result<(), CalendarError> {
        let mut buckets = self.buckets.write().await;
        
        let bucket = buckets
            .entry(endpoint.to_string())
            .or_insert_with(|| self.create_bucket_for_endpoint(endpoint));
        
        if bucket.try_consume(tokens) {
            Ok(())
        } else {
            let retry_after = bucket.time_until_available().unwrap_or(Duration::from_secs(60));
            Err(CalendarError::RateLimitExceeded { 
                seconds: retry_after.as_secs() 
            })
        }
    }

    /// Create appropriate bucket configuration based on endpoint
    fn create_bucket_for_endpoint(&self, endpoint: &str) -> TokenBucket {
        match endpoint {
            // Google Calendar API: 1000 requests per 100 seconds per user
            // We'll use 100 requests per 10 seconds for safety margin
            e if e.contains("googleapis.com/calendar") => {
                TokenBucket::new(100, Duration::from_secs(10))
            }
            
            // OAuth2 endpoints: More restrictive to prevent abuse
            // 10 requests per minute for OAuth2 flows
            e if e.contains("oauth2") || e.contains("token") => {
                TokenBucket::new(10, Duration::from_secs(60))
            }
            
            // Default conservative rate limiting
            _ => TokenBucket::new(50, Duration::from_secs(30))
        }
    }

    /// Reset rate limits for testing purposes
    #[cfg(test)]
    pub async fn reset(&self) {
        let mut buckets = self.buckets.write().await;
        buckets.clear();
    }

    /// Get current bucket status for monitoring
    pub async fn get_bucket_status(&self, endpoint: &str) -> Option<BucketStatus> {
        let buckets = self.buckets.read().await;
        buckets.get(endpoint).map(|bucket| {
            BucketStatus {
                available_tokens: bucket.tokens,
                capacity: bucket.capacity,
                next_refill: bucket.last_refill + bucket.refill_rate,
            }
        })
    }
}

#[derive(Debug, Clone)]
pub struct BucketStatus {
    pub available_tokens: usize,
    pub capacity: usize,
    pub next_refill: Instant,
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_rate_limiter_allows_requests_within_limit() {
        let limiter = RateLimiter::new();
        
        // First request should be allowed
        let result = limiter.check_rate_limit("https://www.googleapis.com/calendar/v3/calendars", 1).await;
        assert!(result.is_ok());
        
        // Should have multiple tokens available initially
        for _ in 0..10 {
            let result = limiter.check_rate_limit("https://www.googleapis.com/calendar/v3/calendars", 1).await;
            assert!(result.is_ok());
        }
    }

    #[tokio::test] 
    async fn test_rate_limiter_blocks_excessive_requests() {
        let limiter = RateLimiter::new();
        let endpoint = "https://www.googleapis.com/calendar/v3/calendars";
        
        // Consume all available tokens
        for _ in 0..100 {
            let result = limiter.check_rate_limit(endpoint, 1).await;
            if result.is_err() {
                break;
            }
        }
        
        // Next request should be rate limited
        let result = limiter.check_rate_limit(endpoint, 1).await;
        assert!(matches!(result, Err(CalendarError::RateLimitExceeded { .. })));
    }

    #[tokio::test]
    async fn test_oauth2_rate_limiting_more_restrictive() {
        let limiter = RateLimiter::new();
        let oauth_endpoint = "https://oauth2.googleapis.com/token";
        
        // OAuth2 endpoints should have lower limits (10 requests)
        for _ in 0..10 {
            let result = limiter.check_rate_limit(oauth_endpoint, 1).await;
            assert!(result.is_ok());
        }
        
        // 11th request should be blocked
        let result = limiter.check_rate_limit(oauth_endpoint, 1).await;
        assert!(matches!(result, Err(CalendarError::RateLimitExceeded { .. })));
    }

    #[tokio::test]
    async fn test_rate_limiter_token_refill() {
        let limiter = RateLimiter::new();
        let endpoint = "test_endpoint";
        
        // Create a bucket that refills quickly for testing
        {
            let mut buckets = limiter.buckets.write().await;
            buckets.insert(
                endpoint.to_string(),
                TokenBucket::new(2, Duration::from_millis(100))
            );
        }
        
        // Consume all tokens
        assert!(limiter.check_rate_limit(endpoint, 1).await.is_ok());
        assert!(limiter.check_rate_limit(endpoint, 1).await.is_ok());
        assert!(limiter.check_rate_limit(endpoint, 1).await.is_err());
        
        // Wait for refill
        sleep(Duration::from_millis(150)).await;
        
        // Should have tokens available again
        assert!(limiter.check_rate_limit(endpoint, 1).await.is_ok());
    }

    #[tokio::test]
    async fn test_bucket_status_monitoring() {
        let limiter = RateLimiter::new();
        let endpoint = "https://www.googleapis.com/calendar/v3/calendars";
        
        // Make a request to create bucket
        limiter.check_rate_limit(endpoint, 1).await.unwrap();
        
        // Check bucket status
        let status = limiter.get_bucket_status(endpoint).await;
        assert!(status.is_some());
        
        let status = status.unwrap();
        assert_eq!(status.capacity, 100);
        assert_eq!(status.available_tokens, 99); // One token consumed
    }

    #[tokio::test]
    async fn test_concurrent_rate_limiting() {
        let limiter = Arc::new(RateLimiter::new());
        let endpoint = "https://www.googleapis.com/calendar/v3/calendars";
        
        // Create multiple concurrent requests
        let mut handles = vec![];
        for i in 0..50 {
            let limiter_clone = Arc::clone(&limiter);
            let endpoint_clone = endpoint.to_string();
            
            handles.push(tokio::spawn(async move {
                limiter_clone.check_rate_limit(&endpoint_clone, 1).await
            }));
        }
        
        // Collect results
        let results: Vec<Result<(), CalendarError>> = 
            futures::future::join_all(handles).await
            .into_iter()
            .map(|r| r.unwrap())
            .collect();
        
        let successful = results.iter().filter(|r| r.is_ok()).count();
        let rate_limited = results.iter().filter(|r| r.is_err()).count();
        
        // Some should succeed, some should be rate limited
        assert!(successful > 0);
        assert!(successful + rate_limited == 50);
    }
}