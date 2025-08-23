import React, { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/common/useDebounce';
import { searchService } from '@/services/search.service';
import { InMeetingMatch } from '@/types/search.types';
import { SearchHighlight } from './SearchHighlight';

interface InMeetingSearchProps {
  meetingId: string;
  onSearchMatch?: (match: InMeetingMatch) => void;
  highlightMatches?: boolean;
  className?: string;
}

export const InMeetingSearch: React.FC<InMeetingSearchProps> = ({
  meetingId,
  onSearchMatch,
  highlightMatches = true,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState<InMeetingMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Perform search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setMatches([]);
        setCurrentMatchIndex(0);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await searchService.searchWithinMeeting(meetingId, debouncedQuery);
        setMatches(results);
        setCurrentMatchIndex(0);
        
        // Navigate to first match if available
        if (results.length > 0 && onSearchMatch) {
          onSearchMatch(results[0]);
        }
      } catch (err) {
        console.error('In-meeting search error:', err);
        setError('Failed to search within meeting');
        setMatches([]);
        setCurrentMatchIndex(0);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, meetingId, onSearchMatch]);

  const handlePreviousMatch = useCallback(() => {
    if (matches.length === 0) return;
    
    const newIndex = currentMatchIndex > 0 ? currentMatchIndex - 1 : matches.length - 1;
    setCurrentMatchIndex(newIndex);
    
    if (onSearchMatch) {
      onSearchMatch(matches[newIndex]);
    }
  }, [matches, currentMatchIndex, onSearchMatch]);

  const handleNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    
    const newIndex = currentMatchIndex < matches.length - 1 ? currentMatchIndex + 1 : 0;
    setCurrentMatchIndex(newIndex);
    
    if (onSearchMatch) {
      onSearchMatch(matches[newIndex]);
    }
  }, [matches, currentMatchIndex, onSearchMatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePreviousMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setMatches([]);
    setCurrentMatchIndex(0);
    setError(null);
  };

  const currentMatch = matches[currentMatchIndex];

  return (
    <div className={`relative ${className}`}>
      {/* Search Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Search within meeting (Ctrl+F)"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          Search in meeting
        </button>
      )}

      {/* Search Bar */}
      {isOpen && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-3">
          {/* Search Input Row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search within this meeting..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus
              />
            </div>
            
            {/* Navigation Controls */}
            {matches.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePreviousMatch}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMatch}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="Next match (Enter)"
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Close search (Escape)"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Search Results Info */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              )}
              
              {error && (
                <span className="text-red-600">{error}</span>
              )}
              
              {!isLoading && !error && query.trim() && (
                <span>
                  {matches.length > 0 
                    ? `${currentMatchIndex + 1} of ${matches.length} matches`
                    : 'No matches found'
                  }
                </span>
              )}
            </div>

            <div className="text-gray-400">
              Press Enter to navigate • Shift+Enter for previous • Esc to close
            </div>
          </div>

          {/* Current Match Context */}
          {currentMatch && (
            <div className="border-t border-gray-100 pt-3">
              <SearchHighlight
                match={currentMatch}
                query={query}
                onClick={() => onSearchMatch?.(currentMatch)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};