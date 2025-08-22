import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { TranscriptionChunk } from '../../components/transcription/RealTimeTranscription/RealTimeTranscription';

export interface UseTranscriptionStreamOptions {
  /** Session ID to filter events for */
  sessionId?: string;
  /** Maximum number of chunks to keep in memory */
  maxChunks?: number;
  /** Minimum confidence threshold to accept chunks */
  minConfidence?: number;
  /** Whether to auto-scroll container to new chunks */
  autoScroll?: boolean;
  /** Container element to auto-scroll */
  scrollContainer?: HTMLElement | null;
  /** Callback when new chunk is received */
  onChunk?: (chunk: TranscriptionChunk) => void;
  /** Callback when transcription starts */
  onStart?: (sessionId: string) => void;
  /** Callback when transcription stops */
  onStop?: (sessionId: string, totalChunks: number) => void;
  /** Callback when error occurs */
  onError?: (error: string, sessionId?: string) => void;
}

export interface UseTranscriptionStreamReturn {
  /** All received chunks */
  chunks: TranscriptionChunk[];
  /** Latest received chunk */
  latestChunk: TranscriptionChunk | null;
  /** Whether stream is currently active */
  isActive: boolean;
  /** Current session ID */
  currentSessionId: string | null;
  /** Total chunks received */
  totalChunks: number;
  /** Average confidence of all chunks */
  averageConfidence: number;
  /** Clear all chunks */
  clearChunks: () => void;
  /** Remove specific chunk */
  removeChunk: (chunkId: string) => void;
  /** Get chunks filtered by criteria */
  getFilteredChunks: (filter: (chunk: TranscriptionChunk) => boolean) => TranscriptionChunk[];
}

/**
 * Hook for streaming real-time transcription events
 */
export const useTranscriptionStream = (
  options: UseTranscriptionStreamOptions = {}
): UseTranscriptionStreamReturn => {
  const {
    sessionId,
    maxChunks = 100,
    minConfidence = 0.0,
    autoScroll = false,
    scrollContainer,
    onChunk,
    onStart,
    onStop,
    onError,
  } = options;

  const [chunks, setChunks] = useState<TranscriptionChunk[]>([]);
  const [latestChunk, setLatestChunk] = useState<TranscriptionChunk | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Refs for stable callbacks
  const onChunkRef = useRef(onChunk);
  const onStartRef = useRef(onStart);
  const onStopRef = useRef(onStop);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onChunkRef.current = onChunk;
    onStartRef.current = onStart;
    onStopRef.current = onStop;
    onErrorRef.current = onError;
  }, [onChunk, onStart, onStop, onError]);

  // Auto-scroll functionality
  const scrollToBottom = useCallback(() => {
    if (autoScroll && scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [autoScroll, scrollContainer]);

  // Add new chunk
  const addChunk = useCallback((chunk: TranscriptionChunk) => {
    // Note: Session filtering should be done at the event listener level
    // since TranscriptionChunk doesn't contain session_id

    // Filter by confidence
    if (chunk.confidence < minConfidence) {
      return;
    }

    setChunks(prevChunks => {
      const newChunks = [...prevChunks, chunk];
      
      // Limit number of chunks in memory
      if (newChunks.length > maxChunks) {
        return newChunks.slice(-maxChunks);
      }
      
      return newChunks;
    });

    setLatestChunk(chunk);
    
    // Call user callback
    onChunkRef.current?.(chunk);
    
    // Auto-scroll after state update
    setTimeout(scrollToBottom, 50);
  }, [sessionId, minConfidence, maxChunks, scrollToBottom]);

  // Clear all chunks
  const clearChunks = useCallback(() => {
    setChunks([]);
    setLatestChunk(null);
  }, []);

  // Remove specific chunk
  const removeChunk = useCallback((chunkId: string) => {
    setChunks(prevChunks => prevChunks.filter(chunk => chunk.id !== chunkId));
    
    // Clear latest chunk if it was removed
    setLatestChunk(prevLatest => 
      prevLatest?.id === chunkId ? null : prevLatest
    );
  }, []);

  // Get filtered chunks
  const getFilteredChunks = useCallback((
    filter: (chunk: TranscriptionChunk) => boolean
  ) => {
    return chunks.filter(filter);
  }, [chunks]);

  // Calculate average confidence
  const averageConfidence = chunks.length > 0 
    ? chunks.reduce((sum, chunk) => sum + chunk.confidence, 0) / chunks.length
    : 0;

  // Set up event listeners
  useEffect(() => {
    const setupEventListeners = async () => {
      const unlisteners: (() => void)[] = [];

      try {
        // Listen for transcription chunks
        const unlistenChunk = await listen('transcription-chunk', (event: any) => {
          const data = event.payload;
          if (data.chunk) {
            addChunk(data.chunk);
          }
        });
        unlisteners.push(unlistenChunk);

        // Listen for session started
        const unlistenStart = await listen('transcription-session-started', (event: any) => {
          const data = event.payload;
          const sessionId = data.session_id;
          
          setIsActive(true);
          setCurrentSessionId(sessionId);
          onStartRef.current?.(sessionId);
        });
        unlisteners.push(unlistenStart);

        // Listen for session stopped
        const unlistenStop = await listen('transcription-session-stopped', (event: any) => {
          const data = event.payload;
          const sessionId = data.session_id;
          const totalChunks = data.total_chunks || 0;
          
          setIsActive(false);
          setCurrentSessionId(null);
          onStopRef.current?.(sessionId, totalChunks);
        });
        unlisteners.push(unlistenStop);

        // Listen for transcription errors
        const unlistenError = await listen('transcription-error', (event: any) => {
          const data = event.payload;
          const error = data.error;
          const sessionId = data.session_id;
          
          onErrorRef.current?.(error, sessionId);
        });
        unlisteners.push(unlistenError);

        // Listen for chunk batches (for performance)
        const unlistenBatch = await listen('transcription-chunk-batch', (event: any) => {
          const data = event.payload;
          const chunks = data.chunks || [];
          
          chunks.forEach((chunk: any) => {
            addChunk(chunk);
          });
        });
        unlisteners.push(unlistenBatch);

        // Return cleanup function
        return () => {
          unlisteners.forEach(unlisten => unlisten());
        };
      } catch (error) {
        console.error('Failed to set up transcription stream listeners:', error);
        onErrorRef.current?.(
          'Failed to set up transcription stream',
          sessionId || undefined
        );
        return () => {};
      }
    };

    setupEventListeners().then(cleanup => {
      // Store cleanup function for component unmount
      return cleanup;
    });

    // Cleanup on unmount
    return () => {
      // The actual cleanup will be called by the promise above
    };
  }, [addChunk, sessionId]);

  // Clear chunks when session ID changes
  useEffect(() => {
    if (sessionId !== currentSessionId) {
      clearChunks();
    }
  }, [sessionId, currentSessionId, clearChunks]);

  return {
    chunks,
    latestChunk,
    isActive,
    currentSessionId,
    totalChunks: chunks.length,
    averageConfidence,
    clearChunks,
    removeChunk,
    getFilteredChunks,
  };
};

export default useTranscriptionStream;