use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Search query structure with filters and pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub filters: SearchFilters,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub include_highlights: bool,
}

impl Default for SearchQuery {
    fn default() -> Self {
        Self {
            query: String::new(),
            filters: SearchFilters::default(),
            limit: Some(50), // Default page size
            offset: Some(0),
            include_highlights: true,
        }
    }
}

/// Enhanced search filters extending the basic model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    // Time-based filters
    pub date_start: Option<DateTime<Utc>>,
    pub date_end: Option<DateTime<Utc>>,
    
    // Content filters
    pub participants: Vec<String>,
    pub tags: Vec<String>,
    pub meeting_types: Vec<String>,
    
    // Duration filters (in minutes)
    pub duration_min: Option<i32>,
    pub duration_max: Option<i32>,
    
    // Quality filters
    pub confidence_min: Option<f64>,
    pub confidence_max: Option<f64>,
    
    // Technical filters
    pub languages: Vec<String>,
    pub models: Vec<String>,
    pub processed_locally: Option<bool>,
    
    // Meeting-specific filters
    pub meeting_ids: Vec<i64>,
    pub session_ids: Vec<String>,
}

impl Default for SearchFilters {
    fn default() -> Self {
        Self {
            date_start: None,
            date_end: None,
            participants: Vec::new(),
            tags: Vec::new(),
            meeting_types: Vec::new(),
            duration_min: None,
            duration_max: None,
            confidence_min: None,
            confidence_max: None,
            languages: Vec::new(),
            models: Vec::new(),
            processed_locally: None,
            meeting_ids: Vec::new(),
            session_ids: Vec::new(),
        }
    }
}

/// Search result with relevance and context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub meeting_id: i64,
    pub meeting_title: String,
    pub participants: Vec<String>,
    pub tags: Vec<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: i64,
    pub relevance_score: f32,
    pub snippet: String,
    pub highlight_positions: Vec<(usize, usize)>,
    pub match_type: SearchMatchType,
    pub transcription_id: Option<i64>,
}

/// Type of search match found
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchMatchType {
    Title,
    Participant,
    Content,
    Tag,
    Summary,
    ActionItem,
}

/// Position of highlighted text in content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightPosition {
    pub start: usize,
    pub end: usize,
    pub matched_term: String,
}

/// Additional context for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultContext {
    pub meeting_start_time: DateTime<Utc>,
    pub meeting_duration: Option<i32>,
    pub participant_count: i32,
    pub confidence: f64,
    pub language: String,
    pub model_used: String,
    pub chunk_start_time: f64,
    pub chunk_end_time: f64,
}

/// Search suggestions for autocomplete
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSuggestion {
    pub text: String,
    pub type_: String,
    pub frequency: u32,
    pub context: Option<String>,
}

/// Type of search suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuggestionType {
    Participant,
    Tag,
    Title,
    Content,
    RecentQuery,
    PopularTerm,
    MeetingTitle,
}

/// In-meeting search match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InMeetingMatch {
    pub transcription_id: i64,
    pub content: String,
    pub position: usize,
    pub timestamp: i64,
    pub confidence: f32,
    pub segment_id: Option<i64>,
    pub speaker: Option<String>,
    pub match_type: String,
}

/// Search history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryEntry {
    pub id: String,
    pub query: String,
    pub result_count: Option<u32>,
    pub searched_at: String,
}

/// Saved search with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSearchEntry {
    pub id: i64,
    pub name: String,
    pub query: String,
    pub filters: Option<String>, // JSON serialized SearchFilters
    pub description: Option<String>,
    pub is_favorite: bool,
    pub usage_count: i64,
    pub last_used: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Search analytics data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchAnalytics {
    pub total_searches: i64,
    pub average_response_time: f64,
    pub popular_terms: Vec<(String, i32)>,
    pub search_patterns: Vec<SearchPattern>,
    pub performance_metrics: SearchPerformanceMetrics,
}

/// Search pattern analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPattern {
    pub pattern_type: String,
    pub frequency: i32,
    pub average_results: f64,
    pub user_satisfaction: Option<f64>,
}

/// Performance metrics for search operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPerformanceMetrics {
    pub queries_per_second: f64,
    pub index_size_mb: f64,
    pub memory_usage_mb: f64,
    pub cache_hit_rate: f64,
}

/// Export format for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    Csv,
    Json,
    Markdown,
    Html,
}

/// Search configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    pub max_results: usize,
    pub snippet_length: usize,
    pub highlight_tags: (String, String), // (open_tag, close_tag)
    pub min_query_length: usize,
    pub enable_stemming: bool,
    pub enable_fuzzy_match: bool,
    pub boost_recent: f64,
    pub boost_confidence: f64,
    pub search_timeout_ms: u64,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            max_results: 50,  // Reduced for better performance
            snippet_length: 150,
            highlight_tags: ("<mark>".to_string(), "</mark>".to_string()),
            min_query_length: 2,
            enable_stemming: true,
            enable_fuzzy_match: true,
            boost_recent: 0.3,
            boost_confidence: 0.7,
            search_timeout_ms: 100,  // Optimized for 100ms requirement
        }
    }
}

/// Error types for search operations
#[derive(Debug, thiserror::Error)]
pub enum SearchError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Invalid query: {message}")]
    InvalidQuery { message: String },
    
    #[error("Query too short: minimum length is {min_length} characters")]
    QueryTooShort { min_length: usize },
    
    #[error("Search timeout: query took longer than {timeout_ms}ms")]
    Timeout { timeout_ms: u64 },
    
    #[error("Search failed: {0}")]
    SearchFailed(String),
    
    #[error("Save failed: {0}")]
    SaveFailed(String),
    
    #[error("Delete failed: {0}")]
    DeleteFailed(String),
    
    #[error("Clear failed: {0}")]
    ClearFailed(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Index error: {0}")]
    IndexError(String),
    
    #[error("Export failed: {0}")]
    ExportFailed(String),
    
    #[error("Configuration error: {message}")]
    ConfigError { message: String },
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Parse error: {0}")]
    ParseError(#[from] std::num::ParseIntError),
    
    #[error("Internal error: {message}")]
    Internal { message: String },
}

pub type SearchServiceResult<T> = Result<T, SearchError>;

// Additional types used by the frontend and repository

impl SearchMatchType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "meeting" => SearchMatchType::Title,
            "transcription" => SearchMatchType::Content,
            "participant" => SearchMatchType::Participant,
            "tag" => SearchMatchType::Tag,
            "summary" => SearchMatchType::Summary,
            "action_item" => SearchMatchType::ActionItem,
            _ => SearchMatchType::Content,
        }
    }
}

/// Saved search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSearch {
    pub id: String,
    pub name: String,
    pub query: SearchQuery,
    pub created_at: String,
    pub last_used_at: String,
    pub usage_count: u32,
}

/// Filter values available for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterValues {
    pub participants: Vec<String>,
    pub tags: Vec<String>,
    pub meeting_types: Vec<String>,
}

// Helper methods for creating common errors
impl SearchError {
    pub fn search_failed(msg: String) -> Self {
        SearchError::SearchFailed(msg)
    }
    
    pub fn save_failed(msg: String) -> Self {
        SearchError::SaveFailed(msg)
    }
    
    pub fn delete_failed(msg: String) -> Self {
        SearchError::DeleteFailed(msg)
    }
    
    pub fn clear_failed(msg: String) -> Self {
        SearchError::ClearFailed(msg)
    }
    
    pub fn not_found(msg: String) -> Self {
        SearchError::NotFound(msg)
    }
    
    pub fn index_error(msg: String) -> Self {
        SearchError::IndexError(msg)
    }
    
    pub fn export_failed(msg: String) -> Self {
        SearchError::ExportFailed(msg)
    }
}