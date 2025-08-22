use std::sync::Arc;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tokio::sync::RwLock;

use super::oauth::OAuth2Service;
use super::types::{CalendarError, CalendarEvent, TimeRange, CalendarProvider};

#[derive(Debug, Deserialize)]
struct GoogleCalendarListResponse {
    items: Vec<GoogleCalendarEvent>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleCalendarEvent {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    start: GoogleDateTime,
    end: GoogleDateTime,
    attendees: Option<Vec<GoogleAttendee>>,
    location: Option<String>,
    #[serde(rename = "hangoutLink")]
    hangout_link: Option<String>,
    #[serde(rename = "htmlLink")]
    html_link: Option<String>,
    updated: String,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleDateTime {
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
    date: Option<String>,
    #[serde(rename = "timeZone")]
    time_zone: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct GoogleAttendee {
    email: Option<String>,
    #[serde(rename = "responseStatus")]
    response_status: Option<String>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

pub struct GoogleCalendarService {
    oauth_service: Arc<OAuth2Service>,
    http_client: reqwest::Client,
    base_url: String,
}

impl GoogleCalendarService {
    pub fn new(oauth_service: Arc<OAuth2Service>) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            oauth_service,
            http_client,
            base_url: "https://www.googleapis.com/calendar/v3".to_string(),
        }
    }

    pub async fn fetch_events(
        &self,
        account_id: i64,
        time_range: TimeRange,
    ) -> Result<Vec<CalendarEvent>, CalendarError> {
        let access_token = self.oauth_service.get_valid_token(account_id).await?;
        let mut all_events = Vec::new();
        let mut page_token: Option<String> = None;

        // Google Calendar API pagination
        loop {
            let mut url = format!(
                "{}/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=250",
                self.base_url,
                time_range.start.to_rfc3339(),
                time_range.end.to_rfc3339()
            );

            if let Some(token) = &page_token {
                url.push_str(&format!("&pageToken={}", token));
            }

            let response = self
                .http_client
                .get(&url)
                .header(AUTHORIZATION, format!("Bearer {}", access_token))
                .header(CONTENT_TYPE, "application/json")
                .send()
                .await?;

            if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                // Token might be expired, try to refresh
                let new_token = self.oauth_service.refresh_token(account_id).await?;
                return self.fetch_events_with_token(account_id, &new_token.access_token, time_range).await;
            }

            if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                // Rate limit exceeded
                let retry_after = response
                    .headers()
                    .get("retry-after")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(60);
                
                return Err(CalendarError::RateLimitExceeded { seconds: retry_after });
            }

            response.error_for_status_ref()?;
            
            let calendar_response: GoogleCalendarListResponse = response.json().await?;
            
            // Convert Google events to our CalendarEvent format
            for google_event in calendar_response.items {
                if let Some(event) = self.convert_google_event(google_event, account_id)? {
                    // Filter out irrelevant events
                    if self.is_meeting_relevant(&event) {
                        all_events.push(event);
                    }
                }
            }

            // Check if there are more pages
            page_token = calendar_response.next_page_token;
            if page_token.is_none() {
                break;
            }
        }

        Ok(all_events)
    }

    async fn fetch_events_with_token(
        &self,
        account_id: i64,
        access_token: &str,
        time_range: TimeRange,
    ) -> Result<Vec<CalendarEvent>, CalendarError> {
        let url = format!(
            "{}/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=250",
            self.base_url,
            time_range.start.to_rfc3339(),
            time_range.end.to_rfc3339()
        );

        let response = self
            .http_client
            .get(&url)
            .header(AUTHORIZATION, format!("Bearer {}", access_token))
            .header(CONTENT_TYPE, "application/json")
            .send()
            .await?;

        response.error_for_status_ref()?;
        
        let calendar_response: GoogleCalendarListResponse = response.json().await?;
        let mut events = Vec::new();

        for google_event in calendar_response.items {
            if let Some(event) = self.convert_google_event(google_event, account_id)? {
                if self.is_meeting_relevant(&event) {
                    events.push(event);
                }
            }
        }

        Ok(events)
    }

    fn convert_google_event(
        &self,
        google_event: GoogleCalendarEvent,
        calendar_account_id: i64,
    ) -> Result<Option<CalendarEvent>, CalendarError> {
        // Skip cancelled events
        if google_event.status.as_deref() == Some("cancelled") {
            return Ok(None);
        }

        // Parse start and end times
        let start_time = self.parse_google_datetime(&google_event.start)?;
        let end_time = self.parse_google_datetime(&google_event.end)?;

        // Skip all-day events (they don't have dateTime field)
        if google_event.start.date_time.is_none() {
            return Ok(None);
        }

        // Extract participants
        let participants = google_event
            .attendees
            .clone()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|attendee| {
                // Only include accepted or tentative attendees
                match attendee.response_status.as_deref() {
                    Some("declined") => None,
                    _ => attendee.email,
                }
            })
            .collect();

        // Determine if the current user has accepted the meeting
        let is_accepted = google_event
            .attendees
            .as_ref()
            .map(|attendees| {
                attendees.iter().any(|a| {
                    a.response_status.as_deref() != Some("declined")
                })
            })
            .unwrap_or(true); // If no attendees, assume accepted

        // Parse last modified time
        let last_modified = chrono::DateTime::parse_from_rfc3339(&google_event.updated)
            .map(|dt| dt.with_timezone(&Utc))
            .ok();

        // Determine meeting URL (prefer hangout link, fallback to html link)
        let meeting_url = google_event.hangout_link
            .or(google_event.html_link)
            .or_else(|| {
                // Extract meeting URLs from description
                google_event.description.as_ref().and_then(|desc| {
                    self.extract_meeting_url_from_description(desc)
                })
            });

        Ok(Some(CalendarEvent {
            id: None, // Will be set by database
            calendar_account_id,
            external_event_id: google_event.id,
            title: google_event.summary.unwrap_or_else(|| "(No title)".to_string()),
            description: google_event.description,
            start_time,
            end_time,
            participants,
            location: google_event.location,
            meeting_url,
            is_accepted,
            last_modified,
            created_at: Utc::now(),
        }))
    }

    fn parse_google_datetime(&self, google_dt: &GoogleDateTime) -> Result<DateTime<Utc>, CalendarError> {
        if let Some(date_time) = &google_dt.date_time {
            chrono::DateTime::parse_from_rfc3339(date_time)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| CalendarError::AuthenticationFailed {
                    reason: format!("Failed to parse datetime: {}", e),
                })
        } else {
            Err(CalendarError::AuthenticationFailed {
                reason: "All-day events are not supported".to_string(),
            })
        }
    }

    fn is_meeting_relevant(&self, event: &CalendarEvent) -> bool {
        // Skip if the user has declined
        if !event.is_accepted {
            return false;
        }

        // Skip very short events (less than 5 minutes)
        let duration = event.end_time.signed_duration_since(event.start_time);
        if duration.num_minutes() < 5 {
            return false;
        }

        // Skip events that are clearly not meetings
        let title_lower = event.title.to_lowercase();
        let excluded_keywords = [
            "lunch", "break", "holiday", "vacation", "out of office", 
            "ooo", "personal", "blocked", "focus time", "busy"
        ];
        
        if excluded_keywords.iter().any(|keyword| title_lower.contains(keyword)) {
            return false;
        }

        // Prefer events with meeting URLs or multiple participants
        event.meeting_url.is_some() || event.participants.len() > 1
    }

    fn extract_meeting_url_from_description(&self, description: &str) -> Option<String> {
        // Common meeting URL patterns
        let url_patterns = [
            r"https://[a-zA-Z0-9.-]+\.zoom\.us/j/[0-9]+",
            r"https://meet\.google\.com/[a-zA-Z0-9-]+",
            r"https://teams\.microsoft\.com/l/meetup-join/[^\\s]+",
            r"https://[a-zA-Z0-9.-]+\.webex\.com/[^\\s]+",
        ];

        for pattern in &url_patterns {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(match_) = regex.find(description) {
                    return Some(match_.as_str().to_string());
                }
            }
        }

        None
    }

    pub async fn setup_webhook(&self, account_id: i64, webhook_url: &str) -> Result<String, CalendarError> {
        let access_token = self.oauth_service.get_valid_token(account_id).await?;
        
        #[derive(Serialize)]
        struct WebhookRequest {
            id: String,
            r#type: String,
            address: String,
        }

        let webhook_id = uuid::Uuid::new_v4().to_string();
        let webhook_request = WebhookRequest {
            id: webhook_id.clone(),
            r#type: "web_hook".to_string(),
            address: webhook_url.to_string(),
        };

        let url = format!("{}/calendars/primary/events/watch", self.base_url);
        
        let response = self
            .http_client
            .post(&url)
            .header(AUTHORIZATION, format!("Bearer {}", access_token))
            .header(CONTENT_TYPE, "application/json")
            .json(&webhook_request)
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(CalendarError::InvalidToken {
                reason: "Access token is invalid or expired".to_string(),
            });
        }

        response.error_for_status_ref()?;

        Ok(webhook_id)
    }
}

#[async_trait]
pub trait CalendarService: Send + Sync {
    async fn fetch_events(
        &self,
        account_id: i64,
        time_range: TimeRange,
    ) -> Result<Vec<CalendarEvent>, CalendarError>;
    
    async fn setup_webhook(&self, account_id: i64, webhook_url: &str) -> Result<String, CalendarError>;
}

#[async_trait]
impl CalendarService for GoogleCalendarService {
    async fn fetch_events(
        &self,
        account_id: i64,
        time_range: TimeRange,
    ) -> Result<Vec<CalendarEvent>, CalendarError> {
        self.fetch_events(account_id, time_range).await
    }

    async fn setup_webhook(&self, account_id: i64, webhook_url: &str) -> Result<String, CalendarError> {
        self.setup_webhook(account_id, webhook_url).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_meeting_relevance_filtering() {
        let service = GoogleCalendarService::new(Arc::new(OAuth2Service::default()));
        
        let relevant_event = CalendarEvent {
            id: None,
            calendar_account_id: 1,
            external_event_id: "test1".to_string(),
            title: "Team standup".to_string(),
            description: None,
            start_time: Utc::now(),
            end_time: Utc::now() + chrono::Duration::minutes(30),
            participants: vec!["user1@example.com".to_string(), "user2@example.com".to_string()],
            location: None,
            meeting_url: Some("https://meet.google.com/abc-defg-hij".to_string()),
            is_accepted: true,
            last_modified: None,
            created_at: Utc::now(),
        };

        assert!(service.is_meeting_relevant(&relevant_event));

        let irrelevant_event = CalendarEvent {
            title: "Lunch break".to_string(),
            is_accepted: false,
            ..relevant_event.clone()
        };

        assert!(!service.is_meeting_relevant(&irrelevant_event));
    }

    #[test]
    fn test_meeting_url_extraction() {
        let service = GoogleCalendarService::new(Arc::new(OAuth2Service::default()));
        
        let description = "Join the meeting at https://zoom.us/j/123456789 or call in at +1-555-123-4567";
        let url = service.extract_meeting_url_from_description(description);
        assert!(url.is_some());
        assert!(url.unwrap().contains("zoom.us"));

        let google_meet_desc = "Meeting link: https://meet.google.com/abc-defg-hij";
        let google_url = service.extract_meeting_url_from_description(google_meet_desc);
        assert!(google_url.is_some());
        assert!(google_url.unwrap().contains("meet.google.com"));
    }
}