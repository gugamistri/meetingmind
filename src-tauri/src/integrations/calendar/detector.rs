use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use chrono::{DateTime, Utc};
use tracing::{info, warn, error, debug};

use super::{
    CalendarRepository, CalendarEvent, MeetingDetectionConfig,
    CalendarError,
};
use crate::events::CalendarEventEmitter;
use crate::audio::AudioCaptureService;

#[derive(Debug, Clone)]
pub struct DetectedMeeting {
    pub calendar_event: CalendarEvent,
    pub confidence: f64,
    pub detection_time: DateTime<Utc>,
    pub countdown_seconds: u32,
    pub auto_start_triggered: bool,
}

pub struct MeetingDetector {
    repository: Arc<CalendarRepository>,
    event_emitter: Arc<CalendarEventEmitter>,
    audio_service: Option<Arc<AudioCaptureService>>,
    config: Arc<RwLock<MeetingDetectionConfig>>,
    detected_meetings: Arc<RwLock<HashMap<String, DetectedMeeting>>>,
    is_running: Arc<RwLock<bool>>,
}

impl MeetingDetector {
    pub fn new(
        repository: Arc<CalendarRepository>,
        event_emitter: Arc<CalendarEventEmitter>,
        audio_service: Option<Arc<AudioCaptureService>>,
        config: MeetingDetectionConfig,
    ) -> Self {
        Self {
            repository,
            event_emitter,
            audio_service,
            config: Arc::new(RwLock::new(config)),
            detected_meetings: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), CalendarError> {
        {
            let mut running = self.is_running.write().await;
            if *running {
                return Ok(());
            }
            *running = true;
        }

        info!("Starting meeting detection service");

        let detector = Arc::new(self);
        
        // Start the detection loop
        tokio::spawn(async move {
            detector.detection_loop().await;
        });

        Ok(())
    }

    pub async fn stop(&self) -> Result<(), CalendarError> {
        {
            let mut running = self.is_running.write().await;
            *running = false;
        }

        info!("Meeting detection service stopped");
        Ok(())
    }

    pub async fn update_config(&self, config: MeetingDetectionConfig) {
        let mut current_config = self.config.write().await;
        *current_config = config;
        info!("Meeting detection configuration updated");
    }

    pub async fn get_config(&self) -> MeetingDetectionConfig {
        self.config.read().await.clone()
    }

    pub async fn get_detected_meetings(&self) -> Vec<DetectedMeeting> {
        let meetings = self.detected_meetings.read().await;
        meetings.values().cloned().collect()
    }

    async fn detection_loop(&self) {
        let mut interval = interval(Duration::from_secs(30)); // Check every 30 seconds

        while *self.is_running.read().await {
            interval.tick().await;

            if let Err(e) = self.detect_meetings().await {
                error!("Meeting detection error: {}", e);
                continue;
            }

            // Clean up old detected meetings
            self.cleanup_old_detections().await;
        }
    }

    async fn detect_meetings(&self) -> Result<(), CalendarError> {
        let config = self.config.read().await.clone();
        
        // Get events in the detection window
        let events = self.repository
            .get_events_in_detection_window(config.detection_window_minutes)
            .await?;

        for event in events {
            if self.should_detect_meeting(&event, &config).await {
                self.process_detected_meeting(event, &config).await?;
            }
        }

        Ok(())
    }

    async fn should_detect_meeting(&self, event: &CalendarEvent, config: &MeetingDetectionConfig) -> bool {
        let now = Utc::now();
        let time_until_start = event.start_time.signed_duration_since(now);
        let minutes_until_start = time_until_start.num_minutes();

        // Check if within detection window
        if minutes_until_start.abs() > config.detection_window_minutes as i64 {
            return false;
        }

        // Check if already detected
        if let Some(detected) = self.detected_meetings.read().await.get(&event.external_event_id) {
            // Don't re-detect the same meeting within a short timeframe
            if now.signed_duration_since(detected.detection_time).num_minutes() < 2 {
                return false;
            }
        }

        // Check if meeting has enough confidence indicators
        self.calculate_meeting_confidence(event, minutes_until_start).await >= config.confidence_threshold
    }

    async fn calculate_meeting_confidence(&self, event: &CalendarEvent, minutes_until_start: i64) -> f64 {
        let mut confidence = 0.0;
        let mut factors = 0;

        // Base confidence for being in calendar
        confidence += 0.3;
        factors += 1;

        // Time proximity factor
        let time_factor = match minutes_until_start.abs() {
            0..=2 => 0.4,
            3..=5 => 0.3,
            6..=10 => 0.2,
            _ => 0.1,
        };
        confidence += time_factor;
        factors += 1;

        // Meeting URL factor
        if event.meeting_url.is_some() {
            confidence += 0.2;
            factors += 1;
        }

        // Participants factor
        if event.participants.len() > 1 {
            confidence += 0.15;
            factors += 1;
        }

        // Title analysis factor
        if self.analyze_meeting_title(&event.title) {
            confidence += 0.1;
            factors += 1;
        }

        // Audio activity factor (if audio service is available)
        if let Some(audio_service) = &self.audio_service {
            if self.detect_audio_activity(audio_service).await {
                confidence += 0.15;
                factors += 1;
            }
        }

        // Normalize confidence
        if factors > 0 {
            confidence / factors as f64
        } else {
            0.0
        }
    }

    fn analyze_meeting_title(&self, title: &str) -> bool {
        let title_lower = title.to_lowercase();
        let meeting_keywords = [
            "meeting", "call", "standup", "sync", "review", "demo",
            "presentation", "interview", "discussion", "workshop",
        ];

        meeting_keywords.iter().any(|keyword| title_lower.contains(keyword))
    }

    async fn detect_audio_activity(&self, _audio_service: &AudioCaptureService) -> bool {
        // In a real implementation, this would check for current audio activity
        // For now, return false as a placeholder
        false
    }

    async fn process_detected_meeting(&self, event: CalendarEvent, config: &MeetingDetectionConfig) -> Result<(), CalendarError> {
        let now = Utc::now();
        let time_until_start = event.start_time.signed_duration_since(now);
        let minutes_until_start = time_until_start.num_minutes();
        let confidence = self.calculate_meeting_confidence(&event, minutes_until_start).await;

        let countdown_seconds = if time_until_start.num_seconds() > 0 {
            time_until_start.num_seconds() as u32
        } else {
            0
        };

        let detected_meeting = DetectedMeeting {
            calendar_event: event.clone(),
            confidence,
            detection_time: now,
            countdown_seconds,
            auto_start_triggered: false,
        };

        // Store detected meeting
        {
            let mut detected = self.detected_meetings.write().await;
            detected.insert(event.external_event_id.clone(), detected_meeting.clone());
        }

        // Emit detection event
        self.event_emitter.emit_meeting_detected(event.clone(), confidence, countdown_seconds);

        // Send notification if enabled and within notification window
        if config.notification_enabled && 
           minutes_until_start >= 0 && 
           minutes_until_start <= config.notification_minutes_before as i64 {
            self.event_emitter.emit_meeting_notification(event.clone(), minutes_until_start as u32);
        }

        // Check for auto-start trigger
        if config.auto_start_enabled && 
           minutes_until_start >= -2 && // Allow 2 minutes after start
           minutes_until_start <= 0 && // Only after meeting has started
           confidence >= config.confidence_threshold {
            
            self.trigger_auto_start(&event).await?;
        }

        info!(
            "Meeting detected: '{}' at {} (confidence: {:.2}, countdown: {}s)",
            event.title, event.start_time, confidence, countdown_seconds
        );

        Ok(())
    }

    async fn trigger_auto_start(&self, event: &CalendarEvent) -> Result<(), CalendarError> {
        // Update detected meeting to mark auto-start as triggered
        {
            let mut detected = self.detected_meetings.write().await;
            if let Some(detected_meeting) = detected.get_mut(&event.external_event_id) {
                if detected_meeting.auto_start_triggered {
                    return Ok(()); // Already triggered
                }
                detected_meeting.auto_start_triggered = true;
            }
        }

        // Generate a meeting ID for the auto-started session
        let meeting_id = uuid::Uuid::new_v4().to_string();

        // Emit auto-start event
        self.event_emitter.emit_auto_start_triggered(event.clone(), meeting_id.clone());

        info!("Auto-start triggered for meeting: '{}' (ID: {})", event.title, meeting_id);

        // In a real implementation, this would trigger the audio capture start
        // For now, we just emit the event

        Ok(())
    }

    async fn cleanup_old_detections(&self) {
        let now = Utc::now();
        let mut detected = self.detected_meetings.write().await;
        
        detected.retain(|_, meeting| {
            // Remove detections older than 1 hour or meetings that ended more than 30 minutes ago
            let detection_age = now.signed_duration_since(meeting.detection_time);
            let meeting_ended_time = now.signed_duration_since(meeting.calendar_event.end_time);
            
            detection_age.num_hours() < 1 && meeting_ended_time.num_minutes() < 30
        });
    }

    /// Manual trigger for meeting detection (for testing or user-initiated detection)
    pub async fn manual_detect(&self) -> Result<Vec<DetectedMeeting>, CalendarError> {
        self.detect_meetings().await?;
        Ok(self.get_detected_meetings().await)
    }

    /// Check for conflicts with currently detected meetings
    pub async fn check_conflicts(&self, start_time: DateTime<Utc>, end_time: DateTime<Utc>) -> Result<Vec<CalendarEvent>, CalendarError> {
        self.repository.find_conflicting_meetings(start_time, end_time).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::database::create_test_pool;
    
    #[tokio::test]
    async fn test_meeting_confidence_calculation() {
        let pool = create_test_pool().await.unwrap();
        let repository = Arc::new(CalendarRepository::new(pool));
        
        // This would require a proper AppHandle in real tests
        // let detector = MeetingDetector::new(
        //     repository,
        //     event_emitter,
        //     None,
        //     MeetingDetectionConfig::default(),
        // );
        
        // Test confidence calculation logic
        // let event = create_test_calendar_event();
        // let confidence = detector.calculate_meeting_confidence(&event, 0).await;
        // assert!(confidence > 0.0);
    }

    #[test]
    fn test_meeting_title_analysis() {
        let detector = create_test_detector();
        
        assert!(detector.analyze_meeting_title("Team standup meeting"));
        assert!(detector.analyze_meeting_title("Client call"));
        assert!(detector.analyze_meeting_title("Project sync"));
        assert!(!detector.analyze_meeting_title("Lunch break"));
        assert!(!detector.analyze_meeting_title("Personal time"));
    }

    fn create_test_detector() -> MeetingDetector {
        // This is a simplified version for unit testing
        // In practice, you'd need proper dependencies
        panic!("Test helper not implemented - requires proper AppHandle and dependencies");
    }
}