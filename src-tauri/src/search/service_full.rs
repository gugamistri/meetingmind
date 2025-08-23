use sqlx::{SqlitePool, Row};
use std::time::Instant;
use tokio::time::{timeout, Duration};
use tracing::{debug, error, info, warn};

use crate::search::types::*;
use crate::storage::models::{SearchHistory, SavedSearch};

/// Core search service providing full-text search capabilities
#[derive(Debug, Clone)]
pub struct SearchService {
    pool: SqlitePool,
    config: SearchConfig,
}

impl SearchService {
    /// Create a new search service instance
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            config: SearchConfig::default(),
        }
    }

    /// Create a new search service with custom configuration
    pub fn with_config(pool: SqlitePool, config: SearchConfig) -> Self {
        Self { pool, config }
    }

    /// Search across all meeting content with filters and pagination
    pub async fn search_meetings(
        &self,
        query: SearchQuery,
    ) -> SearchServiceResult<Vec<SearchResult>> {
        let start_time = Instant::now();
        
        // Validate query
        self.validate_query(&query)?;
        
        // Perform search with timeout
        let search_future = self.execute_search(query.clone());
        let search_timeout = Duration::from_millis(self.config.search_timeout_ms);
        
        let results = match timeout(search_timeout, search_future).await {
            Ok(Ok(results)) => results,
            Ok(Err(e)) => return Err(e),
            Err(_) => {
                return Err(SearchError::Timeout {
                    timeout_ms: self.config.search_timeout_ms,
                });
            }
        };

        let response_time = start_time.elapsed().as_millis() as i32;
        
        // Record search in history
        if let Err(e) = self.record_search_history(&query, results.len() as i32, response_time).await {
            warn!("Failed to record search history: {}", e);
        }

        info!(
            "Search completed: query='{}', results={}, time={}ms", 
            query.query, 
            results.len(), 
            response_time
        );

        Ok(results)
    }

    /// Execute the actual search query
    async fn execute_search(&self, query: SearchQuery) -> SearchServiceResult<Vec<SearchResult>> {
        // Build FTS query
        let fts_query = self.build_fts_query(&query.query)?;
        
        // For simplicity, start with basic FTS search and expand filters later
        let sql = format!(
            r#"
            SELECT DISTINCT
                t.id as transcription_id,
                t.meeting_id,
                m.title as meeting_title,
                t.content as full_content,
                t.confidence,
                t.language,
                t.model_used,
                t.start_timestamp as chunk_start_time,
                t.end_timestamp as chunk_end_time,
                t.created_at,
                m.start_time as meeting_start_time,
                m.end_time as meeting_end_time,
                -- Calculate relevance score
                (
                    1.0 + 
                    (t.confidence * {}) + 
                    (1.0 - (julianday('now') - julianday(t.created_at)) / 30.0) * {}
                ) as relevance_score
            FROM transcriptions_fts fts
            JOIN transcriptions t ON t.id = fts.rowid
            JOIN meetings m ON m.id = t.meeting_id
            WHERE transcriptions_fts MATCH ?
            ORDER BY relevance_score DESC, t.created_at DESC
            LIMIT ?
            "#,
            self.config.boost_confidence,
            self.config.boost_recent
        );

        debug!("Executing search query: {}", sql);

        let limit = query.limit.unwrap_or(50) as i64;
        let rows = sqlx::query(&sql)
            .bind(&fts_query)
            .bind(limit)
            .fetch_all(&self.pool).await?;

        // Transform results
        let mut results = Vec::new();
        for row in rows {
            let transcription_id: i64 = row.get("transcription_id");
            let meeting_id: i64 = row.get("meeting_id");
            let meeting_title: String = row.get("meeting_title");
            let full_content: String = row.get("full_content");
            let relevance_score: f64 = row.get("relevance_score");
            let confidence: f64 = row.get("confidence");
            let language: String = row.get("language");
            let model_used: String = row.get("model_used");
            let chunk_start_time: f64 = row.get("chunk_start_time");
            let chunk_end_time: f64 = row.get("chunk_end_time");
            let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let meeting_start_time: chrono::DateTime<chrono::Utc> = row.get("meeting_start_time");
            let meeting_end_time: Option<chrono::DateTime<chrono::Utc>> = row.get("meeting_end_time");

            // Generate snippet and highlights
            let (snippet, highlights) = if query.include_highlights {
                self.generate_snippet_with_highlights(&full_content, &query.query)?
            } else {
                (self.generate_snippet(&full_content), Vec::new())
            };

            // Calculate meeting duration
            let meeting_duration = meeting_end_time
                .map(|end| (end - meeting_start_time).num_minutes() as i32);

            let search_result = SearchResult {
                transcription_id,
                meeting_id,
                meeting_title,
                content_snippet: snippet,
                full_content,
                relevance_score: relevance_score as f32,
                match_type: SearchMatchType::Content, // TODO: Determine actual match type
                highlight_positions: highlights,
                context: SearchResultContext {
                    meeting_start_time,
                    meeting_duration,
                    participant_count: 0, // TODO: Count participants
                    confidence,
                    language,
                    model_used,
                    chunk_start_time,
                    chunk_end_time,
                },
                created_at,
            };

            results.push(search_result);
        }

        Ok(results)
    }

    /// Search within a specific meeting
    pub async fn search_within_meeting(
        &self,
        meeting_id: i64,
        query: &str,
    ) -> SearchServiceResult<Vec<InMeetingMatch>> {
        self.validate_query_string(query)?;

        let fts_query = self.build_fts_query(query)?;
        
        let sql = r#"
            SELECT 
                t.id as transcription_id,
                t.chunk_id,
                t.content,
                t.start_timestamp,
                t.end_timestamp,
                fts.rank as relevance_score
            FROM transcriptions_fts fts
            JOIN transcriptions t ON t.id = fts.rowid
            WHERE transcriptions_fts MATCH ? AND t.meeting_id = ?
            ORDER BY t.start_timestamp ASC
        "#;

        let rows = sqlx::query(sql)
            .bind(&fts_query)
            .bind(meeting_id)
            .fetch_all(&self.pool)
            .await?;

        let mut matches = Vec::new();
        for row in rows {
            let transcription_id: i64 = row.get("transcription_id");
            let chunk_id: String = row.get("chunk_id");
            let content: String = row.get("content");
            let start_timestamp: f64 = row.get("start_timestamp");
            let end_timestamp: f64 = row.get("end_timestamp");
            let relevance_score: f64 = row.get("relevance_score");

            let (_, highlights) = self.generate_snippet_with_highlights(&content, query)?;

            let meeting_match = InMeetingMatch {
                transcription_id,
                chunk_id,
                content: content.clone(),
                start_timestamp,
                end_timestamp,
                match_positions: highlights,
                surrounding_context: content, // TODO: Get actual surrounding context
                relevance_score: relevance_score as f32,
            };

            matches.push(meeting_match);
        }

        Ok(matches)
    }

    /// Get search suggestions for autocomplete
    pub async fn get_search_suggestions(
        &self,
        partial_query: &str,
        suggestion_type: SuggestionType,
        limit: usize,
    ) -> SearchServiceResult<Vec<SearchSuggestion>> {
        let sql = match suggestion_type {
            SuggestionType::RecentQuery => {
                r#"
                SELECT DISTINCT query as suggestion, 'RecentQuery' as type, 
                       COUNT(*) as frequency, MAX(created_at) as last_used
                FROM search_history 
                WHERE query LIKE ? || '%' AND query != ?
                GROUP BY query
                ORDER BY last_used DESC, frequency DESC
                LIMIT ?
                "#
            }
            SuggestionType::PopularTerm => {
                r#"
                SELECT DISTINCT query as suggestion, 'PopularTerm' as type,
                       COUNT(*) as frequency, MAX(created_at) as last_used
                FROM search_history 
                WHERE query LIKE ? || '%' AND query != ?
                GROUP BY query
                ORDER BY frequency DESC, last_used DESC
                LIMIT ?
                "#
            }
            _ => {
                // For other types, we'll implement later
                return Ok(Vec::new());
            }
        };

        let rows = sqlx::query(sql)
            .bind(partial_query)
            .bind(partial_query)
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await?;

        let mut suggestions = Vec::new();
        for row in rows {
            let suggestion: String = row.get("suggestion");
            let frequency: i64 = row.get("frequency");
            let last_used: Option<chrono::DateTime<chrono::Utc>> = row.get("last_used");

            suggestions.push(SearchSuggestion {
                suggestion,
                suggestion_type: suggestion_type.clone(),
                frequency: frequency as i32,
                last_used,
            });
        }

        Ok(suggestions)
    }

    /// Save a search query for later use
    pub async fn save_search(
        &self,
        name: &str,
        query: &SearchQuery,
        description: Option<&str>,
    ) -> SearchServiceResult<SavedSearchEntry> {
        let filters_json = serde_json::to_string(&query.filters)?;
        
        let result = sqlx::query!(
            r#"
            INSERT INTO saved_searches (name, query, filters, description)
            VALUES (?, ?, ?, ?)
            RETURNING id, name, query, filters, description, is_favorite, 
                     usage_count, last_used, created_at, updated_at
            "#,
            name,
            query.query,
            filters_json,
            description
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(SavedSearchEntry {
            id: result.id,
            name: result.name,
            query: result.query,
            filters: result.filters,
            description: result.description,
            is_favorite: result.is_favorite != 0,
            usage_count: result.usage_count,
            last_used: result.last_used,
            created_at: result.created_at,
            updated_at: result.updated_at,
        })
    }

    /// Get all saved searches
    pub async fn get_saved_searches(&self) -> SearchServiceResult<Vec<SavedSearchEntry>> {
        let rows = sqlx::query!(
            "SELECT id, name, query, filters, description, is_favorite, usage_count, last_used, created_at, updated_at FROM saved_searches ORDER BY last_used DESC, name ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        let saved_searches = rows.into_iter().map(|row| SavedSearchEntry {
            id: row.id,
            name: row.name,
            query: row.query,
            filters: row.filters,
            description: row.description,
            is_favorite: row.is_favorite != 0,
            usage_count: row.usage_count,
            last_used: row.last_used,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }).collect();

        Ok(saved_searches)
    }

    /// Get search history
    pub async fn get_search_history(&self, limit: usize) -> SearchServiceResult<Vec<SearchHistoryEntry>> {
        let rows = sqlx::query!(
            "SELECT id, query, results_count, filters, response_time_ms, created_at FROM search_history ORDER BY created_at DESC LIMIT ?",
            limit as i64
        )
        .fetch_all(&self.pool)
        .await?;

        let history = rows.into_iter().map(|row| SearchHistoryEntry {
            id: row.id,
            query: row.query,
            results_count: row.results_count as i32,
            filters: row.filters,
            response_time_ms: row.response_time_ms as i32,
            created_at: row.created_at,
        }).collect();

        Ok(history)
    }

    /// Helper: Validate search query
    fn validate_query(&self, query: &SearchQuery) -> SearchServiceResult<()> {
        self.validate_query_string(&query.query)
    }

    /// Helper: Validate query string
    fn validate_query_string(&self, query: &str) -> SearchServiceResult<()> {
        if query.trim().len() < self.config.min_query_length {
            return Err(SearchError::QueryTooShort {
                min_length: self.config.min_query_length,
            });
        }
        Ok(())
    }

    /// Helper: Build FTS5 query string
    fn build_fts_query(&self, query: &str) -> SearchServiceResult<String> {
        let cleaned_query = query.trim();
        
        if cleaned_query.is_empty() {
            return Err(SearchError::InvalidQuery {
                message: "Query cannot be empty".to_string(),
            });
        }

        // For basic implementation, we'll just quote the query for phrase matching
        // TODO: Add more sophisticated query parsing (AND, OR, NOT operators)
        let fts_query = if cleaned_query.contains(' ') {
            format!("\"{}\"", cleaned_query)
        } else {
            format!("{}*", cleaned_query) // Prefix matching for single words
        };

        Ok(fts_query)
    }

    /// Helper: Generate content snippet
    fn generate_snippet(&self, content: &str) -> String {
        if content.len() <= self.config.snippet_length {
            content.to_string()
        } else {
            let mut snippet = content.chars().take(self.config.snippet_length).collect::<String>();
            snippet.push_str("...");
            snippet
        }
    }

    /// Helper: Generate snippet with highlights
    fn generate_snippet_with_highlights(
        &self,
        content: &str,
        query: &str,
    ) -> SearchServiceResult<(String, Vec<HighlightPosition>)> {
        let query_lower = query.to_lowercase();
        let content_lower = content.to_lowercase();
        
        let mut highlights = Vec::new();
        let mut start = 0;
        
        // Find all occurrences of the query in the content
        while let Some(pos) = content_lower[start..].find(&query_lower) {
            let actual_pos = start + pos;
            highlights.push(HighlightPosition {
                start: actual_pos,
                end: actual_pos + query.len(),
                matched_term: query.to_string(),
            });
            start = actual_pos + 1;
        }

        // Generate snippet around the first match if found
        let snippet = if let Some(first_match) = highlights.first() {
            let snippet_start = if first_match.start > self.config.snippet_length / 2 {
                first_match.start - self.config.snippet_length / 2
            } else {
                0
            };
            
            let snippet_end = std::cmp::min(
                snippet_start + self.config.snippet_length,
                content.len()
            );
            
            let mut snippet = content[snippet_start..snippet_end].to_string();
            if snippet_start > 0 {
                snippet = format!("...{}", snippet);
            }
            if snippet_end < content.len() {
                snippet.push_str("...");
            }
            
            snippet
        } else {
            self.generate_snippet(content)
        };

        Ok((snippet, highlights))
    }

    /// Helper: Record search in history
    async fn record_search_history(
        &self,
        query: &SearchQuery,
        results_count: i32,
        response_time_ms: i32,
    ) -> SearchServiceResult<()> {
        let filters_json = serde_json::to_string(&query.filters)?;
        
        sqlx::query!(
            r#"
            INSERT INTO search_history (query, results_count, filters, response_time_ms)
            VALUES (?, ?, ?, ?)
            "#,
            query.query,
            results_count,
            filters_json,
            response_time_ms
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}