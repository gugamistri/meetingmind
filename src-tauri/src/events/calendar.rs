use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::integrations::calendar::{CalendarEvent as CalendarEventData, SyncStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum CalendarEvent {
    /// Emitted when a meeting is detected within the detection window
    MeetingDetected {
        event: CalendarEventData,
        confidence: f64,
        countdown_seconds: u32,
    },
    
    /// Emitted when calendar sync starts
    SyncStarted {
        account_id: i64,
    },
    
    /// Emitted when calendar sync completes
    SyncCompleted {
        account_id: i64,
        events_synced: u32,
        status: SyncStatus,
    },
    
    /// Emitted when calendar sync fails
    SyncFailed {
        account_id: i64,
        error: String,
    },
    
    /// Emitted when OAuth2 authentication is required
    AuthenticationRequired {
        account_id: i64,
        provider: String,
    },
    
    /// Emitted when a meeting is about to start (notification)
    MeetingNotification {
        event: CalendarEventData,
        minutes_until_start: u32,
    },
    
    /// Emitted when auto-start behavior is triggered
    AutoStartTriggered {
        event: CalendarEventData,
        meeting_id: String,
    },
    
    /// Emitted when calendar accounts are updated
    AccountsUpdated {
        accounts_count: u32,
    },
}

pub struct CalendarEventEmitter {
    app_handle: AppHandle,
}

impl CalendarEventEmitter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn emit_meeting_detected(&self, event: CalendarEventData, confidence: f64, countdown_seconds: u32) {
        let calendar_event = CalendarEvent::MeetingDetected {
            event,
            confidence,
            countdown_seconds,
        };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit meeting detected event: {}", e);
        }
    }

    pub fn emit_sync_started(&self, account_id: i64) {
        let calendar_event = CalendarEvent::SyncStarted { account_id };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit sync started event: {}", e);
        }
    }

    pub fn emit_sync_completed(&self, account_id: i64, events_synced: u32, status: SyncStatus) {
        let calendar_event = CalendarEvent::SyncCompleted {
            account_id,
            events_synced,
            status,
        };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit sync completed event: {}", e);
        }
    }

    pub fn emit_sync_failed(&self, account_id: i64, error: String) {
        let calendar_event = CalendarEvent::SyncFailed {
            account_id,
            error,
        };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit sync failed event: {}", e);
        }
    }

    pub fn emit_authentication_required(&self, account_id: i64, provider: String) {
        let calendar_event = CalendarEvent::AuthenticationRequired {
            account_id,
            provider,
        };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit authentication required event: {}", e);
        }
    }

    pub fn emit_meeting_notification(&self, event: CalendarEventData, minutes_until_start: u32) {
        let calendar_event = CalendarEvent::MeetingNotification {
            event,
            minutes_until_start,
        };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit meeting notification event: {}", e);
        }
    }

    pub fn emit_auto_start_triggered(&self, event: CalendarEventData, meeting_id: String) {
        let calendar_event = CalendarEvent::AutoStartTriggered {
            event,
            meeting_id,
        };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit auto start triggered event: {}", e);
        }
    }

    pub fn emit_accounts_updated(&self, accounts_count: u32) {
        let calendar_event = CalendarEvent::AccountsUpdated { accounts_count };
        
        if let Err(e) = self.app_handle.emit("calendar-event", &calendar_event) {
            tracing::error!("Failed to emit accounts updated event: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_calendar_event_serialization() {
        let event = CalendarEvent::SyncStarted { account_id: 123 };
        
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("SyncStarted"));
        assert!(json.contains("123"));
        
        let deserialized: CalendarEvent = serde_json::from_str(&json).unwrap();
        match deserialized {
            CalendarEvent::SyncStarted { account_id } => assert_eq!(account_id, 123),
            _ => panic!("Wrong event type deserialized"),
        }
    }
}