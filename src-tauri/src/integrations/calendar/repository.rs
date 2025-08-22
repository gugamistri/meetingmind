use sqlx::SqlitePool;
use chrono::{DateTime, Utc};

use super::types::{
    CalendarError, CalendarAccount, CalendarEvent, CalendarProvider, SyncStatus,
};

pub struct CalendarRepository {
    pool: SqlitePool,
}

impl CalendarRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    // Calendar Account Management
    pub async fn get_account(&self, account_id: i64) -> Result<Option<CalendarAccount>, CalendarError> {
        let row = sqlx::query!(
            r#"
            SELECT id, provider, account_email, is_active, auto_start_enabled, created_at, updated_at
            FROM calendar_accounts 
            WHERE id = ?
            "#,
            account_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let provider_str = match row.provider {
                Some(p) => p,
                None => return Ok(None), // If provider is null, skip this account
            };
            
            Ok(Some(CalendarAccount {
                id: Some(row.id),
                provider: provider_str.parse()?,
                account_email: row.account_email,
                is_active: row.is_active.unwrap_or(false),
                auto_start_enabled: row.auto_start_enabled.unwrap_or(false),
                created_at: row.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
                updated_at: row.updated_at
                    .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|| Utc::now()),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_active_accounts(&self) -> Result<Vec<CalendarAccount>, CalendarError> {
        let rows = sqlx::query!(
            r#"
            SELECT id, provider, account_email, is_active, auto_start_enabled, created_at, updated_at
            FROM calendar_accounts 
            WHERE is_active = TRUE
            ORDER BY created_at ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let mut accounts = Vec::new();
        for row in rows {
            if let Some(provider_str) = row.provider {
                accounts.push(CalendarAccount {
                    id: Some(row.id),
                    provider: provider_str.parse()?,
                    account_email: row.account_email,
                    is_active: row.is_active.unwrap_or(false),
                    auto_start_enabled: row.auto_start_enabled.unwrap_or(false),
                    created_at: row.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
                    updated_at: row.updated_at
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|| Utc::now()),
                });
            }
        }

        Ok(accounts)
    }

    pub async fn update_account_auto_start(&self, account_id: i64, auto_start_enabled: bool) -> Result<(), CalendarError> {
        sqlx::query!(
            "UPDATE calendar_accounts SET auto_start_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            auto_start_enabled,
            account_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_account(&self, account_id: i64) -> Result<(), CalendarError> {
        // Delete associated calendar events first (CASCADE should handle this)
        sqlx::query!(
            "DELETE FROM calendar_events WHERE calendar_account_id = ?",
            account_id
        )
        .execute(&self.pool)
        .await?;

        // Delete the account
        sqlx::query!(
            "DELETE FROM calendar_accounts WHERE id = ?",
            account_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_events(
        &self,
        account_id: i64,
        events: Vec<CalendarEvent>,
    ) -> Result<Vec<i64>, CalendarError> {
        let mut transaction = self.pool.begin().await?;
        let mut event_ids = Vec::new();

        for event in events {
            let participants_json = serde_json::to_string(&event.participants)?;
            let start_time_str = event.start_time.to_rfc3339();
            let end_time_str = event.end_time.to_rfc3339();
            let last_modified_str = event.last_modified.as_ref().map(|dt| dt.to_rfc3339());
            
            let event_id = sqlx::query!(
                r#"
                INSERT INTO calendar_events 
                (calendar_account_id, external_event_id, title, description, start_time, end_time, 
                 participants, location, meeting_url, is_accepted, last_modified, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(calendar_account_id, external_event_id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    start_time = excluded.start_time,
                    end_time = excluded.end_time,
                    participants = excluded.participants,
                    location = excluded.location,
                    meeting_url = excluded.meeting_url,
                    is_accepted = excluded.is_accepted,
                    last_modified = excluded.last_modified
                RETURNING id
                "#,
                event.calendar_account_id,
                event.external_event_id,
                event.title,
                event.description,
                start_time_str,
                end_time_str,
                participants_json,
                event.location,
                event.meeting_url,
                event.is_accepted,
                last_modified_str
            )
            .fetch_one(&mut *transaction)
            .await?;

            event_ids.push(event_id.id);
        }

        transaction.commit().await?;
        Ok(event_ids)
    }

    pub async fn get_upcoming_events(&self, account_id: Option<i64>, hours_ahead: u32) -> Result<Vec<CalendarEvent>, CalendarError> {
        let now = Utc::now();
        let end_time = now + chrono::Duration::hours(hours_ahead as i64);
        let now_str = now.to_rfc3339();
        let end_time_str = end_time.to_rfc3339();

        let rows = if let Some(account_id) = account_id {
            sqlx::query!(
                r#"
                SELECT id, calendar_account_id, external_event_id, title, description, 
                       start_time, end_time, participants, location, meeting_url, 
                       is_accepted, last_modified, created_at
                FROM calendar_events 
                WHERE calendar_account_id = ? AND start_time BETWEEN ? AND ? AND is_accepted = TRUE
                ORDER BY start_time ASC
                "#,
                account_id,
                now_str,
                end_time_str
            )
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query!(
                r#"
                SELECT id, calendar_account_id, external_event_id, title, description, 
                       start_time, end_time, participants, location, meeting_url, 
                       is_accepted, last_modified, created_at
                FROM calendar_events 
                WHERE start_time BETWEEN ? AND ? AND is_accepted = TRUE
                ORDER BY start_time ASC
                "#,
                now_str,
                end_time_str
            )
            .fetch_all(&self.pool)
            .await?
        };

        let mut events = Vec::new();
        for row in rows {
            let participants: Vec<String> = serde_json::from_str(row.participants.as_deref().unwrap_or("[]"))?;
            
            events.push(CalendarEvent {
                id: row.id,
                calendar_account_id: row.calendar_account_id,
                external_event_id: row.external_event_id,
                title: row.title,
                description: row.description,
                start_time: row.start_time.and_utc(),
                end_time: row.end_time.and_utc(),
                participants,
                location: row.location,
                meeting_url: row.meeting_url,
                is_accepted: row.is_accepted.unwrap_or(false),
                last_modified: row.last_modified.map(|lm| lm.and_utc()),
                created_at: row.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
            });
        }

        Ok(events)
    }

    pub async fn get_events_in_detection_window(&self, window_minutes: u32) -> Result<Vec<CalendarEvent>, CalendarError> {
        let now = Utc::now();
        let window_start = now - chrono::Duration::minutes(window_minutes as i64);
        let window_end = now + chrono::Duration::minutes(window_minutes as i64);

        let window_start_str = window_start.to_rfc3339();
        let window_end_str = window_end.to_rfc3339();
        
        let rows = sqlx::query!(
            r#"
            SELECT ce.id, ce.calendar_account_id, ce.external_event_id, ce.title, ce.description, 
                   ce.start_time, ce.end_time, ce.participants, ce.location, ce.meeting_url, 
                   ce.is_accepted, ce.last_modified, ce.created_at
            FROM calendar_events ce
            JOIN calendar_accounts ca ON ce.calendar_account_id = ca.id
            WHERE ca.is_active = TRUE 
              AND ca.auto_start_enabled = TRUE
              AND ce.is_accepted = TRUE
              AND ce.start_time BETWEEN ? AND ?
            ORDER BY ce.start_time ASC
            "#,
            window_start_str,
            window_end_str
        )
        .fetch_all(&self.pool)
        .await?;

        let mut events = Vec::new();
        for row in rows {
            let participants: Vec<String> = serde_json::from_str(row.participants.as_deref().unwrap_or("[]"))?;
            
            events.push(CalendarEvent {
                id: row.id,
                calendar_account_id: row.calendar_account_id,
                external_event_id: row.external_event_id,
                title: row.title,
                description: row.description,
                start_time: row.start_time.and_utc(),
                end_time: row.end_time.and_utc(),
                participants,
                location: row.location,
                meeting_url: row.meeting_url,
                is_accepted: row.is_accepted.unwrap_or(false),
                last_modified: row.last_modified.map(|lm| lm.and_utc()),
                created_at: row.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
            });
        }

        Ok(events)
    }

    pub async fn cleanup_old_events(&self, days_to_keep: u32) -> Result<u64, CalendarError> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days_to_keep as i64);
        
        let cutoff_rfc3339 = cutoff_date.to_rfc3339();
        let result = sqlx::query!(
            "DELETE FROM calendar_events WHERE end_time < ?",
            cutoff_rfc3339
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn get_sync_status(&self, account_id: i64) -> Result<SyncStatus, CalendarError> {
        let row = sqlx::query!(
            r#"
            SELECT updated_at,
                   CAST((SELECT COUNT(*) FROM calendar_events WHERE calendar_account_id = ?) AS INTEGER) as "events_count: i64"
            FROM calendar_accounts 
            WHERE id = ?
            "#,
            account_id,
            account_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(SyncStatus {
                last_sync: row.updated_at.map(|dt| dt.and_utc()),
                events_synced: row.events_count.unwrap_or(0) as u32,
                sync_in_progress: false, // Would be tracked separately in a real implementation
                last_error: None, // Would be stored in database in a real implementation
            })
        } else {
            Ok(SyncStatus::default())
        }
    }

    pub async fn find_conflicting_meetings(
        &self, 
        start_time: DateTime<Utc>, 
        end_time: DateTime<Utc>
    ) -> Result<Vec<CalendarEvent>, CalendarError> {
        let start_time_str = start_time.to_rfc3339();
        let end_time_str = end_time.to_rfc3339();
        
        let rows = sqlx::query!(
            r#"
            SELECT ce.id, ce.calendar_account_id, ce.external_event_id, ce.title, ce.description, 
                   ce.start_time, ce.end_time, ce.participants, ce.location, ce.meeting_url, 
                   ce.is_accepted, ce.last_modified, ce.created_at
            FROM calendar_events ce
            JOIN calendar_accounts ca ON ce.calendar_account_id = ca.id
            WHERE ca.is_active = TRUE 
              AND ce.is_accepted = TRUE
              AND (
                (ce.start_time <= ? AND ce.end_time > ?) OR
                (ce.start_time < ? AND ce.end_time >= ?) OR
                (ce.start_time >= ? AND ce.end_time <= ?)
              )
            ORDER BY ce.start_time ASC
            "#,
            start_time_str, start_time_str,
            end_time_str, end_time_str,
            start_time_str, end_time_str
        )
        .fetch_all(&self.pool)
        .await?;

        let mut events = Vec::new();
        for row in rows {
            let participants: Vec<String> = serde_json::from_str(row.participants.as_deref().unwrap_or("[]"))?;
            
            events.push(CalendarEvent {
                id: row.id,
                calendar_account_id: row.calendar_account_id,
                external_event_id: row.external_event_id,
                title: row.title,
                description: row.description,
                start_time: row.start_time.and_utc(),
                end_time: row.end_time.and_utc(),
                participants,
                location: row.location,
                meeting_url: row.meeting_url,
                is_accepted: row.is_accepted.unwrap_or(false),
                last_modified: row.last_modified.map(|lm| lm.and_utc()),
                created_at: row.created_at.map(|dt| dt.and_utc()).unwrap_or_else(|| Utc::now()),
            });
        }

        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::database::create_test_pool;
    use chrono::{Duration, Utc, TimeZone};
    
    /// Critical Test: Offline Functionality Validation - AC5 Reliability
    /// Tests: 1.5-INT-010 Offline Cache Consistency
    #[tokio::test]
    async fn test_offline_cache_consistency() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        // Create a test account
        let account_id = repo.create_test_account().await.unwrap();
        
        let now = Utc::now();
        let future_meeting = now + Duration::minutes(10);
        
        // Store calendar events in cache
        let test_events = vec![
            CalendarEvent {
                id: 0,
                calendar_account_id: account_id,
                external_event_id: "event_1".to_string(),
                title: "Important meeting".to_string(),
                description: Some("Urgent discussion".to_string()),
                start_time: future_meeting,
                end_time: future_meeting + Duration::minutes(30),
                participants: vec!["user1@test.com".to_string()],
                location: None,
                meeting_url: Some("https://meet.google.com/test".to_string()),
                is_accepted: true,
                last_modified: now,
                created_at: now,
            },
            CalendarEvent {
                id: 0,
                calendar_account_id: account_id,
                external_event_id: "event_2".to_string(),
                title: "Team sync".to_string(),
                description: None,
                start_time: future_meeting + Duration::hours(1),
                end_time: future_meeting + Duration::hours(1) + Duration::minutes(30),
                participants: vec![],
                location: None,
                meeting_url: None,
                is_accepted: true,
                last_modified: now,
                created_at: now,
            },
        ];
        
        // Store events in cache
        for event in &test_events {
            repo.store_calendar_event(event).await.unwrap();
        }
        
        // Test offline detection functionality
        let cached_events = repo.get_upcoming_events(Some(account_id), 24).await.unwrap();
        
        assert_eq!(cached_events.len(), 2);
        assert_eq!(cached_events[0].title, "Important meeting");
        assert_eq!(cached_events[1].title, "Team sync");
        
        // Verify meeting detection works with cached data
        let detection_events = repo.get_events_in_detection_window(10).await.unwrap();
        assert_eq!(detection_events.len(), 1); // Only the 10-minute meeting should be in window
        assert_eq!(detection_events[0].title, "Important meeting");
    }

    /// Critical Test: Cache Data Staleness Handling - AC5 Offline Reliability
    #[tokio::test]
    async fn test_cache_data_staleness_handling() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        let account_id = repo.create_test_account().await.unwrap();
        let now = Utc::now();
        
        // Store an old event that should be considered stale
        let old_event = CalendarEvent {
            id: 0,
            calendar_account_id: account_id,
            external_event_id: "old_event".to_string(),
            title: "Old cached meeting".to_string(),
            description: None,
            start_time: now - Duration::hours(2), // 2 hours ago
            end_time: now - Duration::minutes(90), // Ended 90 minutes ago
            participants: vec![],
            location: None,
            meeting_url: None,
            is_accepted: true,
            last_modified: now - Duration::days(1), // Last modified 1 day ago
            created_at: now - Duration::days(1),
        };
        
        repo.store_calendar_event(&old_event).await.unwrap();
        
        // Test that old events are properly handled
        let upcoming_events = repo.get_upcoming_events(Some(account_id), 24).await.unwrap();
        assert_eq!(upcoming_events.len(), 0); // Old events should not appear in upcoming
        
        // Test cleanup functionality
        repo.cleanup_old_events(account_id, Duration::hours(1)).await.unwrap();
        
        // Verify old event was cleaned up
        let all_events = repo.get_all_cached_events(account_id).await.unwrap();
        assert_eq!(all_events.len(), 0);
    }

    /// Critical Test: Offline Meeting Detection Window - AC5 & AC1 Integration
    #[tokio::test]
    async fn test_offline_meeting_detection_window() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        let account_id = repo.create_test_account().await.unwrap();
        let now = Utc::now();
        
        let test_events = vec![
            // Should be detected (within 5-minute window)
            create_test_event("in_window_1", now + Duration::minutes(3), account_id),
            create_test_event("in_window_2", now - Duration::minutes(2), account_id),
            
            // Should NOT be detected (outside window)
            create_test_event("outside_window_1", now + Duration::minutes(10), account_id),
            create_test_event("outside_window_2", now - Duration::minutes(10), account_id),
        ];
        
        for event in &test_events {
            repo.store_calendar_event(event).await.unwrap();
        }
        
        // Test detection window logic
        let detected_events = repo.get_events_in_detection_window(5).await.unwrap();
        assert_eq!(detected_events.len(), 2);
        
        // Verify correct events detected
        let detected_titles: std::collections::HashSet<_> = 
            detected_events.iter().map(|e| &e.title).collect();
        assert!(detected_titles.contains(&"in_window_1".to_string()));
        assert!(detected_titles.contains(&"in_window_2".to_string()));
    }

    /// Test: Incremental Sync Conflict Resolution - AC5 Data Consistency
    #[tokio::test]
    async fn test_incremental_sync_conflict_resolution() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        let account_id = repo.create_test_account().await.unwrap();
        let now = Utc::now();
        
        // Store original event
        let original_event = CalendarEvent {
            id: 0,
            calendar_account_id: account_id,
            external_event_id: "conflict_event".to_string(),
            title: "Original title".to_string(),
            description: Some("Original description".to_string()),
            start_time: now + Duration::minutes(30),
            end_time: now + Duration::minutes(60),
            participants: vec!["original@test.com".to_string()],
            location: None,
            meeting_url: None,
            is_accepted: true,
            last_modified: now - Duration::minutes(10),
            created_at: now - Duration::hours(1),
        };
        
        repo.store_calendar_event(&original_event).await.unwrap();
        
        // Simulate updated event from sync (newer last_modified)
        let updated_event = CalendarEvent {
            id: 0,
            calendar_account_id: account_id,
            external_event_id: "conflict_event".to_string(),
            title: "Updated title".to_string(),
            description: Some("Updated description".to_string()),
            start_time: now + Duration::minutes(35), // Time changed
            end_time: now + Duration::minutes(65),
            participants: vec!["updated@test.com".to_string()],
            location: Some("Conference Room A".to_string()),
            meeting_url: Some("https://meet.google.com/updated".to_string()),
            is_accepted: true,
            last_modified: now, // More recent
            created_at: now - Duration::hours(1),
        };
        
        // Store updated event (should overwrite original)
        repo.store_calendar_event(&updated_event).await.unwrap();
        
        // Verify conflict resolution (should use newer version)
        let stored_events = repo.get_upcoming_events(Some(account_id), 24).await.unwrap();
        assert_eq!(stored_events.len(), 1);
        assert_eq!(stored_events[0].title, "Updated title");
        assert_eq!(stored_events[0].description, Some("Updated description".to_string()));
        assert_eq!(stored_events[0].participants, vec!["updated@test.com"]);
    }

    /// Test: Account Isolation in Cache - Data Privacy
    #[tokio::test]
    async fn test_account_isolation_in_cache() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        let account_1 = repo.create_test_account().await.unwrap();
        let account_2 = repo.create_test_account().await.unwrap();
        
        let now = Utc::now();
        
        // Store events for different accounts
        let event_1 = create_test_event("Account 1 meeting", now + Duration::minutes(10), account_1);
        let event_2 = create_test_event("Account 2 meeting", now + Duration::minutes(15), account_2);
        
        repo.store_calendar_event(&event_1).await.unwrap();
        repo.store_calendar_event(&event_2).await.unwrap();
        
        // Verify account isolation
        let account_1_events = repo.get_upcoming_events(Some(account_1), 24).await.unwrap();
        let account_2_events = repo.get_upcoming_events(Some(account_2), 24).await.unwrap();
        
        assert_eq!(account_1_events.len(), 1);
        assert_eq!(account_2_events.len(), 1);
        assert_eq!(account_1_events[0].title, "Account 1 meeting");
        assert_eq!(account_2_events[0].title, "Account 2 meeting");
        
        // Cross-account access should not return other account's data
        assert_ne!(account_1_events[0].calendar_account_id, account_2_events[0].calendar_account_id);
    }

    /// Test: Cache Performance with Large Datasets - AC5 Scalability
    #[tokio::test]
    async fn test_cache_performance_large_datasets() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        let account_id = repo.create_test_account().await.unwrap();
        let now = Utc::now();
        
        // Store many events
        for i in 0..100 {
            let event = CalendarEvent {
                id: 0,
                calendar_account_id: account_id,
                external_event_id: format!("bulk_event_{}", i),
                title: format!("Bulk meeting {}", i),
                description: None,
                start_time: now + Duration::minutes(i * 10),
                end_time: now + Duration::minutes(i * 10 + 30),
                participants: vec![],
                location: None,
                meeting_url: None,
                is_accepted: true,
                last_modified: now,
                created_at: now,
            };
            repo.store_calendar_event(&event).await.unwrap();
        }
        
        // Test query performance
        let start_time = std::time::Instant::now();
        let upcoming_events = repo.get_upcoming_events(Some(account_id), 48).await.unwrap();
        let query_duration = start_time.elapsed();
        
        // Should handle 100 events efficiently (under 100ms)
        assert!(query_duration.as_millis() < 100, "Query took too long: {:?}", query_duration);
        assert!(upcoming_events.len() > 0);
        
        // Test detection window performance
        let start_time = std::time::Instant::now();
        let detection_events = repo.get_events_in_detection_window(5).await.unwrap();
        let detection_duration = start_time.elapsed();
        
        assert!(detection_duration.as_millis() < 50, "Detection query took too long: {:?}", detection_duration);
        assert!(detection_events.len() <= 2); // Should only find events within 5 minutes
    }

    #[tokio::test]
    async fn test_calendar_repository_operations() {
        let pool = create_test_pool().await.unwrap();
        let repo = CalendarRepository::new(pool);
        
        // Test getting non-existent account
        let account = repo.get_account(999).await.unwrap();
        assert!(account.is_none());
        
        // Test getting upcoming events
        let events = repo.get_upcoming_events(None, 24).await.unwrap();
        assert!(events.is_empty()); // No events in test database
    }

    // Helper functions for tests
    fn create_test_event(title: &str, start_time: chrono::DateTime<Utc>, account_id: i64) -> CalendarEvent {
        CalendarEvent {
            id: 0,
            calendar_account_id: account_id,
            external_event_id: format!("test_{}", title.replace(" ", "_").to_lowercase()),
            title: title.to_string(),
            description: Some(format!("Description for {}", title)),
            start_time,
            end_time: start_time + Duration::minutes(30),
            participants: vec![format!("{}@test.com", title.replace(" ", "").to_lowercase())],
            location: None,
            meeting_url: Some("https://meet.google.com/test".to_string()),
            is_accepted: true,
            last_modified: Utc::now(),
            created_at: Utc::now(),
        }
    }
}

// Extension trait for test helper methods
impl CalendarRepository {
    #[cfg(test)]
    async fn create_test_account(&self) -> Result<i64, CalendarError> {
        let account_id = sqlx::query!(
            r#"
            INSERT INTO calendar_accounts (provider, account_email, encrypted_access_token, encrypted_refresh_token, is_active)
            VALUES ('google', 'test@example.com', X'00', X'00', TRUE)
            RETURNING id
            "#
        )
        .fetch_one(&self.pool)
        .await?
        .id;
        Ok(account_id)
    }

    #[cfg(test)]
    async fn get_all_cached_events(&self, account_id: i64) -> Result<Vec<CalendarEvent>, CalendarError> {
        let events = sqlx::query_as!(
            CalendarEvent,
            r#"
            SELECT id, calendar_account_id, external_event_id, title, description,
                   start_time as "start_time: chrono::DateTime<chrono::Utc>", 
                   end_time as "end_time: chrono::DateTime<chrono::Utc>",
                   participants as "participants: String", location, meeting_url, is_accepted,
                   last_modified as "last_modified: chrono::DateTime<chrono::Utc>",
                   created_at as "created_at: chrono::DateTime<chrono::Utc>"
            FROM calendar_events 
            WHERE calendar_account_id = ?
            ORDER BY start_time
            "#,
            account_id
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(events.into_iter().map(|mut event| {
            event.participants = serde_json::from_str(&event.participants).unwrap_or_default();
            event
        }).collect())
    }

    #[cfg(test)]
    async fn cleanup_old_events(&self, account_id: i64, cutoff_duration: chrono::Duration) -> Result<(), CalendarError> {
        let cutoff_time = chrono::Utc::now() - cutoff_duration;
        
        sqlx::query!(
            "DELETE FROM calendar_events WHERE calendar_account_id = ? AND end_time < ?",
            account_id,
            cutoff_time
        )
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
}