use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_shell::ShellExt;

use crate::integrations::calendar::{
    OAuth2Service, CalendarRepository, GoogleCalendarService,
    CalendarError, CalendarProvider, CalendarAccount, CalendarEvent, 
    TimeRange, SyncStatus,
};
use crate::integrations::calendar::types::{AuthorizationRequest, AuthorizationResponse};
use crate::error::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarAuthRequest {
    pub provider: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarAuthResponse {
    pub authorization_url: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompleteAuthRequest {
    pub provider: String,
    pub code: String,
    pub state: String,
    pub account_email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncCalendarRequest {
    pub account_id: i64,
    pub hours_ahead: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateAutoStartRequest {
    pub account_id: i64,
    pub auto_start_enabled: bool,
}

// Store active OAuth flows temporarily
static OAUTH_FLOWS: std::sync::LazyLock<std::sync::Mutex<std::collections::HashMap<String, AuthorizationRequest>>> = 
    std::sync::LazyLock::new(|| std::sync::Mutex::new(std::collections::HashMap::new()));

#[tauri::command]
pub async fn start_calendar_auth(
    oauth_service: State<'_, Arc<OAuth2Service>>,
    request: CalendarAuthRequest,
) -> Result<CalendarAuthResponse, String> {
    let provider: CalendarProvider = request.provider.parse()
        .map_err(|e: CalendarError| e.to_string())?;

    let auth_request = oauth_service.start_oauth_flow(provider).await
        .map_err(|e| e.to_string())?;

    let auth_url = auth_request.authorization_url.clone();
    let state = auth_request.state.clone();

    // Store the auth request temporarily
    {
        let mut flows = OAUTH_FLOWS.lock().unwrap();
        flows.insert(state.clone(), auth_request);
    }

    Ok(CalendarAuthResponse {
        authorization_url: auth_url,
        state,
    })
}

#[tauri::command]
pub async fn complete_calendar_auth(
    oauth_service: State<'_, Arc<OAuth2Service>>,
    request: CompleteAuthRequest,
) -> Result<i64, String> {
    // Retrieve the stored auth request
    let auth_request = {
        let mut flows = OAUTH_FLOWS.lock().unwrap();
        flows.remove(&request.state)
    }.ok_or_else(|| "Invalid or expired authentication state".to_string())?;

    let auth_response = AuthorizationResponse {
        code: request.code,
        state: request.state,
    };

    let account_id = oauth_service
        .complete_oauth_flow(&auth_request, auth_response, request.account_email)
        .await
        .map_err(|e| e.to_string())?;

    Ok(account_id)
}

#[tauri::command]
pub async fn get_calendar_accounts(
    repository: State<'_, Arc<CalendarRepository>>,
) -> Result<Vec<CalendarAccount>, String> {
    repository.get_active_accounts().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_calendar_events(
    calendar_service: State<'_, Arc<GoogleCalendarService>>,
    repository: State<'_, Arc<CalendarRepository>>,
    request: SyncCalendarRequest,
) -> Result<u32, String> {
    let hours_ahead = request.hours_ahead.unwrap_or(24);
    let time_range = TimeRange::next_hours(hours_ahead);

    let events = calendar_service
        .fetch_events(request.account_id, time_range)
        .await
        .map_err(|e| e.to_string())?;

    let event_count = events.len() as u32;
    repository.save_events(request.account_id, events).await
        .map_err(|e| e.to_string())?;

    Ok(event_count)
}

#[tauri::command]
pub async fn get_upcoming_meetings(
    repository: State<'_, Arc<CalendarRepository>>,
    account_id: Option<i64>,
    hours_ahead: Option<u32>,
) -> Result<Vec<CalendarEvent>, String> {
    let hours = hours_ahead.unwrap_or(24);
    repository.get_upcoming_events(account_id, hours).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_meetings_in_detection_window(
    repository: State<'_, Arc<CalendarRepository>>,
    window_minutes: Option<u32>,
) -> Result<Vec<CalendarEvent>, String> {
    let minutes = window_minutes.unwrap_or(5);
    repository.get_events_in_detection_window(minutes).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_calendar_auto_start(
    repository: State<'_, Arc<CalendarRepository>>,
    request: UpdateAutoStartRequest,
) -> Result<(), String> {
    repository.update_account_auto_start(request.account_id, request.auto_start_enabled).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_calendar_account(
    oauth_service: State<'_, Arc<OAuth2Service>>,
    repository: State<'_, Arc<CalendarRepository>>,
    account_id: i64,
) -> Result<(), String> {
    // Revoke OAuth2 tokens first
    if let Err(e) = oauth_service.revoke_token(account_id).await {
        tracing::warn!("Failed to revoke OAuth2 tokens: {}", e);
        // Continue with deletion even if revocation fails
    }

    // Delete from database
    repository.delete_account(account_id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_calendar_sync_status(
    repository: State<'_, Arc<CalendarRepository>>,
    account_id: i64,
) -> Result<SyncStatus, String> {
    repository.get_sync_status(account_id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cleanup_old_calendar_events(
    repository: State<'_, Arc<CalendarRepository>>,
    days_to_keep: Option<u32>,
) -> Result<u64, String> {
    let days = days_to_keep.unwrap_or(30);
    repository.cleanup_old_events(days).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_meeting_conflicts(
    repository: State<'_, Arc<CalendarRepository>>,
    start_time: String,
    end_time: String,
) -> Result<Vec<CalendarEvent>, String> {
    let start = chrono::DateTime::parse_from_rfc3339(&start_time)
        .map_err(|e| format!("Invalid start time format: {}", e))?
        .with_timezone(&chrono::Utc);
    
    let end = chrono::DateTime::parse_from_rfc3339(&end_time)
        .map_err(|e| format!("Invalid end time format: {}", e))?
        .with_timezone(&chrono::Utc);

    repository.find_conflicting_meetings(start, end).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refresh_calendar_token(
    oauth_service: State<'_, Arc<OAuth2Service>>,
    account_id: i64,
) -> Result<(), String> {
    oauth_service.refresh_token(account_id).await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Open the system default browser for OAuth2 authentication
#[tauri::command]
pub async fn open_oauth_browser(
    app_handle: tauri::AppHandle,
    authorization_url: String,
) -> Result<(), String> {
    let shell = app_handle.shell();
    shell.open(&authorization_url, None)
        .map_err(|e| format!("Failed to open browser: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::database::create_test_pool;
    
    #[tokio::test]
    async fn test_calendar_auth_request_serialization() {
        let request = CalendarAuthRequest {
            provider: "google".to_string(),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("google"));
        
        let deserialized: CalendarAuthRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.provider, "google");
    }
}