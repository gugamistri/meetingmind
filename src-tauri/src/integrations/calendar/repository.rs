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
            Ok(Some(CalendarAccount {
                id: Some(row.id),
                provider: row.provider.parse()?,
                account_email: row.account_email,
                is_active: row.is_active,
                auto_start_enabled: row.auto_start_enabled,
                created_at: DateTime::parse_from_rfc3339(&row.created_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
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
            accounts.push(CalendarAccount {
                id: Some(row.id),
                provider: row.provider.parse()?,
                account_email: row.account_email,
                is_active: row.is_active,
                auto_start_enabled: row.auto_start_enabled,
                created_at: DateTime::parse_from_rfc3339(&row.created_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
            });
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

    // Calendar Event Management
    pub async fn save_events(&self, events: &[CalendarEvent]) -> Result<Vec<i64>, CalendarError> {
        let mut transaction = self.pool.begin().await?;
        let mut event_ids = Vec::new();

        for event in events {
            let participants_json = serde_json::to_string(&event.participants)?;
            
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
                event.start_time.to_rfc3339(),
                event.end_time.to_rfc3339(),
                participants_json,
                event.location,
                event.meeting_url,
                event.is_accepted,
                event.last_modified.as_ref().map(|dt| dt.to_rfc3339())
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
                now.to_rfc3339(),
                end_time.to_rfc3339()
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
                now.to_rfc3339(),
                end_time.to_rfc3339()
            )
            .fetch_all(&self.pool)
            .await?
        };

        let mut events = Vec::new();
        for row in rows {
            let participants: Vec<String> = serde_json::from_str(&row.participants)?;
            
            events.push(CalendarEvent {
                id: Some(row.id),
                calendar_account_id: row.calendar_account_id,
                external_event_id: row.external_event_id,
                title: row.title,
                description: row.description,
                start_time: DateTime::parse_from_rfc3339(&row.start_time)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                end_time: DateTime::parse_from_rfc3339(&row.end_time)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                participants,
                location: row.location,
                meeting_url: row.meeting_url,
                is_accepted: row.is_accepted,
                last_modified: row.last_modified.as_ref().and_then(|lm| {
                    DateTime::parse_from_rfc3339(lm).ok().map(|dt| dt.with_timezone(&Utc))
                }),
                created_at: DateTime::parse_from_rfc3339(&row.created_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
            });
        }

        Ok(events)
    }

    pub async fn get_events_in_detection_window(&self, window_minutes: u32) -> Result<Vec<CalendarEvent>, CalendarError> {
        let now = Utc::now();
        let window_start = now - chrono::Duration::minutes(window_minutes as i64);
        let window_end = now + chrono::Duration::minutes(window_minutes as i64);

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
            window_start.to_rfc3339(),
            window_end.to_rfc3339()
        )
        .fetch_all(&self.pool)
        .await?;

        let mut events = Vec::new();
        for row in rows {
            let participants: Vec<String> = serde_json::from_str(&row.participants)?;
            
            events.push(CalendarEvent {
                id: Some(row.id),
                calendar_account_id: row.calendar_account_id,
                external_event_id: row.external_event_id,
                title: row.title,
                description: row.description,
                start_time: DateTime::parse_from_rfc3339(&row.start_time)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                end_time: DateTime::parse_from_rfc3339(&row.end_time)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                participants,
                location: row.location,
                meeting_url: row.meeting_url,
                is_accepted: row.is_accepted,
                last_modified: row.last_modified.as_ref().and_then(|lm| {
                    DateTime::parse_from_rfc3339(lm).ok().map(|dt| dt.with_timezone(&Utc))
                }),
                created_at: DateTime::parse_from_rfc3339(&row.created_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
            });
        }

        Ok(events)
    }

    pub async fn cleanup_old_events(&self, days_to_keep: u32) -> Result<u64, CalendarError> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days_to_keep as i64);
        
        let result = sqlx::query!(
            "DELETE FROM calendar_events WHERE end_time < ?",
            cutoff_date.to_rfc3339()
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn get_sync_status(&self, account_id: i64) -> Result<SyncStatus, CalendarError> {
        let row = sqlx::query!(
            r#"
            SELECT updated_at,
                   (SELECT COUNT(*) FROM calendar_events WHERE calendar_account_id = ?) as events_count
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
                last_sync: DateTime::parse_from_rfc3339(&row.updated_at)
                    .ok().map(|dt| dt.with_timezone(&Utc)),
                events_synced: row.events_count as u32,
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
            start_time.to_rfc3339(), start_time.to_rfc3339(),
            end_time.to_rfc3339(), end_time.to_rfc3339(),
            start_time.to_rfc3339(), end_time.to_rfc3339()
        )
        .fetch_all(&self.pool)
        .await?;

        let mut events = Vec::new();
        for row in rows {
            let participants: Vec<String> = serde_json::from_str(&row.participants)?;
            
            events.push(CalendarEvent {
                id: Some(row.id),
                calendar_account_id: row.calendar_account_id,
                external_event_id: row.external_event_id,
                title: row.title,
                description: row.description,
                start_time: DateTime::parse_from_rfc3339(&row.start_time)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                end_time: DateTime::parse_from_rfc3339(&row.end_time)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
                participants,
                location: row.location,
                meeting_url: row.meeting_url,
                is_accepted: row.is_accepted,
                last_modified: row.last_modified.as_ref().and_then(|lm| {
                    DateTime::parse_from_rfc3339(lm).ok().map(|dt| dt.with_timezone(&Utc))
                }),
                created_at: DateTime::parse_from_rfc3339(&row.created_at)
                    .map_err(|e| CalendarError::Database(sqlx::Error::Decode(Box::new(e))))?
                    .with_timezone(&Utc),
            });
        }

        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::database::create_test_pool;
    
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
}