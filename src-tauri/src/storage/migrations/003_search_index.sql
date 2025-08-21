-- Full-text search implementation using FTS5
-- Provides fast full-text search capabilities for transcription content

-- Create FTS5 virtual table for transcription content search
CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
    content,              -- Transcription text content
    meeting_title,        -- Meeting title for context
    language,            -- Language for language-specific search
    model_used,          -- Model used for filtering
    content='transcriptions',
    content_rowid='id',
    tokenize='porter'    -- Use Porter stemming for better English search
);

-- Populate the FTS table with existing data
INSERT OR IGNORE INTO transcriptions_fts(rowid, content, meeting_title, language, model_used)
SELECT 
    t.id,
    t.content,
    m.title,
    t.language,
    t.model_used
FROM transcriptions t
JOIN meetings m ON t.meeting_id = m.id;

-- Triggers to keep FTS table synchronized with transcriptions table

-- Insert trigger - add new transcriptions to FTS
CREATE TRIGGER IF NOT EXISTS transcriptions_fts_insert
    AFTER INSERT ON transcriptions
    FOR EACH ROW
BEGIN
    INSERT INTO transcriptions_fts(rowid, content, meeting_title, language, model_used)
    SELECT 
        NEW.id,
        NEW.content,
        m.title,
        NEW.language,
        NEW.model_used
    FROM meetings m 
    WHERE m.id = NEW.meeting_id;
END;

-- Update trigger - update FTS when transcription content changes
CREATE TRIGGER IF NOT EXISTS transcriptions_fts_update
    AFTER UPDATE OF content, language, model_used ON transcriptions
    FOR EACH ROW
BEGIN
    UPDATE transcriptions_fts 
    SET 
        content = NEW.content,
        language = NEW.language,
        model_used = NEW.model_used
    WHERE rowid = NEW.id;
END;

-- Delete trigger - remove from FTS when transcription is deleted
CREATE TRIGGER IF NOT EXISTS transcriptions_fts_delete
    AFTER DELETE ON transcriptions
    FOR EACH ROW
BEGIN
    DELETE FROM transcriptions_fts WHERE rowid = OLD.id;
END;

-- Update trigger for meeting title changes
CREATE TRIGGER IF NOT EXISTS transcriptions_fts_meeting_update
    AFTER UPDATE OF title ON meetings
    FOR EACH ROW
BEGIN
    UPDATE transcriptions_fts 
    SET meeting_title = NEW.title
    WHERE rowid IN (
        SELECT id FROM transcriptions WHERE meeting_id = NEW.id
    );
END;

-- Create search ranking table for custom ranking algorithms
CREATE TABLE IF NOT EXISTS search_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    transcription_id INTEGER NOT NULL,
    relevance_score REAL NOT NULL DEFAULT 0.0,
    click_count INTEGER NOT NULL DEFAULT 0,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transcription_id) REFERENCES transcriptions (id) ON DELETE CASCADE
);

-- Index for search ranking queries
CREATE INDEX IF NOT EXISTS idx_search_rankings_query ON search_rankings(query);
CREATE INDEX IF NOT EXISTS idx_search_rankings_transcription_id ON search_rankings(transcription_id);
CREATE INDEX IF NOT EXISTS idx_search_rankings_relevance ON search_rankings(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_rankings_accessed ON search_rankings(last_accessed DESC);

-- Search history table for analytics and suggestions
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    filters TEXT, -- JSON string of applied filters
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    user_session TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for search history analytics
CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);

-- Saved searches table for user convenience
CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    filters TEXT, -- JSON string of filters
    description TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for saved searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);
CREATE INDEX IF NOT EXISTS idx_saved_searches_favorite ON saved_searches(is_favorite);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_used ON saved_searches(last_used DESC);

-- Trigger to update saved searches last_used and usage_count
CREATE TRIGGER IF NOT EXISTS update_saved_search_usage
    AFTER UPDATE OF usage_count ON saved_searches
    FOR EACH ROW
    WHEN NEW.usage_count > OLD.usage_count
BEGIN
    UPDATE saved_searches 
    SET 
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Trigger to update saved searches updated_at
CREATE TRIGGER IF NOT EXISTS update_saved_searches_updated_at
    AFTER UPDATE ON saved_searches
    FOR EACH ROW
BEGIN
    UPDATE saved_searches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- View for enhanced search results with relevance and context
CREATE VIEW IF NOT EXISTS search_results_enhanced AS
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
    t.created_at,
    t.session_id,
    m.id as meeting_id,
    m.title as meeting_title,
    m.start_time as meeting_start_time,
    ts.overall_confidence as session_confidence,
    -- Calculate relevance boost based on confidence and recency
    (t.confidence * 0.7 + 
     (1.0 - (julianday('now') - julianday(t.created_at)) / 30.0) * 0.3) as relevance_score
FROM transcriptions t
JOIN meetings m ON t.meeting_id = m.id
JOIN transcription_sessions ts ON t.session_id = ts.session_id;

-- Create indexes for performance optimization on the FTS table
-- These are automatically created by FTS5, but we can add custom ones for specific use cases

-- Custom search configuration table
CREATE TABLE IF NOT EXISTS search_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default search configuration
INSERT OR IGNORE INTO search_config (name, value, description) VALUES
    ('max_results', '100', 'Maximum number of search results to return'),
    ('snippet_length', '150', 'Length of text snippets in search results'),
    ('highlight_tags', '<mark>|</mark>', 'HTML tags for highlighting search terms'),
    ('min_query_length', '2', 'Minimum length for search queries'),
    ('enable_stemming', '1', 'Enable word stemming in search'),
    ('enable_fuzzy_match', '1', 'Enable fuzzy matching for typos'),
    ('boost_recent', '0.3', 'Boost factor for recent results (0.0-1.0)'),
    ('boost_confidence', '0.7', 'Boost factor for high-confidence results (0.0-1.0)');

-- Trigger to update search config timestamp
CREATE TRIGGER IF NOT EXISTS update_search_config_updated_at
    AFTER UPDATE ON search_config
    FOR EACH ROW
BEGIN
    UPDATE search_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;