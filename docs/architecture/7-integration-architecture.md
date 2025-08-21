# 7. Integration Architecture

## 7.1 Calendar Integration

### Google Calendar API Implementation
```rust
struct GoogleCalendarService {
    client: GoogleCalendarClient,
    oauth_flow: OAuth2Flow,
    token_store: TokenStore,
}

impl GoogleCalendarService {
    async fn authenticate_user(&self) -> Result<AuthToken> {
        // Launch browser for OAuth2 consent
        // Handle callback and token exchange
        // Store refresh token securely
        // Return access token for API calls
    }
    
    async fn fetch_upcoming_meetings(&self, hours: u32) -> Result<Vec<CalendarEvent>> {
        let now = Utc::now();
        let end_time = now + Duration::hours(hours as i64);
        
        let events = self.client
            .events()
            .list("primary")
            .time_min(now)
            .time_max(end_time)
            .single_events(true)
            .order_by("startTime")
            .execute()
            .await?;
            
        Ok(events.items.into_iter()
            .filter(|event| self.is_relevant_meeting(event))
            .map(|event| event.into())
            .collect())
    }
    
    fn is_relevant_meeting(&self, event: &GoogleCalendarEvent) -> bool {
        // Filter out all-day events
        // Check for meeting-related keywords
        // Exclude declined meetings
        // Prioritize meetings with multiple attendees
    }
}
```

### Meeting Detection Logic
```rust
struct MeetingDetector {
    calendar_service: GoogleCalendarService,
    audio_analyzer: AudioAnalyzer,
    notification_service: NotificationService,
}

impl MeetingDetector {
    async fn detect_active_meeting(&self) -> Option<DetectedMeeting> {
        // Check calendar for meetings starting within 5 minutes
        let calendar_meetings = self.calendar_service.get_current_meetings().await?;
        
        // Analyze audio for meeting platform signatures
        let audio_meeting = self.audio_analyzer.detect_meeting_audio().await?;
        
        // Combine calendar and audio detection
        self.match_calendar_to_audio(calendar_meetings, audio_meeting).await
    }
    
    async fn notify_meeting_detected(&self, meeting: DetectedMeeting) {
        self.notification_service.show_meeting_prompt(MeetingPrompt {
            meeting_title: meeting.title,
            auto_start_countdown: 8,
            participants: meeting.participants,
            confidence: meeting.detection_confidence,
        }).await;
    }
}
```

## 7.2 External AI Services

### API Client Architecture
```rust
trait AIServiceClient: Send + Sync {
    async fn transcribe(&self, audio: &[u8], language: Option<&str>) -> Result<TranscriptionResult>;
    async fn summarize(&self, text: &str, template: &str) -> Result<SummaryResult>;
    fn estimate_cost(&self, operation: &AIOperation) -> Result<CostEstimate>;
}

struct OpenAIClient {
    client: reqwest::Client,
    api_key: String,
    rate_limiter: RateLimiter,
}

struct ClaudeClient {
    client: reqwest::Client,
    api_key: String,
    rate_limiter: RateLimiter,
}

struct AIServiceManager {
    primary_service: Box<dyn AIServiceClient>,
    fallback_services: Vec<Box<dyn AIServiceClient>>,
    cost_tracker: CostTracker,
}

impl AIServiceManager {
    async fn transcribe_with_fallback(&self, audio: &[u8]) -> Result<TranscriptionResult> {
        // Try primary service
        match self.primary_service.transcribe(audio, None).await {
            Ok(result) => return Ok(result),
            Err(e) if e.is_retriable() => {
                // Log error and continue to fallback
                log::warn!("Primary transcription service failed: {}", e);
            }
            Err(e) => return Err(e),
        }
        
        // Try fallback services
        for fallback in &self.fallback_services {
            match fallback.transcribe(audio, None).await {
                Ok(result) => return Ok(result),
                Err(e) => log::warn!("Fallback service failed: {}", e),
            }
        }
        
        Err(AIServiceError::AllServicesFailed)
    }
}
```

### Cost Tracking and Transparency
```rust
struct CostTracker {
    usage_records: Vec<UsageRecord>,
    monthly_budget: Option<f64>,
    notification_thresholds: Vec<f64>,
}

impl CostTracker {
    async fn record_usage(&mut self, service: &str, operation: AIOperation, cost: f64) {
        let record = UsageRecord {
            timestamp: Utc::now(),
            service: service.to_string(),
            operation,
            cost_usd: cost,
            tokens_used: self.extract_token_count(&operation),
        };
        
        self.usage_records.push(record);
        
        // Check budget and thresholds
        let monthly_total = self.get_monthly_total().await;
        if let Some(budget) = self.monthly_budget {
            if monthly_total > budget * 0.8 {
                self.notify_approaching_budget().await;
            }
        }
    }
    
    async fn get_cost_estimate(&self, operation: &AIOperation) -> CostEstimate {
        match operation {
            AIOperation::Transcription { duration_seconds } => {
                CostEstimate {
                    min_cost: duration_seconds as f64 * 0.006 / 60.0, // OpenAI pricing
                    max_cost: duration_seconds as f64 * 0.012 / 60.0,
                    confidence: 0.9,
                }
            }
            AIOperation::Summarization { word_count } => {
                let token_estimate = word_count / 4; // Rough estimate
                CostEstimate {
                    min_cost: token_estimate as f64 * 0.03 / 1000.0, // GPT-4 pricing
                    max_cost: token_estimate as f64 * 0.06 / 1000.0,
                    confidence: 0.8,
                }
            }
        }
    }
}
```

## 7.3 File Export and Sharing

### Export System Architecture
```rust
trait ExportFormat {
    fn export(&self, meeting: &Meeting, options: &ExportOptions) -> Result<ExportResult>;
    fn mime_type(&self) -> &'static str;
    fn file_extension(&self) -> &'static str;
}

struct MarkdownExporter;
struct PDFExporter;
struct DOCXExporter;
struct JSONExporter;

impl ExportFormat for MarkdownExporter {
    fn export(&self, meeting: &Meeting, options: &ExportOptions) -> Result<ExportResult> {
        let mut content = String::new();
        
        // Header with meeting metadata
        content.push_str(&format!("# {}\n\n", meeting.title));
        content.push_str(&format!("**Date:** {}\n", meeting.start_time.format("%Y-%m-%d %H:%M")));
        content.push_str(&format!("**Duration:** {} minutes\n\n", meeting.duration_minutes()));
        
        if options.include_participants && !meeting.participants.is_empty() {
            content.push_str("## Participants\n\n");
            for participant in &meeting.participants {
                content.push_str(&format!("- {}\n", participant));
            }
            content.push_str("\n");
        }
        
        if options.include_transcription {
            content.push_str("## Transcription\n\n");
            for segment in &meeting.transcription.segments {
                if let Some(speaker) = &segment.speaker {
                    content.push_str(&format!("**{}:** ", speaker.name));
                }
                content.push_str(&format!("{}\n\n", segment.text));
            }
        }
        
        if options.include_summary && meeting.summary.is_some() {
            let summary = meeting.summary.as_ref().unwrap();
            content.push_str("## Summary\n\n");
            content.push_str(&summary.content);
            content.push_str("\n\n");
            
            if !summary.action_items.is_empty() {
                content.push_str("### Action Items\n\n");
                for item in &summary.action_items {
                    content.push_str(&format!("- [ ] {}\n", item.description));
                }
            }
        }
        
        Ok(ExportResult {
            content: content.into_bytes(),
            filename: format!("{}.md", sanitize_filename(&meeting.title)),
            size_bytes: content.len(),
        })
    }
}
```

### Temporary Sharing Service
```rust
struct SharingService {
    storage_client: S3Client,
    url_signer: URLSigner,
    cleanup_scheduler: CleanupScheduler,
}

impl SharingService {
    async fn create_share_link(&self, export_data: &[u8], options: ShareOptions) -> Result<ShareLink> {
        // Generate unique share ID
        let share_id = Uuid::new_v4().to_string();
        
        // Upload to temporary storage
        let object_key = format!("shares/{}/{}", 
            options.expiration_date.format("%Y%m%d"), 
            share_id);
            
        self.storage_client.put_object()
            .bucket("meetingmind-shares")
            .key(&object_key)
            .body(ByteStream::from(export_data))
            .metadata("expiration", options.expiration_date.timestamp().to_string())
            .send()
            .await?;
        
        // Generate signed URL
        let signed_url = self.url_signer.generate_presigned_url(
            &object_key,
            options.expiration_date,
        ).await?;
        
        // Schedule cleanup
        self.cleanup_scheduler.schedule_deletion(&object_key, options.expiration_date).await?;
        
        Ok(ShareLink {
            id: share_id,
            url: signed_url,
            expires_at: options.expiration_date,
            password_protected: options.password.is_some(),
            download_count: 0,
        })
    }
}
```

---
