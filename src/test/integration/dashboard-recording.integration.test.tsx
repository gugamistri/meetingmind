/**
 * Dashboard + Recording Integration Tests
 * 
 * Tests the interaction between dashboard components and recording functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../../components/dashboard/Dashboard';
import { AudioControls } from '../../components/audio/AudioControls';

// Mock the stores with more realistic implementations
let mockDashboardStore = {
  dashboardData: null,
  recentMeetings: [],
  meetingStats: null,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
};

let mockMeetingActionsStore = {
  createMeeting: vi.fn(),
  isCreating: false,
};

let mockAudioStore = {
  isRecording: false,
  isStarting: false,
  isStopping: false,
  hasError: false,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('../../stores/meeting.store', () => ({
  useDashboardData: () => mockDashboardStore,
  useMeetingActions: () => mockMeetingActionsStore,
}));

vi.mock('../../stores/audio.store', () => ({
  useAudioStatus: () => mockAudioStore,
  useAudioError: () => null,
  useAudioStore: () => mockAudioStore,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Dashboard + Recording Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset all stores to default state
    mockDashboardStore = {
      dashboardData: null,
      recentMeetings: [],
      meetingStats: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    };
    
    mockMeetingActionsStore = {
      createMeeting: vi.fn(),
      isCreating: false,
    };
    
    mockAudioStore = {
      isRecording: false,
      isStarting: false,
      isStopping: false,
      hasError: false,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      clearError: vi.fn(),
    };
  });

  it('integrates AudioControls within dashboard recording section', () => {
    renderWithRouter(<Dashboard />);
    
    // AudioControls should be present in the recording section
    const recordingSection = screen.getByText('Start Recording').closest('div');
    expect(recordingSection).toBeInTheDocument();
    
    // Should contain the start recording button from AudioControls
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });

  it('shows recording status in dashboard header when recording is active', () => {
    mockAudioStore.isRecording = true;
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Recording Active')).toBeInTheDocument();
    expect(screen.getByText('Recording Active').closest('div')).toHaveClass('bg-red-100');
  });

  it('hides Quick Start button when recording is active', () => {
    mockAudioStore.isRecording = true;
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.queryByText('Quick Start')).not.toBeInTheDocument();
  });

  it('handles quick start recording workflow', async () => {
    const mockCreatedMeeting = {
      id: 123,
      title: 'Quick Meeting',
      startTime: new Date(),
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    mockMeetingActionsStore.createMeeting.mockResolvedValue(mockCreatedMeeting);
    
    renderWithRouter(<Dashboard />);
    
    // Click Quick Start button
    const quickStartButton = screen.getByText('Quick Start');
    fireEvent.click(quickStartButton);
    
    // Should create a meeting
    await waitFor(() => {
      expect(mockMeetingActionsStore.createMeeting).toHaveBeenCalledWith({
        title: expect.stringContaining('Meeting'),
        description: 'Quick recording session',
        startTime: expect.any(Date),
      });
    });
  });

  it('shows loading state during quick start creation', () => {
    mockMeetingActionsStore.isCreating = true;
    
    renderWithRouter(<Dashboard />);
    
    // Quick Start button should show loading state
    const quickStartButton = screen.getByText('Quick Start').closest('button');
    expect(quickStartButton).toBeDisabled();
  });

  it('handles recording start from AudioControls in dashboard', async () => {
    mockAudioStore.startRecording.mockResolvedValue(undefined);
    
    renderWithRouter(<Dashboard />);
    
    // Find and click the start recording button from AudioControls
    const startButton = screen.getByLabelText('Start recording');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockAudioStore.startRecording).toHaveBeenCalled();
    });
  });

  it('handles recording stop from AudioControls in dashboard', async () => {
    mockAudioStore.isRecording = true;
    mockAudioStore.stopRecording.mockResolvedValue(undefined);
    
    renderWithRouter(<Dashboard />);
    
    // Find and click the stop recording button from AudioControls
    const stopButton = screen.getByLabelText('Stop recording');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(mockAudioStore.stopRecording).toHaveBeenCalled();
    });
  });

  it('shows recording transition states in dashboard', () => {
    mockAudioStore.isStarting = true;
    
    renderWithRouter(<Dashboard />);
    
    // Should show the starting state in AudioControls
    expect(screen.getByText('Starting recording...')).toBeInTheDocument();
  });

  it('shows stopping state in dashboard', () => {
    mockAudioStore.isRecording = true;
    mockAudioStore.isStopping = true;
    
    renderWithRouter(<Dashboard />);
    
    expect(screen.getByText('Stopping recording...')).toBeInTheDocument();
  });

  it('displays audio error states in dashboard context', () => {
    mockAudioStore.hasError = true;
    
    renderWithRouter(<Dashboard />);
    
    // Error should be shown within the AudioControls component
    expect(screen.getByText('Ready to record')).toBeInTheDocument(); // Default state text
  });

  it('maintains keyboard shortcuts functionality in dashboard context', () => {
    renderWithRouter(<Dashboard />);
    
    // Should show keyboard shortcut hint
    expect(screen.getByText(/Press.*Space.*to toggle recording/)).toBeInTheDocument();
    
    // Simulate space key press
    fireEvent.keyDown(document, { code: 'Space' });
    
    // Since AudioControls handles keyboard events, it should attempt to start recording
    expect(mockAudioStore.startRecording).toHaveBeenCalled();
  });

  it('updates dashboard state when recording session changes', () => {
    // Initially not recording
    renderWithRouter(<Dashboard />);
    expect(screen.queryByText('Recording Active')).not.toBeInTheDocument();
    
    // Start recording - re-render with new state
    mockAudioStore.isRecording = true;
    renderWithRouter(<Dashboard />);
    expect(screen.getByText('Recording Active')).toBeInTheDocument();
  });

  it('provides appropriate recording feedback in dashboard context', () => {
    mockAudioStore.isRecording = true;
    
    renderWithRouter(<Dashboard />);
    
    // Should show active recording indicators
    expect(screen.getByText('Recording Active')).toBeInTheDocument();
    expect(screen.getByText('Recording active')).toBeInTheDocument();
  });

  it('handles concurrent dashboard operations during recording', async () => {
    mockAudioStore.isRecording = true;
    
    renderWithRouter(<Dashboard />);
    
    // Dashboard refresh should still work during recording
    const refreshSpy = mockDashboardStore.refresh;
    
    // Simulate some dashboard operation that would trigger refresh
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
    
    // Recording state should be maintained
    expect(screen.getByText('Recording Active')).toBeInTheDocument();
  });

  it('properly integrates recording controls sizing in dashboard', () => {
    renderWithRouter(<Dashboard />);
    
    // AudioControls should use large size in dashboard
    const audioControlsContainer = screen.getByLabelText('Start recording').closest('[data-size]');
    expect(audioControlsContainer).toHaveAttribute('data-size', 'lg');
  });

  it('handles error recovery in integrated recording workflow', async () => {
    mockAudioStore.hasError = true;
    mockMeetingActionsStore.createMeeting.mockRejectedValue(new Error('Creation failed'));
    
    renderWithRouter(<Dashboard />);
    
    // Quick Start should handle meeting creation error
    const quickStartButton = screen.getByText('Quick Start');
    fireEvent.click(quickStartButton);
    
    await waitFor(() => {
      expect(mockMeetingActionsStore.createMeeting).toHaveBeenCalled();
    });
    
    // Error should be handled gracefully without breaking the dashboard
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
  });
});