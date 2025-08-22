-- Migration 004: Add summaries and AI-related tables

-- Summaries table with metadata and template linkage
CREATE TABLE summaries (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    template_id INTEGER,
    content TEXT NOT NULL,
    model_used TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'openai' or 'claude'
    cost_usd REAL NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    token_count INTEGER,
    confidence_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id),
    FOREIGN KEY (template_id) REFERENCES summary_templates (id)
);

-- Summary templates for different meeting types
CREATE TABLE summary_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    prompt_template TEXT NOT NULL,
    meeting_type TEXT NOT NULL, -- 'standup', 'client', 'brainstorm', 'all_hands', 'custom'
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking for cost monitoring and reporting
CREATE TABLE usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_provider TEXT NOT NULL, -- 'openai', 'claude'
    operation_type TEXT NOT NULL, -- 'summarization', 'transcription', 'insight_generation', 'action_item_extraction'
    model_name TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL NOT NULL,
    meeting_id TEXT,
    summary_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id),
    FOREIGN KEY (summary_id) REFERENCES summaries (id)
);

-- FTS5 search index for summary content
CREATE VIRTUAL TABLE summaries_fts USING fts5(
    content,
    content=summaries,
    content_rowid=id
);

-- Triggers to maintain FTS index
CREATE TRIGGER summaries_fts_insert AFTER INSERT ON summaries
BEGIN
    INSERT INTO summaries_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;

CREATE TRIGGER summaries_fts_delete AFTER DELETE ON summaries
BEGIN
    INSERT INTO summaries_fts(summaries_fts, rowid, content) VALUES ('delete', OLD.rowid, OLD.content);
END;

CREATE TRIGGER summaries_fts_update AFTER UPDATE ON summaries
BEGIN
    INSERT INTO summaries_fts(summaries_fts, rowid, content) VALUES ('delete', OLD.rowid, OLD.content);
    INSERT INTO summaries_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;

-- Insert default summary templates
INSERT INTO summary_templates (name, description, prompt_template, meeting_type, is_default)
VALUES 
(
    'Standup Meeting',
    'Daily standup or team sync meeting summary',
    'Create a concise summary of this standup meeting. Focus on:

## Team Updates
- What each team member accomplished
- Current work in progress
- Planned work for next period

## Blockers & Issues
- Any obstacles or challenges mentioned
- Dependencies or help needed

## Action Items
- Specific tasks or decisions made
- Ownership and deadlines if mentioned

## Key Insights
- Important context or announcements
- Process improvements or changes

Keep the summary professional and organized. Use bullet points for clarity.',
    'standup',
    TRUE
),
(
    'Client Meeting',
    'Client meeting summary with decisions and follow-ups',
    'Summarize this client meeting with emphasis on:

## Meeting Overview
- Participants and context
- Main purpose and agenda covered

## Key Discussions
- Important topics and client feedback
- Concerns or questions raised
- Solutions or recommendations provided

## Decisions Made
- Concrete decisions and agreements
- Changes to scope, timeline, or approach
- Budget or resource commitments

## Action Items
- Next steps with clear ownership
- Deliverables and deadlines
- Follow-up meetings or check-ins

## Client Feedback
- Satisfaction levels and concerns
- Requests for changes or improvements

Format professionally for sharing with stakeholders.',
    'client',
    TRUE
),
(
    'Brainstorm Session',
    'Creative brainstorming and ideation meeting summary',
    'Summarize this brainstorming session by organizing the content into:

## Session Goals
- Problem statement or challenge addressed
- Objectives and desired outcomes

## Ideas Generated
- Core concepts and creative solutions
- Innovative approaches or alternatives
- Build-on ideas and variations

## Promising Directions
- Ideas with strong potential
- Concepts that generated enthusiasm
- Solutions worth exploring further

## Next Steps
- Ideas to prototype or test
- Research or validation needed
- Assignment of exploration tasks

## Key Insights
- Patterns or themes that emerged
- Unexpected connections or revelations
- Strategic implications

Maintain the creative energy while organizing ideas clearly.',
    'brainstorm',
    TRUE
),
(
    'All-Hands Meeting',
    'Company-wide or department all-hands meeting summary',
    'Create a comprehensive summary of this all-hands meeting:

## Announcements
- Company updates and news
- Policy changes or new initiatives
- Leadership updates or org changes

## Performance & Metrics
- Business results and achievements
- Goal progress and key metrics
- Performance highlights

## Strategic Updates
- Product roadmap or strategy changes
- Market updates and competitive landscape
- Future planning and vision

## Q&A Highlights
- Important questions from the team
- Leadership responses and clarifications
- Commitments or promises made

## Action Items
- Company-wide initiatives
- Department-specific follow-ups
- Communication or implementation plans

Format for broad distribution and future reference.',
    'all_hands',
    TRUE
),
(
    'General Meeting',
    'Generic meeting summary template',
    'Provide a well-structured summary of this meeting:

## Meeting Overview
- Purpose and participants
- Key topics discussed

## Important Points
- Main discussion items
- Decisions and agreements
- Concerns or issues raised

## Action Items
- Tasks assigned with ownership
- Deadlines and follow-up items
- Next meetings or check-ins

## Key Takeaways
- Important insights or learnings
- Strategic implications
- Process improvements

Use clear formatting and bullet points for readability.',
    'custom',
    TRUE
);

-- Create indexes for performance
CREATE INDEX idx_summaries_meeting_id ON summaries (meeting_id);
CREATE INDEX idx_summaries_created_at ON summaries (created_at);
CREATE INDEX idx_summaries_provider ON summaries (provider);
CREATE INDEX idx_summary_templates_meeting_type ON summary_templates (meeting_type);
CREATE INDEX idx_usage_records_created_at ON usage_records (created_at);
CREATE INDEX idx_usage_records_provider ON usage_records (service_provider);
CREATE INDEX idx_usage_records_operation_type ON usage_records (operation_type);