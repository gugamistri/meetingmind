# MeetingMind System Architecture

## Document Information
- **Document Version**: 1.0
- **Date**: August 21, 2025
- **Author**: System Architect
- **Status**: Final
- **Last Updated**: August 21, 2025

---

## 1. Executive Summary

### 1.1 System Overview
MeetingMind is a privacy-first desktop AI Meeting Assistant that captures system audio, performs hybrid transcription (local Whisper + optional cloud APIs), and generates AI-powered summaries while maintaining data locality by default. Built with Tauri 2.0 + Rust + React, the system prioritizes user privacy, offline functionality, and cross-platform compatibility.

### 1.2 Key Architectural Decisions

**Technology Stack Rationale:**
- **Tauri 2.0**: 3x better performance than Electron with smaller memory footprint
- **Rust Backend**: High-performance audio processing and native OS integration
- **React 18 Frontend**: Modern UI with concurrent features for smooth user experience
- **Local-First Architecture**: Privacy by design with optional cloud enhancement
- **SQLite Storage**: Zero-configuration local database with excellent performance

**Core Design Principles:**
1. **Privacy by Design**: All processing local by default
2. **Offline-First**: Core functionality without internet dependency
3. **Progressive Enhancement**: Optional cloud APIs for improved quality
4. **Zero Configuration**: Automatic setup and meeting detection
5. **Cross-Platform Consistency**: Unified experience across operating systems

### 1.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MeetingMind Desktop Application          │
├─────────────────────────────────────────────────────────────┤
│  Frontend Layer (React 18 + TypeScript)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │     UI      │  │    State    │  │  Real-time  │         │
│  │ Components  │  │ Management  │  │    View     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Backend Layer (Rust + Tauri)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Audio    │  │     AI      │  │   Storage   │         │
│  │   Capture   │  │  Pipeline   │  │   Engine    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   SQLite    │  │    Audio    │  │    Local    │         │
│  │  Database   │  │    Files    │  │   Models    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  External Services (Optional)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   OpenAI    │  │   Claude    │  │   Google    │         │
│  │    API      │  │    API      │  │  Calendar   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture

### 2.1 Architecture Patterns

**Event-Driven Architecture:**
The system follows an event-driven pattern with clear separation between audio capture, processing, and UI updates. This enables real-time responsiveness and loose coupling between components.

**Layered Architecture:**
- **Presentation Layer**: React UI components with Zustand state management
- **Application Layer**: Tauri commands and business logic coordination
- **Domain Layer**: Core business entities and rules (Recording, Transcription, Summary)
- **Infrastructure Layer**: Audio APIs, file system, database, external services

**Hybrid Processing Pattern:**
- **Local-First**: Whisper ONNX models for offline transcription
- **Progressive Enhancement**: Optional cloud APIs for quality improvement
- **Fallback Chain**: Local → OpenAI → Claude → Graceful degradation

### 2.2 Core Components

#### Audio Capture Service
**Responsibilities:**
- Cross-platform system audio capture using CPAL
- Real-time audio level monitoring and visualization
- Automatic device detection and fallback handling
- Meeting detection via audio pattern analysis

**Key Technologies:**
- CPAL for cross-platform audio (WASAPI/Core Audio/ALSA)
- Rodio for audio processing and format conversion
- Circular buffers for low-latency streaming
- Native OS APIs for system audio access

**Implementation Pattern:**
```rust
struct AudioCaptureService {
    input_stream: Option<Stream>,
    output_stream: Option<Stream>,
    buffer: Arc<Mutex<CircularBuffer<f32>>>,
    is_recording: Arc<AtomicBool>,
    event_sender: UnboundedSender<AudioEvent>,
}

impl AudioCaptureService {
    async fn start_capture(&mut self, config: CaptureConfig) -> Result<()> {
        // Initialize audio streams with optimal settings
        // Set up real-time processing pipeline
        // Begin buffering audio data for transcription
    }
}
```

#### Transcription Pipeline
**Responsibilities:**
- Local Whisper model inference using ONNX Runtime
- Real-time audio chunk processing with streaming output
- Confidence-based quality assessment and API fallback
- Language detection and speaker identification

**Processing Flow:**
1. **Audio Preprocessing**: Normalize, resample to 16kHz mono
2. **Local Inference**: ONNX Whisper model processing
3. **Confidence Assessment**: Evaluate transcription quality
4. **Optional Enhancement**: External API for low-confidence segments
5. **Post-Processing**: Punctuation, formatting, speaker detection

**Model Selection Strategy:**
- **Whisper Tiny** (39MB): Fast, offline-capable, 80%+ accuracy
- **Whisper Base** (142MB): Better accuracy, moderate speed
- **External APIs**: Highest quality for critical content

#### AI Processing Hub
**Responsibilities:**
- Coordinate local models and external APIs
- Generate meeting summaries using customizable templates
- Cost tracking and transparent usage reporting
- Fallback management between AI providers

**Summary Generation Process:**
1. **Template Selection**: User-defined or meeting type-specific
2. **Context Preparation**: Combine transcription with metadata
3. **API Selection**: Primary (OpenAI) → Fallback (Claude)
4. **Cost Tracking**: Token usage and real-time cost calculation
5. **Post-Processing**: Format summary according to template

#### Storage Engine
**Database Schema:**
```sql
-- Core entities
CREATE TABLE meetings (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_seconds INTEGER,
    calendar_event_id TEXT,
    audio_file_path TEXT,
    participants TEXT, -- JSON array
    status TEXT CHECK(status IN ('scheduled', 'recording', 'completed', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transcriptions (
    id INTEGER PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id),
    content TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    confidence REAL,
    model_used TEXT,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transcription_segments (
    id INTEGER PRIMARY KEY,
    transcription_id INTEGER REFERENCES transcriptions(id),
    speaker_id INTEGER,
    text TEXT NOT NULL,
    start_timestamp REAL,
    end_timestamp REAL,
    confidence REAL,
    is_edited BOOLEAN DEFAULT FALSE
);

CREATE TABLE summaries (
    id INTEGER PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id),
    content TEXT NOT NULL,
    template_name TEXT,
    api_provider TEXT,
    token_count INTEGER,
    cost_usd REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE speakers (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT,
    voice_fingerprint BLOB,
    color_hex TEXT,
    total_meetings INTEGER DEFAULT 0,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search indexes
CREATE VIRTUAL TABLE meetings_fts USING fts5(
    title, participants, content='meetings'
);

CREATE VIRTUAL TABLE transcriptions_fts USING fts5(
    content, content='transcriptions'
);

-- Performance indexes
CREATE INDEX idx_meetings_start_time ON meetings(start_time DESC);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_segments_speaker ON transcription_segments(speaker_id);
CREATE INDEX idx_segments_timestamp ON transcription_segments(start_timestamp);
```

**Storage Optimization:**
- **WAL Mode**: Better concurrency and crash recovery
- **FTS5**: Full-text search with ranking and snippets
- **JSON Support**: Flexible metadata storage
- **Automatic Backup**: Scheduled backups with retention policy

### 2.3 Data Flow Architecture

#### Real-Time Recording Flow
```
Calendar Event → Meeting Detection → Audio Capture Start
                                           ↓
Audio Stream → Circular Buffer → Chunk Processing (1s intervals)
                                           ↓
Whisper Local → Confidence Check → [Optional API Enhancement]
                                           ↓
Transcription Segments → UI Update → SQLite Storage
```

#### Post-Meeting Processing Flow
```
Recording Complete → Audio File Save → Transcription Finalization
                                           ↓
Template Selection → AI Summary Generation → Cost Calculation
                                           ↓
Summary Storage → Export Options → User Notification
```

#### Search and Retrieval Flow
```
User Search Query → FTS5 Index → Ranked Results
                                           ↓
Metadata Enrichment → Speaker Information → UI Presentation
```

---

## 3. Technology Stack Specifications

### 3.1 Backend Technologies

#### Rust Ecosystem
```toml
[dependencies]
# Core framework
tauri = { version = "2.0", features = ["shell-open", "fs", "path", "process"] }

# Audio processing
cpal = "0.15"
rodio = "0.17"
hound = "3.5"

# AI/ML inference
ort = { version = "2.0", features = ["cuda", "tensorrt"] }
tokenizers = "0.15"

# Database and storage
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "sqlite", "chrono", "uuid"] }
sqlite = "0.32"

# Async runtime and utilities
tokio = { version = "1.35", features = ["full"] }
futures = "0.3"
async-trait = "0.1"

# Serialization and networking
serde = { version = "1.0", features = ["derive"] }
reqwest = { version = "0.11", features = ["json", "stream"] }
chrono = { version = "0.4", features = ["serde"] }

# Security and encryption
chacha20poly1305 = "0.10"
argon2 = "0.5"
ring = "0.17"

# Platform integration
machine-uid = "0.3"
dirs = "5.0"
```

#### Audio Processing Stack
- **CPAL**: Cross-platform audio I/O (Windows WASAPI, macOS Core Audio, Linux ALSA/PulseAudio)
- **Rodio**: High-level audio playback and processing
- **Hound**: WAV file reading/writing for audio storage
- **Native APIs**: Direct system audio capture integration

#### Machine Learning Infrastructure
- **ONNX Runtime**: Cross-platform ML inference engine
- **Whisper Models**: OpenAI's speech-to-text models in ONNX format
- **Model Optimization**: Quantization and pruning for performance
- **Hardware Acceleration**: CUDA/TensorRT support where available

### 3.2 Frontend Technologies

#### React Ecosystem
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-tooltip": "^1.0.7",
    
    "zustand": "^4.4.7",
    "react-query": "^3.39.3",
    
    "tailwindcss": "^3.4.0",
    "framer-motion": "^10.18.0",
    "lucide-react": "^0.312.0",
    
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react-swc": "^3.5.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

#### UI Component Architecture
- **Radix UI**: Accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions
- **Lucide React**: Consistent iconography
- **SWC**: Fast TypeScript/JSX compilation

#### State Management Strategy
```typescript
// Global app state with Zustand
interface AppState {
  // Recording state
  currentRecording: Recording | null;
  isRecording: boolean;
  isPaused: boolean;
  audioLevel: number;
  
  // Transcription state
  transcriptionBuffer: TranscriptionSegment[];
  isTranscribing: boolean;
  
  // UI state
  currentView: AppView;
  sidebarOpen: boolean;
  
  // Data management
  meetings: Meeting[];
  searchQuery: string;
  
  // Actions
  startRecording: (config: RecordingConfig) => Promise<void>;
  stopRecording: () => Promise<void>;
  updateTranscription: (segment: TranscriptionSegment) => void;
}
```

### 3.3 External Integrations

#### Google Calendar API
```rust
struct CalendarService {
    client: GoogleCalendarClient,
    credentials: OAuth2Credentials,
    sync_interval: Duration,
}

impl CalendarService {
    async fn fetch_upcoming_meetings(&self) -> Result<Vec<CalendarEvent>> {
        // OAuth2 authentication flow
        // Fetch events for next 24 hours
        // Parse meeting metadata and participants
        // Return structured meeting information
    }
}
```

#### OpenAI API Integration
```rust
struct OpenAIService {
    client: OpenAIClient,
    api_key: String,
    rate_limiter: RateLimiter,
    cost_tracker: CostTracker,
}

impl OpenAIService {
    async fn transcribe_audio(&self, audio: &[u8]) -> Result<TranscriptionResult> {
        let request = CreateTranscriptionRequest {
            file: audio,
            model: "whisper-1",
            language: Some("pt"),
            response_format: Some("verbose_json"),
            timestamp_granularities: vec!["word", "segment"],
        };
        
        self.track_cost(&request).await?;
        self.client.audio().transcriptions().create(request).await
    }
    
    async fn generate_summary(&self, transcription: &str, template: &str) -> Result<String> {
        let messages = vec![
            ChatMessage::system(template),
            ChatMessage::user(transcription),
        ];
        
        let request = CreateChatCompletionRequest {
            model: "gpt-4",
            messages,
            max_tokens: Some(1000),
            temperature: Some(0.3),
        };
        
        self.track_cost(&request).await?;
        self.client.chat().completions().create(request).await
    }
}
```

---

## 4. Security Architecture

### 4.1 Privacy-First Design

#### Local Data Processing
- **Default Behavior**: All transcription happens locally using Whisper models
- **User Control**: Explicit consent required for external API usage
- **Data Minimization**: Only necessary data sent to external services
- **Transparency**: Clear indication when data leaves the device

#### Device-Based Authentication
```rust
struct DeviceAuth {
    device_id: String,
    hardware_fingerprint: String,
    install_date: DateTime<Utc>,
    app_version: String,
}

impl DeviceAuth {
    fn generate_device_id() -> String {
        let machine_id = machine_uid::get().unwrap_or_default();
        let install_uuid = Uuid::new_v4();
        format!("{}_{}", machine_id, install_uuid)
    }
    
    async fn validate_session(&self) -> Result<bool> {
        // Verify device integrity
        // Check app signature
        // Validate local data consistency
    }
}
```

### 4.2 Data Encryption

#### Encryption at Rest
```rust
struct DataEncryption {
    key_derivation: Scrypt,
    cipher: ChaCha20Poly1305,
    secure_key_store: SecureKeyStore,
}

impl DataEncryption {
    async fn encrypt_sensitive_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let key = self.derive_encryption_key().await?;
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
        
        let cipher = ChaCha20Poly1305::new(&key);
        cipher.encrypt(&nonce, data).map_err(Into::into)
    }
    
    async fn setup_database_encryption(&self) -> Result<()> {
        // Use SQLCipher for database encryption
        // Encrypt audio files with ChaCha20Poly1305
        // Maintain performance for search indexes
    }
}
```

#### Encryption in Transit
- **TLS 1.3**: All external API communications
- **Certificate Pinning**: Prevent man-in-the-middle attacks
- **Request Signing**: Verify request integrity
- **Rate Limiting**: Prevent API abuse

### 4.3 PII Detection and Protection

#### Automated PII Detection
```rust
#[derive(Debug, Serialize, Deserialize)]
struct PIIClassification {
    text: String,
    pii_detected: Vec<PIIType>,
    confidence: f32,
    redaction_applied: bool,
}

enum PIIType {
    EmailAddress,
    PhoneNumber,
    SocialSecurityNumber,
    CreditCardNumber,
    PersonalName,
    Address,
    IPAddress,
}

impl PIIDetector {
    async fn scan_transcription(&self, text: &str) -> PIIClassification {
        // Regex pattern matching for common PII types
        // ML-based detection for names and addresses
        // Confidence scoring for manual review
        // Automatic redaction for high-confidence matches
    }
}
```

#### User Data Control
- **Granular Permissions**: Control what data can be processed externally
- **Audit Trail**: Log all data processing activities
- **Right to Delete**: Complete data removal on user request
- **Data Export**: Full data portability in standard formats

---

## 5. Performance Architecture

### 5.1 Real-Time Processing Requirements

#### Audio Processing Performance
- **Latency**: <1 second from capture to buffer
- **Throughput**: Real-time processing at 16kHz sample rate
- **Memory Usage**: <200MB baseline, <500MB during recording
- **CPU Optimization**: Multi-threaded processing with SIMD instructions

#### Transcription Performance Targets
- **Local Processing**: <3 seconds latency for 30-second audio chunks
- **Streaming Output**: Display transcription as it's generated
- **Confidence Threshold**: 80% accuracy for local models
- **API Fallback**: <10 seconds for external enhancement

### 5.2 Optimization Strategies

#### Memory Management
```rust
struct AudioBuffer {
    capacity: usize,
    data: Box<[f32]>,
    write_pos: AtomicUsize,
    read_pos: AtomicUsize,
}

impl AudioBuffer {
    fn new(capacity: usize) -> Self {
        Self {
            capacity,
            data: vec![0.0; capacity].into_boxed_slice(),
            write_pos: AtomicUsize::new(0),
            read_pos: AtomicUsize::new(0),
        }
    }
    
    fn write_samples(&self, samples: &[f32]) -> Result<usize> {
        // Lock-free circular buffer implementation
        // Atomic operations for thread safety
        // Minimal memory allocations
    }
}
```

#### Database Performance
- **Connection Pooling**: Optimized SQLite connection management
- **Prepared Statements**: Prevent SQL injection and improve performance
- **WAL Mode**: Better concurrency for reads during writes
- **Index Optimization**: Covering indexes for common query patterns

#### UI Performance Optimization
- **Virtual Scrolling**: Handle large transcription lists efficiently
- **Debounced Search**: Minimize database queries during typing
- **Lazy Loading**: Load meeting details on demand
- **Optimistic Updates**: Immediate UI feedback for user actions

### 5.3 Scalability Considerations

#### Data Growth Management
- **Audio Compression**: Automatic FLAC compression for storage efficiency
- **Cleanup Policies**: Configurable retention for old recordings
- **Archive System**: Move old meetings to compressed storage
- **Search Optimization**: Incremental index updates

#### Resource Monitoring
```rust
struct PerformanceMonitor {
    cpu_usage: Arc<RwLock<f32>>,
    memory_usage: Arc<RwLock<u64>>,
    disk_usage: Arc<RwLock<u64>>,
}

impl PerformanceMonitor {
    async fn monitor_resources(&self) -> ResourceStatus {
        // Track CPU, memory, and disk usage
        // Alert on resource constraints
        // Automatically adjust quality settings
        // Provide performance insights to users
    }
}
```

---

## 6. User Interface Architecture

### 6.1 Design System Implementation

#### Component Architecture
```typescript
// Base component structure
interface BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

// Design tokens
const designTokens = {
  colors: {
    primary: {
      white: '#F8F9FA',
      darkGreen: '#0A5F55',
    },
    secondary: {
      greenLight: '#4CAF94',
      greenPale: '#E6F4F1',
    },
    functional: {
      success: '#43A047',
      error: '#E53935',
      warning: '#FFD54F',
      neutral: '#9E9E9E',
    },
  },
  typography: {
    fontFamily: ['SF Pro Text', 'Roboto', 'Inter', 'system-ui'],
    sizes: {
      h1: '28px',
      h2: '24px',
      h3: '20px',
      body: '15px',
      caption: '13px',
    },
  },
  spacing: {
    micro: '4px',
    small: '8px',
    default: '16px',
    medium: '24px',
    large: '32px',
    xl: '48px',
  },
} as const;
```

#### Key UI Components

**Recording Controls:**
```typescript
const RecordingControls: React.FC = () => {
  const { isRecording, isPaused, startRecording, stopRecording, pauseRecording } = useRecording();
  
  return (
    <div className="recording-controls">
      <Button
        variant={isRecording ? 'secondary' : 'primary'}
        size="lg"
        onClick={isRecording ? stopRecording : startRecording}
        className="record-button"
      >
        {isRecording ? <StopIcon /> : <RecordIcon />}
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </Button>
      
      {isRecording && (
        <Button
          variant="ghost"
          onClick={pauseRecording}
          className="pause-button"
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </Button>
      )}
      
      <AudioLevelMeter />
      <RecordingTimer />
    </div>
  );
};
```

**Live Transcription Display:**
```typescript
const LiveTranscription: React.FC = () => {
  const { transcriptionBuffer } = useTranscription();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom for new content
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptionBuffer]);
  
  return (
    <div ref={containerRef} className="transcription-container">
      {transcriptionBuffer.map(segment => (
        <TranscriptionSegment
          key={segment.id}
          segment={segment}
          editable={true}
          onEdit={handleSegmentEdit}
          onSpeakerChange={handleSpeakerChange}
        />
      ))}
    </div>
  );
};
```

### 6.2 User Experience Flows

#### First-Time Setup Flow
1. **Welcome Screen**: Introduction and privacy explanation
2. **Permissions Request**: Audio access and calendar integration
3. **Audio Test**: Verify microphone and system audio capture
4. **Calendar Connection**: Optional Google Calendar setup
5. **First Recording**: Guided first meeting capture

#### Daily Usage Flow
1. **Dashboard View**: Upcoming meetings and recent recordings
2. **Meeting Detection**: Automatic notification 5 minutes before scheduled meetings
3. **Recording Session**: Live transcription with real-time feedback
4. **Post-Meeting**: Review, edit, and summarize transcription
5. **Export/Share**: Multiple format options and sharing links

#### Meeting Management Flow
1. **Search Interface**: Full-text search with filters and facets
2. **Meeting List**: Chronological view with metadata and previews
3. **Detail View**: Full transcription editor with speaker identification
4. **Summary Generation**: AI-powered summaries with custom templates
5. **Export Options**: Markdown, PDF, DOCX, and sharing links

### 6.3 Accessibility and Internationalization

#### Accessibility Implementation
- **WCAG 2.1 AA Compliance**: 4.5:1 contrast ratios, keyboard navigation
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Keyboard Shortcuts**: Complete app functionality via keyboard
- **Reduced Motion**: Respect `prefers-reduced-motion` setting

#### Internationalization Support
- **Language Detection**: Automatic detection of meeting language
- **UI Localization**: Portuguese and English interface support
- **Date/Time Formatting**: Locale-specific formatting
- **Text Direction**: RTL language support preparation

---

## 7. Integration Architecture

### 7.1 Calendar Integration

#### Google Calendar API Implementation
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

#### Meeting Detection Logic
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

### 7.2 External AI Services

#### API Client Architecture
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

#### Cost Tracking and Transparency
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

### 7.3 File Export and Sharing

#### Export System Architecture
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

#### Temporary Sharing Service
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

## 8. Deployment and DevOps

### 8.1 Build and Distribution

#### Multi-Platform Build Pipeline
```yaml
# .github/workflows/release.yml
name: Release Build

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-20.04, windows-latest]
        
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: |
            x86_64-pc-windows-msvc
            x86_64-apple-darwin
            aarch64-apple-darwin
            x86_64-unknown-linux-gnu
            
      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev
          
      - name: Download AI Models
        run: |
          mkdir -p src-tauri/models
          curl -L -o src-tauri/models/whisper-tiny.onnx \
            "https://huggingface.co/onnx-community/whisper-tiny/resolve/main/onnx/model.onnx"
          curl -L -o src-tauri/models/whisper-base.onnx \
            "https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/model.onnx"
            
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
          ENABLE_CODE_SIGNING: ${{ secrets.APPLE_CERTIFICATE }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'MeetingMind ${{ github.ref_name }}'
          releaseBody: 'See CHANGELOG.md for details.'
          releaseDraft: true
          prerelease: false
          includeDebug: false
```

#### Code Signing and Notarization
```bash
# macOS Code Signing
codesign --force --options runtime --sign "Developer ID Application" target/release/meetingmind.app

# Windows Code Signing
signtool sign /f certificate.p12 /p password /t http://timestamp.digicert.com target/release/meetingmind.exe

# Linux AppImage Signing
gpg --armor --detach-sign target/release/meetingmind.AppImage
```

### 8.2 Update System

#### Automatic Update Architecture
```rust
struct UpdateManager {
    current_version: Version,
    update_server_url: String,
    private_key: PrivateKey,
    public_key: PublicKey,
}

impl UpdateManager {
    async fn check_for_updates(&self) -> Result<Option<UpdateInfo>> {
        let response = reqwest::get(&format!("{}/api/updates/check", self.update_server_url))
            .await?
            .json::<UpdateCheckResponse>()
            .await?;
            
        if response.latest_version > self.current_version {
            // Verify update signature
            self.verify_update_signature(&response)?;
            
            Ok(Some(UpdateInfo {
                version: response.latest_version,
                download_url: response.download_url,
                release_notes: response.release_notes,
                required: response.security_update,
                size_bytes: response.size_bytes,
            }))
        } else {
            Ok(None)
        }
    }
    
    async fn download_and_install(&self, update: UpdateInfo) -> Result<()> {
        // Download update package
        let update_data = self.download_update(&update.download_url).await?;
        
        // Verify signature and integrity
        self.verify_update_package(&update_data)?;
        
        // Platform-specific installation
        match std::env::consts::OS {
            "windows" => self.install_windows_update(&update_data).await?,
            "macos" => self.install_macos_update(&update_data).await?,
            "linux" => self.install_linux_update(&update_data).await?,
            _ => return Err(UpdateError::UnsupportedPlatform),
        }
        
        // Schedule restart
        self.schedule_restart().await?;
        
        Ok(())
    }
}
```

#### Update Server Implementation
```rust
// Simple update server for distribution
#[derive(Serialize)]
struct UpdateResponse {
    latest_version: Version,
    download_url: String,
    release_notes: String,
    security_update: bool,
    size_bytes: u64,
    signature: String,
}

async fn check_updates(Query(params): Query<UpdateCheckParams>) -> Json<UpdateResponse> {
    let latest_release = get_latest_release().await;
    
    Json(UpdateResponse {
        latest_version: latest_release.version,
        download_url: format!("https://github.com/meetingmind/releases/download/{}/{}",
            latest_release.tag,
            get_platform_binary_name(&params.platform)
        ),
        release_notes: latest_release.notes,
        security_update: latest_release.is_security_update,
        size_bytes: latest_release.binary_size,
        signature: sign_response(&latest_release).await,
    })
}
```

### 8.3 Monitoring and Analytics

#### Privacy-Respecting Telemetry
```rust
struct TelemetryService {
    enabled: bool,
    anonymous_id: String,
    endpoint: Option<String>,
    local_cache: TelemetryCache,
}

impl TelemetryService {
    async fn track_event(&self, event: TelemetryEvent) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }
        
        let anonymized_event = AnonymizedEvent {
            id: Uuid::new_v4(),
            anonymous_user: self.anonymous_id.clone(),
            event_type: event.event_type,
            properties: self.anonymize_properties(event.properties),
            timestamp: Utc::now(),
            app_version: env!("CARGO_PKG_VERSION"),
            platform: std::env::consts::OS,
        };
        
        // Store locally first
        self.local_cache.store(anonymized_event.clone()).await?;
        
        // Send to server if endpoint configured
        if let Some(endpoint) = &self.endpoint {
            self.send_to_server(endpoint, anonymized_event).await?;
        }
        
        Ok(())
    }
    
    fn anonymize_properties(&self, properties: HashMap<String, Value>) -> HashMap<String, Value> {
        // Remove or hash any potentially identifying information
        // Keep only aggregate metrics and performance data
        properties.into_iter()
            .filter(|(key, _)| self.is_safe_property(key))
            .map(|(key, value)| (key, self.sanitize_value(value)))
            .collect()
    }
}

// Example telemetry events (all anonymized)
enum TelemetryEvent {
    AppStarted { startup_time_ms: u64 },
    RecordingStarted { 
        audio_sources: u32,
        auto_detected: bool 
    },
    TranscriptionCompleted { 
        duration_seconds: u64,
        model_used: String,
        confidence_avg: f32,
        processing_time_ms: u64
    },
    SummaryGenerated {
        api_provider: String,
        token_count: u32,
        processing_time_ms: u64
    },
    ErrorOccurred { 
        error_category: String,
        recovery_attempted: bool
    },
}
```

#### Performance Monitoring
```rust
struct PerformanceMonitor {
    metrics_collector: MetricsCollector,
    alerting_service: AlertingService,
}

impl PerformanceMonitor {
    async fn collect_system_metrics(&self) -> SystemMetrics {
        SystemMetrics {
            cpu_usage_percent: self.get_cpu_usage().await,
            memory_usage_mb: self.get_memory_usage().await,
            disk_usage_percent: self.get_disk_usage().await,
            network_latency_ms: self.measure_network_latency().await,
            audio_buffer_underruns: self.get_audio_stats().buffer_underruns,
            transcription_queue_size: self.get_transcription_stats().queue_size,
        }
    }
    
    async fn check_performance_thresholds(&self, metrics: &SystemMetrics) -> Vec<PerformanceAlert> {
        let mut alerts = Vec::new();
        
        if metrics.cpu_usage_percent > 80.0 {
            alerts.push(PerformanceAlert::HighCPU(metrics.cpu_usage_percent));
        }
        
        if metrics.memory_usage_mb > 1024 {
            alerts.push(PerformanceAlert::HighMemory(metrics.memory_usage_mb));
        }
        
        if metrics.audio_buffer_underruns > 0 {
            alerts.push(PerformanceAlert::AudioDropouts(metrics.audio_buffer_underruns));
        }
        
        alerts
    }
}
```

---

## 9. Development Guidelines

### 9.1 Code Organization

#### Project Structure
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

### 9.2 Coding Standards

#### Rust Code Style
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

#### TypeScript Code Style
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

### 9.3 Testing Strategy

#### Unit Testing
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

#### Integration Testing
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

### 9.4 Performance Guidelines

#### Audio Processing Optimization
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

#### Database Performance Optimization
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

## 10. Future Architecture Considerations

### 10.1 Scalability Planning

#### Multi-User Support
While the MVP focuses on single-user functionality, the architecture includes provisions for future multi-user support:

- **Team Workspaces**: Shared meeting libraries and templates
- **Role-Based Access**: Different permission levels for team members
- **Synchronization**: Optional cloud sync for shared content
- **Enterprise Features**: Admin panels, usage analytics, compliance tools

#### Cloud Integration Expansion
- **Hybrid Storage**: Local-first with optional cloud backup
- **Distributed Processing**: Offload intensive AI processing to cloud
- **Real-Time Collaboration**: Live meeting transcription sharing
- **Advanced Analytics**: Cross-meeting insights and trends

### 10.2 Technology Evolution

#### AI Model Improvements
- **Model Updates**: Seamless updates to newer Whisper versions
- **Custom Training**: Domain-specific model fine-tuning
- **Multilingual Support**: Expanded language coverage
- **Real-Time Models**: Lower latency streaming transcription

#### Platform Expansion
- **Mobile Apps**: Companion apps for meeting management
- **Web Interface**: Browser-based meeting review and sharing
- **API Platform**: Third-party integrations and extensions
- **Browser Extension**: Meeting detection and quick access

### 10.3 Emerging Technologies

#### Advanced Audio Processing
- **Noise Cancellation**: AI-powered background noise removal
- **Voice Enhancement**: Improve audio quality for better transcription
- **Speaker Diarization**: Advanced speaker identification and tracking
- **Emotion Detection**: Meeting sentiment and engagement analysis

#### Next-Generation AI
- **Local Large Models**: On-device GPT-style models for summarization
- **Multimodal Processing**: Screen capture and visual context integration
- **Real-Time Translation**: Live translation between meeting languages
- **Action Item Detection**: Automated task extraction and assignment

---

## 11. Conclusion

The MeetingMind architecture provides a robust foundation for a privacy-first, desktop AI meeting assistant that meets the demanding requirements outlined in the PRD while maintaining flexibility for future expansion. Key architectural strengths include:

**Privacy by Design**: Local-first processing ensures user data remains secure while providing optional cloud enhancement for improved quality.

**Performance Optimization**: Multi-threaded audio processing, efficient database design, and optimized AI inference deliver real-time responsiveness.

**Cross-Platform Consistency**: Tauri framework enables native performance across Windows, macOS, and Linux with a single codebase.

**Extensible Foundation**: Modular architecture supports future features like team collaboration, advanced AI models, and platform expansion.

**Developer Experience**: Clear separation of concerns, comprehensive testing strategy, and modern tooling enable rapid development and maintenance.

The architecture successfully balances competing demands of privacy, performance, and usability while providing a clear path for product evolution and scaling.

---

**Document Status**: Final  
**Next Review**: Quarterly review recommended as implementation progresses  
**Change Management**: Architecture changes require approval from technical leadership team