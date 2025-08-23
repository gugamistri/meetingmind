/**
 * Global Search Bar Component
 * 
 * Provides a comprehensive search interface with real-time suggestions,
 * recent searches, and quick filters.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, ClockIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useSearch } from '../../../stores/search.store';
import { SuggestionType } from '../../../types/search.types';
import { useDebounce } from '../../../hooks/common/useDebounce';
import clsx from 'clsx';

export interface GlobalSearchBarProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  showFilters?: boolean;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  placeholder = 'Search meetings, participants, content...',
  className,
  onSearch,
  onFocus,
  onBlur,
  showFilters = true,
}) => {
  const {
    query,
    suggestions,
    isLoading,
    error,
    setQuery,
    performSearch,
    getSuggestions,
    clearSearch,
  } = useSearch();

  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [localQuery, setLocalQuery] = useState(query);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce the query for suggestions
  const debouncedQuery = useDebounce(localQuery, 300);

  // Update local query when store query changes
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Get suggestions when debounced query changes
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length >= 2 && isFocused) {
      getSuggestions(debouncedQuery, 'RecentQuery');
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }, [debouncedQuery, isFocused, getSuggestions]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setLocalQuery(newQuery);
    setQuery(newQuery);
  };

  // Handle search execution
  const handleSearch = async () => {
    if (localQuery.trim()) {
      setShowSuggestions(false);
      await performSearch();
      onSearch?.(localQuery);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
      // Use selected suggestion
      const selectedSuggestion = suggestions[selectedSuggestionIndex];
      if (selectedSuggestion) {
        setLocalQuery(selectedSuggestion.suggestion);
        setQuery(selectedSuggestion.suggestion);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        setTimeout(() => {
          handleSearch();
        }, 0);
      }
    } else {
      handleSearch();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
          e.preventDefault();
          const selectedSuggestion = suggestions[selectedSuggestionIndex];
          if (selectedSuggestion) {
            setLocalQuery(selectedSuggestion.suggestion);
            setQuery(selectedSuggestion.suggestion);
          }
        }
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setLocalQuery(suggestion);
    setQuery(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setTimeout(() => {
      handleSearch();
    }, 0);
  };

  // Handle focus events
  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
    if (localQuery.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't hide suggestions if clicking on a suggestion
    if (suggestionsRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsFocused(false);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    onBlur?.();
  };

  // Clear search
  const handleClear = () => {
    setLocalQuery('');
    clearSearch();
    inputRef.current?.focus();
  };

  const getSuggestionIcon = (type: SuggestionType) => {
    switch (type) {
      case 'RecentQuery':
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
      case 'PopularTerm':
        return <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />;
      default:
        return <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={clsx('relative w-full max-w-2xl mx-auto', className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon 
              className={clsx(
                'w-5 h-5 transition-colors',
                isFocused ? 'text-emerald-500' : 'text-gray-400'
              )} 
            />
          </div>

          {/* Search Input */}
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={clsx(
              'w-full pl-10 pr-20 py-3 text-gray-900 border rounded-xl',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
              'placeholder-gray-500 bg-white shadow-sm transition-all duration-200',
              isFocused && 'shadow-lg ring-2 ring-emerald-500',
              error && 'border-red-300 focus:ring-red-500'
            )}
            disabled={isLoading}
          />

          {/* Action Buttons */}
          <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-3">
            {localQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Clear search"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}

            {showFilters && (
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Search filters"
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
              </button>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center w-5 h-5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 text-sm text-red-600 px-3">
            {error}
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.suggestion}-${index}`}
                type="button"
                onMouseDown={() => handleSuggestionClick(suggestion.suggestion)}
                className={clsx(
                  'w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors',
                  'first:rounded-t-lg last:rounded-b-lg',
                  selectedSuggestionIndex === index && 'bg-emerald-50 text-emerald-900'
                )}
              >
                {getSuggestionIcon(suggestion.suggestion_type)}
                <span className="flex-1 truncate">{suggestion.suggestion}</span>
                {suggestion.frequency > 1 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {suggestion.frequency}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

export default GlobalSearchBar;