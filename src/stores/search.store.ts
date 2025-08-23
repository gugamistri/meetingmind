/**
 * Search store using Zustand for state management
 * 
 * Manages search state, results, history, and UI interactions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { searchService } from '../services/search.service';
import {
  SearchState,
  SearchFilters,
  SearchResult,
  SearchSuggestion,
  SavedSearchEntry,
  SearchHistoryEntry,
  InMeetingMatch,
  SuggestionType,
} from '../types/search.types';

interface SearchStore extends SearchState {
  // Actions
  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  setResults: (results: SearchResult[]) => void;
  setSuggestions: (suggestions: SearchSuggestion[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;
  clearSearch: () => void;
  
  // Search operations
  performSearch: (options?: { page?: number; limit?: number }) => Promise<void>;
  searchWithinMeeting: (meetingId: number, query: string) => Promise<InMeetingMatch[]>;
  getSuggestions: (partialQuery: string, type?: SuggestionType) => Promise<void>;
  
  // Pagination
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
  
  // Saved searches
  savedSearches: SavedSearchEntry[];
  setSavedSearches: (searches: SavedSearchEntry[]) => void;
  loadSavedSearches: () => Promise<void>;
  saveCurrentSearch: (name: string, description?: string) => Promise<void>;
  deleteSavedSearch: (searchId: number) => Promise<void>;
  useSavedSearch: (search: SavedSearchEntry) => Promise<void>;
  
  // Search history
  searchHistory: SearchHistoryEntry[];
  setSearchHistory: (history: SearchHistoryEntry[]) => void;
  loadSearchHistory: () => Promise<void>;
  clearSearchHistory: () => Promise<void>;
}

const initialState: SearchState = {
  query: '',
  filters: {
    participants: [],
    tags: [],
    meeting_types: [],
    languages: [],
    models: [],
    meeting_ids: [],
    session_ids: [],
  },
  results: [],
  suggestions: [],
  isLoading: false,
  hasSearched: false,
  totalResults: 0,
  currentPage: 1,
  itemsPerPage: 20,
};

export const useSearchStore = create<SearchStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      savedSearches: [],
      searchHistory: [],

      // Basic state setters
      setQuery: (query: string) => {
        set({ query }, false, 'setQuery');
      },

      setFilters: (filters: SearchFilters) => {
        set({ filters }, false, 'setFilters');
      },

      setResults: (results: SearchResult[]) => {
        set({ 
          results, 
          totalResults: results.length, 
          hasSearched: true 
        }, false, 'setResults');
      },

      setSuggestions: (suggestions: SearchSuggestion[]) => {
        set({ suggestions }, false, 'setSuggestions');
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading }, false, 'setLoading');
      },

      setError: (error: string | undefined) => {
        if (error) {
          set({ error }, false, 'setError');
        } else {
          set((state) => {
            const { error: _error, ...rest } = state;
            return rest;
          }, false, 'clearError');
        }
      },

      clearSearch: () => {
        set((state) => {
          const { error: _error, ...rest } = state;
          return {
            ...rest,
            query: '',
            filters: {
              participants: [],
              tags: [],
              meeting_types: [],
              languages: [],
              models: [],
              meeting_ids: [],
              session_ids: [],
            },
            results: [],
            suggestions: [],
            hasSearched: false,
            totalResults: 0,
            currentPage: 1,
          };
        }, false, 'clearSearch');
      },

      // Search operations
      performSearch: async (options = {}) => {
        const { query, filters, itemsPerPage } = get();
        const { page = 1, limit = itemsPerPage } = options;
        
        if (!query.trim()) {
          set({ error: 'Please enter a search query' }, false, 'performSearch:emptyQuery');
          return;
        }

        set((state) => {
          const { error: _error, ...rest } = state;
          return { ...rest, isLoading: true };
        }, false, 'performSearch:start');

        try {
          const offset = (page - 1) * limit;
          const results = await searchService.searchMeetings(
            query,
            filters,
            limit,
            offset,
            true // include highlights
          );

          set({
            results,
            totalResults: results.length,
            currentPage: page,
            hasSearched: true,
            isLoading: false,
          }, false, 'performSearch:success');

        } catch (error) {
          console.error('Search failed:', error);
          set({
            error: error instanceof Error ? error.message : 'Search failed',
            isLoading: false,
            results: [],
            totalResults: 0,
          }, false, 'performSearch:error');
        }
      },

      searchWithinMeeting: async (meetingId: number, query: string) => {
        set((state) => {
          const { error: _error, ...rest } = state;
          return { ...rest, isLoading: true };
        }, false, 'searchWithinMeeting:start');

        try {
          const matches = await searchService.searchWithinMeeting(meetingId, query);
          set({ isLoading: false }, false, 'searchWithinMeeting:success');
          return matches;
        } catch (error) {
          console.error('In-meeting search failed:', error);
          set({
            error: error instanceof Error ? error.message : 'In-meeting search failed',
            isLoading: false,
          }, false, 'searchWithinMeeting:error');
          return [];
        }
      },

      getSuggestions: async (partialQuery: string, type: SuggestionType = 'RecentQuery') => {
        if (!partialQuery.trim()) {
          set({ suggestions: [] }, false, 'getSuggestions:empty');
          return;
        }

        try {
          const suggestions = await searchService.getSearchSuggestions(
            partialQuery,
            type,
            10
          );
          set({ suggestions }, false, 'getSuggestions:success');
        } catch (error) {
          console.error('Failed to get suggestions:', error);
          set({ suggestions: [] }, false, 'getSuggestions:error');
        }
      },

      // Pagination
      setCurrentPage: (currentPage: number) => {
        set({ currentPage }, false, 'setCurrentPage');
      },

      setItemsPerPage: (itemsPerPage: number) => {
        set({ itemsPerPage, currentPage: 1 }, false, 'setItemsPerPage');
      },

      // Saved searches
      setSavedSearches: (savedSearches: SavedSearchEntry[]) => {
        set({ savedSearches }, false, 'setSavedSearches');
      },

      loadSavedSearches: async () => {
        try {
          const savedSearches = await searchService.getSavedSearches();
          set({ savedSearches }, false, 'loadSavedSearches:success');
        } catch (error) {
          console.error('Failed to load saved searches:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load saved searches' 
          }, false, 'loadSavedSearches:error');
        }
      },

      saveCurrentSearch: async (name: string, description?: string) => {
        const { query, filters } = get();
        
        try {
          const savedSearch = await searchService.saveSearchQuery(
            name,
            query,
            filters,
            description
          );
          
          const { savedSearches } = get();
          set({ 
            savedSearches: [savedSearch, ...savedSearches] 
          }, false, 'saveCurrentSearch:success');
          
        } catch (error) {
          console.error('Failed to save search:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to save search' 
          }, false, 'saveCurrentSearch:error');
        }
      },

      deleteSavedSearch: async (searchId: number) => {
        try {
          await searchService.deleteSavedSearch(searchId);
          
          const { savedSearches } = get();
          set({ 
            savedSearches: savedSearches.filter(s => s.id !== searchId) 
          }, false, 'deleteSavedSearch:success');
          
        } catch (error) {
          console.error('Failed to delete saved search:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete saved search' 
          }, false, 'deleteSavedSearch:error');
        }
      },

      useSavedSearch: async (search: SavedSearchEntry) => {
        try {
          await searchService.useSavedSearch(search.id);
          
          // Parse filters from JSON string if present
          let parsedFilters: SearchFilters = {
            participants: [],
            tags: [],
            meeting_types: [],
            languages: [],
            models: [],
            meeting_ids: [],
            session_ids: [],
          };
          if (search.filters) {
            try {
              parsedFilters = JSON.parse(search.filters);
            } catch (e) {
              console.warn('Failed to parse saved search filters:', e);
            }
          }
          
          set({
            query: search.query,
            filters: parsedFilters,
          }, false, 'useSavedSearch:success');
          
          // Perform the search
          await get().performSearch();
          
        } catch (error) {
          console.error('Failed to use saved search:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to use saved search' 
          }, false, 'useSavedSearch:error');
        }
      },

      // Search history
      setSearchHistory: (searchHistory: SearchHistoryEntry[]) => {
        set({ searchHistory }, false, 'setSearchHistory');
      },

      loadSearchHistory: async () => {
        try {
          const searchHistory = await searchService.getSearchHistory(50);
          set({ searchHistory }, false, 'loadSearchHistory:success');
        } catch (error) {
          console.error('Failed to load search history:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load search history' 
          }, false, 'loadSearchHistory:error');
        }
      },

      clearSearchHistory: async () => {
        try {
          await searchService.clearSearchHistory();
          set({ searchHistory: [] }, false, 'clearSearchHistory:success');
        } catch (error) {
          console.error('Failed to clear search history:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to clear search history' 
          }, false, 'clearSearchHistory:error');
        }
      },
    }),
    { name: 'search-store' }
  )
);

// Convenience hooks for specific parts of the store
export const useSearch = () => {
  const store = useSearchStore();
  return {
    query: store.query,
    filters: store.filters,
    results: store.results,
    suggestions: store.suggestions,
    isLoading: store.isLoading,
    hasSearched: store.hasSearched,
    error: store.error,
    totalResults: store.totalResults,
    currentPage: store.currentPage,
    itemsPerPage: store.itemsPerPage,
    setQuery: store.setQuery,
    setFilters: store.setFilters,
    performSearch: store.performSearch,
    getSuggestions: store.getSuggestions,
    clearSearch: store.clearSearch,
  };
};

export const useSearchActions = () => {
  const store = useSearchStore();
  return {
    performSearch: store.performSearch,
    searchWithinMeeting: store.searchWithinMeeting,
    getSuggestions: store.getSuggestions,
    setCurrentPage: store.setCurrentPage,
    setItemsPerPage: store.setItemsPerPage,
    clearSearch: store.clearSearch,
  };
};

export const useSavedSearches = () => {
  const store = useSearchStore();
  return {
    savedSearches: store.savedSearches,
    loadSavedSearches: store.loadSavedSearches,
    saveCurrentSearch: store.saveCurrentSearch,
    deleteSavedSearch: store.deleteSavedSearch,
    useSavedSearch: store.useSavedSearch,
  };
};

export const useSearchHistory = () => {
  const store = useSearchStore();
  return {
    searchHistory: store.searchHistory,
    loadSearchHistory: store.loadSearchHistory,
    clearSearchHistory: store.clearSearchHistory,
  };
};