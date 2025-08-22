/**
 * QuickStats component tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickStats } from './QuickStats';
import { MeetingStats } from '../../types/meeting.types';

const mockStats: MeetingStats = {
  totalMeetings: 42,
  totalDurationMs: 7200000, // 2 hours
  todaysMeetings: 3,
  weeklyMeetings: 12,
  averageDurationMs: 1800000, // 30 minutes
  completedMeetings: 40,
  recordingsWithTranscription: 35,
  recordingsWithAiSummary: 28,
};

describe('QuickStats', () => {
  it('renders statistics correctly', () => {
    render(<QuickStats stats={mockStats} />);
    
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Meetings')).toBeInTheDocument();
    expect(screen.getByText('2h 0m')).toBeInTheDocument();
    expect(screen.getByText('Total Time')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('AI Summaries')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<QuickStats stats={null} isLoading={true} />);
    
    // Should show skeleton loading cards
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });

  it('shows "no statistics available" when stats is null and not loading', () => {
    render(<QuickStats stats={null} isLoading={false} />);
    
    expect(screen.getByText('No statistics available')).toBeInTheDocument();
  });

  it('calculates AI summary coverage percentage correctly', () => {
    render(<QuickStats stats={mockStats} />);
    
    // 28 AI summaries out of 42 total meetings = 67%
    expect(screen.getByText('67% coverage')).toBeInTheDocument();
  });

  it('handles zero total meetings for percentage calculation', () => {
    const statsWithZeroMeetings: MeetingStats = {
      ...mockStats,
      totalMeetings: 0,
      recordingsWithAiSummary: 0,
    };
    
    render(<QuickStats stats={statsWithZeroMeetings} />);
    
    expect(screen.getByText('0% coverage')).toBeInTheDocument();
  });

  it('shows today\'s meetings in weekly description', () => {
    render(<QuickStats stats={mockStats} />);
    
    expect(screen.getByText('3 today')).toBeInTheDocument();
  });

  it('applies correct CSS classes to stat cards', () => {
    render(<QuickStats stats={mockStats} />);
    
    const cards = document.querySelectorAll('[class*="border-l-"]');
    expect(cards.length).toBe(4);
    
    // Check that different colored borders are applied
    expect(document.querySelector('.border-l-emerald-500')).toBeInTheDocument();
    expect(document.querySelector('.border-l-teal-500')).toBeInTheDocument();
    expect(document.querySelector('.border-l-green-500')).toBeInTheDocument();
    expect(document.querySelector('.border-l-blue-500')).toBeInTheDocument();
  });

  it('formats duration correctly for different time periods', () => {
    const statsWithLongDuration: MeetingStats = {
      ...mockStats,
      totalDurationMs: 18000000, // 5 hours
    };
    
    render(<QuickStats stats={statsWithLongDuration} />);
    
    expect(screen.getByText('5h 0m')).toBeInTheDocument();
  });

  it('handles minutes-only duration formatting', () => {
    const statsWithMinutesDuration: MeetingStats = {
      ...mockStats,
      totalDurationMs: 2700000, // 45 minutes
    };
    
    render(<QuickStats stats={statsWithMinutesDuration} />);
    
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('has hover effects on stat cards', () => {
    render(<QuickStats stats={mockStats} />);
    
    const cards = document.querySelectorAll('.hover\\:shadow-md');
    expect(cards.length).toBe(4);
  });

  it('displays all required stat descriptions', () => {
    render(<QuickStats stats={mockStats} />);
    
    expect(screen.getByText('All recorded meetings')).toBeInTheDocument();
    expect(screen.getByText('Combined meeting duration')).toBeInTheDocument();
    expect(screen.getByText('3 today')).toBeInTheDocument();
    expect(screen.getByText('67% coverage')).toBeInTheDocument();
  });

  it('handles custom className prop', () => {
    const { container } = render(
      <QuickStats stats={mockStats} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('maintains consistent grid layout', () => {
    render(<QuickStats stats={mockStats} />);
    
    const gridContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
    expect(gridContainer).toBeInTheDocument();
  });
});