/**
 * Tests for audio store using Zustand
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioStore } from './audio.store';
import { tauriAudioService } from '../services/tauri.service';
import { AudioCaptureStatus, DEFAULT_AUDIO_CONFIG } from '../types/audio.types';

// Mock the Tauri service
vi.mock('../services/tauri.service', () => ({
  tauriAudioService: {
    initAudioService: vi.fn(),
    getAudioInputDevices: vi.fn(),
    getAudioConfig: vi.fn(),
    startAudioCapture: vi.fn(),
    stopAudioCapture: vi.fn(),
    setAudioDevice: vi.fn(),
    setAudioConfig: vi.fn(),
    refreshAudioDevices: vi.fn(),
    subscribeToAudioLevels: vi.fn(),
    subscribeToAudioStatus: vi.fn(),
    subscribeToDeviceChanges: vi.fn(),
  },
  TauriServiceError: class TauriServiceError extends Error {
    constructor(public command: string, public originalError: any, message?: string) {
      super(message || `Tauri command '${command}' failed: ${originalError}`);
      this.name = 'TauriServiceError';
    }
  },
}));

// Mock console methods
const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

const mockDevices = [
  {
    name: 'Default Microphone',
    is_default: true,
    is_available: true,
    device_type: 'Input' as const,
  },
  {
    name: 'USB Microphone',
    is_default: false,
    is_available: true,
    device_type: 'Input' as const,
  },
];

describe('Audio Store', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset store state
    useAudioStore.setState({
      isRecording: false,
      isStarting: false,
      isStopping: false,
      hasError: false,
      currentDevice: undefined,
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
    });
    
    // Setup default mocks
    (tauriAudioService.initAudioService as any).mockResolvedValue(undefined);
    (tauriAudioService.getAudioInputDevices as any).mockResolvedValue(mockDevices);
    (tauriAudioService.getAudioConfig as any).mockResolvedValue(DEFAULT_AUDIO_CONFIG);
    (tauriAudioService.subscribeToAudioLevels as any).mockResolvedValue(undefined);
    (tauriAudioService.subscribeToAudioStatus as any).mockResolvedValue(undefined);
    (tauriAudioService.subscribeToDeviceChanges as any).mockResolvedValue(undefined);
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAudioStore());
      
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.availableDevices).toEqual([]);
      expect(result.current.config).toEqual(DEFAULT_AUDIO_CONFIG);
      expect(result.current.error).toBe(null);
    });

    it('should initialize audio service successfully', async () => {
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.initializeAudio();
      });

      expect(tauriAudioService.initAudioService).toHaveBeenCalled();
      expect(tauriAudioService.getAudioInputDevices).toHaveBeenCalled();
      expect(tauriAudioService.getAudioConfig).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.availableDevices).toEqual(mockDevices);
      expect(result.current.currentDevice).toEqual(mockDevices[0]); // Default device
      expect(result.current.error).toBe(null);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      (tauriAudioService.initAudioService as any).mockRejectedValue(error);

      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        try {
          await result.current.initializeAudio();
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Failed to initialize audio service');
    });
  });

  describe('Recording Control', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useAudioStore());
      
      await act(async () => {
        await result.current.initializeAudio();
      });
    });

    it('should start recording successfully', async () => {
      (tauriAudioService.startAudioCapture as any).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(tauriAudioService.startAudioCapture).toHaveBeenCalledWith({
        device_name: undefined,
        config: DEFAULT_AUDIO_CONFIG,
      });
      expect(result.current.error).toBe(null);
      expect(result.current.hasError).toBe(false);
    });

    it('should start recording with custom device and config', async () => {
      (tauriAudioService.startAudioCapture as any).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAudioStore());
      const customConfig = { ...DEFAULT_AUDIO_CONFIG, sample_rate: 48000 };

      await act(async () => {
        await result.current.startRecording('USB Microphone', customConfig);
      });

      expect(tauriAudioService.startAudioCapture).toHaveBeenCalledWith({
        device_name: 'USB Microphone',
        config: customConfig,
      });
      expect(result.current.config).toEqual(customConfig);
    });

    it('should handle recording start errors', async () => {
      const error = new Error('Start recording failed');
      (tauriAudioService.startAudioCapture as any).mockRejectedValue(error);
      
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Failed to start recording');
    });

    it('should stop recording successfully', async () => {
      (tauriAudioService.stopAudioCapture as any).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAudioStore());
      
      // Set recording state first
      act(() => {
        result.current.setStatus(AudioCaptureStatus.Running);
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(tauriAudioService.stopAudioCapture).toHaveBeenCalled();
      expect(result.current.error).toBe(null);
      expect(result.current.hasError).toBe(false);
    });

    it('should not start recording if already in progress', async () => {
      const { result } = renderHook(() => useAudioStore());
      
      // Set starting state
      act(() => {
        useAudioStore.setState({ isStarting: true });
      });

      await act(async () => {
        await result.current.startRecording();
      });

      expect(tauriAudioService.startAudioCapture).not.toHaveBeenCalled();
    });

    it('should not stop recording if not recording', async () => {
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(tauriAudioService.stopAudioCapture).not.toHaveBeenCalled();
    });
  });

  describe('Device Management', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useAudioStore());
      
      await act(async () => {
        await result.current.initializeAudio();
      });
    });

    it('should switch devices successfully', async () => {
      (tauriAudioService.setAudioDevice as any).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.switchDevice('USB Microphone');
      });

      expect(tauriAudioService.setAudioDevice).toHaveBeenCalledWith('USB Microphone');
      expect(result.current.currentDevice).toEqual(mockDevices[1]);
    });

    it('should handle device switch errors', async () => {
      const error = new Error('Device switch failed');
      (tauriAudioService.setAudioDevice as any).mockRejectedValue(error);
      
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        try {
          await result.current.switchDevice('USB Microphone');
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Failed to switch audio device');
    });

    it('should refresh devices successfully', async () => {
      const updatedDevices = [...mockDevices, {
        name: 'New Device',
        is_default: false,
        is_available: true,
        device_type: 'Input' as const,
      }];
      
      (tauriAudioService.refreshAudioDevices as any).mockResolvedValue(updatedDevices);
      
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.refreshDevices();
      });

      expect(tauriAudioService.refreshAudioDevices).toHaveBeenCalled();
      expect(result.current.availableDevices).toEqual(updatedDevices);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useAudioStore());
      
      await act(async () => {
        await result.current.initializeAudio();
      });
    });

    it('should update configuration successfully', async () => {
      (tauriAudioService.setAudioConfig as any).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAudioStore());
      const newConfig = { ...DEFAULT_AUDIO_CONFIG, sample_rate: 48000 };

      await act(async () => {
        await result.current.updateConfig(newConfig);
      });

      expect(tauriAudioService.setAudioConfig).toHaveBeenCalledWith(newConfig);
      expect(result.current.config).toEqual(newConfig);
    });

    it('should handle configuration update errors', async () => {
      const error = new Error('Config update failed');
      (tauriAudioService.setAudioConfig as any).mockRejectedValue(error);
      
      const { result } = renderHook(() => useAudioStore());
      const newConfig = { ...DEFAULT_AUDIO_CONFIG, sample_rate: 48000 };

      await act(async () => {
        try {
          await result.current.updateConfig(newConfig);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Failed to update audio configuration');
    });
  });

  describe('State Management', () => {
    it('should update status correctly', () => {
      const { result } = renderHook(() => useAudioStore());

      act(() => {
        result.current.setStatus(AudioCaptureStatus.Running);
      });

      expect(result.current.isRecording).toBe(true);
      expect(result.current.isStarting).toBe(false);
      expect(result.current.isStopping).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should update audio levels', () => {
      const { result } = renderHook(() => useAudioStore());

      const levelEvent = {
        rms_level: 0.5,
        peak_level: 0.8,
        rms_level_db: -6.0,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.updateAudioLevel(levelEvent);
      });

      expect(result.current.audioLevel).toBe(0.5);
      expect(result.current.peakLevel).toBe(0.8);
      expect(result.current.lastLevelUpdate).toBe(levelEvent.timestamp);
    });

    it('should clear errors', () => {
      const { result } = renderHook(() => useAudioStore());

      act(() => {
        result.current.setError('Some error');
      });

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.hasError).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('Computed Getters', () => {
    it('should return audio quality info', () => {
      const { result } = renderHook(() => useAudioStore());

      act(() => {
        result.current.updateAudioLevel({
          rms_level: 0.5,
          peak_level: 0.6,
          rms_level_db: -6.0,
          timestamp: Date.now(),
        });
      });

      const quality = result.current.getAudioQuality();
      expect(quality.level).toBe('excellent');
      expect(quality.description).toBe('Excellent audio quality');
    });

    it('should return selected device', async () => {
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.initializeAudio();
      });

      const selectedDevice = result.current.getSelectedDevice();
      expect(selectedDevice).toEqual(mockDevices[0]);
    });

    it('should check device availability', async () => {
      const { result } = renderHook(() => useAudioStore());

      await act(async () => {
        await result.current.initializeAudio();
      });

      expect(result.current.isDeviceAvailable('Default Microphone')).toBe(true);
      expect(result.current.isDeviceAvailable('Nonexistent Device')).toBe(false);
    });
  });

  describe('Selectors', () => {
    it('should select audio level correctly', () => {
      const { result } = renderHook(() => {
        return {
          level: useAudioStore(state => state.audioLevel),
          store: useAudioStore(),
        };
      });

      act(() => {
        result.current.store.updateAudioLevel({
          rms_level: 0.3,
          peak_level: 0.4,
          rms_level_db: -10.0,
          timestamp: Date.now(),
        });
      });

      expect(result.current.level).toBe(0.3);
    });

    it('should select audio status correctly', () => {
      const { result } = renderHook(() => {
        return {
          status: useAudioStore(state => ({
            isRecording: state.isRecording,
            isStarting: state.isStarting,
            isStopping: state.isStopping,
            hasError: state.hasError,
          })),
          store: useAudioStore(),
        };
      });

      act(() => {
        result.current.store.setStatus(AudioCaptureStatus.Starting);
      });

      expect(result.current.status.isRecording).toBe(false);
      expect(result.current.status.isStarting).toBe(true);
      expect(result.current.status.isStopping).toBe(false);
      expect(result.current.status.hasError).toBe(false);
    });
  });
});