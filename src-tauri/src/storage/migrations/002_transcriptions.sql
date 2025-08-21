-- Transcription-related tables and indexes
-- Adds tables for storing transcription data with full-text search capabilities

-- Transcriptions table - stores transcription chunks
CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id TEXT NOT NULL UNIQUE, -- UUID of the transcription chunk
    meeting_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    language TEXT NOT NULL DEFAULT 'auto',
    model_used TEXT NOT NULL,
    start_timestamp REAL NOT NULL, -- Seconds from session start
    end_timestamp REAL NOT NULL,   -- Seconds from session start
    word_count INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    processed_locally BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_transcriptions_meeting_id ON transcriptions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_session_id ON transcriptions(session_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_chunk_id ON transcriptions(chunk_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_confidence ON transcriptions(confidence);
CREATE INDEX IF NOT EXISTS idx_transcriptions_timestamp ON transcriptions(start_timestamp, end_timestamp);
CREATE INDEX IF NOT EXISTS idx_transcriptions_language ON transcriptions(language);
CREATE INDEX IF NOT EXISTS idx_transcriptions_model ON transcriptions(model_used);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at);

-- Transcription sessions table - tracks transcription sessions
CREATE TABLE IF NOT EXISTS transcription_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    meeting_id INTEGER NOT NULL,
    config_language TEXT NOT NULL DEFAULT 'auto',
    config_model TEXT NOT NULL DEFAULT 'tiny',
    config_mode TEXT NOT NULL DEFAULT 'hybrid' CHECK (config_mode IN ('local', 'cloud', 'hybrid')),
    confidence_threshold REAL NOT NULL DEFAULT 0.7,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    total_duration_seconds REAL NOT NULL DEFAULT 0.0,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    local_chunks INTEGER NOT NULL DEFAULT 0,
    cloud_chunks INTEGER NOT NULL DEFAULT 0,
    overall_confidence REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
);

-- Create indexes for transcription sessions
CREATE INDEX IF NOT EXISTS idx_transcription_sessions_session_id ON transcription_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_transcription_sessions_meeting_id ON transcription_sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcription_sessions_status ON transcription_sessions(status);
CREATE INDEX IF NOT EXISTS idx_transcription_sessions_started_at ON transcription_sessions(started_at);

-- Transcription statistics table - aggregated stats for reporting
CREATE TABLE IF NOT EXISTS transcription_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_chunks INTEGER NOT NULL DEFAULT 0,
    total_duration_seconds REAL NOT NULL DEFAULT 0.0,
    total_processing_time_ms INTEGER NOT NULL DEFAULT 0,
    avg_confidence REAL NOT NULL DEFAULT 0.0,
    local_processing_percentage REAL NOT NULL DEFAULT 0.0,
    error_count INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for stats queries
CREATE INDEX IF NOT EXISTS idx_transcription_stats_date ON transcription_stats(date);

-- Trigger to update transcription updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_transcriptions_updated_at 
    AFTER UPDATE ON transcriptions
    FOR EACH ROW
BEGIN
    UPDATE transcriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update session chunk count when transcriptions are added
CREATE TRIGGER IF NOT EXISTS update_session_chunk_count_insert
    AFTER INSERT ON transcriptions
    FOR EACH ROW
BEGIN
    UPDATE transcription_sessions 
    SET 
        chunk_count = chunk_count + 1,
        total_duration_seconds = total_duration_seconds + (NEW.end_timestamp - NEW.start_timestamp),
        processing_time_ms = processing_time_ms + NEW.processing_time_ms,
        local_chunks = local_chunks + CASE WHEN NEW.processed_locally THEN 1 ELSE 0 END,
        cloud_chunks = cloud_chunks + CASE WHEN NOT NEW.processed_locally THEN 1 ELSE 0 END
    WHERE session_id = NEW.session_id;
    
    -- Update overall confidence (simple average for now)
    UPDATE transcription_sessions 
    SET overall_confidence = (
        SELECT AVG(confidence) 
        FROM transcriptions 
        WHERE session_id = NEW.session_id
    )
    WHERE session_id = NEW.session_id;
END;

-- Trigger to update session chunk count when transcriptions are deleted
CREATE TRIGGER IF NOT EXISTS update_session_chunk_count_delete
    AFTER DELETE ON transcriptions
    FOR EACH ROW
BEGIN
    UPDATE transcription_sessions 
    SET 
        chunk_count = chunk_count - 1,
        total_duration_seconds = total_duration_seconds - (OLD.end_timestamp - OLD.start_timestamp),
        processing_time_ms = processing_time_ms - OLD.processing_time_ms,
        local_chunks = local_chunks - CASE WHEN OLD.processed_locally THEN 1 ELSE 0 END,
        cloud_chunks = cloud_chunks - CASE WHEN NOT OLD.processed_locally THEN 1 ELSE 0 END
    WHERE session_id = OLD.session_id;
    
    -- Update overall confidence
    UPDATE transcription_sessions 
    SET overall_confidence = COALESCE((
        SELECT AVG(confidence) 
        FROM transcriptions 
        WHERE session_id = OLD.session_id
    ), 0.0)
    WHERE session_id = OLD.session_id;
END;

-- View for convenient transcription queries with meeting information
CREATE VIEW IF NOT EXISTS transcription_details AS
SELECT 
    t.id,
    t.chunk_id,
    t.content,
    t.confidence,
    t.language,
    t.model_used,
    t.start_timestamp,
    t.end_timestamp,
    t.word_count,
    t.processing_time_ms,
    t.processed_locally,
    t.created_at,
    t.session_id,
    m.id as meeting_id,
    m.title as meeting_title,
    m.start_time as meeting_start_time,
    ts.config_mode as session_mode,
    ts.confidence_threshold as session_threshold
FROM transcriptions t
JOIN meetings m ON t.meeting_id = m.id
JOIN transcription_sessions ts ON t.session_id = ts.session_id;

-- Function to calculate local processing percentage
-- This would be implemented as a custom function in a real database
-- For SQLite, we'll handle this in the application code