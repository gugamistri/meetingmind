/// Search module for full-text search functionality
/// 
/// This module provides comprehensive search capabilities across all meeting data
/// including transcriptions, meeting metadata, summaries, and participant information.
/// It uses SQLite FTS5 for high-performance local search while maintaining privacy.

pub mod service;
pub mod types;
pub mod indexer;

pub use service::SearchService;
pub use types::*;
pub use indexer::SearchIndexer;

#[cfg(test)]
mod tests;