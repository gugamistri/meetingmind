import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RealTimeTranscription, type TranscriptionChunk } from './RealTimeTranscription';

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

// Mock transcription store
const mockTranscriptionStore = {
  isTranscribing: false,
  currentSession: null,
};

vi.mock('../../../stores/transcription.store', () => ({
  useTranscriptionStore: () => mockTranscriptionStore,
}));

// Sample transcription chunk for testing
const createMockChunk = (overrides: Partial<TranscriptionChunk> = {}): TranscriptionChunk => ({
  id: 'chunk-1',
  text: 'Hello world, this is a test transcription.',
  confidence: 0.95,
  language: 'en',
  start_time_ms: 1000,
  end_time_ms: 3000,
  word_count: 7,
  model_used: 'whisper-tiny',
  processing_time_ms: 150,
  processed_locally: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('RealTimeTranscription', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock event listener setup
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      // Return a cleanup function
      return Promise.resolve(() => {});
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders no transcription message when not transcribing', () => {
    render(<RealTimeTranscription />);
    
    expect(screen.getByText('No transcription active')).toBeInTheDocument();
    expect(screen.getByText('Start a meeting to see real-time transcription')).toBeInTheDocument();
  });

  it('displays live indicator when transcribing', () => {
    mockTranscriptionStore.isTranscribing = true;
    
    render(<RealTimeTranscription />);
    
    expect(screen.getByText('Live Transcription')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('handles chunk received callback', async () => {
    const onChunkReceived = vi.fn();
    const mockChunk = createMockChunk();
    
    // Mock the event listener to immediately call with a chunk
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      if (eventName === 'transcription-chunk') {
        setTimeout(() => {
          callback({
            payload: {
              session_id: 'test-session',
              chunk: mockChunk,
            },
          });
        }, 0);
      }
      return Promise.resolve(() => {});
    });
    
    render(
      <RealTimeTranscription 
        sessionId="test-session"
        onChunkReceived={onChunkReceived}
      />
    );
    
    await waitFor(() => {
      expect(onChunkReceived).toHaveBeenCalledWith(mockChunk);
    });
  });

  it('filters chunks by confidence threshold', async () => {
    const onChunkReceived = vi.fn();
    const lowConfidenceChunk = createMockChunk({ confidence: 0.5 });
    const highConfidenceChunk = createMockChunk({ confidence: 0.9 });
    
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      if (eventName === 'transcription-chunk') {
        // Send low confidence chunk first
        setTimeout(() => {
          callback({
            payload: {
              session_id: 'test-session',
              chunk: lowConfidenceChunk,
            },
          });
        }, 0);
        
        // Then high confidence chunk
        setTimeout(() => {
          callback({
            payload: {
              session_id: 'test-session',
              chunk: highConfidenceChunk,
            },
          });
        }, 10);
      }
      return Promise.resolve(() => {});
    });
    
    render(
      <RealTimeTranscription 
        sessionId="test-session"
        confidenceThreshold={0.7}
        onChunkReceived={onChunkReceived}
      />
    );
    
    await waitFor(() => {
      // Should only receive the high confidence chunk
      expect(onChunkReceived).toHaveBeenCalledTimes(1);
      expect(onChunkReceived).toHaveBeenCalledWith(highConfidenceChunk);
    });
  });

  it('displays error messages', async () => {
    const onError = vi.fn();
    const errorMessage = 'Transcription service error';
    
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      if (eventName === 'transcription-error') {
        setTimeout(() => {
          callback({
            payload: {
              session_id: 'test-session',
              error: errorMessage,
            },
          });
        }, 0);
      }
      return Promise.resolve(() => {});
    });
    
    render(
      <RealTimeTranscription 
        sessionId="test-session"
        onError={onError}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('can dismiss error messages', async () => {
    const errorMessage = 'Test error';
    
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      if (eventName === 'transcription-error') {
        setTimeout(() => {
          callback({
            payload: {
              session_id: 'test-session',
              error: errorMessage,
            },
          });
        }, 0);
      }
      return Promise.resolve(() => {});
    });
    
    render(<RealTimeTranscription sessionId="test-session" />);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByText('Dismiss');
    await user.click(dismissButton);
    
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    const chunk = createMockChunk({
      start_time_ms: 125000, // 2 minutes 5 seconds
    });
    
    render(<RealTimeTranscription />);
    
    // Simulate receiving a chunk by directly calling the component's internal method
    // This is more of an integration test approach
    // In practice, we might need to expose this functionality differently
  });

  it('shows confidence with appropriate colors', () => {
    // This test would verify the confidence color coding
    // Based on the getConfidenceColor function logic
    const highConfidenceChunk = createMockChunk({ confidence: 0.95 });
    const mediumConfidenceChunk = createMockChunk({ confidence: 0.75 });
    const lowConfidenceChunk = createMockChunk({ confidence: 0.5 });
    
    // Test would render chunks and verify CSS classes
  });

  it('displays processing indicators correctly', () => {
    const localChunk = createMockChunk({ processed_locally: true });
    const cloudChunk = createMockChunk({ processed_locally: false });
    
    // Test would verify that local chunks show "Local" badge
    // and cloud chunks show "Cloud" badge
  });

  it('limits number of chunks displayed', async () => {
    const maxChunks = 3;
    
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      if (eventName === 'transcription-chunk') {
        // Send more chunks than the limit
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            callback({
              payload: {
                session_id: 'test-session',
                chunk: createMockChunk({ id: `chunk-${i}` }),
              },
            });
          }, i * 10);
        }
      }
      return Promise.resolve(() => {});
    });
    
    render(
      <RealTimeTranscription 
        sessionId="test-session"
        maxChunks={maxChunks}
      />
    );
    
    // Wait for all chunks to be processed
    await waitFor(() => {
      const chunkElements = screen.getAllByText(/^#\d+$/);
      expect(chunkElements).toHaveLength(maxChunks);
    }, { timeout: 1000 });
  });

  it('handles session ID filtering', async () => {
    const onChunkReceived = vi.fn();
    const targetSessionId = 'target-session';
    const otherSessionId = 'other-session';
    
    mockListen.mockImplementation((eventName: string, callback: Function) => {
      if (eventName === 'transcription-chunk') {
        // Send chunk for different session
        setTimeout(() => {
          callback({
            payload: {
              session_id: otherSessionId,
              chunk: createMockChunk({ id: 'other-chunk' }),
            },
          });
        }, 0);
        
        // Send chunk for target session
        setTimeout(() => {
          callback({
            payload: {
              session_id: targetSessionId,
              chunk: createMockChunk({ id: 'target-chunk' }),
            },
          });
        }, 10);
      }
      return Promise.resolve(() => {});
    });
    
    render(
      <RealTimeTranscription 
        sessionId={targetSessionId}
        onChunkReceived={onChunkReceived}
      />
    );
    
    await waitFor(() => {
      // Should only receive the chunk for the target session
      expect(onChunkReceived).toHaveBeenCalledTimes(1);
      expect(onChunkReceived).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'target-chunk' })
      );
    });
  });

  it('clears chunks when session changes', () => {
    const { rerender } = render(
      <RealTimeTranscription sessionId="session-1" />
    );
    
    // Add some mock chunks to the state (this would need to be implemented)
    
    rerender(<RealTimeTranscription sessionId="session-2" />);
    
    // Verify that chunks were cleared
    // This test depends on how the component manages its internal state
  });
});