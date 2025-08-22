import { useEffect, useCallback, useState } from 'react';
import { useTranscriptionStore, ensureTranscriptionServiceInitialized } from '../../stores/transcription.store';
import { TranscriptionChunk } from '../../components/transcription/RealTimeTranscription/RealTimeTranscription';

export interface UseTranscriptionOptions {
  /** Auto-initialize the service */
  autoInitialize?: boolean;
  /** Session ID to use for transcription */
  sessionId?: string;
  /** Meeting ID to associate with transcription */
  meetingId?: number;
  /** Auto-start transcription when session is set */
  autoStart?: boolean;
}

export interface UseTranscriptionReturn {
  // Service state
  isInitialized: boolean;
  isTranscribing: boolean;
  isProcessing: boolean;
  
  // Current session data
  currentSession: any;
  latestChunk: TranscriptionChunk | null;
  recentChunks: TranscriptionChunk[];
  
  // Configuration
  config: any;
  
  // Error handling
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  startTranscription: (sessionId?: string, meetingId?: number) => Promise<void>;
  stopTranscription: () => Promise<void>;
  updateConfig: (config: any) => Promise<void>;
  processAudioChunk: (audioData: number[], sampleRate: number) => Promise<void>;
  clearError: () => void;
  
  // Statistics
  statistics: any;
  updateStatistics: () => Promise<void>;
}

/**
 * Hook for managing transcription functionality
 */
export const useTranscription = (options: UseTranscriptionOptions = {}): UseTranscriptionReturn => {
  const {
    autoInitialize = true,
    sessionId,
    meetingId,
    autoStart = false,
  } = options;

  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Zustand store selectors
  const {
    isInitialized,
    isTranscribing,
    isProcessing,
    currentSession,
    latestChunk,
    recentChunks,
    config,
    error,
    statistics,
    initializeService: _initializeService,
    startTranscription: startTranscriptionAction,
    stopTranscription: stopTranscriptionAction,
    updateConfig: updateConfigAction,
    processAudioChunk: processAudioChunkAction,
    clearError,
    updateStatistics,
  } = useTranscriptionStore();

  // Initialize service
  const initialize = useCallback(async () => {
    try {
      setInitializationError(null);
      await ensureTranscriptionServiceInitialized();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize transcription service';
      setInitializationError(errorMessage);
      throw error;
    }
  }, []);

  // Start transcription with session/meeting
  const startTranscription = useCallback(async (
    sessionIdParam?: string,
    meetingIdParam?: number
  ) => {
    const effectiveSessionId = sessionIdParam || sessionId || `session-${Date.now()}`;
    const effectiveMeetingId = meetingIdParam || meetingId;
    
    await startTranscriptionAction(effectiveSessionId, effectiveMeetingId);
  }, [sessionId, meetingId, startTranscriptionAction]);

  // Process audio chunk wrapper
  const processAudioChunk = useCallback(async (
    audioData: number[],
    sampleRate: number
  ) => {
    if (!isTranscribing) {
      console.warn('Cannot process audio chunk: transcription not active');
      return;
    }
    
    await processAudioChunkAction(audioData, sampleRate);
  }, [isTranscribing, processAudioChunkAction]);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize && !isInitialized && !initializationError) {
      initialize().catch((error) => {
        console.error('Auto-initialization failed:', error);
      });
    }
  }, [autoInitialize, isInitialized, initialize, initializationError]);

  // Auto-start transcription when session is set
  useEffect(() => {
    if (autoStart && isInitialized && sessionId && !isTranscribing && !currentSession) {
      startTranscription().catch((error) => {
        console.error('Auto-start transcription failed:', error);
      });
    }
  }, [autoStart, isInitialized, sessionId, isTranscribing, currentSession, startTranscription]);

  return {
    // Service state
    isInitialized,
    isTranscribing,
    isProcessing,
    
    // Current session data
    currentSession,
    latestChunk,
    recentChunks,
    
    // Configuration
    config,
    
    // Error handling
    error: error || initializationError,
    
    // Actions
    initialize,
    startTranscription,
    stopTranscription: stopTranscriptionAction,
    updateConfig: updateConfigAction,
    processAudioChunk,
    clearError: () => {
      clearError();
      setInitializationError(null);
    },
    
    // Statistics
    statistics,
    updateStatistics,
  };
};

export default useTranscription;