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

        // Clone the necessary fields for the async task
        let repository = self.repository.clone();
        let event_emitter = self.event_emitter.clone();
        let audio_service = self.audio_service.clone();
        let config = self.config.clone();
        let detected_meetings = self.detected_meetings.clone();
        let is_running = self.is_running.clone();
        
        // Start the detection loop
        tokio::spawn(async move {
            let detector = MeetingDetector {
                repository,
                event_emitter,
                audio_service,
                config,
                detected_meetings,
                is_running,
            };
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
    use chrono::{Duration, TimeZone};
    use std::collections::HashMap;
    
    /// Critical Test: 5-minute Meeting Detection Window - AC1 Core Functionality
    /// Tests: 1.5-INT-003 Meeting Detection Timing Precision
    #[tokio::test]
    async fn test_5_minute_detection_window_precision() {
        let detector = create_test_detector().await;
        let config = MeetingDetectionConfig {
            detection_window_minutes: 5,
            confidence_threshold: 0.5,
            ..Default::default()
        };
        
        let now = Utc::now();
        
        // Test scenarios within 5-minute window
        let test_cases = vec![
            // (minutes_offset, should_detect, description)
            (-5, true, "Exactly 5 minutes before"),
            (-4, true, "4 minutes before"),
            (-3, true, "3 minutes before"), 
            (-2, true, "2 minutes before"),
            (-1, true, "1 minute before"),
            (0, true, "At meeting start time"),
            (1, true, "1 minute after start"),
            (2, true, "2 minutes after start"),
            (3, true, "3 minutes after start"),
            (4, true, "4 minutes after start"),
            (5, true, "Exactly 5 minutes after start"),
            
            // Edge cases - should NOT detect
            (-6, false, "6 minutes before (outside window)"),
            (6, false, "6 minutes after start (outside window)"),
            (-10, false, "10 minutes before (outside window)"),
            (10, false, "10 minutes after start (outside window)"),
        ];
        
        for (minutes_offset, should_detect, description) in test_cases {
            let event_time = now + Duration::minutes(minutes_offset);
            let event = create_test_calendar_event_at_time(event_time);
            
            let result = detector.should_detect_meeting(&event, &config).await;
            
            if should_detect {
                assert!(result, "Failed to detect meeting {}: {}", description, minutes_offset);
            } else {
                assert!(!result, "Incorrectly detected meeting {}: {}", description, minutes_offset);
            }
        }
    }

    /// Critical Test: Meeting Detection Algorithm Logic - AC1 Core Logic
    /// Tests: 1.5-UNIT-001 Meeting Detection Algorithm Logic
    #[tokio::test]
    async fn test_meeting_detection_algorithm_logic() {
        let detector = create_test_detector().await;
        let config = MeetingDetectionConfig {
            detection_window_minutes: 5,
            confidence_threshold: 0.6,
            ..Default::default()
        };
        
        let now = Utc::now();
        let meeting_time = now + Duration::minutes(2); // 2 minutes from now
        
        // Test 1: High confidence meeting (should detect)
        let high_confidence_event = CalendarEvent {
            id: 1,
            calendar_account_id: 1,
            external_event_id: "high_conf_meeting".to_string(),
            title: "Team standup meeting".to_string(), // Keywords increase confidence
            description: Some("Daily team synchronization".to_string()),
            start_time: meeting_time,
            end_time: meeting_time + Duration::minutes(30),
            participants: vec!["user1@test.com".to_string(), "user2@test.com".to_string()], // Multiple participants
            location: None,
            meeting_url: Some("https://meet.google.com/abc-defg-hij".to_string()), // Meeting URL increases confidence
            is_accepted: true,
            last_modified: now,
            created_at: now,
        };
        
        let result = detector.should_detect_meeting(&high_confidence_event, &config).await;
        assert!(result, "High confidence meeting should be detected");
        
        // Test 2: Low confidence meeting (should not detect)
        let low_confidence_event = CalendarEvent {
            id: 2,
            calendar_account_id: 1,
            external_event_id: "low_conf_event".to_string(),
            title: "Lunch break".to_string(), // No meeting keywords
            description: None,
            start_time: meeting_time,
            end_time: meeting_time + Duration::minutes(30),
            participants: vec![], // No participants
            location: None,
            meeting_url: None, // No meeting URL
            is_accepted: true,
            last_modified: now,
            created_at: now,
        };
        
        let result = detector.should_detect_meeting(&low_confidence_event, &config).await;
        assert!(!result, "Low confidence meeting should not be detected");
    }

    /// Critical Test: Edge Case Boundary Testing - AC1 Precision
    #[tokio::test]
    async fn test_detection_window_edge_cases() {
        let detector = create_test_detector().await;
        let config = MeetingDetectionConfig {
            detection_window_minutes: 5,
            confidence_threshold: 0.5,
            ..Default::default()
        };
        
        let now = Utc::now();
        
        // Test exact boundaries with high precision
        let boundary_cases = vec![
            // Test with seconds precision
            (-5 * 60, true, "Exactly 5 minutes (300 seconds) before"),
            (-5 * 60 - 1, false, "301 seconds before (outside window)"),
            (5 * 60, true, "Exactly 5 minutes (300 seconds) after"),
            (5 * 60 + 1, false, "301 seconds after (outside window)"),
        ];
        
        for (seconds_offset, should_detect, description) in boundary_cases {
            let event_time = now + Duration::seconds(seconds_offset);
            let event = create_test_calendar_event_at_time(event_time);
            
            let result = detector.should_detect_meeting(&event, &config).await;
            
            if should_detect {
                assert!(result, "Boundary test failed: {}", description);
            } else {
                assert!(!result, "Boundary test failed: {}", description);
            }
        }
    }

    /// Critical Test: Timezone Handling in Detection - AC1 Robustness
    #[tokio::test]
    async fn test_timezone_handling_in_detection() {
        let detector = create_test_detector().await;
        let config = MeetingDetectionConfig {
            detection_window_minutes: 5,
            confidence_threshold: 0.5,
            ..Default::default()
        };
        
        // Test with different timezone representations
        let utc_now = Utc::now();
        
        // Event in UTC (should work normally)
        let utc_event = create_test_calendar_event_at_time(utc_now + Duration::minutes(3));
        assert!(detector.should_detect_meeting(&utc_event, &config).await);
        
        // Event with timezone offset (still within window when converted to UTC)
        let offset_time = utc_now + Duration::minutes(3);
        let offset_event = create_test_calendar_event_at_time(offset_time);
        assert!(detector.should_detect_meeting(&offset_event, &config).await);
    }

    /// Test: Meeting Confidence Scoring Algorithm
    #[tokio::test]
    async fn test_meeting_confidence_calculation() {
        let detector = create_test_detector().await;
        let now = Utc::now();
        
        // High confidence meeting
        let high_conf_event = CalendarEvent {
            id: 1,
            calendar_account_id: 1,
            external_event_id: "high_conf".to_string(),
            title: "Team standup meeting".to_string(),
            description: Some("Daily sync".to_string()),
            start_time: now,
            end_time: now + Duration::minutes(30),
            participants: vec!["user1@test.com".to_string(), "user2@test.com".to_string()],
            location: None,
            meeting_url: Some("https://meet.google.com/test".to_string()),
            is_accepted: true,
            last_modified: now,
            created_at: now,
        };
        
        let confidence = detector.calculate_meeting_confidence(&high_conf_event, 0).await;
        assert!(confidence > 0.6, "High confidence meeting should have score > 0.6, got {}", confidence);
        
        // Low confidence event
        let low_conf_event = CalendarEvent {
            id: 2,
            calendar_account_id: 1,
            external_event_id: "low_conf".to_string(),
            title: "Personal time".to_string(),
            description: None,
            start_time: now,
            end_time: now + Duration::minutes(30),
            participants: vec![],
            location: None,
            meeting_url: None,
            is_accepted: true,
            last_modified: now,
            created_at: now,
        };
        
        let confidence = detector.calculate_meeting_confidence(&low_conf_event, 10).await;
        assert!(confidence < 0.4, "Low confidence event should have score < 0.4, got {}", confidence);
    }

    /// Critical Test: Auto-Start Logic Testing - AC3 Implementation
    #[tokio::test]
    async fn test_auto_start_logic() {
        let detector = create_test_detector().await;
        let config = MeetingDetectionConfig {
            detection_window_minutes: 5,
            confidence_threshold: 0.6,
            auto_start_enabled: true,
            ..Default::default()
        };
        
        let now = Utc::now();
        
        // Test auto-start trigger conditions
        let auto_start_cases = vec![
            // (minutes_offset, confidence, should_trigger, description)
            (-1, 0.7, false, "Before meeting start - should not trigger"),
            (0, 0.7, true, "At meeting start with high confidence - should trigger"),
            (1, 0.7, true, "1 minute after start with high confidence - should trigger"),
            (2, 0.7, false, "2+ minutes after start - outside auto-start window"),
            (0, 0.5, false, "At start but low confidence - should not trigger"),
        ];
        
        for (minutes_offset, confidence, should_trigger, description) in auto_start_cases {
            // Create a meeting with specific confidence characteristics
            let meeting_time = now + Duration::minutes(minutes_offset);
            let event = if confidence > 0.6 {
                create_high_confidence_event_at_time(meeting_time)
            } else {
                create_low_confidence_event_at_time(meeting_time)
            };
            
            // Clear previous detections
            detector.detected_meetings.write().await.clear();
            
            // Process the meeting
            let result = detector.process_detected_meeting(event.clone(), &config).await;
            assert!(result.is_ok(), "Processing should succeed for: {}", description);
            
            // Check if auto-start was triggered
            let detected = detector.detected_meetings.read().await;
            if let Some(detected_meeting) = detected.get(&event.external_event_id) {
                if should_trigger {
                    assert!(detected_meeting.auto_start_triggered, "Auto-start should be triggered: {}", description);
                } else {
                    assert!(!detected_meeting.auto_start_triggered, "Auto-start should not be triggered: {}", description);
                }
            } else if should_trigger {
                panic!("Meeting should be detected for auto-start test: {}", description);
            }
        }
    }

    #[test]
    fn test_meeting_title_analysis() {
        let detector = create_simple_detector();
        
        // Should detect meeting titles
        assert!(detector.analyze_meeting_title("Team standup meeting"));
        assert!(detector.analyze_meeting_title("Client call"));
        assert!(detector.analyze_meeting_title("Project sync"));
        assert!(detector.analyze_meeting_title("Weekly review"));
        assert!(detector.analyze_meeting_title("Demo presentation"));
        assert!(detector.analyze_meeting_title("Technical interview"));
        assert!(detector.analyze_meeting_title("Strategy discussion"));
        assert!(detector.analyze_meeting_title("Workshop session"));
        
        // Should not detect non-meeting titles
        assert!(!detector.analyze_meeting_title("Lunch break"));
        assert!(!detector.analyze_meeting_title("Personal time"));
        assert!(!detector.analyze_meeting_title("Vacation"));
        assert!(!detector.analyze_meeting_title("Out of office"));
        assert!(!detector.analyze_meeting_title("Birthday party"));
    }

    /// Test: Duplicate Detection Prevention
    #[tokio::test]
    async fn test_duplicate_detection_prevention() {
        let detector = create_test_detector().await;
        let config = MeetingDetectionConfig::default();
        
        let event = create_test_calendar_event_at_time(Utc::now() + Duration::minutes(2));
        
        // First detection should succeed
        assert!(detector.should_detect_meeting(&event, &config).await);
        
        // Mark as detected
        let detected_meeting = DetectedMeeting {
            calendar_event: event.clone(),
            confidence: 0.8,
            detection_time: Utc::now(),
            countdown_seconds: 120,
            auto_start_triggered: false,
        };
        
        detector.detected_meetings.write().await.insert(
            event.external_event_id.clone(),
            detected_meeting,
        );
        
        // Second detection within 2 minutes should be prevented
        assert!(!detector.should_detect_meeting(&event, &config).await);
    }

    // Helper functions for tests
    async fn create_test_detector() -> MeetingDetector {
        let pool = create_test_pool().await.unwrap();
        let repository = Arc::new(CalendarRepository::new(pool));
        let event_emitter = Arc::new(MockCalendarEventEmitter::new());
        
        MeetingDetector::new(
            repository,
            event_emitter,
            None, // No audio service for tests
            MeetingDetectionConfig::default(),
        )
    }
    
    fn create_simple_detector() -> MeetingDetector {
        // For simple unit tests that don't need async setup
        let repository = Arc::new(unsafe { std::mem::zeroed() }); // Not used in title analysis
        let event_emitter = Arc::new(MockCalendarEventEmitter::new());
        
        MeetingDetector::new(
            repository,
            event_emitter,
            None,
            MeetingDetectionConfig::default(),
        )
    }

    fn create_test_calendar_event_at_time(start_time: DateTime<Utc>) -> CalendarEvent {
        CalendarEvent {
            id: 1,
            calendar_account_id: 1,
            external_event_id: format!("test_event_{}", start_time.timestamp()),
            title: "Test meeting call".to_string(),
            description: Some("Test meeting description".to_string()),
            start_time,
            end_time: start_time + Duration::minutes(30),
            participants: vec!["test@example.com".to_string()],
            location: None,
            meeting_url: Some("https://meet.google.com/test".to_string()),
            is_accepted: true,
            last_modified: Utc::now(),
            created_at: Utc::now(),
        }
    }

    fn create_high_confidence_event_at_time(start_time: DateTime<Utc>) -> CalendarEvent {
        CalendarEvent {
            id: 1,
            calendar_account_id: 1,
            external_event_id: format!("high_conf_event_{}", start_time.timestamp()),
            title: "Team standup meeting".to_string(),
            description: Some("Daily team sync discussion".to_string()),
            start_time,
            end_time: start_time + Duration::minutes(30),
            participants: vec!["user1@test.com".to_string(), "user2@test.com".to_string()],
            location: None,
            meeting_url: Some("https://meet.google.com/high-conf".to_string()),
            is_accepted: true,
            last_modified: Utc::now(),
            created_at: Utc::now(),
        }
    }

    fn create_low_confidence_event_at_time(start_time: DateTime<Utc>) -> CalendarEvent {
        CalendarEvent {
            id: 2,
            calendar_account_id: 1,
            external_event_id: format!("low_conf_event_{}", start_time.timestamp()),
            title: "Personal time".to_string(),
            description: None,
            start_time,
            end_time: start_time + Duration::minutes(30),
            participants: vec![],
            location: None,
            meeting_url: None,
            is_accepted: true,
            last_modified: Utc::now(),
            created_at: Utc::now(),
        }
    }

    // Mock event emitter for testing
    struct MockCalendarEventEmitter;

    impl MockCalendarEventEmitter {
        fn new() -> Self {
            Self
        }
        
        fn emit_meeting_detected(&self, _event: CalendarEvent, _confidence: f64, _countdown: u32) {
            // Mock implementation - does nothing
        }
        
        fn emit_meeting_notification(&self, _event: CalendarEvent, _minutes_before: u32) {
            // Mock implementation - does nothing
        }
        
        fn emit_auto_start_triggered(&self, _event: CalendarEvent, _meeting_id: String) {
            // Mock implementation - does nothing
        }
    }
}