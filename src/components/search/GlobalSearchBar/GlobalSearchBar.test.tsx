/**
 * Tests for GlobalSearchBar component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { GlobalSearchBar } from './GlobalSearchBar';

// Mock the search store
const mockUseSearch = {
  query: '',
  suggestions: [],
  isLoading: false,
  error: undefined,
  setQuery: vi.fn(),
  performSearch: vi.fn(),
  getSuggestions: vi.fn(),
  clearSearch: vi.fn(),
};

vi.mock('../../../stores/search.store', () => ({
  useSearch: () => mockUseSearch,
}));

// Mock the useDebounce hook
vi.mock('../../../hooks/common/useDebounce', () => ({
  useDebounce: (value: string) => value, // Return value immediately for testing
}));

describe('GlobalSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with placeholder', () => {
    render(<GlobalSearchBar />);
    
    const input = screen.getByPlaceholderText(/search meetings/i);
    expect(input).toBeInTheDocument();
  });

  it('calls setQuery when typing in input', async () => {
    const user = userEvent.setup();
    render(<GlobalSearchBar />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test query');
    
    expect(mockUseSearch.setQuery).toHaveBeenCalledWith('test query');
  });

  it('shows loading indicator when isLoading is true', () => {
    mockUseSearch.isLoading = true;
    render(<GlobalSearchBar />);
    
    const loadingSpinner = screen.getByRole('textbox').closest('form')?.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });

  it('displays error message when error exists', () => {
    mockUseSearch.error = 'Search failed';
    render(<GlobalSearchBar />);
    
    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  it('submits search when form is submitted', async () => {
    const onSearch = vi.fn();
    mockUseSearch.query = 'test search';
    
    const user = userEvent.setup();
    render(<GlobalSearchBar onSearch={onSearch} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, '{enter}');
    
    expect(mockUseSearch.performSearch).toHaveBeenCalled();
  });

  it('shows clear button when query exists', () => {
    mockUseSearch.query = 'test query';
    render(<GlobalSearchBar />);
    
    const clearButton = screen.getByTitle('Clear search');
    expect(clearButton).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();
    mockUseSearch.query = 'test query';
    
    render(<GlobalSearchBar />);
    
    const clearButton = screen.getByTitle('Clear search');
    await user.click(clearButton);
    
    expect(mockUseSearch.clearSearch).toHaveBeenCalled();
  });

  it('shows suggestions when available', () => {
    mockUseSearch.suggestions = [
      { 
        suggestion: 'recent search', 
        suggestion_type: 'RecentQuery',
        frequency: 3,
        last_used: '2024-01-01T00:00:00Z'
      }
    ];
    
    render(<GlobalSearchBar />);
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    expect(screen.getByText('recent search')).toBeInTheDocument();
  });

  it('handles keyboard navigation for suggestions', async () => {
    const user = userEvent.setup();
    mockUseSearch.suggestions = [
      { 
        suggestion: 'suggestion 1', 
        suggestion_type: 'RecentQuery',
        frequency: 1,
      },
      { 
        suggestion: 'suggestion 2', 
        suggestion_type: 'RecentQuery',
        frequency: 1,
      }
    ];
    
    render(<GlobalSearchBar />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    fireEvent.focus(input);
    
    // Navigate down to first suggestion
    await user.keyboard('{ArrowDown}');
    
    // Submit should use selected suggestion
    await user.keyboard('{Enter}');
    
    expect(mockUseSearch.setQuery).toHaveBeenCalledWith('suggestion 1');
  });

  it('applies custom className', () => {
    render(<GlobalSearchBar className="custom-class" />);
    
    const container = screen.getByRole('textbox').closest('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('calls onFocus when input is focused', async () => {
    const onFocus = vi.fn();
    const user = userEvent.setup();
    
    render(<GlobalSearchBar onFocus={onFocus} />);
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    expect(onFocus).toHaveBeenCalled();
  });

  it('hides filters button when showFilters is false', () => {
    render(<GlobalSearchBar showFilters={false} />);
    
    const filtersButton = screen.queryByTitle('Search filters');
    expect(filtersButton).not.toBeInTheDocument();
  });
});