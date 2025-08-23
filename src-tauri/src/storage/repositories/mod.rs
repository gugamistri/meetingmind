//! Repository layer for data access operations

pub mod transcription;
pub mod summary;
pub mod usage;
pub mod search;

// Re-export repositories
pub use transcription::{TranscriptionRepository, TranscriptionStatistics, SessionSummary};
pub use summary::{SummaryRepository, TemplateRepository};
pub use usage::{UsageRepository, UsageStatistics, ProviderBreakdown};
pub use search::SearchRepository;