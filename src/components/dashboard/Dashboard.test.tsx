/**
 * Dashboard component tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { Meeting, MeetingStats, MeetingStatus } from '../../types/meeting.types';

// Mock the stores
const mockDashboardData = {
  dashboardData: null,
  recentMeetings: [],
  meetingStats: null,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
};

const mockMeetingActions = {
  createMeeting: vi.fn(),
  isCreating: false,
};

const mockAudioStatus = {
  isRecording: false,
};

vi.mock('../../stores/meeting.store', () => ({
  useDashboardData: () => mockDashboardData,
  useMeetingActions: () => mockMeetingActions,
}));

vi.mock('../../stores/audio.store', () => ({
  useAudioStatus: () => mockAudioStatus,
}));

// Mock child components to avoid complex testing dependencies
vi.mock('./QuickStats', () => ({
  QuickStats: ({ stats, isLoading }: any) => (
    <div data-testid="quick-stats">
      {isLoading ? 'Loading stats...' : stats ? 'Stats loaded' : 'No stats'}
    </div>
  ),
}));

vi.mock('./MeetingCard', () => ({
  MeetingCard: ({ meeting }: any) => (
    <div data-testid="meeting-card">{meeting.title}</div>
  ),
}));

vi.mock('../audio/AudioControls', () => ({
  AudioControls: ({ size, onRecordingStart, onRecordingStop }: any) => (
    <div data-testid="audio-controls" data-size={size}>
      <button onClick={onRecordingStart}>Start Recording</button>
      <button onClick={onRecordingStop}>Stop Recording</button>
    </div>
  ),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock data to default state
    Object.assign(mockDashboardData, {
      dashboardData: null,
      recentMeetings: [],
      meetingStats: null,
      isLoading: false,
      error: null,
    });
    Object.assign(mockMeetingActions, {
      isCreating: false,
    });
    Object.assign(mockAudioStatus, {
      isRecording: false,
    });
  });

  it('renders greeting and dashboard title', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
    expect(screen.getByText('Welcome to your meeting dashboard')).toBeInTheDocument();
  });

  it('calls refresh function on mount', () => {
    renderWithRouter(<Dashboard />);
    
    expect(mockDashboardData.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows error state when there is an error', () => {
    Object.assign(mockDashboardData, {
      error: 'Failed to load dashboard data',
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Failed to Load Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows recording status indicator when recording is active', () => {
    Object.assign(mockAudioStatus, {
      isRecording: true,
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Recording Active')).toBeInTheDocument();
  });

  it('hides recording status indicator when not recording', () => {
    Object.assign(mockAudioStatus, {
      isRecording: false,
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.queryByText('Recording Active')).not.toBeInTheDocument();
  });

  it('renders QuickStats component', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByTestId('quick-stats')).toBeInTheDocument();
  });

  it('renders recording controls section', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByRole('heading', { name: 'Start Recording' })).toBeInTheDocument();
    expect(screen.getByText('Begin a new meeting recording with high-quality audio capture')).toBeInTheDocument();
    expect(screen.getByTestId('audio-controls')).toBeInTheDocument();
  });

  it('shows Quick Start button when not recording', () => {
    Object.assign(mockAudioStatus, {
      isRecording: false,
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
  });

  it('hides Quick Start button when recording', () => {
    Object.assign(mockAudioStatus, {
      isRecording: true,
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.queryByText('Quick Start')).not.toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText(/Press.*Space.*to toggle recording/)).toBeInTheDocument();
  });

  it('renders recent meetings section title', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Recent Meetings')).toBeInTheDocument();
    expect(screen.getByText('View all meetings →')).toBeInTheDocument();
  });

  it('shows loading state for recent meetings', () => {
    Object.assign(mockDashboardData, {
      isLoading: true,
    });
    
    renderWithRouter(<Dashboard />);
    
    // Should show loading skeletons
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('renders meeting cards when meetings are available', () => {
    const mockMeetings: Meeting[] = [
      {
        id: 1,
        title: 'Test Meeting 1',
        startTime: new Date(),
        status: MeetingStatus.Completed,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Meeting,
      {
        id: 2,
        title: 'Test Meeting 2',
        startTime: new Date(),
        status: MeetingStatus.Completed,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Meeting,
    ];
    
    Object.assign(mockDashboardData, {
      recentMeetings: mockMeetings,
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByTestId('meeting-card')).toBeInTheDocument();
  });

  it('shows empty state when no meetings are available', () => {
    Object.assign(mockDashboardData, {
      recentMeetings: [],
    });
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('No meetings yet')).toBeInTheDocument();
    expect(screen.getByText('Start your first meeting recording to see it here')).toBeInTheDocument();
    expect(screen.getByText('Start First Meeting')).toBeInTheDocument();
  });

  it('renders Quick Actions section', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
    expect(screen.getByText('Audio Settings')).toBeInTheDocument();
    expect(screen.getByText('Calendar Sync')).toBeInTheDocument();
  });

  it('renders Tips section', () => {
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Tips')).toBeInTheDocument();
    expect(screen.getByText('Best Audio Quality')).toBeInTheDocument();
    expect(screen.getByText('Privacy First')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('handles quick start recording click', async () => {
    const mockCreateMeeting = vi.fn().mockResolvedValue({ id: 1 });
    Object.assign(mockMeetingActions, {
      createMeeting: mockCreateMeeting,
    });
    
    renderWithRouter(<Dashboard />);
    
    const quickStartButton = screen.getByText('Quick Start');
    fireEvent.click(quickStartButton);
    
    await waitFor(() => {
      expect(mockCreateMeeting).toHaveBeenCalledWith({
        title: expect.stringMatching(/Meeting \d+\/\d+\/\d+ \d+:\d+:\d+ [AP]M/),
        description: 'Quick recording session',
        startTime: expect.any(Date),
      });
    });
  });

  it('shows loading state during quick start creation', () => {
    Object.assign(mockMeetingActions, {
      isCreating: true,
    });
    
    renderWithRouter(<Dashboard />);
    
    // Quick Start button should be disabled and show loading state
    const quickStartButton = screen.getByText('Quick Start').closest('button');
    expect(quickStartButton).toBeDisabled();
  });

  it('handles error in Try Again button', async () => {
    Object.assign(mockDashboardData, {
      error: 'Test error',
    });
    
    renderWithRouter(<Dashboard />);
    
    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);
    
    expect(mockDashboardData.refresh).toHaveBeenCalledTimes(2); // Once on mount, once on click
  });

  it('applies custom className when provided', () => {
    const { container } = renderWithRouter(
      <Dashboard className="custom-dashboard-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-dashboard-class');
  });
});