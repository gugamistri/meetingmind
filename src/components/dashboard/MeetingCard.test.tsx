/**
 * MeetingCard component tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MeetingCard } from './MeetingCard';
import { Meeting, MeetingStatus } from '../../types/meeting.types';

// Mock the router navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockMeeting: Meeting = {
  id: 1,
  title: 'Test Meeting',
  description: 'This is a test meeting',
  startTime: new Date('2023-12-01T10:00:00Z'),
  endTime: new Date('2023-12-01T11:00:00Z'),
  status: MeetingStatus.Completed,
  createdAt: new Date('2023-12-01T09:00:00Z'),
  updatedAt: new Date('2023-12-01T09:00:00Z'),
  duration: 3600000, // 1 hour in ms
  hasTranscription: true,
  hasAiSummary: true,
  participants: [
    {
      id: 1,
      meetingId: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'organizer' as any,
      createdAt: new Date(),
    },
    {
      id: 2,
      meetingId: 1,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'participant' as any,
      createdAt: new Date(),
    },
  ],
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MeetingCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders meeting information correctly', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} />);
    
    expect(screen.getByText('Test Meeting')).toBeInTheDocument();
    expect(screen.getByText('This is a test meeting')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  it('shows feature indicators when available', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} />);
    
    expect(screen.getByText('Transcribed')).toBeInTheDocument();
    expect(screen.getByText('AI Summary')).toBeInTheDocument();
  });

  it('hides feature indicators when not available', () => {
    const meetingWithoutFeatures = {
      ...mockMeeting,
      hasTranscription: false,
      hasAiSummary: false,
    };
    
    renderWithRouter(<MeetingCard meeting={meetingWithoutFeatures} />);
    
    expect(screen.queryByText('Transcribed')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Summary')).not.toBeInTheDocument();
  });

  it('calls onClick handler when card is clicked', () => {
    const onClick = vi.fn();
    renderWithRouter(<MeetingCard meeting={mockMeeting} onClick={onClick} />);
    
    fireEvent.click(screen.getByRole('img', { hidden: true }).closest('.cursor-pointer')!);
    expect(onClick).toHaveBeenCalledWith(mockMeeting);
  });

  it('navigates to meeting details by default when clicked', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} />);
    
    fireEvent.click(screen.getByRole('img', { hidden: true }).closest('.cursor-pointer')!);
    expect(mockNavigate).toHaveBeenCalledWith('/meetings/1');
  });

  it('shows actions menu when actions button is clicked', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} />);
    
    // Click the actions button (three dots)
    const actionsButton = screen.getByRole('button');
    fireEvent.click(actionsButton);
    
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows transcription action only when transcription is available', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} />);
    
    // Click the actions button
    const actionsButton = screen.getByRole('button');
    fireEvent.click(actionsButton);
    
    expect(screen.getByText('View Transcription')).toBeInTheDocument();
  });

  it('shows AI summary action only when summary is available', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} />);
    
    // Click the actions button
    const actionsButton = screen.getByRole('button');
    fireEvent.click(actionsButton);
    
    expect(screen.getByText('View AI Summary')).toBeInTheDocument();
  });

  it('calls onAction handler when action is clicked', () => {
    const onAction = vi.fn();
    renderWithRouter(
      <MeetingCard meeting={mockMeeting} onAction={onAction} />
    );
    
    // Click the actions button
    const actionsButton = screen.getByRole('button');
    fireEvent.click(actionsButton);
    
    // Click the view action
    fireEvent.click(screen.getByText('View Details'));
    
    expect(onAction).toHaveBeenCalledWith('view', mockMeeting);
  });

  it('prevents event propagation when actions menu is clicked', () => {
    const onClick = vi.fn();
    renderWithRouter(<MeetingCard meeting={mockMeeting} onClick={onClick} />);
    
    // Click the actions button
    const actionsButton = screen.getByRole('button');
    fireEvent.click(actionsButton);
    
    // The card onClick should not have been called
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can hide actions menu', () => {
    renderWithRouter(<MeetingCard meeting={mockMeeting} showActions={false} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('formats duration correctly for meetings under an hour', () => {
    const shortMeeting = {
      ...mockMeeting,
      endTime: new Date('2023-12-01T10:30:00Z'), // 30 minutes
      duration: 1800000, // 30 minutes in ms
    };
    
    renderWithRouter(<MeetingCard meeting={shortMeeting} />);
    
    expect(screen.getByText('30m')).toBeInTheDocument();
  });

  it('handles meetings without end time', () => {
    const ongoingMeeting = {
      ...mockMeeting,
      endTime: undefined,
      duration: undefined,
    };
    
    renderWithRouter(<MeetingCard meeting={ongoingMeeting} />);
    
    // Should not show duration when meeting has no end time
    expect(screen.queryByText(/\d+[hm]/)).not.toBeInTheDocument();
  });

  it('handles meetings without participants', () => {
    const meetingWithoutParticipants = {
      ...mockMeeting,
      participants: undefined,
    };
    
    renderWithRouter(<MeetingCard meeting={meetingWithoutParticipants} />);
    
    expect(screen.queryByText(/participants/)).not.toBeInTheDocument();
  });

  it('displays correct status styling for different meeting statuses', () => {
    const inProgressMeeting = {
      ...mockMeeting,
      status: MeetingStatus.InProgress,
    };
    
    renderWithRouter(<MeetingCard meeting={inProgressMeeting} />);
    
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });
});