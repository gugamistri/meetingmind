-- Enhanced search capabilities for advanced filtering and tagging
-- Extends the existing search infrastructure with additional features

-- Add tags support to meetings table
ALTER TABLE meetings ADD COLUMN tags TEXT; -- JSON array of tags

-- Create FTS5 virtual table for meetings search (title, participants, tags)
CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts5(
    title,               -- Meeting title
    participants,        -- JSON array of participants
    tags,               -- JSON array of tags
    summary_content,     -- Meeting summary content
    content='meetings',
    content_rowid='id',
    tokenize='porter'    -- Use Porter stemming for better search
);

-- Populate meetings FTS with existing data
INSERT OR IGNORE INTO meetings_fts(rowid, title, participants, tags, summary_content)
SELECT 
    m.id,
    m.title,
    COALESCE(m.participants, '[]'),
    COALESCE(m.tags, '[]'),
    COALESCE(s.summary_content, '')
FROM meetings m
LEFT JOIN summaries s ON m.id = s.meeting_id;

-- Triggers to keep meetings FTS table synchronized

-- Insert trigger for meetings
CREATE TRIGGER IF NOT EXISTS meetings_fts_insert
    AFTER INSERT ON meetings
    FOR EACH ROW
BEGIN
    INSERT INTO meetings_fts(rowid, title, participants, tags, summary_content)
    VALUES (
        NEW.id,
        NEW.title,
        COALESCE(NEW.participants, '[]'),
        COALESCE(NEW.tags, '[]'),
        ''
    );
END;

-- Update trigger for meetings
CREATE TRIGGER IF NOT EXISTS meetings_fts_update
    AFTER UPDATE OF title, participants, tags ON meetings
    FOR EACH ROW
BEGIN
    UPDATE meetings_fts 
    SET 
        title = NEW.title,
        participants = COALESCE(NEW.participants, '[]'),
        tags = COALESCE(NEW.tags, '[]')
    WHERE rowid = NEW.id;
END;

-- Delete trigger for meetings
CREATE TRIGGER IF NOT EXISTS meetings_fts_delete
    AFTER DELETE ON meetings
    FOR EACH ROW
BEGIN
    DELETE FROM meetings_fts WHERE rowid = OLD.id;
END;

-- Update trigger for summary content changes
CREATE TRIGGER IF NOT EXISTS meetings_fts_summary_update
    AFTER INSERT OR UPDATE OF summary_content ON summaries
    FOR EACH ROW
BEGIN
    UPDATE meetings_fts 
    SET summary_content = NEW.summary_content
    WHERE rowid = NEW.meeting_id;
END;

-- Enhanced search history table with filters support
ALTER TABLE search_history ADD COLUMN duration_ms INTEGER DEFAULT 0; -- Search execution time
ALTER TABLE search_history ADD COLUMN result_clicked BOOLEAN DEFAULT 0; -- Whether user clicked a result

-- Meeting duration index for filtering
CREATE INDEX IF NOT EXISTS idx_meetings_duration ON meetings(
    CAST((julianday(end_time) - julianday(start_time)) * 24 * 60 AS INTEGER)
) WHERE end_time IS NOT NULL;

-- Participants search optimization
CREATE INDEX IF NOT EXISTS idx_meetings_participants ON meetings(participants) WHERE participants IS NOT NULL;

-- Tags search optimization  
CREATE INDEX IF NOT EXISTS idx_meetings_tags ON meetings(tags) WHERE tags IS NOT NULL;

-- Enhanced search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    total_searches INTEGER NOT NULL DEFAULT 0,
    unique_queries INTEGER NOT NULL DEFAULT 0,
    avg_response_time_ms REAL NOT NULL DEFAULT 0.0,
    total_results INTEGER NOT NULL DEFAULT 0,
    zero_result_queries INTEGER NOT NULL DEFAULT 0,
    most_common_query TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily search analytics index
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_analytics_date ON search_analytics(date);

-- Search suggestions table for autocomplete
CREATE TABLE IF NOT EXISTS search_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'participant', 'tag', 'query', 'title'
    frequency INTEGER NOT NULL DEFAULT 1,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Search suggestions indexes
CREATE INDEX IF NOT EXISTS idx_search_suggestions_category ON search_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_frequency ON search_suggestions(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_text ON search_suggestions(suggestion);

-- Enhanced view for comprehensive search results
CREATE VIEW IF NOT EXISTS comprehensive_search_results AS
SELECT 
    'meeting' as result_type,
    m.id as result_id,
    m.title as title,
    '' as content_snippet,
    m.participants,
    m.tags,
    m.start_time,
    m.end_time,
    CAST((julianday(COALESCE(m.end_time, datetime('now'))) - julianday(m.start_time)) * 24 * 60 AS INTEGER) as duration_minutes,
    1.0 as confidence,
    m.created_at,
    0 as transcription_id,
    0 as chunk_id,
    0 as start_timestamp,
    0 as end_timestamp
FROM meetings m

UNION ALL

SELECT 
    'transcription' as result_type,
    t.meeting_id as result_id,
    m.title as title,
    t.content as content_snippet,
    m.participants,
    m.tags,
    m.start_time,
    m.end_time,
    CAST((julianday(COALESCE(m.end_time, datetime('now'))) - julianday(m.start_time)) * 24 * 60 AS INTEGER) as duration_minutes,
    t.confidence,
    t.created_at,
    t.id as transcription_id,
    t.chunk_id,
    t.start_timestamp,
    t.end_timestamp
FROM transcriptions t
JOIN meetings m ON t.meeting_id = m.id;

-- Function-like view for getting available filter values
CREATE VIEW IF NOT EXISTS search_filter_values AS
SELECT 
    'participant' as filter_type,
    json_each.value as filter_value,
    COUNT(*) as usage_count
FROM meetings m, json_each(m.participants)
WHERE m.participants IS NOT NULL
GROUP BY json_each.value

UNION ALL

SELECT 
    'tag' as filter_type,
    json_each.value as filter_value,
    COUNT(*) as usage_count
FROM meetings m, json_each(m.tags)
WHERE m.tags IS NOT NULL
GROUP BY json_each.value

ORDER BY usage_count DESC;

-- Search performance monitoring
CREATE TABLE IF NOT EXISTS search_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_type TEXT NOT NULL, -- 'global', 'meeting', 'suggestion'
    query_length INTEGER NOT NULL,
    result_count INTEGER NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    memory_used_kb INTEGER DEFAULT 0,
    cache_hit BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance monitoring indexes
CREATE INDEX IF NOT EXISTS idx_search_performance_timestamp ON search_performance(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_performance_query_type ON search_performance(query_type);
CREATE INDEX IF NOT EXISTS idx_search_performance_execution_time ON search_performance(execution_time_ms);

-- Trigger to clean old performance data (keep last 30 days)
CREATE TRIGGER IF NOT EXISTS cleanup_search_performance
    AFTER INSERT ON search_performance
    FOR EACH ROW
BEGIN
    DELETE FROM search_performance 
    WHERE timestamp < datetime('now', '-30 days');
END;

-- Enhanced search configuration
INSERT OR IGNORE INTO search_config (name, value, description) VALUES
    ('filter_participants_limit', '100', 'Maximum participants to show in filter dropdown'),
    ('filter_tags_limit', '50', 'Maximum tags to show in filter dropdown'),
    ('suggestion_debounce_ms', '300', 'Debounce time for search suggestions'),
    ('max_snippet_highlights', '3', 'Maximum number of highlights per snippet'),
    ('enable_analytics', '1', 'Enable search analytics collection'),
    ('cache_suggestions', '1', 'Cache search suggestions for performance'),
    ('auto_save_searches', '1', 'Automatically save frequently used searches');

-- Performance optimization: Analyze tables for query planner
ANALYZE meetings;
ANALYZE transcriptions;
ANALYZE meetings_fts;
ANALYZE transcriptions_fts;