# 9. Development Guidelines

## 9.1 Code Organization

### Project Structure
```
meetingmind/
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs            # Application entry point
│   │   ├── lib.rs             # Library exports
│   │   ├── audio/             # Audio capture and processing
│   │   │   ├── mod.rs
│   │   │   ├── capture.rs     # System audio capture
│   │   │   ├── processing.rs  # Audio preprocessing
│   │   │   └── formats.rs     # Audio format handling
│   │   ├── ai/                # AI processing pipeline
│   │   │   ├── mod.rs
│   │   │   ├── whisper.rs     # Local Whisper integration
│   │   │   ├── external.rs    # External API clients
│   │   │   └── summarization.rs
│   │   ├── storage/           # Data persistence
│   │   │   ├── mod.rs
│   │   │   ├── database.rs    # SQLite operations
│   │   │   ├── models.rs      # Data structures
│   │   │   └── migrations.rs  # Schema updates
│   │   ├── integrations/      # External service integrations
│   │   │   ├── mod.rs
│   │   │   ├── calendar.rs    # Google Calendar
│   │   │   └── sharing.rs     # File sharing service
│   │   ├── security/          # Security and encryption
│   │   │   ├── mod.rs
│   │   │   ├── encryption.rs
│   │   │   └── auth.rs
│   │   └── commands/          # Tauri command handlers
│   │       ├── mod.rs
│   │       ├── recording.rs
│   │       ├── transcription.rs
│   │       └── meetings.rs
│   ├── models/                # AI model files
│   │   ├── whisper-tiny.onnx
│   │   └── whisper-base.onnx
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                       # React frontend
│   ├── components/            # UI components
│   │   ├── common/           # Shared components
│   │   ├── recording/        # Recording interface
│   │   ├── transcription/    # Transcription display
│   │   ├── meetings/         # Meeting management
│   │   └── settings/         # Configuration
│   ├── hooks/                # Custom React hooks
│   │   ├── useRecording.ts
│   │   ├── useTranscription.ts
│   │   └── useMeetings.ts
│   ├── stores/               # Zustand stores
│   │   ├── recordingStore.ts
│   │   ├── meetingStore.ts
│   │   └── settingsStore.ts
│   ├── types/                # TypeScript definitions
│   │   ├── recording.ts
│   │   ├── transcription.ts
│   │   └── api.ts
│   ├── utils/                # Utility functions
│   │   ├── audio.ts
│   │   ├── formatting.ts
│   │   └── export.ts
│   ├── styles/               # CSS and styling
│   │   ├── globals.css
│   │   └── components.css
│   ├── App.tsx
│   └── main.tsx
├── docs/                     # Documentation
│   ├── architecture.md       # This document
│   ├── api.md               # API reference
│   └── deployment.md        # Deployment guide
├── tests/                   # Test files
│   ├── integration/
│   └── unit/
├── .github/                 # GitHub workflows
│   └── workflows/
│       ├── test.yml
│       └── release.yml
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## 9.2 Coding Standards

### Rust Code Style
```rust
// Use explicit error types
#[derive(Debug, thiserror::Error)]
enum AudioError {
    #[error("Failed to initialize audio device: {0}")]
    DeviceInitialization(String),
    #[error("Audio buffer overflow")]
    BufferOverflow,
    #[error("Unsupported audio format")]
    UnsupportedFormat,
}

// Prefer owned types in public APIs
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

// Use async/await consistently
impl AudioCaptureService {
    pub async fn start_capture(&mut self, config: AudioConfig) -> Result<(), AudioError> {
        self.initialize_device(&config).await?;
        self.start_recording().await?;
        Ok(())
    }
}

// Document public APIs
/// Captures system audio and microphone input simultaneously
/// 
/// # Arguments
/// 
/// * `config` - Audio capture configuration
/// * `callback` - Function called for each audio chunk
/// 
/// # Returns
/// 
/// Returns `Ok(())` on successful start, or `AudioError` on failure
pub async fn start_dual_capture<F>(
    config: AudioConfig,
    callback: F,
) -> Result<(), AudioError>
where
    F: Fn(&[f32]) + Send + Sync + 'static,
{
    // Implementation
}
```

### TypeScript Code Style
```typescript
// Use strict type definitions
interface RecordingConfig {
  readonly audioSources: readonly AudioSource[];
  readonly autoTranscribe: boolean;
  readonly language: 'auto' | 'en' | 'pt-br';
}

// Prefer explicit return types for public functions
export async function startRecording(config: RecordingConfig): Promise<Recording> {
  const recording = await invoke('start_recording', { config });
  return Recording.fromTauriResponse(recording);
}

// Use branded types for IDs
type RecordingId = string & { readonly brand: unique symbol };
type MeetingId = string & { readonly brand: unique symbol };

// Document complex functions
/**
 * Processes transcription segments and updates the UI in real-time
 * 
 * @param segments - Array of transcription segments from the backend
 * @param onUpdate - Callback function called when display should update
 * @returns Promise that resolves when processing is complete
 */
export async function processTranscriptionSegments(
  segments: TranscriptionSegment[],
  onUpdate: (displaySegments: DisplaySegment[]) => void
): Promise<void> {
  // Implementation
}
```

## 9.3 Testing Strategy

### Unit Testing
```rust
// Rust unit tests
#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_audio_capture_initialization() {
        let config = AudioConfig {
            sample_rate: 16000,
            channels: 1,
            buffer_size: 1024,
        };
        
        let mut service = AudioCaptureService::new();
        let result = service.start_capture(config).await;
        
        assert!(result.is_ok());
        assert!(service.is_recording());
    }
    
    #[test]
    fn test_transcription_confidence_calculation() {
        let segments = vec![
            TranscriptionSegment::new("Hello", 0.9),
            TranscriptionSegment::new("world", 0.7),
        ];
        
        let confidence = calculate_average_confidence(&segments);
        assert_eq!(confidence, 0.8);
    }
}
```

```typescript
// TypeScript unit tests with Jest
describe('Recording Store', () => {
  it('should start recording with correct config', async () => {
    const store = useRecordingStore.getState();
    const config: RecordingConfig = {
      audioSources: [{ type: 'microphone', name: 'Default' }],
      autoTranscribe: true,
      language: 'auto',
    };
    
    await store.startRecording(config);
    
    expect(store.isRecording).toBe(true);
    expect(store.currentRecording).toBeDefined();
  });
  
  it('should handle recording errors gracefully', async () => {
    const store = useRecordingStore.getState();
    
    // Mock a failure
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Device not found'));
    
    await expect(store.startRecording(mockConfig)).rejects.toThrow();
    expect(store.isRecording).toBe(false);
  });
});
```

### Integration Testing
```rust
#[tokio::test]
async fn test_full_recording_workflow() {
    // Set up test database
    let db = setup_test_database().await;
    
    // Initialize services
    let audio_service = AudioCaptureService::new();
    let transcription_service = TranscriptionService::new();
    let storage_service = StorageService::new(db);
    
    // Start recording
    let recording_id = audio_service.start_capture(test_config()).await?;
    
    // Simulate audio data
    let test_audio = generate_test_audio(Duration::seconds(10));
    audio_service.process_audio_chunk(&test_audio).await?;
    
    // Stop recording and transcribe
    audio_service.stop_capture().await?;
    let transcription = transcription_service.transcribe(&test_audio).await?;
    
    // Store results
    let meeting = storage_service.save_meeting(recording_id, transcription).await?;
    
    // Verify results
    assert!(meeting.transcription.confidence > 0.5);
    assert!(!meeting.transcription.content.is_empty());
}
```

## 9.4 Performance Guidelines

### Audio Processing Optimization
```rust
// Use SIMD instructions for audio processing
use std::simd::{f32x8, SimdFloat};

fn normalize_audio_simd(samples: &mut [f32]) {
    // Find peak value using SIMD
    let mut max_val = 0.0f32;
    for chunk in samples.chunks_exact(8) {
        let simd_chunk = f32x8::from_slice(chunk);
        max_val = max_val.max(simd_chunk.abs().reduce_max());
    }
    
    // Normalize using SIMD
    let norm_factor = f32x8::splat(1.0 / max_val);
    for chunk in samples.chunks_exact_mut(8) {
        let mut simd_chunk = f32x8::from_slice(chunk);
        simd_chunk *= norm_factor;
        chunk.copy_from_slice(simd_chunk.as_array());
    }
}

// Use lock-free structures for real-time audio
use crossbeam::queue::SegQueue;

struct AudioBuffer {
    queue: SegQueue<AudioChunk>,
    capacity: usize,
}

impl AudioBuffer {
    fn push_chunk(&self, chunk: AudioChunk) -> Result<(), AudioError> {
        if self.queue.len() >= self.capacity {
            // Drop oldest chunk instead of blocking
            self.queue.pop();
        }
        self.queue.push(chunk);
        Ok(())
    }
}
```

### Database Performance Optimization
```rust
// Use prepared statements and connection pooling
struct OptimizedStorage {
    pool: sqlx::Pool<sqlx::Sqlite>,
    prepared_statements: HashMap<&'static str, sqlx::Executor>,
}

impl OptimizedStorage {
    async fn insert_transcription_batch(&self, segments: Vec<TranscriptionSegment>) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        
        // Use batch insert for better performance
        let query = "INSERT INTO transcription_segments (transcription_id, speaker_id, text, start_timestamp, end_timestamp, confidence) VALUES ";
        let values: Vec<String> = segments.iter()
            .map(|s| format!("({}, {}, '{}', {}, {}, {})", 
                s.transcription_id, 
                s.speaker_id.unwrap_or(0),
                s.text.replace('\'', "''"), // SQL escape
                s.start_timestamp,
                s.end_timestamp,
                s.confidence
            ))
            .collect();
        
        let full_query = format!("{}{}", query, values.join(", "));
        sqlx::query(&full_query).execute(&mut *tx).await?;
        
        tx.commit().await?;
        Ok(())
    }
}
```

---
