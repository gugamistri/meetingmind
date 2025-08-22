import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TranscriptionChunk } from '../components/transcription/RealTimeTranscription/RealTimeTranscription';

export interface TranscriptionConfig {
  language: string;
  model: string;
  mode: string;
  confidence_threshold: number;
  real_time_streaming: boolean;
  chunk_size_seconds: number;
  chunk_overlap_seconds: number;
  max_latency_ms: number;
}

export interface TranscriptionSession {
  id: string;
  meetingId?: number;
  config: TranscriptionConfig;
  startTime: Date;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  chunks: TranscriptionChunk[];
  totalChunks: number;
  totalDuration: number;
  averageConfidence: number;
}

export interface TranscriptionStatistics {
  totalSessions: number;
  totalChunks: number;
  averageConfidence: number;
  totalDuration: number;
  localProcessingPercentage: number;
  processingTimeAverage: number;
}

export interface TranscriptionState {
  // Service state
  isInitialized: boolean;
  isTranscribing: boolean;
  isProcessing: boolean;
  
  // Current session
  currentSession: TranscriptionSession | null;
  
  // Configuration
  config: TranscriptionConfig;
  
  // Real-time data
  latestChunk: TranscriptionChunk | null;
  recentChunks: TranscriptionChunk[];
  
  // Statistics
  statistics: TranscriptionStatistics | null;
  
  // Error handling
  error: string | null;
  lastError: string | null;
  
  // UI state
  isConfigPanelOpen: boolean;
  selectedChunk: TranscriptionChunk | null;
  searchQuery: string;
  
  // Actions
  initializeService: () => Promise<void>;
  startTranscription: (sessionId: string, meetingId?: number, config?: Partial<TranscriptionConfig>) => Promise<void>;
  stopTranscription: () => Promise<void>;
  updateConfig: (config: Partial<TranscriptionConfig>) => Promise<void>;
  processAudioChunk: (audioData: number[], sampleRate: number) => Promise<void>;
  
  // Data management
  addChunk: (chunk: TranscriptionChunk) => void;
  clearChunks: () => void;
  setSelectedChunk: (chunk: TranscriptionChunk | null) => void;
  
  // UI actions
  setConfigPanelOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
  
  // Statistics
  updateStatistics: () => Promise<void>;
  
  // Event handling
  setupEventListeners: () => Promise<() => void>;
}

const defaultConfig: TranscriptionConfig = {
  language: 'auto',
  model: 'tiny',
  mode: 'hybrid',
  confidence_threshold: 0.7,
  real_time_streaming: true,
  chunk_size_seconds: 30.0,
  chunk_overlap_seconds: 5.0,
  max_latency_ms: 3000,
};

export const useTranscriptionStore = create<TranscriptionState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isInitialized: false,
    isTranscribing: false,
    isProcessing: false,
    currentSession: null,
    config: defaultConfig,
    latestChunk: null,
    recentChunks: [],
    statistics: null,
    error: null,
    lastError: null,
    isConfigPanelOpen: false,
    selectedChunk: null,
    searchQuery: '',

    // Initialize transcription service
    initializeService: async () => {
      try {
        set({ error: null });
        
        await invoke('initialize_transcription_service');
        
        // Set up event listeners
        const state = get();
        const cleanup = await state.setupEventListeners();
        
        set({ isInitialized: true });
        
        // Store cleanup function for later use
        (window as any).__transcriptionCleanup = cleanup;
        
        console.log('Transcription service initialized');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize transcription service';
        set({ error: errorMessage, lastError: errorMessage });
        console.error('Failed to initialize transcription service:', error);
        throw error;
      }
    },

    // Start transcription session
    startTranscription: async (sessionId: string, meetingId?: number, configOverrides?: Partial<TranscriptionConfig>) => {
      try {
        set({ error: null, isProcessing: true });
        
        const state = get();
        
        // Update config if overrides provided
        let finalConfig = state.config;
        if (configOverrides) {
          finalConfig = { ...state.config, ...configOverrides };
          await invoke('update_transcription_config', { 
            request: { config: finalConfig } 
          });
          set({ config: finalConfig });
        }
        
        // Start transcription
        await invoke('start_transcription', {
          request: {
            session_id: sessionId,
            config: finalConfig,
          },
        });
        
        // Create session object
        const session: TranscriptionSession = {
          id: sessionId,
          ...(meetingId !== undefined ? { meetingId } : {}),
          config: finalConfig,
          startTime: new Date(),
          status: 'active',
          chunks: [],
          totalChunks: 0,
          totalDuration: 0,
          averageConfidence: 0,
        };
        
        set({ 
          currentSession: session,
          isTranscribing: true,
          isProcessing: false,
          recentChunks: [],
          latestChunk: null,
        });
        
        console.log('Transcription started for session:', sessionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start transcription';
        set({ 
          error: errorMessage, 
          lastError: errorMessage, 
          isProcessing: false,
          isTranscribing: false,
        });
        console.error('Failed to start transcription:', error);
        throw error;
      }
    },

    // Stop transcription session
    stopTranscription: async () => {
      try {
        set({ error: null, isProcessing: true });
        
        await invoke('stop_transcription');
        
        const state = get();
        if (state.currentSession) {
          const updatedSession: TranscriptionSession = {
            ...state.currentSession,
            status: 'completed',
          };
          
          set({ 
            currentSession: updatedSession,
            isTranscribing: false,
            isProcessing: false,
          });
        } else {
          set({ 
            isTranscribing: false,
            isProcessing: false,
          });
        }
        
        console.log('Transcription stopped');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to stop transcription';
        set({ 
          error: errorMessage, 
          lastError: errorMessage, 
          isProcessing: false,
        });
        console.error('Failed to stop transcription:', error);
        throw error;
      }
    },

    // Update transcription configuration
    updateConfig: async (configOverrides: Partial<TranscriptionConfig>) => {
      try {
        set({ error: null });
        
        const state = get();
        const newConfig = { ...state.config, ...configOverrides };
        
        await invoke('update_transcription_config', {
          request: { config: newConfig },
        });
        
        set({ config: newConfig });
        
        console.log('Transcription config updated:', newConfig);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update configuration';
        set({ error: errorMessage, lastError: errorMessage });
        console.error('Failed to update transcription config:', error);
        throw error;
      }
    },

    // Process audio chunk
    processAudioChunk: async (audioData: number[], sampleRate: number) => {
      try {
        const state = get();
        if (!state.isTranscribing) {
          return;
        }
        
        const chunks = await invoke<TranscriptionChunk[]>('process_audio_chunk', {
          request: {
            audio_data: audioData,
            sample_rate: sampleRate,
          },
        });
        
        // Add chunks to store
        chunks.forEach((chunk: TranscriptionChunk) => {
          state.addChunk(chunk);
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process audio chunk';
        set({ error: errorMessage, lastError: errorMessage });
        console.error('Failed to process audio chunk:', error);
      }
    },

    // Add transcription chunk
    addChunk: (chunk: TranscriptionChunk) => {
      set(state => {
        const updatedRecentChunks = [...state.recentChunks, chunk].slice(-20); // Keep last 20 chunks
        
        let updatedSession = state.currentSession;
        if (updatedSession) {
          const sessionChunks = [...updatedSession.chunks, chunk];
          const totalChunks = sessionChunks.length;
          const totalDuration = sessionChunks.reduce((sum, c) => 
            sum + (c.end_time_ms - c.start_time_ms), 0) / 1000;
          const averageConfidence = sessionChunks.reduce((sum, c) => 
            sum + c.confidence, 0) / totalChunks;
          
          updatedSession = {
            ...updatedSession,
            chunks: sessionChunks,
            totalChunks,
            totalDuration,
            averageConfidence,
          };
        }
        
        return {
          latestChunk: chunk,
          recentChunks: updatedRecentChunks,
          currentSession: updatedSession,
        };
      });
    },

    // Clear chunks
    clearChunks: () => {
      set({ 
        recentChunks: [], 
        latestChunk: null,
        selectedChunk: null,
      });
    },

    // Set selected chunk
    setSelectedChunk: (chunk: TranscriptionChunk | null) => {
      set({ selectedChunk: chunk });
    },

    // UI actions
    setConfigPanelOpen: (open: boolean) => {
      set({ isConfigPanelOpen: open });
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    clearError: () => {
      set({ error: null });
    },

    // Update statistics
    updateStatistics: async () => {
      try {
        const stats = await invoke<TranscriptionStatistics>('get_transcription_statistics');
        set({ statistics: stats });
      } catch (error) {
        console.error('Failed to update statistics:', error);
      }
    },

    // Set up event listeners
    setupEventListeners: async () => {
      const unlisteners: (() => void)[] = [];
      
      try {
        // Listen for transcription chunks
        const unlistenChunk = await listen('transcription-chunk', (event: any) => {
          const data = event.payload;
          const state = get();
          
          // Only process chunks for current session
          if (state.currentSession?.id === data.session_id) {
            state.addChunk(data.chunk);
          }
        });
        unlisteners.push(unlistenChunk);

        // Listen for session events
        const unlistenSessionStarted = await listen('transcription-session-started', (event: any) => {
          const data = event.payload;
          console.log('Transcription session started:', data.session_id);
        });
        unlisteners.push(unlistenSessionStarted);

        const unlistenSessionStopped = await listen('transcription-session-stopped', (event: any) => {
          const data = event.payload;
          const state = get();
          
          if (state.currentSession?.id === data.session_id) {
            set(prevState => ({
              currentSession: prevState.currentSession ? {
                ...prevState.currentSession,
                status: 'completed',
              } : null,
              isTranscribing: false,
            }));
          }
          
          console.log('Transcription session stopped:', data.session_id);
        });
        unlisteners.push(unlistenSessionStopped);

        // Listen for errors
        const unlistenError = await listen('transcription-error', (event: any) => {
          const data = event.payload;
          const errorMessage = data.error;
          
          set({ 
            error: errorMessage, 
            lastError: errorMessage,
            isTranscribing: false,
          });
          
          console.error('Transcription error:', errorMessage);
        });
        unlisteners.push(unlistenError);

        // Listen for confidence updates
        const unlistenConfidence = await listen('transcription-confidence-update', (event: any) => {
          const data = event.payload;
          console.log(`Confidence update for ${data.session_id}: ${data.confidence}`);
        });
        unlisteners.push(unlistenConfidence);

        // Return cleanup function
        return () => {
          unlisteners.forEach(unlisten => unlisten());
        };
        
      } catch (error) {
        console.error('Failed to set up event listeners:', error);
        // Clean up any listeners that were successfully created
        unlisteners.forEach(unlisten => unlisten());
        throw error;
      }
    },
  }))
);

// Initialize service on first use
let initializationPromise: Promise<void> | null = null;

export const ensureTranscriptionServiceInitialized = async () => {
  const state = useTranscriptionStore.getState();
  
  if (state.isInitialized) {
    return;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = state.initializeService();
  return initializationPromise;
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const cleanup = (window as any).__transcriptionCleanup;
    if (cleanup) {
      cleanup();
    }
  });
}