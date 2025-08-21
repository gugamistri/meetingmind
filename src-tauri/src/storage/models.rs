//! Database models and entities

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Meeting entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Meeting {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: MeetingStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Meeting status enumeration
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
pub enum MeetingStatus {
    #[sqlx(rename = "scheduled")]
    Scheduled,
    #[sqlx(rename = "in_progress")]
    InProgress,
    #[sqlx(rename = "completed")]
    Completed,
    #[sqlx(rename = "cancelled")]
    Cancelled,
}

impl std::fmt::Display for MeetingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MeetingStatus::Scheduled => write!(f, "scheduled"),
            MeetingStatus::InProgress => write!(f, "in_progress"),
            MeetingStatus::Completed => write!(f, "completed"),
            MeetingStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Participant entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Participant {
    pub id: i64,
    pub meeting_id: i64,
    pub name: String,
    pub email: Option<String>,
    pub role: ParticipantRole,
    pub joined_at: Option<DateTime<Utc>>,
    pub left_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Participant role enumeration
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
pub enum ParticipantRole {
    #[sqlx(rename = "organizer")]
    Organizer,
    #[sqlx(rename = "participant")]
    Participant,
    #[sqlx(rename = "presenter")]
    Presenter,
}

impl std::fmt::Display for ParticipantRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParticipantRole::Organizer => write!(f, "organizer"),
            ParticipantRole::Participant => write!(f, "participant"),
            ParticipantRole::Presenter => write!(f, "presenter"),
        }
    }
}

/// Transcription entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DbTranscription {
    pub id: i64,
    pub chunk_id: String,
    pub meeting_id: i64,
    pub session_id: String,
    pub content: String,
    pub confidence: f64,
    pub language: String,
    pub model_used: String,
    pub start_timestamp: f64,
    pub end_timestamp: f64,
    pub word_count: i64,
    pub processing_time_ms: i64,
    pub processed_locally: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Transcription session entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DbTranscriptionSession {
    pub id: i64,
    pub session_id: String,
    pub meeting_id: i64,
    pub config_language: String,
    pub config_model: String,
    pub config_mode: TranscriptionMode,
    pub confidence_threshold: f64,
    pub chunk_count: i64,
    pub total_duration_seconds: f64,
    pub processing_time_ms: i64,
    pub local_chunks: i64,
    pub cloud_chunks: i64,
    pub overall_confidence: f64,
    pub status: TranscriptionSessionStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

/// Transcription processing mode
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
pub enum TranscriptionMode {
    #[sqlx(rename = "local")]
    Local,
    #[sqlx(rename = "cloud")]
    Cloud,
    #[sqlx(rename = "hybrid")]
    Hybrid,
}

impl std::fmt::Display for TranscriptionMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TranscriptionMode::Local => write!(f, "local"),
            TranscriptionMode::Cloud => write!(f, "cloud"),
            TranscriptionMode::Hybrid => write!(f, "hybrid"),
        }
    }
}

/// Transcription session status
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
pub enum TranscriptionSessionStatus {
    #[sqlx(rename = "active")]
    Active,
    #[sqlx(rename = "completed")]
    Completed,
    #[sqlx(rename = "failed")]
    Failed,
    #[sqlx(rename = "cancelled")]
    Cancelled,
}

impl std::fmt::Display for TranscriptionSessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TranscriptionSessionStatus::Active => write!(f, "active"),
            TranscriptionSessionStatus::Completed => write!(f, "completed"),
            TranscriptionSessionStatus::Failed => write!(f, "failed"),
            TranscriptionSessionStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Application settings entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Setting {
    pub id: i64,
    pub key: String,
    pub value: String,
    pub category: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Search ranking entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SearchRanking {
    pub id: i64,
    pub query: String,
    pub transcription_id: i64,
    pub relevance_score: f64,
    pub click_count: i64,
    pub last_accessed: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Search history entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SearchHistory {
    pub id: i64,
    pub query: String,
    pub results_count: i64,
    pub filters: Option<String>,
    pub response_time_ms: i64,
    pub user_session: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Saved search entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SavedSearch {
    pub id: i64,
    pub name: String,
    pub query: String,
    pub filters: Option<String>,
    pub description: Option<String>,
    pub is_favorite: bool,
    pub usage_count: i64,
    pub last_used: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Enhanced search result with additional context
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SearchResultEnhanced {
    pub id: i64,
    pub chunk_id: String,
    pub content: String,
    pub confidence: f64,
    pub language: String,
    pub model_used: String,
    pub start_timestamp: f64,
    pub end_timestamp: f64,
    pub word_count: i64,
    pub created_at: DateTime<Utc>,
    pub session_id: String,
    pub meeting_id: i64,
    pub meeting_title: String,
    pub meeting_start_time: DateTime<Utc>,
    pub session_confidence: f64,
    pub relevance_score: f64,
}

/// Transcription statistics entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TranscriptionStats {
    pub id: i64,
    pub date: chrono::NaiveDate,
    pub total_sessions: i64,
    pub total_chunks: i64,
    pub total_duration_seconds: f64,
    pub total_processing_time_ms: i64,
    pub avg_confidence: f64,
    pub local_processing_percentage: f64,
    pub error_count: i64,
    pub updated_at: DateTime<Utc>,
}

/// Search configuration entity
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SearchConfig {
    pub id: i64,
    pub name: String,
    pub value: String,
    pub description: Option<String>,
    pub updated_at: DateTime<Utc>,
}

/// Input models for creating new records

/// Input for creating a new meeting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMeeting {
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
}

/// Input for updating a meeting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMeeting {
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: Option<MeetingStatus>,
}

/// Input for creating a new participant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateParticipant {
    pub meeting_id: i64,
    pub name: String,
    pub email: Option<String>,
    pub role: ParticipantRole,
}

/// Input for creating a new transcription
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTranscription {
    pub chunk_id: String,
    pub meeting_id: i64,
    pub session_id: String,
    pub content: String,
    pub confidence: f64,
    pub language: String,
    pub model_used: String,
    pub start_timestamp: f64,
    pub end_timestamp: f64,
    pub word_count: i64,
    pub processing_time_ms: i64,
    pub processed_locally: bool,
}

/// Input for creating a new transcription session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTranscriptionSession {
    pub session_id: String,
    pub meeting_id: i64,
    pub config_language: String,
    pub config_model: String,
    pub config_mode: TranscriptionMode,
    pub confidence_threshold: f64,
}

/// Input for updating a transcription session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTranscriptionSession {
    pub status: Option<TranscriptionSessionStatus>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

/// Input for creating a saved search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSavedSearch {
    pub name: String,
    pub query: String,
    pub filters: Option<String>,
    pub description: Option<String>,
    pub is_favorite: bool,
}

/// Filter options for search queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub languages: Option<Vec<String>>,
    pub models: Option<Vec<String>>,
    pub confidence_min: Option<f64>,
    pub confidence_max: Option<f64>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub meeting_ids: Option<Vec<i64>>,
    pub session_ids: Option<Vec<String>>,
    pub processed_locally: Option<bool>,
}

impl SearchFilters {
    /// Create empty search filters
    pub fn new() -> Self {
        Self {
            languages: None,
            models: None,
            confidence_min: None,
            confidence_max: None,
            date_from: None,
            date_to: None,
            meeting_ids: None,
            session_ids: None,
            processed_locally: None,
        }
    }

    /// Check if any filters are applied
    pub fn has_filters(&self) -> bool {
        self.languages.is_some()
            || self.models.is_some()
            || self.confidence_min.is_some()
            || self.confidence_max.is_some()
            || self.date_from.is_some()
            || self.date_to.is_some()
            || self.meeting_ids.is_some()
            || self.session_ids.is_some()
            || self.processed_locally.is_some()
    }

    /// Convert to JSON string for storage
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Create from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

impl Default for SearchFilters {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_meeting_status_display() {
        assert_eq!(MeetingStatus::Scheduled.to_string(), "scheduled");
        assert_eq!(MeetingStatus::InProgress.to_string(), "in_progress");
        assert_eq!(MeetingStatus::Completed.to_string(), "completed");
        assert_eq!(MeetingStatus::Cancelled.to_string(), "cancelled");
    }

    #[test]
    fn test_participant_role_display() {
        assert_eq!(ParticipantRole::Organizer.to_string(), "organizer");
        assert_eq!(ParticipantRole::Participant.to_string(), "participant");
        assert_eq!(ParticipantRole::Presenter.to_string(), "presenter");
    }

    #[test]
    fn test_transcription_mode_display() {
        assert_eq!(TranscriptionMode::Local.to_string(), "local");
        assert_eq!(TranscriptionMode::Cloud.to_string(), "cloud");
        assert_eq!(TranscriptionMode::Hybrid.to_string(), "hybrid");
    }

    #[test]
    fn test_search_filters() {
        let filters = SearchFilters::new();
        assert!(!filters.has_filters());

        let filters = SearchFilters {
            languages: Some(vec!["en".to_string()]),
            ..Default::default()
        };
        assert!(filters.has_filters());

        // Test JSON serialization
        let json = filters.to_json().unwrap();
        let restored = SearchFilters::from_json(&json).unwrap();
        assert_eq!(filters.languages, restored.languages);
    }

    #[test]
    fn test_create_meeting() {
        let create_meeting = CreateMeeting {
            title: "Test Meeting".to_string(),
            description: Some("A test meeting".to_string()),
            start_time: Utc::now(),
            end_time: None,
        };

        assert_eq!(create_meeting.title, "Test Meeting");
        assert!(create_meeting.description.is_some());
    }

    #[test]
    fn test_create_transcription() {
        let create_transcription = CreateTranscription {
            chunk_id: "test-chunk-id".to_string(),
            meeting_id: 1,
            session_id: "test-session-id".to_string(),
            content: "Hello world".to_string(),
            confidence: 0.95,
            language: "en".to_string(),
            model_used: "whisper-tiny".to_string(),
            start_timestamp: 0.0,
            end_timestamp: 2.0,
            word_count: 2,
            processing_time_ms: 150,
            processed_locally: true,
        };

        assert_eq!(create_transcription.content, "Hello world");
        assert_eq!(create_transcription.confidence, 0.95);
        assert!(create_transcription.processed_locally);
    }
}