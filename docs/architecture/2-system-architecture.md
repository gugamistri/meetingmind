# 2. System Architecture

## 2.1 Architecture Patterns

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

## 2.2 Core Components

### Audio Capture Service
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

### Transcription Pipeline
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

### AI Processing Hub
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

### Storage Engine
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

## 2.3 Data Flow Architecture

### Real-Time Recording Flow
```
Calendar Event → Meeting Detection → Audio Capture Start
                                           ↓
Audio Stream → Circular Buffer → Chunk Processing (1s intervals)
                                           ↓
Whisper Local → Confidence Check → [Optional API Enhancement]
                                           ↓
Transcription Segments → UI Update → SQLite Storage
```

### Post-Meeting Processing Flow
```
Recording Complete → Audio File Save → Transcription Finalization
                                           ↓
Template Selection → AI Summary Generation → Cost Calculation
                                           ↓
Summary Storage → Export Options → User Notification
```

### Search and Retrieval Flow
```
User Search Query → FTS5 Index → Ranked Results
                                           ↓
Metadata Enrichment → Speaker Information → UI Presentation
```

---
