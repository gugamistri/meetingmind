/**
 * Search Page Component
 * 
 * Main search interface combining search bar, filters, and results.
 */

import React, { useEffect, useState } from 'react';
import { GlobalSearchBar } from '../GlobalSearchBar';
import { AdvancedFilters } from '../AdvancedFilters';
import { SearchResults } from '../SearchResults';
import { useSearch, useSavedSearches, useSearchHistory } from '../../../stores/search.store';
import { SearchResult, SearchFilters } from '../../../types/search.types';
import clsx from 'clsx';

export interface SearchPageProps {
  className?: string;
  initialQuery?: string;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  className,
  initialQuery,
}) => {
  const { filters, setQuery, setFilters } = useSearch();
  const { loadSavedSearches } = useSavedSearches();
  const { loadSearchHistory } = useSearchHistory();
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Load initial data
  useEffect(() => {
    loadSavedSearches();
    loadSearchHistory();
    
    // TODO: Load available participants and tags from backend
    // This would typically call a service to get distinct participants and tags
    setAvailableParticipants(['john.doe@company.com', 'jane.smith@company.com', 'team@company.com']);
    setAvailableTags(['standup', 'planning', 'review', 'one-on-one', 'all-hands']);
  }, [loadSavedSearches, loadSearchHistory]);

  // Set initial query if provided
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery, setQuery]);

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    console.log('Result clicked:', result);
    // TODO: Navigate to meeting details or show detailed view
  };

  // Handle meeting view
  const handleMeetingView = (meetingId: number) => {
    console.log('View meeting:', meetingId);
    // TODO: Navigate to meeting details page
  };

  // Handle search
  const handleSearch = (query: string) => {
    console.log('Search performed:', query);
    // Search is already handled by the store
  };

  return (
    <div className={clsx('max-w-6xl mx-auto px-4 py-6', className)}>
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Search Meetings</h1>
        <p className="text-gray-600">
          Search through your meeting transcriptions, summaries, and metadata.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <GlobalSearchBar
          placeholder="Search meetings, participants, topics, or specific content..."
          onSearch={handleSearch}
          showFilters={true}
        />
      </div>

      {/* Advanced Filters */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Filters</h2>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showAdvancedFilters ? 'Hide Filters' : 'Show Advanced Filters'}
          </button>
        </div>
        
        {showAdvancedFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <AdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableParticipants={availableParticipants}
              availableTags={availableTags}
              isExpanded={showAdvancedFilters}
              onToggle={() => setShowAdvancedFilters(!showAdvancedFilters)}
            />
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="mb-8">
        <SearchResults
          onResultClick={handleResultClick}
          onMeetingView={handleMeetingView}
          showPagination={true}
        />
      </div>

      {/* Quick Tips */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Search Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Search Syntax</h4>
            <ul className="space-y-1">
              <li>• Use quotes for exact phrases: "project kickoff"</li>
              <li>• Search by participant: @john.doe</li>
              <li>• Search by date: after:2024-01-01</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Filter Options</h4>
            <ul className="space-y-1">
              <li>• Filter by date range, duration, or participants</li>
              <li>• Use tags to categorize your searches</li>
              <li>• Save frequently used searches</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;