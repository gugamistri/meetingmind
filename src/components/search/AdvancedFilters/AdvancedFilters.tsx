import React, { useState } from 'react';
import { CalendarIcon, UserGroupIcon, ClockIcon, TagIcon } from '@heroicons/react/24/outline';
import { SearchFilters } from '@/types/search.types';
import { DateRangeFilter } from './DateRangeFilter';
import { ParticipantFilter } from './ParticipantFilter';
import { TagFilter } from './TagFilter';

interface AdvancedFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableParticipants: string[];
  availableTags: string[];
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  availableParticipants,
  availableTags,
  isExpanded = false,
  onToggle
}) => {
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const updateFilters = (updates: Partial<SearchFilters>) => {
    const newFilters = { ...filters, ...updates };
    onFiltersChange(newFilters);
    
    // Count active filters
    let count = 0;
    if (newFilters.date_start || newFilters.date_end) count++;
    if (newFilters.participants && newFilters.participants.length > 0) count++;
    if (newFilters.tags && newFilters.tags.length > 0) count++;
    if (newFilters.duration_min || newFilters.duration_max) count++;
    setActiveFilterCount(count);
  };

  const clearAllFilters = () => {
    const emptyFilters: SearchFilters = {
      date_start: null,
      date_end: null,
      participants: [],
      tags: [],
      duration_min: null,
      duration_max: null,
      meeting_types: []
    };
    onFiltersChange(emptyFilters);
    setActiveFilterCount(0);
  };

  const getDurationPreset = (duration: 'short' | 'medium' | 'long') => {
    switch (duration) {
      case 'short':
        return { duration_min: null, duration_max: 15 };
      case 'medium':
        return { duration_min: 15, duration_max: 60 };
      case 'long':
        return { duration_min: 60, duration_max: null };
    }
  };

  const handleDurationPreset = (duration: 'short' | 'medium' | 'long') => {
    const preset = getDurationPreset(duration);
    updateFilters(preset);
  };

  return (
    <div className="border-t border-gray-200">
      {/* Filter Toggle Button */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Advanced Filters
          {activeFilterCount > 0 && (
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filters Panel */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Date Range Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CalendarIcon className="w-4 h-4" />
              Date Range
            </label>
            <DateRangeFilter
              startDate={filters.date_start}
              endDate={filters.date_end}
              onDateChange={(start, end) => updateFilters({ date_start: start, date_end: end })}
            />
          </div>

          {/* Participants Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <UserGroupIcon className="w-4 h-4" />
              Participants
            </label>
            <ParticipantFilter
              selectedParticipants={filters.participants || []}
              availableParticipants={availableParticipants}
              onSelectionChange={(participants) => updateFilters({ participants })}
            />
          </div>

          {/* Duration Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <ClockIcon className="w-4 h-4" />
              Meeting Duration
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleDurationPreset('short')}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.duration_max === 15 && !filters.duration_min
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Short (&lt;15min)
              </button>
              <button
                onClick={() => handleDurationPreset('medium')}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.duration_min === 15 && filters.duration_max === 60
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Medium (15-60min)
              </button>
              <button
                onClick={() => handleDurationPreset('long')}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.duration_min === 60 && !filters.duration_max
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Long (&gt;60min)
              </button>
            </div>
          </div>

          {/* Tags Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <TagIcon className="w-4 h-4" />
              Tags
            </label>
            <TagFilter
              selectedTags={filters.tags || []}
              availableTags={availableTags}
              onSelectionChange={(tags) => updateFilters({ tags })}
            />
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={clearAllFilters}
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};