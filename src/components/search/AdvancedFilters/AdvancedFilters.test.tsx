import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdvancedFilters } from './AdvancedFilters';
import { SearchFilters } from '@/types/search.types';

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  CalendarIcon: () => <div data-testid="calendar-icon" />,
  UserGroupIcon: () => <div data-testid="user-group-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  TagIcon: () => <div data-testid="tag-icon" />,
}));

describe('AdvancedFilters', () => {
  const defaultFilters: SearchFilters = {
    participants: [],
    tags: [],
    meeting_types: [],
    languages: [],
    models: [],
    meeting_ids: [],
    session_ids: [],
  };

  const defaultProps = {
    filters: defaultFilters,
    onFiltersChange: vi.fn(),
    availableParticipants: ['john@example.com', 'jane@example.com'],
    availableTags: ['standup', 'planning', 'review'],
    isExpanded: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AdvancedFilters {...defaultProps} />);
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('displays available participants', () => {
    render(<AdvancedFilters {...defaultProps} />);
    expect(screen.getByText('Participants')).toBeInTheDocument();
  });

  it('displays available tags', () => {
    render(<AdvancedFilters {...defaultProps} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('handles filter changes correctly', () => {
    const onFiltersChange = vi.fn();
    render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    
    // Test duration filter change
    const minDurationInput = screen.getByLabelText(/minimum duration/i);
    fireEvent.change(minDurationInput, { target: { value: '15' } });
    
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_min: 15,
      })
    );
  });

  it('shows clear all filters button when filters are active', () => {
    const filtersWithValues: SearchFilters = {
      ...defaultFilters,
      participants: ['john@example.com'],
      tags: ['standup'],
    };

    render(<AdvancedFilters {...defaultProps} filters={filtersWithValues} />);
    expect(screen.getByText(/clear all filters/i)).toBeInTheDocument();
  });

  it('counts active filters correctly', () => {
    const filtersWithValues: SearchFilters = {
      ...defaultFilters,
      participants: ['john@example.com'],
      tags: ['standup'],
      duration_min: 15,
    };

    render(<AdvancedFilters {...defaultProps} filters={filtersWithValues} />);
    // Should show active filter indicators
    expect(screen.getByText(/3 filters active/i)).toBeInTheDocument();
  });

  it('can be collapsed and expanded', () => {
    const { rerender } = render(<AdvancedFilters {...defaultProps} isExpanded={false} />);
    
    // When collapsed, advanced options should not be visible
    expect(screen.queryByText('Date Range')).not.toBeInTheDocument();
    
    rerender(<AdvancedFilters {...defaultProps} isExpanded={true} />);
    
    // When expanded, advanced options should be visible
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });
});