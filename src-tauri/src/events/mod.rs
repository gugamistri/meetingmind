//! Event system for real-time frontend updates
//!
//! This module provides the event system for communicating real-time updates
//! from the Rust backend to the React frontend via Tauri's event system.

pub mod transcription;

// Re-export commonly used types
pub use transcription::{
    TranscriptionEvent, TranscriptionEventEmitter, TranscriptionEventListener,
    TranscriptionChunkData, ProcessingStatusData, ModelStatusData,
    TranscriptionEventFilter, FilteredTranscriptionEventEmitter,
};

use tauri::AppHandle;

/// Central event manager for all application events
pub struct EventManager {
    /// Transcription event emitter
    pub transcription: TranscriptionEventEmitter,
}

impl EventManager {
    /// Create a new event manager
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            transcription: TranscriptionEventEmitter::new(app_handle),
        }
    }

    /// Create a filtered transcription emitter
    pub fn filtered_transcription_emitter(
        &self,
        app_handle: AppHandle,
        filter: TranscriptionEventFilter,
    ) -> FilteredTranscriptionEventEmitter {
        FilteredTranscriptionEventEmitter::new(app_handle, filter)
    }
}