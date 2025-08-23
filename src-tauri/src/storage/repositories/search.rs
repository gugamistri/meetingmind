use crate::search::types::*;
use crate::error::Result;
use sqlx::{Pool, Sqlite, Row};
use serde_json;
use std::time::Instant;

#[derive(Debug)]
pub struct SearchRepository {
    pool: Pool<Sqlite>,
}

impl SearchRepository {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Perform comprehensive search across meetings and transcriptions
pub async fn search_comprehensive(
    &self,
    query: &str,
    filters: &SearchFilters,
    limit: usize,
    offset: usize,
) -> Result<Vec<SearchResult>> {
    let start_time = Instant::now();
    
    // Build the search query based on filters - using proper parameterized queries
    let mut conditions = Vec::new();
    let mut bind_params = Vec::new();
    
    // Add FTS search conditions if query is provided
    if !query.is_empty() {
        // Escape FTS query to prevent injection
        let escaped_query = query.replace("\"", "\"\"");
        conditions.push("(mfts.title MATCH ?1 OR tfts.content MATCH ?1)".to_string());
        bind_params.push(escaped_query);
    }
    
    // Date range filters
    if let Some(start_date) = &filters.date_start {
        conditions.push(format!("m.start_time >= ?{}", bind_params.len() + 1));
        bind_params.push(start_date.to_rfc3339());
    }
    if let Some(end_date) = &filters.date_end {
        conditions.push(format!("m.start_time <= ?{}", bind_params.len() + 1));
        bind_params.push(end_date.to_rfc3339());
    }

    // Duration filters
    if let Some(min_duration) = filters.duration_min {
        conditions.push(format!("CAST((julianday(COALESCE(m.end_time, datetime('now'))) - julianday(m.start_time)) * 24 * 60 AS INTEGER) >= ?{}", bind_params.len() + 1));
        bind_params.push(min_duration.to_string());
    }
    if let Some(max_duration) = filters.duration_max {
        conditions.push(format!("CAST((julianday(COALESCE(m.end_time, datetime('now'))) - julianday(m.start_time)) * 24 * 60 AS INTEGER) <= ?{}", bind_params.len() + 1));
        bind_params.push(max_duration.to_string());
    }

    // Participants filter - improved JSON matching
    if !filters.participants.is_empty() {
        let mut participant_conditions = Vec::new();
        for participant in &filters.participants {
            participant_conditions.push(format!("json_extract(m.participants, '$') LIKE ?{}", bind_params.len() + 1));
            bind_params.push(format!("%\"{}\":%", participant));
        }
        conditions.push(format!("({})", participant_conditions.join(" OR ")));
    }

    // Tags filter - improved JSON matching
    if !filters.tags.is_empty() {
        let mut tag_conditions = Vec::new();
        for tag in &filters.tags {
            tag_conditions.push(format!("json_extract(m.tags, '$') LIKE ?{}", bind_params.len() + 1));
            bind_params.push(format!("%\"{}\":%", tag));
        }
        conditions.push(format!("({})", tag_conditions.join(" OR ")));
    }

    let where_clause = if conditions.is_empty() {
        "WHERE 1=1".to_string()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Improved query with proper FTS integration
    let sql = format!(
        r#"
        SELECT DISTINCT
            'meeting' as match_type,
            m.id as meeting_id,
            m.title as meeting_title,
            m.participants,
            m.tags,
            m.start_time,
            m.end_time,
            CAST((julianday(COALESCE(m.end_time, datetime('now'))) - julianday(m.start_time)) * 24 * 60 AS INTEGER) as duration_minutes,
            COALESCE(mfts.rank, 1.0) as relevance_score,
            COALESCE(SUBSTR(m.description, 1, 200), '') as snippet,
            '' as highlight_positions,
            0 as transcription_id
        FROM meetings m
        LEFT JOIN meetings_fts mfts ON m.id = mfts.rowid
        {}
        
        UNION ALL
        
        SELECT DISTINCT
            'transcription' as match_type,
            t.meeting_id,
            m.title as meeting_title,
            m.participants,
            m.tags,
            m.start_time,
            m.end_time,
            CAST((julianday(COALESCE(m.end_time, datetime('now'))) - julianday(m.start_time)) * 24 * 60 AS INTEGER) as duration_minutes,
            COALESCE(tfts.rank * t.confidence, t.confidence) as relevance_score,
            SUBSTR(t.content, 1, 200) as snippet,
            '' as highlight_positions,
            t.id as transcription_id
        FROM transcriptions t
        JOIN meetings m ON t.meeting_id = m.id
        LEFT JOIN transcriptions_fts tfts ON t.id = tfts.rowid
        {}
        
        ORDER BY relevance_score DESC, meeting_title ASC
        LIMIT ?{} OFFSET ?{}
        "#,
        where_clause, where_clause, bind_params.len() + 1, bind_params.len() + 2
    );

    // Build query with proper parameter binding
    let mut query = sqlx::query(&sql);
    
    // Bind all parameters
    for param in &bind_params {
        query = query.bind(param);
    }
    
    // Add the same parameters again for the second part of UNION
    for param in &bind_params {
        query = query.bind(param);
    }
    
    // Add limit and offset
    query = query.bind(limit as i64).bind(offset as i64);

    let rows = query.fetch_all(&self.pool).await?;

    let mut results = Vec::new();
    for row in rows {
        let participants: Vec<String> = if let Ok(participants_json) = row.try_get::<String, _>("participants") {
            serde_json::from_str(&participants_json).unwrap_or_default()
        } else {
            Vec::new()
        };

        let tags: Vec<String> = if let Ok(tags_json) = row.try_get::<String, _>("tags") {
            serde_json::from_str(&tags_json).unwrap_or_default()
        } else {
            Vec::new()
        };

        results.push(SearchResult {
            meeting_id: row.get("meeting_id"),
            meeting_title: row.get("meeting_title"),
            participants,
            tags,
            start_time: row.get("start_time"),
            end_time: row.get("end_time"),
            duration_minutes: row.get("duration_minutes"),
            relevance_score: row.get("relevance_score"),
            snippet: row.get("snippet"),
            highlight_positions: Vec::new(), // TODO: Implement highlighting
            match_type: SearchMatchType::from_str(&row.get::<String, _>("match_type")),
            transcription_id: if row.get::<i64, _>("transcription_id") > 0 {
                Some(row.get("transcription_id"))
            } else {
                None
            },
        });
    }

    let elapsed = start_time.elapsed();
    println!("Search completed in {}ms", elapsed.as_millis());
    
    Ok(results)
}

    /// Search within a specific meeting's transcriptions
    pub async fn search_within_meeting(
        &self,
        meeting_id: i64,
        query: &str,
    ) -> Result<Vec<InMeetingMatch>> {
        let start_time = Instant::now();

        let sql = r#"
            SELECT 
                t.id,
                t.content,
                t.start_timestamp,
                t.end_timestamp,
                t.confidence,
                t.chunk_id,
                '' as speaker,  -- TODO: Extract from metadata
                highlight(transcriptions_fts, 0, '<mark>', '</mark>') as highlighted_content,
                offsets(transcriptions_fts) as match_positions
            FROM transcriptions t
            JOIN transcriptions_fts tfts ON t.id = tfts.rowid
            WHERE t.meeting_id = ? AND transcriptions_fts MATCH ?
            ORDER BY t.start_timestamp ASC
        "#;

        let rows = sqlx::query(sql)
            .bind(meeting_id)
            .bind(query)
            .fetch_all(&self.pool)
            .await?;

        let mut results = Vec::new();
        for row in rows {
            // Find query position in content
            let content: String = row.get("content");
            let position = content.to_lowercase().find(&query.to_lowercase()).unwrap_or(0);

            results.push(InMeetingMatch {
                transcription_id: row.get("id"),
                content,
                position,
                timestamp: row.get::<Option<i64>, _>("start_timestamp").unwrap_or(0),
                confidence: row.get("confidence"),
                segment_id: row.get::<Option<i64>, _>("chunk_id"),
                speaker: row.get::<String, _>("speaker").into(),
                match_type: "content".to_string(),
            });
        }

        let execution_time = start_time.elapsed().as_millis() as i64;
        self.record_search_performance("meeting", query.len(), results.len(), execution_time).await?;

        Ok(results)
    }

    /// Get search suggestions for autocomplete
    pub async fn get_search_suggestions(
        &self,
        partial_query: &str,
        suggestion_type: SuggestionType,
        limit: usize,
    ) -> Result<Vec<SearchSuggestion>> {
        let table_column = match suggestion_type {
            SuggestionType::Participant => ("meetings", "participants"),
            SuggestionType::Tag => ("meetings", "tags"),
            SuggestionType::Title => ("meetings", "title"),
            SuggestionType::Content => ("transcriptions", "content"),
            SuggestionType::RecentQuery => ("search_history", "query"),
            SuggestionType::PopularTerm => ("search_analytics", "term"),
            SuggestionType::MeetingTitle => ("meetings", "title"),
        };

        let sql = match suggestion_type {
            SuggestionType::Participant => {
                r#"
                SELECT DISTINCT
                    json_each.value as suggestion,
                    'participant' as type,
                    COUNT(*) as frequency
                FROM meetings m, json_each(m.participants)
                WHERE m.participants IS NOT NULL 
                  AND json_each.value LIKE ?
                GROUP BY json_each.value
                ORDER BY frequency DESC
                LIMIT ?
                "#
            }
            SuggestionType::Tag => {
                r#"
                SELECT DISTINCT
                    json_each.value as suggestion,
                    'tag' as type,
                    COUNT(*) as frequency
                FROM meetings m, json_each(m.tags)
                WHERE m.tags IS NOT NULL 
                  AND json_each.value LIKE ?
                GROUP BY json_each.value
                ORDER BY frequency DESC
                LIMIT ?
                "#
            }
            SuggestionType::Title => {
                r#"
                SELECT DISTINCT
                    title as suggestion,
                    'title' as type,
                    1 as frequency
                FROM meetings
                WHERE title LIKE ?
                ORDER BY title ASC
                LIMIT ?
                "#
            }
            SuggestionType::Content => {
                r#"
                SELECT DISTINCT
                    suggestion,
                    'query' as type,
                    frequency
                FROM search_suggestions
                WHERE suggestion LIKE ? AND category = 'query'
                ORDER BY frequency DESC
                LIMIT ?
                "#
            }
            SuggestionType::RecentQuery => {
                r#"
                SELECT DISTINCT
                    query as suggestion,
                    'recent_query' as type,
                    1 as frequency
                FROM search_history
                WHERE query LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
                "#
            }
            SuggestionType::PopularTerm => {
                r#"
                SELECT DISTINCT
                    term as suggestion,
                    'popular_term' as type,
                    usage_count as frequency
                FROM search_analytics
                WHERE term LIKE ?
                ORDER BY usage_count DESC
                LIMIT ?
                "#
            }
            SuggestionType::MeetingTitle => {
                r#"
                SELECT DISTINCT
                    title as suggestion,
                    'meeting_title' as type,
                    1 as frequency
                FROM meetings
                WHERE title LIKE ?
                ORDER BY title ASC
                LIMIT ?
                "#
            }
        };

        let rows = sqlx::query(sql)
            .bind(format!("%{}%", partial_query))
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await?;

        let mut suggestions = Vec::new();
        for row in rows {
            suggestions.push(SearchSuggestion {
                text: row.get("suggestion"),
                type_: row.get("type"),
                frequency: row.get::<i64, _>("frequency") as u32,
                context: None,
            });
        }

        Ok(suggestions)
    }

    /// Save a search query for later use
    pub async fn save_search_query(
        &self,
        name: &str,
        query: &SearchQuery,
    ) -> Result<SavedSearch> {
        let filters_json = serde_json::to_string(&query.filters)?;
        
        let sql = r#"
            INSERT INTO saved_searches (name, query, filters, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        "#;

        let result = sqlx::query(sql)
            .bind(name)
            .bind(&query.query)
            .bind(filters_json)
            .execute(&self.pool)
            .await?;

        let id = result.last_insert_rowid().to_string();
        
        Ok(SavedSearch {
            id,
            name: name.to_string(),
            query: query.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            last_used_at: chrono::Utc::now().to_rfc3339(),
            usage_count: 1,
        })
    }

    /// Get all saved searches
    pub async fn get_saved_searches(&self) -> Result<Vec<SavedSearch>> {
        let sql = r#"
            SELECT id, name, query, filters, usage_count, 
                   COALESCE(last_used, created_at) as last_used_at,
                   created_at
            FROM saved_searches
            ORDER BY COALESCE(last_used, created_at) DESC
        "#;

        let rows = sqlx::query(sql).fetch_all(&self.pool).await?;

        let mut saved_searches = Vec::new();
        for row in rows {
            let filters_json: String = row.get("filters");
            let filters: SearchFilters = serde_json::from_str(&filters_json)?;

            saved_searches.push(SavedSearch {
                id: row.get::<i64, _>("id").to_string(),
                name: row.get("name"),
                query: SearchQuery {
                    query: row.get("query"),
                    filters,
                    limit: None,
                    offset: None,
                    include_highlights: false,
                },
                created_at: row.get("created_at"),
                last_used_at: row.get("last_used_at"),
                usage_count: row.get::<i64, _>("usage_count") as u32,
            });
        }

        Ok(saved_searches)
    }

    /// Delete a saved search
    pub async fn delete_saved_search(&self, search_id: &str) -> Result<()> {
        let sql = "DELETE FROM saved_searches WHERE id = ?";
        
        sqlx::query(sql)
            .bind(search_id.parse::<i64>()?)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Update saved search usage
    pub async fn update_saved_search_usage(&self, search_id: &str) -> Result<()> {
        let sql = r#"
            UPDATE saved_searches 
            SET usage_count = usage_count + 1,
                last_used = CURRENT_TIMESTAMP
            WHERE id = ?
        "#;

        sqlx::query(sql)
            .bind(search_id.parse::<i64>()?)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Record search in history
    pub async fn record_search_history(
        &self,
        query: &str,
        filters: &SearchFilters,
        result_count: usize,
        response_time_ms: i64,
    ) -> Result<()> {
        let filters_json = serde_json::to_string(filters)?;
        
        let sql = r#"
            INSERT INTO search_history 
            (query, filters, results_count, response_time_ms, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#;

        sqlx::query(sql)
            .bind(query)
            .bind(filters_json)
            .bind(result_count as i64)
            .bind(response_time_ms)
            .execute(&self.pool)
            .await?;

        // Update search suggestions
        self.update_search_suggestions(query).await?;

        Ok(())
    }

    /// Get search history
    pub async fn get_search_history(&self, limit: usize) -> Result<Vec<SearchHistoryEntry>> {
        let sql = r#"
            SELECT id, query, results_count, created_at
            FROM search_history
            ORDER BY created_at DESC
            LIMIT ?
        "#;

        let rows = sqlx::query(sql)
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await?;

        let mut history = Vec::new();
        for row in rows {
            history.push(SearchHistoryEntry {
                id: row.get::<i64, _>("id").to_string(),
                query: row.get("query"),
                result_count: Some(row.get::<i64, _>("results_count") as u32),
                searched_at: row.get("created_at"),
            });
        }

        Ok(history)
    }

    /// Clear search history
    pub async fn clear_search_history(&self) -> Result<()> {
        let sql = "DELETE FROM search_history";
        sqlx::query(sql).execute(&self.pool).await?;
        Ok(())
    }

    /// Get available filter values for UI
    pub async fn get_filter_values(&self) -> Result<FilterValues> {
        // Get participants
        let participants_sql = r#"
            SELECT DISTINCT json_each.value as participant
            FROM meetings m, json_each(m.participants)
            WHERE m.participants IS NOT NULL
            ORDER BY participant ASC
            LIMIT 100
        "#;

        let participant_rows = sqlx::query(participants_sql).fetch_all(&self.pool).await?;
        let participants: Vec<String> = participant_rows
            .into_iter()
            .map(|row| row.get("participant"))
            .collect();

        // Get tags
        let tags_sql = r#"
            SELECT DISTINCT json_each.value as tag
            FROM meetings m, json_each(m.tags)
            WHERE m.tags IS NOT NULL
            ORDER BY tag ASC
            LIMIT 50
        "#;

        let tag_rows = sqlx::query(tags_sql).fetch_all(&self.pool).await?;
        let tags: Vec<String> = tag_rows
            .into_iter()
            .map(|row| row.get("tag"))
            .collect();

        Ok(FilterValues {
            participants,
            tags,
            meeting_types: vec![], // TODO: Implement meeting types
        })
    }

    /// Rebuild search indexes
    pub async fn rebuild_search_indexes(&self) -> Result<()> {
        // Rebuild FTS indexes
        sqlx::query("INSERT INTO meetings_fts(meetings_fts) VALUES('rebuild')")
            .execute(&self.pool)
            .await?;

        sqlx::query("INSERT INTO transcriptions_fts(transcriptions_fts) VALUES('rebuild')")
            .execute(&self.pool)
            .await?;

        // Optimize FTS indexes
        sqlx::query("INSERT INTO meetings_fts(meetings_fts) VALUES('optimize')")
            .execute(&self.pool)
            .await?;

        sqlx::query("INSERT INTO transcriptions_fts(transcriptions_fts) VALUES('optimize')")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Record search performance metrics
    async fn record_search_performance(
        &self,
        query_type: &str,
        query_length: usize,
        result_count: usize,
        execution_time_ms: i64,
    ) -> Result<()> {
        let sql = r#"
            INSERT INTO search_performance 
            (query_type, query_length, result_count, execution_time_ms, timestamp)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#;

        sqlx::query(sql)
            .bind(query_type)
            .bind(query_length as i64)
            .bind(result_count as i64)
            .bind(execution_time_ms)
            .execute(&self.pool)
            .await
            .ok(); // Don't fail on performance logging errors

        Ok(())
    }

    /// Update search suggestions based on queries
    async fn update_search_suggestions(&self, query: &str) -> Result<()> {
        if query.trim().is_empty() || query.len() < 3 {
            return Ok(());
        }

        let sql = r#"
            INSERT INTO search_suggestions (suggestion, category, frequency, last_used)
            VALUES (?, 'query', 1, CURRENT_TIMESTAMP)
            ON CONFLICT(suggestion) DO UPDATE SET
                frequency = frequency + 1,
                last_used = CURRENT_TIMESTAMP
        "#;

        sqlx::query(sql)
            .bind(query.trim())
            .execute(&self.pool)
            .await
            .ok(); // Don't fail on suggestion updates

        Ok(())
    }
}