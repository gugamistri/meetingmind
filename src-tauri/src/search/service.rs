use sqlx::SqlitePool;
use tracing::{debug, info, warn};
use std::sync::Arc;

use crate::search::types::*;
use crate::storage::repositories::search::SearchRepository;
use crate::error::Result;

/// Enhanced search service with full functionality
#[derive(Debug, Clone)]
pub struct SearchService {
    pool: SqlitePool,
    config: SearchConfig,
    repository: Arc<SearchRepository>,
}

impl SearchService {
    /// Create a new search service instance
    pub fn new(pool: SqlitePool) -> Self {
        let repository = Arc::new(SearchRepository::new(pool.clone()));
        Self {
            pool,
            config: SearchConfig::default(),
            repository,
        }
    }

    /// Comprehensive search implementation
    pub async fn search_meetings(
        &self,
        query: SearchQuery,
    ) -> SearchServiceResult<Vec<SearchResult>> {
        debug!("Performing search for: {}", query.query);
        
        let limit = query.limit.unwrap_or(50);
        let offset = query.offset.unwrap_or(0);
        
        match self.repository.search_comprehensive(&query.query, &query.filters, limit, offset).await {
            Ok(results) => {
                info!("Search returned {} results", results.len());
                
                // Record search in history
                if let Err(e) = self.repository.record_search_history(&query.query, &query.filters, results.len(), 0).await {
                    warn!("Failed to record search history: {}", e);
                }
                
                Ok(results)
            }
            Err(e) => {
                warn!("Search failed: {}", e);
                Err(SearchError::SearchFailed(e.to_string()))
            }
        }
    }

    /// Search within a specific meeting
    pub async fn search_within_meeting(
        &self,
        meeting_id: i64,
        query: &str,
    ) -> SearchServiceResult<Vec<InMeetingMatch>> {
        debug!("Searching within meeting {}: {}", meeting_id, query);
        
        match self.repository.search_within_meeting(meeting_id, query).await {
            Ok(matches) => {
                info!("In-meeting search found {} matches", matches.len());
                Ok(matches)
            }
            Err(e) => {
                warn!("In-meeting search failed: {}", e);
                Err(SearchError::SearchFailed(e.to_string()))
            }
        }
    }

    /// Get search suggestions
    pub async fn get_search_suggestions(
        &self,
        partial_query: &str,
        suggestion_type: SuggestionType,
        limit: usize,
    ) -> SearchServiceResult<Vec<SearchSuggestion>> {
        debug!("Getting suggestions for: {}", partial_query);
        
        match self.repository.get_search_suggestions(partial_query, suggestion_type, limit).await {
            Ok(suggestions) => {
                debug!("Found {} suggestions", suggestions.len());
                Ok(suggestions)
            }
            Err(e) => {
                warn!("Failed to get suggestions: {}", e);
                Ok(Vec::new()) // Return empty suggestions on error
            }
        }
    }

    /// Save a search query
    pub async fn save_search(
        &self,
        name: &str,
        query: &SearchQuery,
        description: Option<&str>,
    ) -> SearchServiceResult<SavedSearchEntry> {
        debug!("Saving search: {}", name);
        
        match self.repository.save_search_query(name, query).await {
            Ok(saved_search) => {
                info!("Search saved with ID: {}", saved_search.id);
                Ok(SavedSearchEntry {
                    id: saved_search.id.parse().unwrap_or(0),
                    name: saved_search.name,
                    query: saved_search.query.query,
                    filters: Some(serde_json::to_string(&saved_search.query.filters).unwrap_or_default()),
                    description: description.map(|s| s.to_string()),
                    is_favorite: false,
                    usage_count: saved_search.usage_count as i64,
                    last_used: Some(chrono::DateTime::parse_from_rfc3339(&saved_search.last_used_at).unwrap().with_timezone(&chrono::Utc)),
                    created_at: chrono::DateTime::parse_from_rfc3339(&saved_search.created_at).unwrap().with_timezone(&chrono::Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&saved_search.last_used_at).unwrap().with_timezone(&chrono::Utc),
                })
            }
            Err(e) => {
                warn!("Failed to save search: {}", e);
                Err(SearchError::SaveFailed(e.to_string()))
            }
        }
    }

    /// Get saved searches
    pub async fn get_saved_searches(&self) -> SearchServiceResult<Vec<SavedSearchEntry>> {
        debug!("Getting saved searches");
        
        match self.repository.get_saved_searches().await {
            Ok(saved_searches) => {
                info!("Found {} saved searches", saved_searches.len());
                let entries = saved_searches.into_iter().map(|s| {
                    SavedSearchEntry {
                        id: s.id.parse().unwrap_or(0),
                        name: s.name,
                        query: s.query.query,
                        filters: Some(serde_json::to_string(&s.query.filters).unwrap_or_default()),
                        description: None,
                        is_favorite: false,
                        usage_count: s.usage_count as i64,
                        last_used: Some(chrono::DateTime::parse_from_rfc3339(&s.last_used_at).unwrap().with_timezone(&chrono::Utc)),
                        created_at: chrono::DateTime::parse_from_rfc3339(&s.created_at).unwrap().with_timezone(&chrono::Utc),
                        updated_at: chrono::DateTime::parse_from_rfc3339(&s.last_used_at).unwrap().with_timezone(&chrono::Utc),
                    }
                }).collect();
                Ok(entries)
            }
            Err(e) => {
                warn!("Failed to get saved searches: {}", e);
                Ok(Vec::new())
            }
        }
    }

    /// Get search history
    pub async fn get_search_history(&self, limit: usize) -> SearchServiceResult<Vec<SearchHistoryEntry>> {
        debug!("Getting search history, limit: {}", limit);
        
        match self.repository.get_search_history(limit).await {
            Ok(history) => {
                info!("Found {} history entries", history.len());
                Ok(history)
            }
            Err(e) => {
                warn!("Failed to get search history: {}", e);
                Ok(Vec::new())
            }
        }
    }

    /// Delete a saved search
    pub async fn delete_saved_search(&self, search_id: &str) -> SearchServiceResult<()> {
        debug!("Deleting saved search: {}", search_id);
        
        match self.repository.delete_saved_search(search_id).await {
            Ok(()) => {
                info!("Saved search deleted: {}", search_id);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to delete saved search: {}", e);
                Err(SearchError::DeleteFailed(e.to_string()))
            }
        }
    }

    /// Use a saved search (increments usage count)
    pub async fn use_saved_search(&self, search_id: &str) -> SearchServiceResult<SearchQuery> {
        debug!("Using saved search: {}", search_id);
        
        match self.repository.update_saved_search_usage(search_id).await {
            Ok(()) => {
                // Get the saved search details
                if let Ok(saved_searches) = self.repository.get_saved_searches().await {
                    if let Some(saved_search) = saved_searches.iter().find(|s| s.id == search_id) {
                        info!("Retrieved saved search: {}", saved_search.name);
                        return Ok(saved_search.query.clone());
                    }
                }
                Err(SearchError::NotFound("Saved search not found".to_string()))
            }
            Err(e) => {
                warn!("Failed to use saved search: {}", e);
                Err(SearchError::SearchFailed(e.to_string()))
            }
        }
    }

    /// Clear search history
    pub async fn clear_search_history(&self) -> SearchServiceResult<()> {
        debug!("Clearing search history");
        
        match self.repository.clear_search_history().await {
            Ok(()) => {
                info!("Search history cleared");
                Ok(())
            }
            Err(e) => {
                warn!("Failed to clear search history: {}", e);
                Err(SearchError::ClearFailed(e.to_string()))
            }
        }
    }

    /// Get available filter values for UI
    pub async fn get_filter_values(&self) -> SearchServiceResult<FilterValues> {
        debug!("Getting filter values");
        
        match self.repository.get_filter_values().await {
            Ok(values) => {
                info!("Retrieved {} participants, {} tags", values.participants.len(), values.tags.len());
                Ok(values)
            }
            Err(e) => {
                warn!("Failed to get filter values: {}", e);
                Ok(FilterValues {
                    participants: Vec::new(),
                    tags: Vec::new(),
                    meeting_types: Vec::new(),
                })
            }
        }
    }

    /// Rebuild search indexes for maintenance
    pub async fn rebuild_search_indexes(&self) -> SearchServiceResult<()> {
        debug!("Rebuilding search indexes");
        
        match self.repository.rebuild_search_indexes().await {
            Ok(()) => {
                info!("Search indexes rebuilt successfully");
                Ok(())
            }
            Err(e) => {
                warn!("Failed to rebuild search indexes: {}", e);
                Err(SearchError::IndexError(e.to_string()))
            }
        }
    }

    /// Export search results in various formats
    pub async fn export_search_results(
        &self,
        results: &[SearchResult],
        format: ExportFormat,
    ) -> SearchServiceResult<String> {
        debug!("Exporting {} search results as {:?}", results.len(), format);
        
        match format {
            ExportFormat::Csv => Ok(self.export_to_csv(results)),
            ExportFormat::Json => self.export_to_json(results),
            ExportFormat::Markdown => Ok(self.export_to_markdown(results)),
            ExportFormat::Html => Ok(self.export_to_html(results)),
        }
    }

    fn export_to_csv(&self, results: &[SearchResult]) -> String {
        let mut csv = String::new();
        csv.push_str("Title,Participants,Tags,Start Time,Duration (min),Snippet,Match Type\n");
        
        for result in results {
            csv.push_str(&format!(
                "{},{},{},{},{},{},{}\n",
                escape_csv_field(&result.meeting_title),
                escape_csv_field(&result.participants.join("; ")),
                escape_csv_field(&result.tags.join("; ")),
                result.start_time.as_deref().unwrap_or(""),
                result.duration_minutes,
                escape_csv_field(&result.snippet),
                format!("{:?}", result.match_type)
            ));
        }
        
        csv
    }

    fn export_to_json(&self, results: &[SearchResult]) -> SearchServiceResult<String> {
        serde_json::to_string_pretty(results)
            .map_err(|e| SearchError::ExportFailed(e.to_string()))
    }

    fn export_to_markdown(&self, results: &[SearchResult]) -> String {
        let mut md = String::new();
        md.push_str("# Search Results\n\n");
        
        for (i, result) in results.iter().enumerate() {
            md.push_str(&format!("## {}. {}\n\n", i + 1, result.meeting_title));
            
            if !result.participants.is_empty() {
                md.push_str(&format!("**Participants:** {}\n\n", result.participants.join(", ")));
            }
            
            if !result.tags.is_empty() {
                md.push_str(&format!("**Tags:** {}\n\n", result.tags.join(", ")));
            }
            
            if let Some(start_time) = &result.start_time {
                md.push_str(&format!("**Date:** {}\n\n", start_time));
            }
            
            md.push_str(&format!("**Duration:** {} minutes\n\n", result.duration_minutes));
            
            if !result.snippet.is_empty() {
                md.push_str(&format!("**Excerpt:** {}\n\n", result.snippet));
            }
            
            md.push_str("---\n\n");
        }
        
        md
    }

    fn export_to_html(&self, results: &[SearchResult]) -> String {
        let mut html = String::new();
        html.push_str("<!DOCTYPE html><html><head><title>Search Results</title>");
        html.push_str("<style>body{font-family:Arial,sans-serif;margin:20px;}");
        html.push_str(".result{margin-bottom:20px;padding:15px;border-left:3px solid #007acc;}");
        html.push_str(".title{font-size:18px;font-weight:bold;margin-bottom:10px;}");
        html.push_str(".meta{color:#666;margin-bottom:10px;}");
        html.push_str(".snippet{background:#f5f5f5;padding:10px;border-radius:4px;}");
        html.push_str("</style></head><body>");
        html.push_str("<h1>Search Results</h1>");
        
        for result in results {
            html.push_str("<div class='result'>");
            html.push_str(&format!("<div class='title'>{}</div>", html_escape(&result.meeting_title)));
            
            let mut meta_parts = Vec::new();
            if !result.participants.is_empty() {
                meta_parts.push(format!("Participants: {}", result.participants.join(", ")));
            }
            if let Some(start_time) = &result.start_time {
                meta_parts.push(format!("Date: {}", start_time));
            }
            meta_parts.push(format!("Duration: {} min", result.duration_minutes));
            
            if !meta_parts.is_empty() {
                html.push_str(&format!("<div class='meta'>{}</div>", meta_parts.join(" • ")));
            }
            
            if !result.snippet.is_empty() {
                html.push_str(&format!("<div class='snippet'>{}</div>", html_escape(&result.snippet)));
            }
            
            html.push_str("</div>");
        }
        
        html.push_str("</body></html>");
        html
    }
}

fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}