-- Calendar Integration Migration
-- Adds calendar account management and event caching for offline operation

-- Calendar accounts for OAuth2 token management
CREATE TABLE calendar_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, -- 'google', 'outlook'
    account_email TEXT NOT NULL,
    encrypted_access_token BLOB NOT NULL,
    encrypted_refresh_token BLOB NOT NULL,
    token_expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    auto_start_enabled BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, account_email)
);

-- Cached calendar events for offline operation
CREATE TABLE calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_account_id INTEGER NOT NULL,
    external_event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    participants TEXT, -- JSON array of participant emails
    location TEXT,
    meeting_url TEXT,
    is_accepted BOOLEAN DEFAULT TRUE,
    last_modified DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (calendar_account_id) REFERENCES calendar_accounts (id) ON DELETE CASCADE,
    UNIQUE(calendar_account_id, external_event_id)
);

-- Extend meetings table for calendar integration
ALTER TABLE meetings ADD COLUMN calendar_event_id INTEGER;
ALTER TABLE meetings ADD COLUMN calendar_account_id INTEGER;
ALTER TABLE meetings ADD COLUMN participants TEXT; -- JSON array
ALTER TABLE meetings ADD COLUMN meeting_url TEXT;
ALTER TABLE meetings ADD COLUMN calendar_description TEXT;

-- Create indexes for efficient queries
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_account_id ON calendar_events(calendar_account_id);
CREATE INDEX idx_calendar_accounts_provider_email ON calendar_accounts(provider, account_email);
CREATE INDEX idx_meetings_calendar_event ON meetings(calendar_event_id);