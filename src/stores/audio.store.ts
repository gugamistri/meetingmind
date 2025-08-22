/**
 * Audio capture state management using Zustand
 * 
 * Manages the global state for audio capture operations,
 * device management, and real-time audio level monitoring.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  AudioDevice,
  AudioCaptureStatus,
  AudioStats,
  AudioCaptureConfig,
  AudioLevelEvent,
  AudioRecordingState,
  DEFAULT_AUDIO_CONFIG,
  AudioQualityInfo,
  AUDIO_LEVEL_THRESHOLDS,
  StartCaptureRequest,
} from '../types/audio.types';
import { tauriAudioService, TauriServiceError } from '../services/tauri.service';

interface AudioStore extends AudioRecordingState {
  // State properties
  error: string | null;
  isInitialized: boolean;
  lastLevelUpdate: number;
  recordingDuration: number;
  
  // Actions
  initializeAudio: () => Promise<void>;
  startRecording: (deviceName?: string, config?: AudioCaptureConfig) => Promise<void>;
  stopRecording: () => Promise<void>;
  switchDevice: (deviceName: string) => Promise<void>;
  updateConfig: (config: AudioCaptureConfig) => Promise<void>;
  refreshDevices: () => Promise<void>;
  clearError: () => void;
  
  // Internal actions
  setDevices: (devices: AudioDevice[]) => void;
  setStatus: (status: AudioCaptureStatus) => void;
  updateAudioLevel: (levelEvent: AudioLevelEvent) => void;
  updateStats: (stats: AudioStats) => void;
  setError: (error: string) => void;
  
  // Computed getters
  getAudioQuality: () => AudioQualityInfo;
  getSelectedDevice: () => AudioDevice | undefined;
  isDeviceAvailable: (deviceName: string) => boolean;
}

export const useAudioStore = create<AudioStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isRecording: false,
    isStarting: false,
    isStopping: false,
    hasError: false,
    availableDevices: [],
    audioLevel: 0,
    peakLevel: 0,
    stats: {
      samples_processed: 0,
      buffer_overruns: 0,
      buffer_underruns: 0,
      average_latency_ms: 0,
      peak_level: 0,
      rms_level: 0,
    },
    config: DEFAULT_AUDIO_CONFIG,
    error: null,
    isInitialized: false,
    lastLevelUpdate: 0,
    recordingDuration: 0,

    // Actions
    initializeAudio: async () => {
      try {
        set({ error: null });
        
        // Initialize backend service
        await tauriAudioService.initAudioService();
        
        // Get initial device list
        const devices = await tauriAudioService.getAudioInputDevices();
        const defaultDevice = devices.find(d => d.is_default);
        
        // Get current configuration
        const config = await tauriAudioService.getAudioConfig();
        
        // Subscribe to events
        await tauriAudioService.subscribeToAudioLevels((event) => {
          get().updateAudioLevel(event);
        });
        
        await tauriAudioService.subscribeToAudioStatus((event) => {
          get().setStatus(event.status);
        });
        
        await tauriAudioService.subscribeToDeviceChanges((event) => {
          get().setDevices(event.devices);
        });
        
        set({
          availableDevices: devices,
          ...(defaultDevice ? { currentDevice: defaultDevice } : {}),
          config,
          isInitialized: true,
          error: null,
        });
        
        console.info('Audio service initialized successfully');
      } catch (error) {
        const errorMessage = error instanceof TauriServiceError 
          ? error.message 
          : 'Failed to initialize audio service';
        
        set({ 
          error: errorMessage,
          hasError: true,
          isInitialized: false 
        });
        
        console.error('Audio initialization error:', error);
        throw error;
      }
    },

    startRecording: async (deviceName?: string, config?: AudioCaptureConfig) => {
      const state = get();
      
      if (state.isRecording || state.isStarting) {
        console.warn('Recording already in progress');
        return;
      }
      
      try {
        set({ 
          isStarting: true, 
          error: null,
          hasError: false,
          recordingDuration: 0,
        });
        
        const request: StartCaptureRequest = {
          ...(deviceName ? { device_name: deviceName } : {}),
          config: config || state.config,
        };
        
        await tauriAudioService.startAudioCapture(request);
        
        // Update config if provided
        if (config) {
          set({ config });
        }
        
        console.info('Audio recording started');
      } catch (error) {
        const errorMessage = error instanceof TauriServiceError 
          ? error.message 
          : 'Failed to start recording';
        
        set({ 
          error: errorMessage,
          hasError: true,
          isStarting: false,
        });
        
        console.error('Start recording error:', error);
        throw error;
      }
    },

    stopRecording: async () => {
      const state = get();
      
      if (!state.isRecording || state.isStopping) {
        console.warn('No active recording to stop');
        return;
      }
      
      try {
        set({ 
          isStopping: true, 
          error: null,
          hasError: false,
        });
        
        await tauriAudioService.stopAudioCapture();
        
        console.info('Audio recording stopped');
      } catch (error) {
        const errorMessage = error instanceof TauriServiceError 
          ? error.message 
          : 'Failed to stop recording';
        
        set({ 
          error: errorMessage,
          hasError: true,
          isStopping: false,
        });
        
        console.error('Stop recording error:', error);
        throw error;
      }
    },

    switchDevice: async (deviceName: string) => {
      try {
        set({ error: null, hasError: false });
        
        await tauriAudioService.setAudioDevice(deviceName);
        
        const devices = get().availableDevices;
        const newDevice = devices.find(d => d.name === deviceName);
        
        if (newDevice) {
          set({ currentDevice: newDevice });
        }
        
        console.info(`Switched to audio device: ${deviceName}`);
      } catch (error) {
        const errorMessage = error instanceof TauriServiceError 
          ? error.message 
          : 'Failed to switch audio device';
        
        set({ 
          error: errorMessage,
          hasError: true,
        });
        
        console.error('Switch device error:', error);
        throw error;
      }
    },

    updateConfig: async (config: AudioCaptureConfig) => {
      try {
        set({ error: null, hasError: false });
        
        await tauriAudioService.setAudioConfig(config);
        set({ config });
        
        console.info('Audio configuration updated', config);
      } catch (error) {
        const errorMessage = error instanceof TauriServiceError 
          ? error.message 
          : 'Failed to update audio configuration';
        
        set({ 
          error: errorMessage,
          hasError: true,
        });
        
        console.error('Update config error:', error);
        throw error;
      }
    },

    refreshDevices: async () => {
      try {
        set({ error: null, hasError: false });
        
        const devices = await tauriAudioService.refreshAudioDevices();
        const currentDeviceName = get().currentDevice?.name;
        const newCurrentDevice = devices.find(d => d.name === currentDeviceName);
        const defaultDevice = devices.find(d => d.is_default);
        const nextDevice = newCurrentDevice || defaultDevice;
        
        set({ 
          availableDevices: devices,
          ...(nextDevice ? { currentDevice: nextDevice } : {}),
        });
        
        console.info(`Refreshed ${devices.length} audio devices`);
      } catch (error) {
        const errorMessage = error instanceof TauriServiceError 
          ? error.message 
          : 'Failed to refresh audio devices';
        
        set({ 
          error: errorMessage,
          hasError: true,
        });
        
        console.error('Refresh devices error:', error);
        throw error;
      }
    },

    clearError: () => {
      set({ error: null, hasError: false });
    },

    // Internal actions
    setDevices: (devices: AudioDevice[]) => {
      const currentDeviceName = get().currentDevice?.name;
      const newCurrentDevice = devices.find(d => d.name === currentDeviceName);
      const defaultDevice = devices.find(d => d.is_default);
      const nextDevice = newCurrentDevice || defaultDevice;
      
      set({ 
        availableDevices: devices,
        ...(nextDevice ? { currentDevice: nextDevice } : {}),
      });
    },

    setStatus: (status: AudioCaptureStatus) => {
      const currentState = get();
      
      const newState: Partial<AudioStore> = {
        isRecording: status === AudioCaptureStatus.Running,
        isStarting: status === AudioCaptureStatus.Starting,
        isStopping: status === AudioCaptureStatus.Stopping,
        hasError: status === AudioCaptureStatus.Error,
      };
      
      // Reset error when status changes from error
      if (currentState.hasError && status !== AudioCaptureStatus.Error) {
        newState.error = null;
      }
      
      set(newState);
    },

    updateAudioLevel: (levelEvent: AudioLevelEvent) => {
      set({ 
        audioLevel: levelEvent.rms_level,
        peakLevel: levelEvent.peak_level,
        lastLevelUpdate: levelEvent.timestamp,
      });
      
      // Update recording duration if recording
      const state = get();
      if (state.isRecording && state.lastLevelUpdate > 0) {
        const duration = Date.now() - (state.recordingDuration || Date.now());
        set({ recordingDuration: duration });
      }
    },

    updateStats: (stats: AudioStats) => {
      set({ stats });
    },

    setError: (error: string) => {
      set({ 
        error,
        hasError: true,
      });
    },

    // Computed getters
    getAudioQuality: (): AudioQualityInfo => {
      const { audioLevel, stats: _stats } = get();
      const dbLevel = audioLevel > 0 ? 20 * Math.log10(audioLevel) : -100;
      
      if (dbLevel >= AUDIO_LEVEL_THRESHOLDS.HIGH) {
        return {
          level: 'excellent',
          description: 'Excellent audio quality',
        };
      } else if (dbLevel >= AUDIO_LEVEL_THRESHOLDS.MEDIUM) {
        return {
          level: 'good',
          description: 'Good audio quality',
        };
      } else if (dbLevel >= AUDIO_LEVEL_THRESHOLDS.LOW) {
        return {
          level: 'fair',
          description: 'Fair audio quality',
          recommendations: ['Move closer to microphone', 'Reduce background noise'],
        };
      } else {
        return {
          level: 'poor',
          description: 'Poor audio quality',
          recommendations: [
            'Check microphone connection',
            'Increase microphone volume',
            'Reduce background noise'
          ],
        };
      }
    },

    getSelectedDevice: (): AudioDevice | undefined => {
      return get().currentDevice;
    },

    isDeviceAvailable: (deviceName: string): boolean => {
      return get().availableDevices.some(d => d.name === deviceName && d.is_available);
    },
  }))
);

// Selectors for optimized component subscriptions
export const useAudioLevel = () => useAudioStore((state) => state.audioLevel);
export const useAudioStatus = () => useAudioStore((state) => ({
  isRecording: state.isRecording,
  isStarting: state.isStarting,
  isStopping: state.isStopping,
  hasError: state.hasError,
}));
export const useAudioDevices = () => useAudioStore((state) => ({
  devices: state.availableDevices,
  currentDevice: state.currentDevice,
}));
export const useAudioConfig = () => useAudioStore((state) => state.config);
export const useAudioStats = () => useAudioStore((state) => state.stats);
export const useAudioError = () => useAudioStore((state) => state.error);

// Initialize audio on app startup
export const initializeAudio = () => {
  return useAudioStore.getState().initializeAudio();
};