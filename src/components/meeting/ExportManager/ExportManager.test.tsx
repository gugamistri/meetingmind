import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ExportManager } from './ExportManager';
import { ExportFormat } from '@/types/transcription.types';
import { DetailedMeeting } from '@/types/meeting.types';

// Mock Tauri API
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

const mockMeeting: DetailedMeeting = {
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
  transcriptions: [
    {
      id: 1,
      meetingId: 1,
      content: 'This is a sample transcription content.',
      confidence: 0.95,
      language: 'en-US',
      modelUsed: 'whisper-large-v2',
      createdAt: '2025-01-15T10:30:00Z',
      segments: [],
      speakers: [],
      totalDuration: 3600,
      processingTimeMs: 5000,
      processedLocally: true,
    }
  ],
  summaries: [
    {
      id: 'summary_1',
      meetingId: '1',
      templateId: 1,
      content: '## Meeting Summary\n\nThis was a productive meeting.',
      modelUsed: 'gpt-4',
      provider: 'openai',
      costUsd: 0.05,
      processingTimeMs: 2500,
      tokenCount: 150,
      confidenceScore: 0.95,
      createdAt: '2025-01-15T11:00:00Z',
    }
  ],
  hasTranscription: true,
  hasAiSummary: true,
  hasAudioFile: true,
  audioFilePath: '/path/to/audio.wav',
  duration: 3600,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T11:00:00Z',
};

describe('ExportManager', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export manager when open', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Export Meeting')).toBeInTheDocument();
    expect(screen.getByText('Test Meeting')).toBeInTheDocument();
    expect(screen.getByText('Export Format')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Export Meeting')).not.toBeInTheDocument();
  });

  it('displays all export format options', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByLabelText(/Markdown/)).toBeInTheDocument();
    expect(screen.getByLabelText(/PDF/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Word Document/)).toBeInTheDocument();
    expect(screen.getByLabelText(/JSON/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Plain Text/)).toBeInTheDocument();
  });

  it('has markdown selected by default', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const markdownRadio = screen.getByDisplayValue('markdown');
    expect(markdownRadio).toBeChecked();
  });

  it('allows format selection change', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const pdfRadio = screen.getByDisplayValue('pdf');
    fireEvent.click(pdfRadio);

    expect(pdfRadio).toBeChecked();
  });

  it('displays export options with default values', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByLabelText('Include timestamps')).toBeChecked();
    expect(screen.getByLabelText('Include speaker identification')).toBeChecked();
    expect(screen.getByLabelText('Include confidence scores')).not.toBeChecked();
    expect(screen.getByLabelText('Include meeting metadata')).toBeChecked();
  });

  it('allows toggling export options', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const timestampsCheckbox = screen.getByLabelText('Include timestamps');
    fireEvent.click(timestampsCheckbox);

    expect(timestampsCheckbox).not.toBeChecked();
  });

  it('calls export_meeting command when Start Export is clicked', async () => {
    mockInvoke.mockResolvedValue({
      file_path: '/tmp/export.md',
      download_url: 'http://localhost:8080/exports/export.md',
      expires_at: '2025-01-16T10:00:00Z',
      format: 'markdown',
      size_bytes: 1024,
    });

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('export_meeting', {
        meetingId: 1,
        options: {
          format: ExportFormat.Markdown,
          includeTimestamps: true,
          includeSpeakers: true,
          includeConfidenceScores: false,
          includeMetadata: true,
          dateFormat: 'YYYY-MM-DD HH:mm:ss',
        },
      });
    });
  });

  it('shows progress during export', async () => {
    mockInvoke.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        file_path: '/tmp/export.md',
        download_url: 'http://localhost:8080/exports/export.md',
        expires_at: '2025-01-16T10:00:00Z',
        format: 'markdown',
        size_bytes: 1024,
      }), 100);
    }));

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('Exporting...')).toBeInTheDocument();
    expect(screen.getByText('Preparing export...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Exporting...')).not.toBeInTheDocument();
    });
  });

  it('displays success message after export', async () => {
    mockInvoke.mockResolvedValue({
      file_path: '/tmp/export.md',
      download_url: 'http://localhost:8080/exports/export.md',
      expires_at: '2025-01-16T10:00:00Z',
      format: 'markdown',
      size_bytes: 1024,
    });

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export completed successfully')).toBeInTheDocument();
      expect(screen.getByText('File size: 1 KB')).toBeInTheDocument();
      expect(screen.getByText('Open File')).toBeInTheDocument();
    });
  });

  it('displays error message on export failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Export failed'));

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument();
      expect(screen.getByText('Export failed')).toBeInTheDocument();
    });
  });

  it('calls show_in_folder when Open File is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        file_path: '/tmp/export.md',
        download_url: 'http://localhost:8080/exports/export.md',
        expires_at: '2025-01-16T10:00:00Z',
        format: 'markdown',
        size_bytes: 1024,
      })
      .mockResolvedValueOnce(undefined);

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Open File')).toBeInTheDocument();
    });

    const openFileButton = screen.getByText('Open File');
    fireEvent.click(openFileButton);

    expect(mockInvoke).toHaveBeenCalledWith('show_in_folder', {
      path: '/tmp/export.md',
    });
  });

  it('closes modal when close button is clicked', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when cancel is clicked', () => {
    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables buttons during export process', async () => {
    mockInvoke.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        file_path: '/tmp/export.md',
        format: 'markdown',
        size_bytes: 1024,
      }), 100);
    }));

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('Exporting...')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText('Exporting...')).not.toBeInTheDocument();
    });
  });

  it('formats file size correctly', async () => {
    mockInvoke.mockResolvedValue({
      file_path: '/tmp/export.md',
      format: 'markdown',
      size_bytes: 1024 * 1024, // 1 MB
    });

    render(
      <ExportManager
        meeting={mockMeeting}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const exportButton = screen.getByText('Start Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('File size: 1 MB')).toBeInTheDocument();
    });
  });
});