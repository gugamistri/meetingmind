/**
 * Tests for AudioControls component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AudioControls } from './AudioControls';
import { useAudioStore, useAudioStatus, useAudioError } from '../../../stores/audio.store';

// Mock the audio store
vi.mock('../../../stores/audio.store', () => ({
  useAudioStore: vi.fn(),
  useAudioStatus: vi.fn(),
  useAudioError: vi.fn(),
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

const mockAudioStore = {
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  clearError: vi.fn(),
};

const defaultAudioStatus = {
  isRecording: false,
  isStarting: false,
  isStopping: false,
  hasError: false,
};

describe('AudioControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (useAudioStore as any).mockReturnValue(mockAudioStore);
    (useAudioStatus as any).mockReturnValue(defaultAudioStatus);
    (useAudioError as any).mockReturnValue(null);
  });

  it('renders start recording button when not recording', () => {
    render(<AudioControls />);
    
    const startButton = screen.getByRole('button', { name: /start recording/i });
    expect(startButton).toBeInTheDocument();
    expect(startButton).not.toBeDisabled();
  });

  it('renders stop recording button when recording', () => {
    (useAudioStatus as any).mockReturnValue({
      ...defaultAudioStatus,
      isRecording: true,
    });

    render(<AudioControls />);
    
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    expect(stopButton).toBeInTheDocument();
    expect(stopButton).not.toBeDisabled();
  });

  it('shows loading state when starting', () => {
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      isStarting: true,
    }));

    render(<AudioControls />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText(/starting recording/i)).toBeInTheDocument();
  });

  it('shows loading state when stopping', () => {
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      isRecording: true,
      isStopping: true,
    }));

    render(<AudioControls />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText(/stopping recording/i)).toBeInTheDocument();
  });

  it('calls startRecording when start button is clicked', async () => {
    mockAudioStore.startRecording.mockResolvedValue(undefined);
    
    render(<AudioControls />);
    
    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockAudioStore.clearError).toHaveBeenCalled();
      expect(mockAudioStore.startRecording).toHaveBeenCalled();
    });
  });

  it('calls stopRecording when stop button is clicked', async () => {
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      isRecording: true,
    }));
    
    mockAudioStore.stopRecording.mockResolvedValue(undefined);
    
    render(<AudioControls />);
    
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockAudioStore.clearError).toHaveBeenCalled();
      expect(mockAudioStore.stopRecording).toHaveBeenCalled();
    });
  });

  it('shows error message when there is an error', () => {
    const errorMessage = 'Audio device not found';
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      hasError: true,
    }));
    (useAudioStore as any).useAudioError = vi.fn(() => errorMessage);

    render(<AudioControls />);
    
    expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('disables button when there is an error', () => {
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      hasError: true,
    }));
    (useAudioStore as any).useAudioError = vi.fn(() => 'Some error');

    render(<AudioControls />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('calls onRecordingStart callback when recording starts', async () => {
    const onRecordingStart = vi.fn();
    mockAudioStore.startRecording.mockResolvedValue(undefined);
    
    render(<AudioControls onRecordingStart={onRecordingStart} />);
    
    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(onRecordingStart).toHaveBeenCalled();
    });
  });

  it('calls onRecordingStop callback when recording stops', async () => {
    const onRecordingStop = vi.fn();
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      isRecording: true,
    }));
    
    mockAudioStore.stopRecording.mockResolvedValue(undefined);
    
    render(<AudioControls onRecordingStop={onRecordingStop} />);
    
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(onRecordingStop).toHaveBeenCalled();
    });
  });

  it('calls onError callback when recording fails', async () => {
    const onError = vi.fn();
    const error = new Error('Recording failed');
    mockAudioStore.startRecording.mockRejectedValue(error);
    
    render(<AudioControls onError={onError} />);
    
    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Recording failed');
    });
  });

  it('handles keyboard shortcut (spacebar) to toggle recording', () => {
    const { rerender } = render(<AudioControls />);
    
    // Test starting recording with spacebar
    fireEvent.keyDown(document, { code: 'Space' });
    expect(mockAudioStore.startRecording).toHaveBeenCalled();

    // Change to recording state
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      isRecording: true,
    }));
    
    rerender(<AudioControls />);
    
    // Test stopping recording with spacebar
    fireEvent.keyDown(document, { code: 'Space' });
    expect(mockAudioStore.stopRecording).toHaveBeenCalled();
  });

  it('ignores spacebar when input is focused', () => {
    render(
      <div>
        <input data-testid="text-input" />
        <AudioControls />
      </div>
    );
    
    const input = screen.getByTestId('text-input');
    input.focus();
    
    fireEvent.keyDown(document, { code: 'Space' });
    expect(mockAudioStore.startRecording).not.toHaveBeenCalled();
  });

  it('shows keyboard shortcut hint', () => {
    render(<AudioControls />);
    expect(screen.getByText(/press space to start/i)).toBeInTheDocument();
  });

  it('shows different hint when recording', () => {
    (useAudioStore as any).useAudioStatus = vi.fn(() => ({
      ...defaultAudioStatus,
      isRecording: true,
    }));

    render(<AudioControls />);
    expect(screen.getByText(/press space to stop/i)).toBeInTheDocument();
  });

  it('hides status when showStatus is false', () => {
    render(<AudioControls showStatus={false} />);
    expect(screen.queryByText(/ready to record/i)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AudioControls className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies size-based styling', () => {
    render(<AudioControls size="lg" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
  });
});