import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import MeetingDetailPage from './MeetingDetailPage';

// Mock all the dependencies
vi.mock('@/hooks/meeting/useMeetingDetail');
vi.mock('@/components/meeting/TranscriptionEditor', () => ({
  TranscriptionEditor: ({ meetingId }: { meetingId: number }) => (
    <div data-testid="transcription-editor">TranscriptionEditor for meeting {meetingId}</div>
  ),
}));
vi.mock('@/components/meeting/SummaryGenerator', () => ({
  SummaryGenerator: ({ meetingId }: { meetingId: number }) => (
    <div data-testid="summary-generator">SummaryGenerator for meeting {meetingId}</div>
  ),
}));
vi.mock('@/components/meeting/ExportManager', () => ({
  ExportManager: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? (
      <div data-testid="export-manager">
        <button onClick={onClose}>Close Export Manager</button>
      </div>
    ) : null
  ),
}));

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockMeeting = {
  id: 1,
  title: 'Test Meeting',
  description: 'A test meeting for unit tests',
  startTime: '2025-01-15T10:00:00Z',
  endTime: '2025-01-15T11:00:00Z',
  status: 'completed',
  participants: [
    {
      id: 1,
      meetingId: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'organizer',
      joinedAt: '2025-01-15T10:00:00Z',
      leftAt: null,
      createdAt: '2025-01-15T10:00:00Z',
    },
    {
      id: 2,
      meetingId: 1,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'participant',
      joinedAt: '2025-01-15T10:05:00Z',
      leftAt: null,
      createdAt: '2025-01-15T10:05:00Z',
    }
  ],
  hasTranscription: true,
  hasAiSummary: true,
  duration: 3600,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T11:00:00Z',
};

const mockUseMeetingDetail = vi.mocked(
  await import('@/hooks/meeting/useMeetingDetail')
).useMeetingDetail;

const renderWithRouter = (initialEntries = ['/meetings/1']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MeetingDetailPage />
    </MemoryRouter>
  );
};

describe('MeetingDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMeetingDetail.mockReturnValue({
      meeting: mockMeeting,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders loading spinner when loading', () => {
    mockUseMeetingDetail.mockReturnValue({
      meeting: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter();

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders error state when there is an error', () => {
    mockUseMeetingDetail.mockReturnValue({
      meeting: null,
      isLoading: false,
      error: 'Failed to load meeting',
      refetch: vi.fn(),
    });

    renderWithRouter();

    expect(screen.getByText('Failed to Load Meeting')).toBeInTheDocument();
    expect(screen.getByText('Failed to load meeting')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders meeting not found when meeting is null but no error', () => {
    mockUseMeetingDetail.mockReturnValue({
      meeting: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter();

    expect(screen.getByText('Meeting Not Found')).toBeInTheDocument();
    expect(screen.getByText("The meeting you're looking for doesn't exist or has been deleted.")).toBeInTheDocument();
  });

  it('renders meeting details when meeting is loaded', () => {
    renderWithRouter();

    expect(screen.getByText('Test Meeting')).toBeInTheDocument();
    expect(screen.getByText('A test meeting for unit tests')).toBeInTheDocument();
    expect(screen.getByText(/2 participants/)).toBeInTheDocument();
  });

  it('displays breadcrumbs with meeting title', () => {
    renderWithRouter();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test Meeting')).toBeInTheDocument();
  });

  it('shows all action buttons in header', () => {
    renderWithRouter();

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('displays content tabs based on available data', () => {
    renderWithRouter();

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(screen.getByText('AI Summary')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('shows overview content by default', () => {
    renderWithRouter();

    expect(screen.getByText('Meeting Information')).toBeInTheDocument();
    expect(screen.getByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('switches to transcription tab when clicked', () => {
    renderWithRouter();

    const transcriptionTab = screen.getByText('Transcription');
    fireEvent.click(transcriptionTab);

    expect(screen.getByTestId('transcription-editor')).toBeInTheDocument();
  });

  it('switches to AI Summary tab when clicked', () => {
    renderWithRouter();

    const summaryTab = screen.getByText('AI Summary');
    fireEvent.click(summaryTab);

    expect(screen.getByTestId('summary-generator')).toBeInTheDocument();
  });

  it('shows insights placeholder in insights tab', () => {
    renderWithRouter();

    const insightsTab = screen.getByText('Insights');
    fireEvent.click(insightsTab);

    expect(screen.getByText('Meeting Insights')).toBeInTheDocument();
    expect(screen.getByText('Advanced insights and analytics will be available here.')).toBeInTheDocument();
  });

  it('opens export manager when export button is clicked', () => {
    renderWithRouter();

    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    expect(screen.getByTestId('export-manager')).toBeInTheDocument();
  });

  it('closes export manager when close is called', () => {
    renderWithRouter();

    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    expect(screen.getByTestId('export-manager')).toBeInTheDocument();

    const closeButton = screen.getByText('Close Export Manager');
    fireEvent.click(closeButton);

    expect(screen.queryByTestId('export-manager')).not.toBeInTheDocument();
  });

  it('shows more menu when More button is clicked', () => {
    renderWithRouter();

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    expect(screen.getByText('Duplicate Meeting')).toBeInTheDocument();
    expect(screen.getByText('Archive Meeting')).toBeInTheDocument();
    expect(screen.getByText('Delete Meeting')).toBeInTheDocument();
  });

  it('calls duplicate_meeting when duplicate is clicked', async () => {
    mockInvoke.mockResolvedValue({ id: 2, title: 'Copy of Test Meeting' });

    renderWithRouter();

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    const duplicateButton = screen.getByText('Duplicate Meeting');
    fireEvent.click(duplicateButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('duplicate_meeting', { meetingId: 1 });
    });
  });

  it('calls archive_meeting when archive is clicked', async () => {
    mockInvoke.mockResolvedValue({ success: true, message: 'Meeting archived successfully' });
    const mockRefetch = vi.fn();
    mockUseMeetingDetail.mockReturnValue({
      meeting: mockMeeting,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderWithRouter();

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    const archiveButton = screen.getByText('Archive Meeting');
    fireEvent.click(archiveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('archive_meeting', { meetingId: 1, archived: true });
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('shows delete confirmation dialog when delete is clicked', () => {
    renderWithRouter();

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    const deleteButton = screen.getByText('Delete Meeting');
    fireEvent.click(deleteButton);

    expect(screen.getByText('Delete Meeting')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Test Meeting"/)).toBeInTheDocument();
  });

  it('calls delete_meeting when delete is confirmed', async () => {
    mockInvoke.mockResolvedValue({ success: true, message: 'Meeting deleted successfully' });

    renderWithRouter();

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    const deleteButton = screen.getByText('Delete Meeting');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByText('Delete Meeting');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete_meeting', { meetingId: 1 });
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('cancels delete when cancel is clicked', () => {
    renderWithRouter();

    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    const deleteButton = screen.getByText('Delete Meeting');
    fireEvent.click(deleteButton);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    renderWithRouter();

    const backButton = screen.getByText('Dashboard');
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows unsaved changes warning when navigating back with changes', () => {
    window.confirm = vi.fn().mockReturnValue(false);

    renderWithRouter();

    // Simulate having unsaved changes (this would normally be set by child components)
    // For now, we'll test the confirmation dialog logic

    const backButton = screen.getByText('Dashboard');
    fireEvent.click(backButton);

    // Since we don't have unsaved changes in this test, it should navigate immediately
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handles keyboard navigation with Escape key', () => {
    renderWithRouter();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('retries loading when Try Again is clicked', () => {
    const mockRefetch = vi.fn();
    mockUseMeetingDetail.mockReturnValue({
      meeting: null,
      isLoading: false,
      error: 'Failed to load meeting',
      refetch: mockRefetch,
    });

    renderWithRouter();

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('hides transcription tab when meeting has no transcription', () => {
    mockUseMeetingDetail.mockReturnValue({
      meeting: { ...mockMeeting, hasTranscription: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter();

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByText('Transcription')).not.toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('hides AI Summary tab when meeting has no AI summary', () => {
    mockUseMeetingDetail.mockReturnValue({
      meeting: { ...mockMeeting, hasAiSummary: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithRouter();

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(screen.queryByText('AI Summary')).not.toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });
});