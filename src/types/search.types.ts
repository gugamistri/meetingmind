/**
 * Search types for frontend-backend communication
 * These types must match the Rust backend types in src-tauri/src/search/types.rs
 */

export interface SearchQuery {
  query: string;
  filters: SearchFilters;
  limit?: number;
  offset?: number;
  include_highlights: boolean;
}

export interface SearchFilters {
  // Time-based filters
  date_start?: string; // ISO date string
  date_end?: string;   // ISO date string
  
  // Content filters
  participants: string[];
  tags: string[];
  meeting_types: string[];
  
  // Duration filters (in minutes)
  duration_min?: number;
  duration_max?: number;
  
  // Quality filters
  confidence_min?: number;
  confidence_max?: number;
  
  // Technical filters
  languages: string[];
  models: string[];
  processed_locally?: boolean;
  
  // Meeting-specific filters
  meeting_ids: number[];
  session_ids: string[];
}

export interface SearchResult {
  meeting_id: number;
  meeting_title: string;
  participants: string[];
  tags: string[];
  start_time?: string;
  end_time?: string;
  duration_minutes: number;
  relevance_score: number;
  snippet: string;
  highlight_positions: [number, number][];
  match_type: SearchMatchType;
  transcription_id?: number;
}

export interface SearchResultContext {
  meeting_start_time: string; // ISO date string
  meeting_duration?: number; // minutes
  participant_count: number;
  confidence: number;
  language: string;
  model_used: string;
  chunk_start_time: number;
  chunk_end_time: number;
}

export interface HighlightPosition {
  start: number;
  end: number;
  matched_term: string;
}

export interface InMeetingMatch {
  transcription_id: number;
  chunk_id: string;
  content: string;
  start_timestamp: number;
  end_timestamp: number;
  match_positions: HighlightPosition[];
  surrounding_context: string;
  relevance_score: number;
}

export interface SearchSuggestion {
  suggestion: string;
  suggestion_type: SuggestionType;
  frequency: number;
  last_used?: string; // ISO date string
}

export interface SavedSearchEntry {
  id: number;
  name: string;
  query: string;
  filters?: string; // JSON string
  description?: string;
  is_favorite: boolean;
  usage_count: number;
  last_used?: string; // ISO date string
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface SearchHistoryEntry {
  id: number;
  query: string;
  results_count: number;
  filters?: string; // JSON string
  response_time_ms: number;
  created_at: string; // ISO date string
}

export type SearchMatchType = 'Content' | 'Title' | 'Participant' | 'Tag';

export type SuggestionType = 'RecentQuery' | 'PopularTerm' | 'Participant' | 'Tag' | 'MeetingTitle';

export type ExportFormat = 'Json' | 'Csv' | 'Markdown' | 'Html';

// UI-specific types
export interface SearchState {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  isLoading: boolean;
  hasSearched: boolean;
  error?: string | undefined;
  totalResults: number;
  currentPage: number;
  itemsPerPage: number;
}

export interface SearchUIConfig {
  enableAutoSuggest: boolean;
  enableHighlights: boolean;
  debounceMs: number;
  maxSuggestions: number;
  resultsPerPage: number;
}