/**
 * Search Results Component
 * 
 * Displays search results with highlighting, pagination, and result actions.
 */

import React, { useMemo } from 'react';
import { 
  CalendarIcon, 
  ClockIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  ShareIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useSearch } from '../../../stores/search.store';
import { SearchResult } from '../../../types/search.types';
import { Button } from '../../common/Button';
import clsx from 'clsx';

export interface SearchResultsProps {
  className?: string;
  onResultClick?: (result: SearchResult) => void;
  onMeetingView?: (meetingId: number) => void;
  showPagination?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  className,
  onResultClick,
  onMeetingView,
  showPagination = true,
}) => {
  const {
    results,
    query,
    isLoading,
    hasSearched,
    totalResults,
    currentPage,
    itemsPerPage,
  } = useSearch();

  // Highlight matching text in content
  const highlightText = (text: string, highlights: any[]) => {
    if (!highlights.length || !query) return text;

    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);
    
    let highlightedText = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        highlightedText.push(text.slice(lastIndex, highlight.start));
      }

      // Add highlighted text
      const highlightedSegment = text.slice(highlight.start, highlight.end);
      highlightedText.push(
        <mark 
          key={`highlight-${index}`}
          className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
        >
          {highlightedSegment}
        </mark>
      );

      lastIndex = highlight.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      highlightedText.push(text.slice(lastIndex));
    }

    return highlightedText;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Unknown duration';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Get relevance color
  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  // Calculate pagination info
  const paginationInfo = useMemo(() => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalResults);
    const totalPages = Math.ceil(totalResults / itemsPerPage);
    
    return { startItem, endItem, totalPages };
  }, [currentPage, itemsPerPage, totalResults]);

  if (isLoading) {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-600">Searching meetings...</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className={clsx('text-center py-12', className)}>
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No search performed</h3>
        <p className="mt-1 text-sm text-gray-500">
          Enter a search term to find meetings and content.
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={clsx('text-center py-12', className)}>
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search terms or filters.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {paginationInfo.startItem}-{paginationInfo.endItem} of {totalResults} results
          {query && (
            <span> for <span className="font-medium">"{query}"</span></span>
          )}
        </div>
        
        {/* Sort/Filter Controls */}
        <div className="flex items-center space-x-2">
          <select className="text-sm border border-gray-300 rounded px-2 py-1">
            <option value="relevance">Sort by relevance</option>
            <option value="date">Sort by date</option>
            <option value="duration">Sort by duration</option>
          </select>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result) => (
          <div
            key={`${result.meeting_id}-${result.transcription_id}`}
            className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => onResultClick?.(result)}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 hover:text-emerald-600 transition-colors">
                    {result.meeting_title}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(result.context.meeting_start_time)}</span>
                    </div>
                    {result.context.meeting_duration && (
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-4 h-4" />
                        <span>{formatDuration(result.context.meeting_duration)}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <UserGroupIcon className="w-4 h-4" />
                      <span>{result.context.participant_count || 'Unknown'} participants</span>
                    </div>
                  </div>
                </div>

                {/* Relevance Score */}
                <div className="flex items-center space-x-2">
                  <span className={clsx(
                    'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                    getRelevanceColor(result.relevance_score)
                  )}>
                    {Math.round(result.relevance_score * 100)}% match
                  </span>
                </div>
              </div>

              {/* Content Preview */}
              <div className="mb-4">
                <p className="text-gray-700 leading-relaxed">
                  {highlightText(result.content_snippet, result.highlight_positions)}
                </p>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Language: {result.context.language}</span>
                  <span>Confidence: {Math.round(result.context.confidence * 100)}%</span>
                  <span>Model: {result.context.model_used}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMeetingView?.(result.meeting_id);
                    }}
                    className="flex items-center space-x-1 text-gray-400 hover:text-emerald-600 transition-colors"
                    title="View full meeting"
                  >
                    <EyeIcon className="w-4 h-4" />
                    <span>View</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Share functionality
                    }}
                    className="flex items-center space-x-1 text-gray-400 hover:text-emerald-600 transition-colors"
                    title="Share result"
                  >
                    <ShareIcon className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {showPagination && paginationInfo.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {paginationInfo.totalPages}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => {
                // TODO: Handle pagination
              }}
            >
              Previous
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === paginationInfo.totalPages}
              onClick={() => {
                // TODO: Handle pagination
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;