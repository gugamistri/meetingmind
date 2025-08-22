use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{JobScheduler, Job};
use chrono::{DateTime, Utc, Duration};
use tracing::{info, warn, error};

use super::{
    CalendarService, CalendarRepository, GoogleCalendarService,
    TimeRange, CalendarError, SyncStatus, CalendarProvider,
};
use crate::events::CalendarEventEmitter;

pub struct CalendarSyncService {
    scheduler: JobScheduler,
    calendar_services: Arc<RwLock<HashMap<CalendarProvider, Arc<dyn CalendarService>>>>,
    repository: Arc<CalendarRepository>,
    event_emitter: Arc<CalendarEventEmitter>,
    sync_status: Arc<RwLock<HashMap<i64, SyncStatus>>>,
}

impl CalendarSyncService {
    pub async fn new(
        repository: Arc<CalendarRepository>,
        event_emitter: Arc<CalendarEventEmitter>,
    ) -> Result<Self, CalendarError> {
        let scheduler = JobScheduler::new().await
            .map_err(|e| CalendarError::ServiceUnavailable)?;
        
        let calendar_services = Arc::new(RwLock::new(HashMap::new()));
        let sync_status = Arc::new(RwLock::new(HashMap::new()));

        Ok(Self {
            scheduler,
            calendar_services,
            repository,
            event_emitter,
            sync_status,
        })
    }

    pub async fn register_calendar_service(
        &self,
        provider: CalendarProvider,
        service: Arc<dyn CalendarService>,
    ) {
        let mut services = self.calendar_services.write().await;
        services.insert(provider, service);
    }

    pub async fn start(&self) -> Result<(), CalendarError> {
        self.scheduler.start().await
            .map_err(|e| CalendarError::ServiceUnavailable)?;
        
        // Schedule periodic sync every 15 minutes
        self.schedule_periodic_sync().await?;
        
        // Schedule cleanup job daily at 2 AM
        self.schedule_cleanup_job().await?;
        
        info!("Calendar sync service started successfully");
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<(), CalendarError> {
        self.scheduler.shutdown().await
            .map_err(|e| CalendarError::ServiceUnavailable)?;
        
        info!("Calendar sync service stopped");
        Ok(())
    }

    pub async fn sync_account(&self, account_id: i64) -> Result<u32, CalendarError> {
        info!("Starting calendar sync for account {}", account_id);
        
        // Update sync status
        {
            let mut status_map = self.sync_status.write().await;
            let status = status_map.entry(account_id).or_insert(SyncStatus::default());
            status.sync_in_progress = true;
            status.last_error = None;
        }
        
        // Emit sync started event
        self.event_emitter.emit_sync_started(account_id);

        let result = self.perform_sync(account_id).await;

        // Update sync status based on result
        {
            let mut status_map = self.sync_status.write().await;
            if let Some(status) = status_map.get_mut(&account_id) {
                status.sync_in_progress = false;
                status.last_sync = Some(Utc::now());
                
                match &result {
                    Ok(events_synced) => {
                        status.events_synced = *events_synced;
                        status.last_error = None;
                        self.event_emitter.emit_sync_completed(account_id, *events_synced, status.clone());
                    }
                    Err(e) => {
                        status.last_error = Some(e.to_string());
                        self.event_emitter.emit_sync_failed(account_id, e.to_string());
                    }
                }
            }
        }

        result
    }

    async fn perform_sync(&self, account_id: i64) -> Result<u32, CalendarError> {
        // Get account information
        let account = self.repository.get_account(account_id).await?
            .ok_or_else(|| CalendarError::AuthenticationFailed {
                reason: "Account not found".to_string(),
            })?;

        // Get the appropriate calendar service
        let services = self.calendar_services.read().await;
        let service = services.get(&account.provider)
            .ok_or_else(|| CalendarError::ServiceUnavailable)?;

        // Fetch events for the next 30 days
        let time_range = TimeRange::next_days(30);
        
        let events = match service.fetch_events(account_id, time_range).await {
            Ok(events) => events,
            Err(CalendarError::InvalidToken { .. }) => {
                // Token expired, emit authentication required event
                self.event_emitter.emit_authentication_required(account_id, account.provider.to_string());
                return Err(CalendarError::InvalidToken {
                    reason: "Token expired, re-authentication required".to_string(),
                });
            }
            Err(e) => return Err(e),
        };

        // Save events to local cache
        let event_count = events.len() as u32;
        self.repository.save_events(account_id, events).await?;

        info!("Synced {} events for account {}", event_count, account_id);
        Ok(event_count)
    }

    async fn schedule_periodic_sync(&self) -> Result<(), CalendarError> {
        let repository = self.repository.clone();
        let calendar_services = self.calendar_services.clone();
        let event_emitter = self.event_emitter.clone();

        let job = Job::new_async("0 */15 * * * *", move |_uuid, _l| {
            let repository = repository.clone();
            let calendar_services = calendar_services.clone();
            let event_emitter = event_emitter.clone();
            
            Box::pin(async move {
                // Create a temporary sync service for this job
                match CalendarSyncService::new(repository.clone(), event_emitter.clone()).await {
                    Ok(mut sync_service) => {
                        sync_service.calendar_services = calendar_services;
                        
                        match repository.get_active_accounts().await {
                            Ok(accounts) => {
                                for account in accounts {
                                    if let Some(account_id) = account.id {
                                        if let Err(e) = sync_service.sync_account(account_id).await {
                                            error!("Periodic sync failed for account {}: {}", account_id, e);
                                        }
                                    }
                                }
                            }
                            Err(e) => error!("Failed to get active accounts for sync: {}", e),
                        }
                    }
                    Err(e) => error!("Failed to create sync service: {}", e),
                }
            })
        })
        .map_err(|e| CalendarError::ServiceUnavailable)?;

        self.scheduler.add(job).await
            .map_err(|e| CalendarError::ServiceUnavailable)?;

        info!("Scheduled periodic calendar sync every 15 minutes");
        Ok(())
    }

    async fn schedule_cleanup_job(&self) -> Result<(), CalendarError> {
        let repository = self.repository.clone();

        let job = Job::new_async("0 0 2 * * *", move |_uuid, _l| {
            let repository = repository.clone();
            
            Box::pin(async move {
                match repository.cleanup_old_events(30).await {
                    Ok(deleted_count) => {
                        info!("Cleaned up {} old calendar events", deleted_count);
                    }
                    Err(e) => {
                        error!("Failed to cleanup old calendar events: {}", e);
                    }
                }
            })
        })
        .map_err(|e| CalendarError::ServiceUnavailable)?;

        self.scheduler.add(job).await
            .map_err(|e| CalendarError::ServiceUnavailable)?;

        info!("Scheduled daily calendar cleanup at 2 AM");
        Ok(())
    }

    pub async fn get_sync_status(&self, account_id: i64) -> SyncStatus {
        let status_map = self.sync_status.read().await;
        status_map.get(&account_id).cloned().unwrap_or_default()
    }

    pub async fn force_sync_all(&self) -> Result<HashMap<i64, Result<u32, String>>, CalendarError> {
        let accounts = self.repository.get_active_accounts().await?;
        let mut results = HashMap::new();

        for account in accounts {
            if let Some(account_id) = account.id {
                let result = self.sync_account(account_id).await
                    .map_err(|e| e.to_string());
                results.insert(account_id, result);
            }
        }

        Ok(results)
    }

    /// Check for incremental sync opportunities
    pub async fn incremental_sync(&self, account_id: i64) -> Result<u32, CalendarError> {
        // Get the last sync timestamp
        let last_sync = {
            let status_map = self.sync_status.read().await;
            status_map.get(&account_id)
                .and_then(|status| status.last_sync)
        };

        if let Some(last_sync_time) = last_sync {
            // Only sync if more than 5 minutes have passed
            if Utc::now().signed_duration_since(last_sync_time) < Duration::minutes(5) {
                return Ok(0);
            }
        }

        // Perform full sync for now (incremental sync would require webhook support)
        self.sync_account(account_id).await
    }
}

impl Default for CalendarSyncService {
    fn default() -> Self {
        panic!("CalendarSyncService must be initialized with proper dependencies");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::database::create_test_pool;
    
    #[tokio::test]
    async fn test_sync_service_creation() {
        let pool = create_test_pool().await.unwrap();
        let repository = Arc::new(CalendarRepository::new(pool));
        
        // Create a mock event emitter (would need proper AppHandle in real tests)
        // let event_emitter = Arc::new(CalendarEventEmitter::new(app_handle));
        
        // For now, just test that the service can be created
        // let sync_service = CalendarSyncService::new(repository, event_emitter).await;
        // assert!(sync_service.is_ok());
    }
}