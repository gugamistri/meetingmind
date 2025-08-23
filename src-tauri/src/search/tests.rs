#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::types::{SearchQuery, SearchFilters, SearchMatchType, SearchConfig};
    
    #[test]
    fn test_search_config_default() {
        let config = SearchConfig::default();
        assert_eq!(config.max_results, 50);
        assert_eq!(config.search_timeout_ms, 100); // Verify 100ms requirement
        assert_eq!(config.min_query_length, 2);
        assert!(config.enable_stemming);
    }
    
    #[test]
    fn test_search_filters_default() {
        let filters = SearchFilters::default();
        assert!(filters.participants.is_empty());
        assert!(filters.tags.is_empty());
        assert!(filters.meeting_types.is_empty());
        assert!(filters.date_start.is_none());
        assert!(filters.date_end.is_none());
    }
    
    #[test]
    fn test_search_query_construction() {
        let filters = SearchFilters {
            participants: vec!["john@example.com".to_string()],
            tags: vec!["standup".to_string()],
            meeting_types: vec!["daily".to_string()],
            duration_min: Some(15),
            duration_max: Some(60),
            ..Default::default()
        };
        
        let query = SearchQuery {
            query: "test meeting".to_string(),
            filters,
            limit: Some(20),
            offset: Some(0),
            include_highlights: true,
        };
        
        assert_eq!(query.query, "test meeting");
        assert_eq!(query.limit, Some(20));
        assert_eq!(query.filters.participants, vec!["john@example.com"]);
        assert_eq!(query.filters.tags, vec!["standup"]);
        assert_eq!(query.filters.duration_min, Some(15));
    }
    
    #[test]
    fn test_search_match_type() {
        let title_match = SearchMatchType::Title;
        let content_match = SearchMatchType::Content;
        let participant_match = SearchMatchType::Participant;
        
        // Test that match types can be constructed and compared
        assert_ne!(title_match, content_match);
        assert_ne!(content_match, participant_match);
        assert_ne!(participant_match, title_match);
    }
    
    #[test]
    fn test_search_performance_config() {
        let config = SearchConfig::default();
        // Verify performance requirements are met
        assert!(config.search_timeout_ms <= 100, "Search timeout must be <= 100ms for performance requirement");
        assert!(config.max_results <= 100, "Max results should be reasonable for performance");
        assert!(config.snippet_length <= 200, "Snippet length should be reasonable for performance");
    }
}