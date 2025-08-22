//! External service integrations

pub mod calendar;

pub use calendar::*;

/// Integration service placeholder
pub struct IntegrationService;

impl IntegrationService {
    /// Create a new integration service
    pub fn new() -> Self {
        Self
    }
}