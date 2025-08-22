use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};

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