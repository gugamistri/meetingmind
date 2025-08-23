/**
 * Search service for frontend-backend communication
 * 
 * This service provides a typed interface for calling search-related Tauri commands.
 */

import { invoke } from '@tauri-apps/api/core';
import {
  SearchFilters,
  SearchResult,
  InMeetingMatch,
  SearchSuggestion,
  SavedSearchEntry,
  SearchHistoryEntry,
  ExportFormat,
} from '../types/search.types';

export class SearchService {
  /**
   * Search across all meeting content
   */
  async searchMeetings(
    query: string,
    filters?: SearchFilters,
    limit?: number,
    offset?: number,
    includeHighlights = true
  ): Promise<SearchResult[]> {
    return await invoke<SearchResult[]>('search_meetings', {
      query,
      filters: filters || {},
      limit,
      offset,
      includeHighlights,
    });
  }

  /**
   * Search within a specific meeting
   */
  async searchWithinMeeting(
    meetingId: number,
    query: string
  ): Promise<InMeetingMatch[]> {
    return await invoke<InMeetingMatch[]>('search_within_meeting', {
      meetingId,
      query,
    });
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(
    partialQuery: string,
    suggestionType: string,
    limit = 10
  ): Promise<SearchSuggestion[]> {
    return await invoke<SearchSuggestion[]>('get_search_suggestions', {
      partialQuery,
      suggestionType,
      limit,
    });
  }

  /**
   * Save a search query for later use
   */
  async saveSearchQuery(
    name: string,
    query: string,
    filters?: SearchFilters,
    description?: string
  ): Promise<SavedSearchEntry> {
    return await invoke<SavedSearchEntry>('save_search_query', {
      name,
      query,
      filters: filters || {},
      description,
    });
  }

  /**
   * Get all saved searches
   */
  async getSavedSearches(): Promise<SavedSearchEntry[]> {
    return await invoke<SavedSearchEntry[]>('get_saved_searches');
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId: number): Promise<void> {
    await invoke('delete_saved_search', { searchId });
  }

  /**
   * Update saved search usage count
   */
  async useSavedSearch(searchId: number): Promise<void> {
    await invoke('use_saved_search', { searchId });
  }

  /**
   * Get search history
   */
  async getSearchHistory(limit = 100): Promise<SearchHistoryEntry[]> {
    return await invoke<SearchHistoryEntry[]>('get_search_history', { limit });
  }

  /**
   * Clear search history
   */
  async clearSearchHistory(): Promise<void> {
    await invoke('clear_search_history');
  }

  /**
   * Export search results
   */
  async exportSearchResults(
    query: string,
    filters: SearchFilters,
    format: ExportFormat
  ): Promise<string> {
    return await invoke<string>('export_search_results', {
      query,
      filters,
      format,
    });
  }

  /**
   * Rebuild search indexes
   */
  async rebuildSearchIndexes(): Promise<void> {
    await invoke('rebuild_search_indexes');
  }
}

// Error handling for search operations
export class SearchServiceError extends Error {
  constructor(
    public readonly operation: string,
    public readonly originalError: any,
    message?: string
  ) {
    super(message || `Search operation '${operation}' failed: ${originalError}`);
    this.name = 'SearchServiceError';
  }
}

/**
 * Wrapper for search operations with error handling
 */
export async function safeSearchInvoke<T>(
  operation: string,
  invokeFunction: () => Promise<T>
): Promise<T | null> {
  try {
    return await invokeFunction();
  } catch (error) {
    console.error(`Search operation '${operation}' failed:`, error);
    throw new SearchServiceError(operation, error);
  }
}

// Singleton instance
export const searchService = new SearchService();

export default searchService;