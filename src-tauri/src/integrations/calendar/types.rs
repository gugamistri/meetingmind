use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum CalendarError {
    #[error("OAuth2 authentication failed: {reason}")]
    AuthenticationFailed { reason: String },
    
    #[error("Calendar service unavailable")]
    ServiceUnavailable,
    
    #[error("Rate limit exceeded, retry after {seconds}s")]
    RateLimitExceeded { seconds: u64 },
    
    #[error("Invalid token: {reason}")]
    InvalidToken { reason: String },
    
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("OAuth2 error: {0}")]
    OAuth2(#[from] oauth2::RequestTokenError<oauth2::reqwest::Error<reqwest::Error>, oauth2::StandardErrorResponse<oauth2::basic::BasicErrorResponseType>>),
    
    #[error("URL parsing error: {0}")]
    UrlParsing(#[from] url::ParseError),
    
    #[error("Encryption error: {message}")]
    Encryption { message: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CalendarProvider {
    Google,
    Outlook,
}

impl std::fmt::Display for CalendarProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarProvider::Google => write!(f, "google"),
            CalendarProvider::Outlook => write!(f, "outlook"),
        }
    }
}

impl std::str::FromStr for CalendarProvider {
    type Err = CalendarError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "google" => Ok(CalendarProvider::Google),
            "outlook" => Ok(CalendarProvider::Outlook),
            _ => Err(CalendarError::AuthenticationFailed {
                reason: format!("Unknown provider: {}", s),
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarAccount {
    pub id: Option<i64>,
    pub provider: CalendarProvider,
    pub account_email: String,
    pub is_active: bool,
    pub auto_start_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: Option<i64>,
    pub calendar_account_id: i64,
    pub external_event_id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub participants: Vec<String>,
    pub location: Option<String>,
    pub meeting_url: Option<String>,
    pub is_accepted: bool,
    pub last_modified: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedToken {
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct OAuth2Config {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub authorization_url: String,
    pub token_url: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationRequest {
    pub provider: CalendarProvider,
    pub state: String,
    pub pkce_verifier: String,
    pub authorization_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationResponse {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Clone)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeRange {
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    pub fn next_hours(hours: u32) -> Self {
        let start = Utc::now();
        let end = start + chrono::Duration::hours(hours as i64);
        Self { start, end }
    }

    pub fn next_days(days: u32) -> Self {
        let start = Utc::now();
        let end = start + chrono::Duration::days(days as i64);
        Self { start, end }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingDetectionConfig {
    pub detection_window_minutes: u32,
    pub confidence_threshold: f64,
    pub auto_start_enabled: bool,
    pub notification_enabled: bool,
    pub notification_minutes_before: u32,
}

impl Default for MeetingDetectionConfig {
    fn default() -> Self {
        Self {
            detection_window_minutes: 5,
            confidence_threshold: 0.8,
            auto_start_enabled: false,
            notification_enabled: true,
            notification_minutes_before: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub last_sync: Option<DateTime<Utc>>,
    pub events_synced: u32,
    pub sync_in_progress: bool,
    pub last_error: Option<String>,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            last_sync: None,
            events_synced: 0,
            sync_in_progress: false,
            last_error: None,
        }
    }
}

/// Converts a calendar event into meeting metadata
impl From<&CalendarEvent> for crate::storage::models::MeetingMetadata {
    fn from(event: &CalendarEvent) -> Self {
        Self {
            title: Some(event.title.clone()),
            participants: if event.participants.is_empty() {
                None
            } else {
                Some(event.participants.join(", "))
            },
            description: event.description.clone(),
            location: event.location.clone(),
            meeting_url: event.meeting_url.clone(),
            calendar_event_id: event.external_event_id.clone(),
        }
    }
}