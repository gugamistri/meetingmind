//! Repository layer for data access operations

pub mod transcription;

// Re-export repositories
pub use transcription::{TranscriptionRepository, TranscriptionStatistics, SessionSummary};