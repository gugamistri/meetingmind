use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use std::path::PathBuf;

/// Detailed meeting data for the frontend - simplified version
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingDetail {
    pub meeting: SimpleMeeting,
    pub participants: Vec<SimpleParticipant>,
    pub transcription_sessions: Vec<SimpleTranscriptionSession>,
    pub transcriptions: Vec<SimpleTranscription>,
    pub summaries: Vec<SimpleSummary>,
    pub has_audio_file: bool,
    pub audio_file_path: Option<String>,
}

/// Simplified meeting structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimpleMeeting {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Simplified participant structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleParticipant {
    pub id: i64,
    pub meeting_id: i64,
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub joined_at: Option<String>,
    pub left_at: Option<String>,
    pub created_at: String,
}

/// Simplified transcription session structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleTranscriptionSession {
    pub id: i64,
    pub session_id: String,
    pub meeting_id: i64,
}

/// Simplified transcription structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleTranscription {
    pub id: i64,
    pub meeting_id: i64,
    pub content: String,
}

/// Simplified summary structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleSummary {
    pub id: String,
    pub meeting_id: String,
    pub template_id: Option<i64>,
    pub content: String,
    pub model_used: String,
    pub provider: String,
    pub cost_usd: Option<f64>,
    pub processing_time_ms: u64,
    pub token_count: Option<u32>,
    pub confidence_score: Option<f32>,
    pub created_at: String,
}

/// Detailed transcription segment data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegmentData {
    pub id: i64,
    pub transcription_id: i64,
    pub speaker_id: Option<i64>,
    pub text: String,
    pub start_timestamp: f64,
    pub end_timestamp: f64,
    pub confidence: f32,
    pub is_edited: bool,
}

/// Speaker data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakerData {
    pub id: i64,
    pub name: Option<String>,
    pub email: Option<String>,
    pub color_hex: String,
    pub voice_fingerprint: Option<Vec<u8>>,
    pub total_meetings: i32,
    pub last_seen: String,
}

/// Detailed transcription with segments and speakers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedMeetingTranscription {
    pub id: i64,
    pub meeting_id: i64,
    pub content: String,
    pub confidence: f32,
    pub language: String,
    pub model_used: String,
    pub created_at: String,
    pub segments: Vec<TranscriptionSegmentData>,
    pub speakers: Vec<SpeakerData>,
    pub total_duration: f64,
    pub processing_time_ms: u64,
    pub processed_locally: bool,
}

/// Request for updating meeting metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMeetingRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub participants: Option<Vec<String>>,
}

/// Response for meeting operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingResponse {
    pub success: bool,
    pub message: String,
}

/// Get detailed meeting information by ID
#[tauri::command]
pub async fn get_meeting_detail(
    meeting_id: i64,
) -> Result<MeetingDetail, String> {
    // For now, we'll create a basic mock implementation
    // In a real implementation, you would fetch from database
    
    let meeting = SimpleMeeting {
        id: meeting_id,
        title: "Sample Meeting".to_string(),
        description: Some("This is a sample meeting for Story 2.2 development. In a complete implementation, this would be fetched from the database.".to_string()),
        start_time: chrono::Utc::now().to_rfc3339(),
        end_time: Some((chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339()),
        status: "completed".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    
    let participants = vec![
        SimpleParticipant {
            id: 1,
            meeting_id,
            name: "John Doe".to_string(),
            email: Some("john@example.com".to_string()),
            role: "organizer".to_string(),
            joined_at: Some(chrono::Utc::now().to_rfc3339()),
            left_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
        SimpleParticipant {
            id: 2,
            meeting_id,
            name: "Jane Smith".to_string(),
            email: Some("jane@example.com".to_string()),
            role: "participant".to_string(),
            joined_at: Some(chrono::Utc::now().to_rfc3339()),
            left_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    ];
    
    let transcription_sessions = vec![
        SimpleTranscriptionSession {
            id: 1,
            session_id: "session_123".to_string(),
            meeting_id,
        }
    ];
    
    let transcriptions = vec![
        SimpleTranscription {
            id: 1,
            meeting_id,
            content: "This is a sample transcription content. In the actual implementation, this would contain the full meeting transcription with speaker identification and timestamps.".to_string(),
        }
    ];
    
    let summaries = vec![
        SimpleSummary {
            id: "summary_123".to_string(),
            meeting_id: meeting_id.to_string(),
            template_id: Some(1),
            content: "## Meeting Summary\n\nThis was a productive meeting where we discussed the implementation of Story 2.2: Meeting Detail View & Management.\n\n## Key Points\n- Implemented basic meeting detail page structure\n- Added navigation and breadcrumbs\n- Created placeholder components for transcription and summary views\n\n## Next Steps\n- Complete transcription editor implementation\n- Add export functionality\n- Implement meeting management actions".to_string(),
            model_used: "gpt-4".to_string(),
            provider: "openai".to_string(),
            cost_usd: Some(0.05),
            processing_time_ms: 2500,
            token_count: Some(150),
            confidence_score: Some(0.95),
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    ];
    
    Ok(MeetingDetail {
        meeting,
        participants,
        transcription_sessions,
        transcriptions,
        summaries,
        has_audio_file: true,
        audio_file_path: Some("/path/to/meeting_audio.wav".to_string()),
    })
}

/// Update meeting metadata
#[tauri::command]
pub async fn update_meeting(
    meeting_id: i64,
    _update_request: UpdateMeetingRequest,
) -> Result<MeetingResponse, String> {
    // TODO: Implement actual meeting update logic
    // This would involve updating the database with new meeting information
    
    Ok(MeetingResponse {
        success: true,
        message: format!("Meeting {} updated successfully", meeting_id),
    })
}

/// Delete a meeting and all associated data
#[tauri::command]
pub async fn delete_meeting(
    meeting_id: i64,
) -> Result<MeetingResponse, String> {
    // TODO: Implement cascade deletion
    // 1. Delete summaries
    // 2. Delete transcriptions
    // 3. Delete transcription sessions
    // 4. Delete participants
    // 5. Delete meeting
    // 6. Delete audio file if exists
    
    Ok(MeetingResponse {
        success: true,
        message: format!("Meeting {} deleted successfully", meeting_id),
    })
}

/// Duplicate a meeting (create a copy with new ID)
#[tauri::command]
pub async fn duplicate_meeting(
    meeting_id: i64,
) -> Result<MeetingDetail, String> {
    // TODO: Implement meeting duplication logic
    // This would create a new meeting with the same metadata but new ID
    
    let meeting = SimpleMeeting {
        id: meeting_id + 1000, // Simple ID increment for now
        title: "Copy of Sample Meeting".to_string(),
        description: Some("Duplicated meeting".to_string()),
        start_time: chrono::Utc::now().to_rfc3339(),
        end_time: None,
        status: "scheduled".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    
    Ok(MeetingDetail {
        meeting,
        participants: vec![],
        transcription_sessions: vec![],
        transcriptions: vec![],
        summaries: vec![],
        has_audio_file: false,
        audio_file_path: None,
    })
}

/// Archive/unarchive a meeting
#[tauri::command]
pub async fn archive_meeting(
    meeting_id: i64,
    archived: bool,
) -> Result<MeetingResponse, String> {
    // TODO: Implement meeting archival logic
    // This would update the meeting status or add an archived flag
    
    let action = if archived { "archived" } else { "unarchived" };
    Ok(MeetingResponse {
        success: true,
        message: format!("Meeting {} {} successfully", meeting_id, action),
    })
}

/// Update a specific transcription segment
#[tauri::command]
pub async fn update_transcription_segment(
    segment_id: i64,
    text: String,
    speaker_id: Option<i64>,
) -> Result<MeetingResponse, String> {
    // TODO: Implement actual transcription segment update logic
    // This would:
    // 1. Validate the segment exists
    // 2. Update the segment text and speaker assignment
    // 3. Mark the segment as edited
    // 4. Update the timestamp of modification
    
    Ok(MeetingResponse {
        success: true,
        message: format!("Transcription segment {} updated successfully", segment_id),
    })
}

/// Assign speaker to a transcription segment
#[tauri::command]
pub async fn update_speaker_assignment(
    segment_id: i64,
    speaker_id: Option<i64>,
) -> Result<MeetingResponse, String> {
    // TODO: Implement speaker assignment logic
    // This would update the speaker_id for a specific segment
    
    Ok(MeetingResponse {
        success: true,
        message: format!("Speaker assignment for segment {} updated successfully", segment_id),
    })
}

/// Get detailed transcription with segments for a meeting
#[tauri::command]
pub async fn get_meeting_transcription(
    meeting_id: i64,
) -> Result<DetailedMeetingTranscription, String> {
    // Mock data for now - in real implementation this would query the database
    let segments = vec![
        TranscriptionSegmentData {
            id: 1,
            transcription_id: 1,
            speaker_id: Some(1),
            text: "Good morning everyone, thank you for joining today's meeting. Let's start with our agenda.".to_string(),
            start_timestamp: 0.0,
            end_timestamp: 5.2,
            confidence: 0.95,
            is_edited: false,
        },
        TranscriptionSegmentData {
            id: 2,
            transcription_id: 1,
            speaker_id: Some(2),
            text: "Thanks John. I have a few updates on the project status that I'd like to share.".to_string(),
            start_timestamp: 5.2,
            end_timestamp: 10.8,
            confidence: 0.92,
            is_edited: false,
        },
        TranscriptionSegmentData {
            id: 3,
            transcription_id: 1,
            speaker_id: Some(1),
            text: "Perfect, please go ahead Jane. We're all listening.".to_string(),
            start_timestamp: 10.8,
            end_timestamp: 14.5,
            confidence: 0.98,
            is_edited: false,
        },
        TranscriptionSegmentData {
            id: 4,
            transcription_id: 1,
            speaker_id: Some(2),
            text: "So we've completed about 75% of the Story 2.2 implementation. The meeting detail page is working well, and now we're focusing on the transcription editor functionality.".to_string(),
            start_timestamp: 14.5,
            end_timestamp: 25.3,
            confidence: 0.89,
            is_edited: false,
        },
    ];
    
    let speakers = vec![
        SpeakerData {
            id: 1,
            name: Some("John Doe".to_string()),
            email: Some("john@example.com".to_string()),
            color_hex: "#10B981".to_string(),
            voice_fingerprint: None,
            total_meetings: 15,
            last_seen: chrono::Utc::now().to_rfc3339(),
        },
        SpeakerData {
            id: 2,
            name: Some("Jane Smith".to_string()),
            email: Some("jane@example.com".to_string()),
            color_hex: "#3B82F6".to_string(),
            voice_fingerprint: None,
            total_meetings: 8,
            last_seen: chrono::Utc::now().to_rfc3339(),
        },
    ];
    
    Ok(DetailedMeetingTranscription {
        id: 1,
        meeting_id,
        content: "Complete meeting transcription content...".to_string(),
        confidence: 0.93,
        language: "en-US".to_string(),
        model_used: "whisper-large-v2".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        segments,
        speakers,
        total_duration: 25.3,
        processing_time_ms: 3500,
        processed_locally: true,
    })
}

/// Create a new speaker for a meeting
#[tauri::command]
pub async fn create_speaker(
    meeting_id: i64,
    name: String,
    email: Option<String>,
    color_hex: String,
) -> Result<SpeakerData, String> {
    // TODO: Implement actual speaker creation logic
    // This would insert a new speaker into the database
    
    let new_speaker = SpeakerData {
        id: chrono::Utc::now().timestamp(), // Simple ID generation for now
        name: Some(name.clone()),
        email,
        color_hex,
        voice_fingerprint: None,
        total_meetings: 1,
        last_seen: chrono::Utc::now().to_rfc3339(),
    };
    
    Ok(new_speaker)
}

/// Update an existing speaker
#[tauri::command]
pub async fn update_speaker(
    speaker_id: i64,
    name: String,
    email: Option<String>,
    color_hex: String,
) -> Result<MeetingResponse, String> {
    // TODO: Implement actual speaker update logic
    // This would update the speaker in the database
    
    Ok(MeetingResponse {
        success: true,
        message: format!("Speaker {} updated successfully", speaker_id),
    })
}

/// Delete a speaker (this will unassign them from all segments)
#[tauri::command]
pub async fn delete_speaker(
    speaker_id: i64,
) -> Result<MeetingResponse, String> {
    // TODO: Implement actual speaker deletion logic
    // This would:
    // 1. Remove speaker assignments from all transcription segments
    // 2. Delete the speaker record
    
    Ok(MeetingResponse {
        success: true,
        message: format!("Speaker {} deleted successfully", speaker_id),
    })
}

/// Generate AI summary for a meeting
#[tauri::command]
pub async fn generate_meeting_summary(
    meeting_id: String,
    template_id: String,
    template_name: String,
    system_prompt: String,
    provider: String,
    model: String,
    transcription_content: String,
) -> Result<SimpleSummary, String> {
    // TODO: Implement actual AI summary generation
    // This would:
    // 1. Validate the provider and model
    // 2. Prepare the prompt with system instructions and transcription
    // 3. Call the appropriate AI service (OpenAI, Anthropic, local)
    // 4. Process the response and calculate costs
    // 5. Save the summary to the database
    
    // Mock response for now
    let processing_start = std::time::Instant::now();
    
    // Simulate processing delay
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    
    let processing_time = processing_start.elapsed().as_millis() as u64;
    
    // Mock summary content based on template
    let mock_content = match template_id.as_str() {
        "standup" => "## Daily Standup Summary\n\n### What was accomplished:\n- Completed transcription editor implementation\n- Fixed speaker assignment issues\n- Added search functionality\n\n### What's planned next:\n- Implement AI summary generation\n- Add export functionality\n- Create comprehensive tests\n\n### Blockers:\n- None reported\n\n### Action Items:\n- [ ] Complete remaining Story 2.2 tasks\n- [ ] Schedule code review session".to_string(),
        "client" => "## Client Meeting Summary\n\n### Meeting Purpose\nReview progress on Story 2.2 implementation and discuss next steps.\n\n### Key Decisions\n- Approved the transcription editor design\n- Agreed on AI summary templates\n- Confirmed export format requirements\n\n### Client Feedback\nPositive feedback on the user interface design and functionality.\n\n### Next Steps\n- Complete remaining development tasks\n- Schedule user acceptance testing\n- Plan deployment timeline\n\n### Deliverables\n- Functional meeting detail view\n- Comprehensive testing suite\n- Documentation updates".to_string(),
        "brainstorm" => "## Brainstorming Session Summary\n\n### Ideas Generated\n1. **Enhanced Speaker Recognition**\n   - Voice fingerprinting for automatic identification\n   - Machine learning for speaker diarization\n\n2. **Advanced Export Options**\n   - Integration with popular tools (Notion, Confluence)\n   - Custom formatting templates\n\n3. **AI Enhancements**\n   - Automatic action item extraction\n   - Meeting insights and analytics\n\n### Selected Concepts\n- Prioritized speaker management improvements\n- Decided on multi-format export implementation\n\n### Action Items\n- [ ] Research voice fingerprinting APIs\n- [ ] Design export integration architecture".to_string(),
        "project" => "## Project Review Summary\n\n### Current Status\n- Story 2.2 is 75% complete\n- All core components implemented\n- Testing phase in progress\n\n### Achievements\n- ✅ Meeting detail page structure\n- ✅ Transcription editor with inline editing\n- ✅ Speaker management system\n- 🔄 AI summary generation (in progress)\n\n### Risks & Issues\n- Minor: Integration testing complexity\n- Mitigation: Comprehensive test suite development\n\n### Next Milestones\n- Complete export functionality\n- Finish comprehensive testing\n- Code review and deployment preparation\n\n### Resource Status\nDevelopment on track with current team allocation.".to_string(),
        _ => "## Meeting Summary\n\nThis is a general summary of the meeting discussion. Key points and decisions have been extracted from the transcription and organized for easy review.\n\n### Main Topics\n- Discussion of project progress\n- Review of current implementation\n- Planning of next steps\n\n### Decisions Made\n- Continued with current approach\n- Scheduled follow-up meetings\n\n### Action Items\n- Complete remaining tasks\n- Update documentation".to_string(),
    };
    
    // Calculate mock metrics
    let token_count = (transcription_content.len() / 4) + (mock_content.len() / 4); // Rough estimation
    let cost_usd = match provider.as_str() {
        "openai" => (token_count as f64) * 0.00003,
        "anthropic" => (token_count as f64) * 0.000015,
        _ => 0.0,
    };
    
    let summary = SimpleSummary {
        id: format!("summary_{}", chrono::Utc::now().timestamp()),
        meeting_id,
        template_id: Some(1), // Mock template ID
        content: mock_content,
        model_used: model,
        provider,
        cost_usd: Some(cost_usd),
        processing_time_ms: processing_time,
        token_count: Some(token_count as u32),
        confidence_score: Some(0.92),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    Ok(summary)
}

/// Export formats supported by the application
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Markdown,
    PDF,
    DOCX,
    JSON,
    TXT,
}

/// Export options configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub format: ExportFormat,
    pub include_timestamps: Option<bool>,
    pub include_speakers: Option<bool>,
    pub include_confidence_scores: Option<bool>,
    pub include_metadata: Option<bool>,
    pub date_format: Option<String>,
    pub template: Option<String>,
}

/// Export result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub file_path: String,
    pub download_url: Option<String>,
    pub expires_at: Option<String>,
    pub format: ExportFormat,
    pub size_bytes: u64,
}

/// Export meeting data in specified format
#[tauri::command]
pub async fn export_meeting(
    meeting_id: i64,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    // TODO: Implement actual export logic
    // This would:
    // 1. Fetch meeting data with transcriptions and summaries
    // 2. Generate the export content based on format and options
    // 3. Write to temporary file with appropriate formatting
    // 4. Return file path and metadata
    
    // Mock implementation for now
    let meeting_detail = get_meeting_detail(meeting_id).await?;
    
    // Simulate processing time
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    // Generate mock file path based on format
    let file_extension = match options.format {
        ExportFormat::Markdown => "md",
        ExportFormat::PDF => "pdf",
        ExportFormat::DOCX => "docx",
        ExportFormat::JSON => "json",
        ExportFormat::TXT => "txt",
    };
    
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("meeting_{}_{}_{}.{}", meeting_id, timestamp, "export", file_extension);
    
    // In real implementation, this would be a temp directory
    let file_path = format!("/tmp/meetingmind_exports/{}", filename);
    
    // Generate mock content based on format
    let content = generate_export_content(&meeting_detail, &options).await?;
    let content_bytes = content.as_bytes();
    let size_bytes = content_bytes.len() as u64;
    
    // In real implementation, write the content to file
    // std::fs::write(&file_path, content_bytes).map_err(|e| e.to_string())?;
    
    // Generate temporary download URL (expires in 24 hours)
    let expires_at = (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339();
    let download_url = Some(format!("http://localhost:8080/exports/{}", filename));
    
    Ok(ExportResult {
        file_path,
        download_url,
        expires_at: Some(expires_at),
        format: options.format,
        size_bytes,
    })
}

/// Generate export content based on format and options
async fn generate_export_content(
    meeting_detail: &MeetingDetail,
    options: &ExportOptions,
) -> Result<String, String> {
    let include_timestamps = options.include_timestamps.unwrap_or(true);
    let include_speakers = options.include_speakers.unwrap_or(true);
    let include_metadata = options.include_metadata.unwrap_or(true);
    
    match options.format {
        ExportFormat::Markdown => {
            let mut content = String::new();
            
            if include_metadata {
                content.push_str(&format!("# {}\n\n", meeting_detail.meeting.title));
                if let Some(desc) = &meeting_detail.meeting.description {
                    content.push_str(&format!("{}\n\n", desc));
                }
                content.push_str(&format!("**Date:** {}\n", meeting_detail.meeting.start_time));
                content.push_str(&format!("**Status:** {}\n", meeting_detail.meeting.status));
                content.push_str(&format!("**Participants:** {}\n\n", 
                    meeting_detail.participants.iter()
                        .map(|p| p.name.as_str())
                        .collect::<Vec<&str>>()
                        .join(", ")
                ));
            }
            
            // Add transcriptions
            if !meeting_detail.transcriptions.is_empty() {
                content.push_str("## Transcription\n\n");
                for transcription in &meeting_detail.transcriptions {
                    content.push_str(&format!("{}\n\n", transcription.content));
                }
            }
            
            // Add summaries
            if !meeting_detail.summaries.is_empty() {
                content.push_str("## AI Summary\n\n");
                for summary in &meeting_detail.summaries {
                    content.push_str(&format!("{}\n\n", summary.content));
                }
            }
            
            Ok(content)
        },
        
        ExportFormat::JSON => {
            // Return full structured data as JSON
            let json_data = serde_json::to_string_pretty(meeting_detail)
                .map_err(|e| format!("Failed to serialize meeting data: {}", e))?;
            Ok(json_data)
        },
        
        ExportFormat::TXT => {
            let mut content = String::new();
            
            if include_metadata {
                content.push_str(&format!("{}\n", meeting_detail.meeting.title));
                content.push_str(&format!("{}\n", "=".repeat(meeting_detail.meeting.title.len())));
                content.push_str(&format!("\nDate: {}\n", meeting_detail.meeting.start_time));
                content.push_str(&format!("Status: {}\n", meeting_detail.meeting.status));
                content.push_str(&format!("Participants: {}\n\n", 
                    meeting_detail.participants.iter()
                        .map(|p| p.name.as_str())
                        .collect::<Vec<&str>>()
                        .join(", ")
                ));
            }
            
            // Add transcriptions
            if !meeting_detail.transcriptions.is_empty() {
                content.push_str("TRANSCRIPTION:\n");
                content.push_str(&"-".repeat(50));
                content.push_str("\n\n");
                for transcription in &meeting_detail.transcriptions {
                    content.push_str(&format!("{}\n\n", transcription.content));
                }
            }
            
            // Add summaries
            if !meeting_detail.summaries.is_empty() {
                content.push_str("AI SUMMARY:\n");
                content.push_str(&"-".repeat(50));
                content.push_str("\n\n");
                for summary in &meeting_detail.summaries {
                    // Remove markdown formatting for plain text
                    let plain_content = summary.content
                        .replace("##", "")
                        .replace("#", "")
                        .replace("**", "")
                        .replace("- [ ]", "- ");
                    content.push_str(&format!("{}\n\n", plain_content));
                }
            }
            
            Ok(content)
        },
        
        ExportFormat::PDF | ExportFormat::DOCX => {
            // For now, return markdown content that would be converted to PDF/DOCX
            // In a real implementation, this would use libraries like:
            // - wkhtmltopdf or headless Chrome for PDF generation
            // - docx crate for Word document generation
            Box::pin(generate_export_content(meeting_detail, &ExportOptions {
                format: ExportFormat::Markdown,
                ..options.clone()
            })).await
        }
    }
}

/// Dashboard data structure for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub recent_meetings: Vec<SimpleMeeting>,
    pub meeting_stats: MeetingStats,
    pub upcoming_meetings: Option<Vec<SimpleMeeting>>,
    pub current_meeting: Option<SimpleMeeting>,
}

/// Meeting statistics for the dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingStats {
    pub total_meetings: i64,
    pub total_duration_ms: i64,
    pub todays_meetings: i64,
    pub weekly_meetings: i64,
    pub average_duration_ms: i64,
    pub completed_meetings: i64,
    pub recordings_with_transcription: i64,
    pub recordings_with_ai_summary: i64,
}

/// Get dashboard data including recent meetings and statistics
#[tauri::command]
pub async fn get_dashboard_data() -> Result<DashboardData, String> {
    // For now, create mock dashboard data to get the UI working
    // In a complete implementation, this would fetch from the database
    
    let recent_meetings = vec![
        SimpleMeeting {
            id: 1,
            title: "Team Standup".to_string(),
            description: Some("Daily team sync meeting".to_string()),
            start_time: chrono::Utc::now().checked_sub_signed(chrono::Duration::hours(2))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            end_time: Some(chrono::Utc::now().checked_sub_signed(chrono::Duration::hours(1))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339()),
            status: "completed".to_string(),
            created_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::hours(3))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            updated_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::hours(1))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
        },
        SimpleMeeting {
            id: 2,
            title: "Product Review".to_string(),
            description: Some("Weekly product review and planning".to_string()),
            start_time: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(1))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            end_time: Some(chrono::Utc::now().checked_sub_signed(chrono::Duration::days(1))
                .and_then(|t| t.checked_add_signed(chrono::Duration::minutes(45)))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339()),
            status: "completed".to_string(),
            created_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(2))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            updated_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(1))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
        },
        SimpleMeeting {
            id: 3,
            title: "Client Consultation".to_string(),
            description: Some("Initial consultation with new client".to_string()),
            start_time: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(3))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            end_time: Some(chrono::Utc::now().checked_sub_signed(chrono::Duration::days(3))
                .and_then(|t| t.checked_add_signed(chrono::Duration::minutes(60)))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339()),
            status: "completed".to_string(),
            created_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(4))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            updated_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(3))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
        },
    ];
    
    let meeting_stats = MeetingStats {
        total_meetings: 15,
        total_duration_ms: 3_600_000 * 12, // 12 hours total
        todays_meetings: 2,
        weekly_meetings: 8,
        average_duration_ms: 45 * 60 * 1000, // 45 minutes average
        completed_meetings: 12,
        recordings_with_transcription: 10,
        recordings_with_ai_summary: 8,
    };
    
    // Mock upcoming meetings
    let upcoming_meetings = vec![
        SimpleMeeting {
            id: 4,
            title: "Sprint Planning".to_string(),
            description: Some("Plan next sprint goals and tasks".to_string()),
            start_time: chrono::Utc::now().checked_add_signed(chrono::Duration::hours(2))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            end_time: Some(chrono::Utc::now().checked_add_signed(chrono::Duration::hours(3))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339()),
            status: "scheduled".to_string(),
            created_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::days(1))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
            updated_at: chrono::Utc::now().checked_sub_signed(chrono::Duration::hours(1))
                .unwrap_or_else(chrono::Utc::now).to_rfc3339(),
        },
    ];
    
    Ok(DashboardData {
        recent_meetings,
        meeting_stats,
        upcoming_meetings: Some(upcoming_meetings),
        current_meeting: None, // No active meeting currently
    })
}

/// Request structure for creating a new meeting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMeetingRequest {
    pub title: String,
    pub description: Option<String>,
    pub start_time: String, // ISO 8601 datetime string
    pub end_time: Option<String>,
    pub participants: Option<Vec<SimpleParticipant>>,
}

/// Create a new meeting
#[tauri::command]
pub async fn create_meeting(request: CreateMeetingRequest) -> Result<SimpleMeeting, String> {
    // For now, create a mock meeting response
    // In a complete implementation, this would save to the database
    
    let now = chrono::Utc::now();
    let meeting_id = (now.timestamp() % 10000) as i64; // Simple ID generation
    
    let meeting = SimpleMeeting {
        id: meeting_id,
        title: request.title,
        description: request.description,
        start_time: request.start_time,
        end_time: request.end_time,
        status: "scheduled".to_string(),
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
    };
    
    Ok(meeting)
}

/// Show exported file in system file explorer
#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    // TODO: Implement platform-specific file explorer opening
    // This would use platform-specific commands to open the file location:
    // - macOS: `open -R /path/to/file`
    // - Windows: `explorer /select,C:\path\to\file`
    // - Linux: `xdg-open /path/to/directory`
    
    println!("Would open file location: {}", path);
    Ok(())
}

