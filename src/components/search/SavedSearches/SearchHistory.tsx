import React, { useState, useEffect } from 'react';
import { ClockIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { SearchHistoryEntry } from '@/types/search.types';
import { searchService } from '@/services/search.service';

interface SearchHistoryProps {
  onSearchSelect?: (query: string) => void;
  className?: string;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  onSearchSelect,
  className = ''
}) => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const historyData = await searchService.getSearchHistory(50); // Get last 50 searches
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to load search history:', err);
      setError('Failed to load search history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all search history? This action cannot be undone.')) {
      return;
    }

    try {
      await searchService.clearSearchHistory();
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear search history:', err);
      setError('Failed to clear search history');
    }
  };

  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const searchTime = new Date(timestamp);
    const diffMs = now.getTime() - searchTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return searchTime.toLocaleDateString();
    }
  };

  const groupHistoryByDate = (historyItems: SearchHistoryEntry[]): Record<string, SearchHistoryEntry[]> => {
    const groups: Record<string, SearchHistoryEntry[]> = {};
    
    historyItems.forEach(item => {
      const date = new Date(item.searched_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = date.toLocaleDateString();
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    
    return groups;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border border-gray-300 border-t-emerald-500 rounded-full animate-spin"></div>
          <span>Loading search history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-red-600 mb-2">{error}</p>
        <button
          onClick={loadHistory}
          className="text-sm text-emerald-600 hover:text-emerald-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>No search history</p>
        <p className="text-sm">Your recent searches will appear here</p>
      </div>
    );
  }

  const groupedHistory = groupHistoryByDate(history);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Clear History Button */}
      <div className="flex justify-end">
        <button
          onClick={handleClearHistory}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
          Clear History
        </button>
      </div>

      {/* History Groups */}
      {Object.entries(groupedHistory).map(([dateGroup, items]) => (
        <div key={dateGroup} className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 px-1">
            {dateGroup}
          </h4>
          
          <div className="space-y-1">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer"
                onClick={() => onSearchSelect?.(item.query)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {item.query || 'Empty search'}
                    </div>
                    {item.result_count !== undefined && (
                      <div className="text-xs text-gray-500">
                        {item.result_count} results
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {formatRelativeTime(item.searched_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};