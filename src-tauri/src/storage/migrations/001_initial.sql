-- Initial database schema for MeetingMind
-- Creates core tables for meetings, users, and basic structure

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Meetings table - stores meeting metadata
CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on meeting times for efficient queries
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- Participants table - stores meeting participants
CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'participant' CHECK (role IN ('organizer', 'participant', 'presenter')),
    joined_at DATETIME,
    left_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
);

-- Create index for participant lookups
CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);

-- Settings table - stores application settings
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, category, description) VALUES
    ('app_version', '0.1.0', 'system', 'Application version'),
    ('default_language', 'auto', 'transcription', 'Default transcription language'),
    ('default_model', 'tiny', 'transcription', 'Default Whisper model'),
    ('confidence_threshold', '0.7', 'transcription', 'Transcription confidence threshold'),
    ('max_session_duration', '14400', 'general', 'Maximum session duration in seconds (4 hours)'),
    ('auto_save_interval', '300', 'general', 'Auto-save interval in seconds'),
    ('data_retention_days', '90', 'general', 'Number of days to retain meeting data');

-- Triggers to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_meetings_updated_at 
    AFTER UPDATE ON meetings
    FOR EACH ROW
BEGIN
    UPDATE meetings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_settings_updated_at 
    AFTER UPDATE ON settings
    FOR EACH ROW
BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;