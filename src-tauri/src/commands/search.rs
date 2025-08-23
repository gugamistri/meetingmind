use tauri::State;
use tracing::{debug, error, info};
use sqlx::Row;

use crate::search::{SearchService, SearchQuery, SearchFilters, SuggestionType};
use crate::search::types::{
    SearchResult as SearchResultType, 
    InMeetingMatch, 
    SearchSuggestion, 
    SavedSearchEntry, 
    SearchHistoryEntry,
    ExportFormat
};
use crate::storage::database::DatabasePool;

/// Search across all meeting content
#[tauri::command]
pub async fn search_meetings(
    query: String,
    filters: Option<SearchFilters>,
    limit: Option<usize>,
    offset: Option<usize>,
    include_highlights: Option<bool>,
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<SearchResultType>, String> {
    debug!("Search request: query='{}', limit={:?}", query, limit);

    let search_query = SearchQuery {
        query,
        filters: filters.unwrap_or_default(),
        limit,
        offset,
        include_highlights: include_highlights.unwrap_or(true),
    };

    // Use the actual database pool instead of memory database
    let search_service = SearchService::new(db_pool.inner().clone());
    
    match search_service.search_meetings(search_query).await {
        Ok(results) => {
            info!("Search completed successfully: {} results", results.len());
            Ok(results)
        }
        Err(e) => {
            error!("Search failed: {}", e);
            Err(format!("Search failed: {}", e))
        }
    }
}

/// Search within a specific meeting
#[tauri::command]
pub async fn search_within_meeting(
    meeting_id: i64,
    query: String,
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<InMeetingMatch>, String> {
    debug!("In-meeting search: meeting_id={}, query='{}'", meeting_id, query);

    let search_service = SearchService::new(db_pool.inner().clone());
    
    match search_service.search_within_meeting(meeting_id, &query).await {
        Ok(matches) => {
            info!("In-meeting search completed: {} matches", matches.len());
            Ok(matches)
        }
        Err(e) => {
            error!("In-meeting search failed: {}", e);
            Err(format!("In-meeting search failed: {}", e))
        }
    }
}

/// Get search suggestions for autocomplete
#[tauri::command]
pub async fn get_search_suggestions(
    partial_query: String,
    suggestion_type: String,
    limit: Option<usize>,
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<SearchSuggestion>, String> {
    debug!("Getting search suggestions: partial='{}', type='{}'", partial_query, suggestion_type);

    let suggestion_type = match suggestion_type.as_str() {
        "recent" => SuggestionType::RecentQuery,
        "popular" => SuggestionType::PopularTerm,
        "participant" => SuggestionType::Participant,
        "tag" => SuggestionType::Tag,
        "meeting_title" => SuggestionType::MeetingTitle,
        _ => SuggestionType::RecentQuery,
    };

    let search_service = SearchService::new(db_pool.inner().clone());
    let limit = limit.unwrap_or(10);
    
    match search_service.get_search_suggestions(&partial_query, suggestion_type, limit).await {
        Ok(suggestions) => {
            debug!("Generated {} suggestions", suggestions.len());
            Ok(suggestions)
        }
        Err(e) => {
            error!("Failed to get search suggestions: {}", e);
            Err(format!("Failed to get search suggestions: {}", e))
        }
    }
}

/// Save a search query for later use
#[tauri::command]
pub async fn save_search_query(
    name: String,
    query: String,
    filters: Option<SearchFilters>,
    description: Option<String>,
    db_pool: State<'_, DatabasePool>,
) -> Result<SavedSearchEntry, String> {
    debug!("Saving search query: name='{}'", name);

    let search_query = SearchQuery {
        query,
        filters: filters.unwrap_or_default(),
        limit: None,
        offset: None,
        include_highlights: true,
    };

    let search_service = SearchService::new(db_pool.inner().clone());
    
    match search_service.save_search(&name, &search_query, description.as_deref()).await {
        Ok(saved_search) => {
            info!("Search query saved successfully: {}", saved_search.id);
            Ok(saved_search)
        }
        Err(e) => {
            error!("Failed to save search query: {}", e);
            Err(format!("Failed to save search query: {}", e))
        }
    }
}

/// Get all saved searches
#[tauri::command]
pub async fn get_saved_searches(
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<SavedSearchEntry>, String> {
    debug!("Getting saved searches");

    let search_service = SearchService::new(db_pool.inner().clone());
    
    match search_service.get_saved_searches().await {
        Ok(saved_searches) => {
            debug!("Retrieved {} saved searches", saved_searches.len());
            Ok(saved_searches)
        }
        Err(e) => {
            error!("Failed to get saved searches: {}", e);
            Err(format!("Failed to get saved searches: {}", e))
        }
    }
}

/// Delete a saved search
#[tauri::command]
pub async fn delete_saved_search(
    search_id: i64,
    db_pool: State<'_, DatabasePool>,
) -> Result<(), String> {
    debug!("Deleting saved search: id={}", search_id);

    match sqlx::query("DELETE FROM saved_searches WHERE id = ?")
        .bind(search_id)
        .execute(db_pool.inner())
        .await 
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Saved search deleted successfully: id={}", search_id);
                Ok(())
            } else {
                Err("Saved search not found".to_string())
            }
        }
        Err(e) => {
            error!("Failed to delete saved search: {}", e);
            Err(format!("Failed to delete saved search: {}", e))
        }
    }
}

/// Update saved search usage count
#[tauri::command]
pub async fn use_saved_search(
    search_id: i64,
    db_pool: State<'_, DatabasePool>,
) -> Result<(), String> {
    debug!("Updating saved search usage: id={}", search_id);

    match sqlx::query("UPDATE saved_searches SET usage_count = usage_count + 1 WHERE id = ?")
        .bind(search_id)
        .execute(db_pool.inner())
        .await 
    {
        Ok(_) => {
            debug!("Saved search usage updated: id={}", search_id);
            Ok(())
        }
        Err(e) => {
            error!("Failed to update saved search usage: {}", e);
            Err(format!("Failed to update saved search usage: {}", e))
        }
    }
}

/// Get search history
#[tauri::command]
pub async fn get_search_history(
    limit: Option<usize>,
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<SearchHistoryEntry>, String> {
    debug!("Getting search history: limit={:?}", limit);

    let search_service = SearchService::new(db_pool.inner().clone());
    let limit = limit.unwrap_or(100);
    
    match search_service.get_search_history(limit).await {
        Ok(history) => {
            debug!("Retrieved {} search history entries", history.len());
            Ok(history)
        }
        Err(e) => {
            error!("Failed to get search history: {}", e);
            Err(format!("Failed to get search history: {}", e))
        }
    }
}

/// Clear search history
#[tauri::command]
pub async fn clear_search_history(
    db_pool: State<'_, DatabasePool>,
) -> Result<(), String> {
    debug!("Clearing search history");

    match sqlx::query("DELETE FROM search_history")
        .execute(db_pool.inner())
        .await 
    {
        Ok(result) => {
            info!("Search history cleared: {} entries removed", result.rows_affected());
            Ok(())
        }
        Err(e) => {
            error!("Failed to clear search history: {}", e);
            Err(format!("Failed to clear search history: {}", e))
        }
    }
}

/// Export search results
#[tauri::command]
pub async fn export_search_results(
    query: String,
    filters: Option<SearchFilters>,
    format: String,
    db_pool: State<'_, DatabasePool>,
) -> Result<String, String> {
    debug!("Exporting search results: query='{}', format='{}'", query, format);

    let export_format = match format.as_str() {
        "csv" => ExportFormat::Csv,
        "json" => ExportFormat::Json,
        "markdown" => ExportFormat::Markdown,
        "html" => ExportFormat::Html,
        _ => ExportFormat::Json,
    };

    let search_query = SearchQuery {
        query,
        filters: filters.unwrap_or_default(),
        limit: None, // Export all results
        offset: None,
        include_highlights: false, // Don't need highlights for export
    };

    let search_service = SearchService::new(db_pool.inner().clone());
    
    match search_service.search_meetings(search_query).await {
        Ok(results) => {
            match export_format {
                ExportFormat::Json => {
                    match serde_json::to_string_pretty(&results) {
                        Ok(json) => Ok(json),
                        Err(e) => Err(format!("Failed to serialize results to JSON: {}", e))
                    }
                }
                ExportFormat::Csv => {
                    export_results_to_csv(&results)
                }
                ExportFormat::Markdown => {
                    Ok(export_results_to_markdown(&results))
                }
                ExportFormat::Html => {
                    Ok(export_results_to_html(&results))
                }
            }
        }
        Err(e) => {
            error!("Failed to export search results: {}", e);
            Err(format!("Failed to export search results: {}", e))
        }
    }
}

/// Rebuild search indexes
#[tauri::command]
pub async fn rebuild_search_indexes(
    db_pool: State<'_, DatabasePool>,
) -> Result<(), String> {
    info!("Rebuilding search indexes");

    let indexer = crate::search::SearchIndexer::new(db_pool.inner().clone());
    
    match indexer.rebuild_indexes().await {
        Ok(_) => {
            info!("Search indexes rebuilt successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to rebuild search indexes: {}", e);
            Err(format!("Failed to rebuild search indexes: {}", e))
        }
    }
}

/// Helper function to export results to CSV format
fn export_results_to_csv(results: &[SearchResultType]) -> Result<String, String> {
    let mut csv = String::new();
    
    // Header
    csv.push_str("Meeting Title,Content Snippet,Relevance Score,Meeting Start Time\n");
    
    // Data rows
    for result in results {
        let escaped_title = escape_csv_field(&result.meeting_title);
        let escaped_snippet = escape_csv_field(&result.snippet);
        let start_time_str = result.start_time.as_deref().unwrap_or("N/A");
        
        csv.push_str(&format!(
            "{},{},{},{}\n",
            escaped_title,
            escaped_snippet,
            result.relevance_score,
            start_time_str
        ));
    }
    
    Ok(csv)
}

/// Helper function to export results to Markdown format
fn export_results_to_markdown(results: &[SearchResultType]) -> String {
    let mut md = String::new();
    
    md.push_str("# Search Results\n\n");
    
    for (i, result) in results.iter().enumerate() {
        md.push_str(&format!("## Result {} - {}\n\n", i + 1, result.meeting_title));
        md.push_str(&format!("**Relevance Score:** {:.2}\n\n", result.relevance_score));
        md.push_str(&format!("**Meeting Date:** {}\n\n", 
            result.start_time.as_deref().unwrap_or("Unknown")));
        md.push_str(&format!("**Content:**\n{}\n\n", result.snippet));
        md.push_str("---\n\n");
    }
    
    md
}

/// Helper function to export results to HTML format
fn export_results_to_html(results: &[SearchResultType]) -> String {
    let mut html = String::new();
    
    html.push_str("<!DOCTYPE html>\n<html>\n<head>\n");
    html.push_str("<title>Search Results</title>\n");
    html.push_str("<style>\n");
    html.push_str("body { font-family: Arial, sans-serif; margin: 20px; }\n");
    html.push_str(".result { border: 1px solid #ddd; margin: 10px 0; padding: 15px; }\n");
    html.push_str(".title { font-size: 1.2em; font-weight: bold; color: #333; }\n");
    html.push_str(".meta { color: #666; font-size: 0.9em; margin: 5px 0; }\n");
    html.push_str(".content { margin: 10px 0; line-height: 1.4; }\n");
    html.push_str("</style>\n");
    html.push_str("</head>\n<body>\n");
    html.push_str("<h1>Search Results</h1>\n");
    
    for (i, result) in results.iter().enumerate() {
        html.push_str(&format!("<div class=\"result\">\n"));
        html.push_str(&format!("<div class=\"title\">{}. {}</div>\n", i + 1, 
            html_escape(&result.meeting_title)));
        html.push_str(&format!("<div class=\"meta\">Relevance: {:.2} | Date: {}</div>\n",
            result.relevance_score,
            result.start_time.as_deref().unwrap_or("Unknown")));
        html.push_str(&format!("<div class=\"content\">{}</div>\n", 
            html_escape(&result.snippet)));
        html.push_str("</div>\n");
    }
    
    html.push_str("</body>\n</html>");
    html
}

/// Helper function to escape CSV fields
fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

/// Helper function to escape HTML content
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

/// Add tag to a meeting
#[tauri::command]
pub async fn add_meeting_tag(
    meeting_id: i64,
    tag: String,
    db_pool: State<'_, DatabasePool>,
) -> Result<(), String> {
    debug!("Adding tag '{}' to meeting {}", tag, meeting_id);

    // Get current tags
    let current_tags_query = "SELECT tags FROM meetings WHERE id = ?";
    let row = sqlx::query(current_tags_query)
        .bind(meeting_id)
        .fetch_optional(db_pool.inner())
        .await
        .map_err(|e| format!("Failed to fetch current tags: {}", e))?;

    let mut tags: Vec<String> = if let Some(row) = row {
        if let Ok(tags_json) = row.try_get::<String, _>("tags") {
            serde_json::from_str(&tags_json).unwrap_or_default()
        } else {
            Vec::new()
        }
    } else {
        return Err("Meeting not found".to_string());
    };

    // Add tag if not already present
    if !tags.contains(&tag) {
        tags.push(tag.clone());
        let tags_json = serde_json::to_string(&tags)
            .map_err(|e| format!("Failed to serialize tags: {}", e))?;

        // Update meeting with new tags
        let update_query = "UPDATE meetings SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        sqlx::query(update_query)
            .bind(tags_json)
            .bind(meeting_id)
            .execute(db_pool.inner())
            .await
            .map_err(|e| format!("Failed to update meeting tags: {}", e))?;

        info!("Tag '{}' added to meeting {}", tag, meeting_id);
    } else {
        debug!("Tag '{}' already exists on meeting {}", tag, meeting_id);
    }

    Ok(())
}

/// Remove tag from a meeting
#[tauri::command]
pub async fn remove_meeting_tag(
    meeting_id: i64,
    tag: String,
    db_pool: State<'_, DatabasePool>,
) -> Result<(), String> {
    debug!("Removing tag '{}' from meeting {}", tag, meeting_id);

    // Get current tags
    let current_tags_query = "SELECT tags FROM meetings WHERE id = ?";
    let row = sqlx::query(current_tags_query)
        .bind(meeting_id)
        .fetch_optional(db_pool.inner())
        .await
        .map_err(|e| format!("Failed to fetch current tags: {}", e))?;

    let mut tags: Vec<String> = if let Some(row) = row {
        if let Ok(tags_json) = row.try_get::<String, _>("tags") {
            serde_json::from_str(&tags_json).unwrap_or_default()
        } else {
            Vec::new()
        }
    } else {
        return Err("Meeting not found".to_string());
    };

    // Remove tag if present
    if let Some(pos) = tags.iter().position(|t| t == &tag) {
        tags.remove(pos);
        let tags_json = serde_json::to_string(&tags)
            .map_err(|e| format!("Failed to serialize tags: {}", e))?;

        // Update meeting with new tags
        let update_query = "UPDATE meetings SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        sqlx::query(update_query)
            .bind(tags_json)
            .bind(meeting_id)
            .execute(db_pool.inner())
            .await
            .map_err(|e| format!("Failed to update meeting tags: {}", e))?;

        info!("Tag '{}' removed from meeting {}", tag, meeting_id);
    } else {
        debug!("Tag '{}' not found on meeting {}", tag, meeting_id);
    }

    Ok(())
}

/// Get all available tags
#[tauri::command]
pub async fn get_all_tags(
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<String>, String> {
    debug!("Getting all available tags");

    let sql = r#"
        SELECT DISTINCT json_each.value as tag, COUNT(*) as usage_count
        FROM meetings m, json_each(m.tags)
        WHERE m.tags IS NOT NULL AND json_each.value != ''
        GROUP BY json_each.value
        ORDER BY usage_count DESC, tag ASC
    "#;

    let rows = sqlx::query(sql)
        .fetch_all(db_pool.inner())
        .await
        .map_err(|e| format!("Failed to fetch tags: {}", e))?;

    let tags: Vec<String> = rows
        .into_iter()
        .map(|row| row.get("tag"))
        .collect();

    debug!("Retrieved {} unique tags", tags.len());
    Ok(tags)
}

/// Get tags for a specific meeting
#[tauri::command]
pub async fn get_meeting_tags(
    meeting_id: i64,
    db_pool: State<'_, DatabasePool>,
) -> Result<Vec<String>, String> {
    debug!("Getting tags for meeting {}", meeting_id);

    let sql = "SELECT tags FROM meetings WHERE id = ?";
    let row = sqlx::query(sql)
        .bind(meeting_id)
        .fetch_optional(db_pool.inner())
        .await
        .map_err(|e| format!("Failed to fetch meeting tags: {}", e))?;

    let tags: Vec<String> = if let Some(row) = row {
        if let Ok(tags_json) = row.try_get::<String, _>("tags") {
            serde_json::from_str(&tags_json).unwrap_or_default()
        } else {
            Vec::new()
        }
    } else {
        return Err("Meeting not found".to_string());
    };

    debug!("Retrieved {} tags for meeting {}", tags.len(), meeting_id);
    Ok(tags)
}