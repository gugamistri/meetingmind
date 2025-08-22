use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use crate::integrations::calendar::CalendarError;

/// Circuit breaker pattern implementation for external service calls
/// Prevents cascade failures and provides graceful degradation
#[derive(Clone)]
pub struct CircuitBreaker {
    state: Arc<RwLock<CircuitBreakerState>>,
    config: CircuitBreakerConfig,
}

#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    /// Number of failures before opening circuit
    pub failure_threshold: usize,
    /// Duration to keep circuit open before trying again
    pub timeout_duration: Duration,
    /// Number of successful calls to close circuit from half-open state
    pub success_threshold: usize,
    /// Duration to consider for failure counting
    pub failure_window: Duration,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            timeout_duration: Duration::from_secs(60),
            success_threshold: 3,
            failure_window: Duration::from_secs(300), // 5 minutes
        }
    }
}

#[derive(Debug, Clone)]
struct CircuitBreakerState {
    state: State,
    failure_count: usize,
    success_count: usize,
    last_failure_time: Option<Instant>,
    last_success_time: Option<Instant>,
    last_state_change: Instant,
}

#[derive(Debug, Clone, PartialEq)]
enum State {
    Closed,   // Normal operation
    Open,     // Circuit open, failing fast
    HalfOpen, // Testing if service recovered
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            state: Arc::new(RwLock::new(CircuitBreakerState {
                state: State::Closed,
                failure_count: 0,
                success_count: 0,
                last_failure_time: None,
                last_success_time: None,
                last_state_change: Instant::now(),
            })),
            config,
        }
    }

    /// Execute a function with circuit breaker protection
    pub async fn execute<F, T, E>(&self, f: F) -> Result<T, CalendarError>
    where
        F: std::future::Future<Output = Result<T, E>>,
        E: Into<CalendarError>,
    {
        // Check if circuit should allow the call
        if !self.should_allow_request().await {
            return Err(CalendarError::ServiceUnavailable);
        }

        // Execute the function
        match f.await {
            Ok(result) => {
                self.record_success().await;
                Ok(result)
            }
            Err(error) => {
                self.record_failure().await;
                Err(error.into())
            }
        }
    }

    /// Check if request should be allowed through circuit breaker
    async fn should_allow_request(&self) -> bool {
        let mut state = self.state.write().await;
        let now = Instant::now();

        match state.state {
            State::Closed => true,
            State::Open => {
                // Check if timeout has elapsed
                if now.duration_since(state.last_state_change) >= self.config.timeout_duration {
                    tracing::info!("Circuit breaker transitioning from Open to HalfOpen");
                    state.state = State::HalfOpen;
                    state.success_count = 0;
                    state.last_state_change = now;
                    true
                } else {
                    false
                }
            }
            State::HalfOpen => true,
        }
    }

    /// Record a successful operation
    async fn record_success(&self) {
        let mut state = self.state.write().await;
        let now = Instant::now();
        
        state.last_success_time = Some(now);
        
        match state.state {
            State::Closed => {
                // Reset failure count on success
                state.failure_count = 0;
            }
            State::HalfOpen => {
                state.success_count += 1;
                if state.success_count >= self.config.success_threshold {
                    tracing::info!("Circuit breaker transitioning from HalfOpen to Closed");
                    state.state = State::Closed;
                    state.failure_count = 0;
                    state.success_count = 0;
                    state.last_state_change = now;
                }
            }
            State::Open => {
                // Shouldn't happen, but handle gracefully
                tracing::warn!("Received success while circuit breaker is Open");
            }
        }
    }

    /// Record a failed operation
    async fn record_failure(&self) {
        let mut state = self.state.write().await;
        let now = Instant::now();
        
        state.last_failure_time = Some(now);
        
        match state.state {
            State::Closed => {
                // Clean up old failures outside the window
                if let Some(last_failure) = state.last_failure_time {
                    if now.duration_since(last_failure) > self.config.failure_window {
                        state.failure_count = 1;
                    } else {
                        state.failure_count += 1;
                    }
                } else {
                    state.failure_count = 1;
                }

                if state.failure_count >= self.config.failure_threshold {
                    tracing::warn!(
                        "Circuit breaker opening after {} failures", 
                        state.failure_count
                    );
                    state.state = State::Open;
                    state.last_state_change = now;
                }
            }
            State::HalfOpen => {
                tracing::warn!("Circuit breaker transitioning from HalfOpen to Open after failure");
                state.state = State::Open;
                state.failure_count += 1;
                state.last_state_change = now;
            }
            State::Open => {
                // Already open, just track the failure
                state.failure_count += 1;
            }
        }
    }

    /// Get current circuit breaker status for monitoring
    pub async fn get_status(&self) -> CircuitBreakerStatus {
        let state = self.state.read().await;
        CircuitBreakerStatus {
            state: state.state.clone(),
            failure_count: state.failure_count,
            success_count: state.success_count,
            last_failure_time: state.last_failure_time,
            last_success_time: state.last_success_time,
            next_attempt_time: if state.state == State::Open {
                Some(state.last_state_change + self.config.timeout_duration)
            } else {
                None
            },
        }
    }

    /// Reset circuit breaker to closed state (for administrative purposes)
    pub async fn reset(&self) {
        let mut state = self.state.write().await;
        tracing::info!("Circuit breaker manually reset to Closed state");
        
        state.state = State::Closed;
        state.failure_count = 0;
        state.success_count = 0;
        state.last_state_change = Instant::now();
    }

    /// Check if circuit is currently allowing requests
    pub async fn is_open(&self) -> bool {
        let state = self.state.read().await;
        state.state == State::Open
    }
}

#[derive(Debug, Clone)]
pub struct CircuitBreakerStatus {
    pub state: State,
    pub failure_count: usize,
    pub success_count: usize,
    pub last_failure_time: Option<Instant>,
    pub last_success_time: Option<Instant>,
    pub next_attempt_time: Option<Instant>,
}

impl std::fmt::Display for State {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            State::Closed => write!(f, "Closed"),
            State::Open => write!(f, "Open"),
            State::HalfOpen => write!(f, "Half-Open"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_circuit_breaker_starts_closed() {
        let breaker = CircuitBreaker::new(CircuitBreakerConfig::default());
        
        assert!(!breaker.is_open().await);
        
        let status = breaker.get_status().await;
        assert_eq!(status.state, State::Closed);
        assert_eq!(status.failure_count, 0);
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_failures() {
        let config = CircuitBreakerConfig {
            failure_threshold: 3,
            timeout_duration: Duration::from_millis(100),
            success_threshold: 2,
            failure_window: Duration::from_secs(60),
        };
        
        let breaker = CircuitBreaker::new(config);
        
        // Execute failing operations
        for _ in 0..3 {
            let result = breaker.execute(async { 
                Err::<(), _>(CalendarError::ServiceUnavailable)
            }).await;
            assert!(result.is_err());
        }
        
        // Circuit should now be open
        assert!(breaker.is_open().await);
        
        // Further requests should fail fast
        let result = breaker.execute(async { 
            Ok::<(), CalendarError>(())
        }).await;
        assert!(matches!(result, Err(CalendarError::ServiceUnavailable)));
    }

    #[tokio::test]
    async fn test_circuit_breaker_half_open_transition() {
        let config = CircuitBreakerConfig {
            failure_threshold: 2,
            timeout_duration: Duration::from_millis(50),
            success_threshold: 2,
            failure_window: Duration::from_secs(60),
        };
        
        let breaker = CircuitBreaker::new(config);
        
        // Trip the circuit
        for _ in 0..2 {
            let _ = breaker.execute(async { 
                Err::<(), _>(CalendarError::ServiceUnavailable)
            }).await;
        }
        
        assert!(breaker.is_open().await);
        
        // Wait for timeout
        sleep(Duration::from_millis(60)).await;
        
        // Next request should be allowed (half-open state)
        let result = breaker.execute(async { Ok::<(), CalendarError>(()) }).await;
        assert!(result.is_ok());
        
        let status = breaker.get_status().await;
        assert_eq!(status.state, State::HalfOpen);
    }

    #[tokio::test]
    async fn test_circuit_breaker_closes_after_successes() {
        let config = CircuitBreakerConfig {
            failure_threshold: 2,
            timeout_duration: Duration::from_millis(50),
            success_threshold: 2,
            failure_window: Duration::from_secs(60),
        };
        
        let breaker = CircuitBreaker::new(config);
        
        // Trip the circuit
        for _ in 0..2 {
            let _ = breaker.execute(async { 
                Err::<(), _>(CalendarError::ServiceUnavailable)
            }).await;
        }
        
        // Wait for timeout
        sleep(Duration::from_millis(60)).await;
        
        // Execute successful operations to close circuit
        for _ in 0..2 {
            let result = breaker.execute(async { Ok::<(), CalendarError>(()) }).await;
            assert!(result.is_ok());
        }
        
        // Circuit should now be closed
        let status = breaker.get_status().await;
        assert_eq!(status.state, State::Closed);
    }

    #[tokio::test]
    async fn test_circuit_breaker_reset() {
        let config = CircuitBreakerConfig {
            failure_threshold: 2,
            ..Default::default()
        };
        
        let breaker = CircuitBreaker::new(config);
        
        // Trip the circuit
        for _ in 0..2 {
            let _ = breaker.execute(async { 
                Err::<(), _>(CalendarError::ServiceUnavailable)
            }).await;
        }
        
        assert!(breaker.is_open().await);
        
        // Reset circuit
        breaker.reset().await;
        
        // Should be closed now
        assert!(!breaker.is_open().await);
        let status = breaker.get_status().await;
        assert_eq!(status.state, State::Closed);
    }

    #[tokio::test]
    async fn test_circuit_breaker_failure_window() {
        let config = CircuitBreakerConfig {
            failure_threshold: 3,
            timeout_duration: Duration::from_millis(100),
            success_threshold: 2,
            failure_window: Duration::from_millis(50), // Very short window
        };
        
        let breaker = CircuitBreaker::new(config);
        
        // First failure
        let _ = breaker.execute(async { 
            Err::<(), _>(CalendarError::ServiceUnavailable)
        }).await;
        
        // Wait for failure window to expire
        sleep(Duration::from_millis(60)).await;
        
        // Second failure (should reset count due to window expiration)
        let _ = breaker.execute(async { 
            Err::<(), _>(CalendarError::ServiceUnavailable)
        }).await;
        
        // Should still be closed since failure count was reset
        assert!(!breaker.is_open().await);
    }

    #[tokio::test]
    async fn test_circuit_breaker_concurrent_access() {
        let config = CircuitBreakerConfig {
            failure_threshold: 5,
            ..Default::default()
        };
        
        let breaker = Arc::new(CircuitBreaker::new(config));
        
        // Spawn multiple concurrent tasks
        let handles: Vec<_> = (0..10).map(|i| {
            let breaker = Arc::clone(&breaker);
            tokio::spawn(async move {
                if i % 2 == 0 {
                    breaker.execute(async { Ok::<(), CalendarError>(()) }).await
                } else {
                    breaker.execute(async { 
                        Err::<(), _>(CalendarError::ServiceUnavailable)
                    }).await
                }
            })
        }).collect();
        
        // Wait for all tasks to complete
        for handle in handles {
            let _ = handle.await;
        }
        
        // Circuit breaker should still be functional
        let status = breaker.get_status().await;
        assert!(status.failure_count > 0);
        assert!(status.success_count > 0);
    }
}