/**
 * Tauri service for frontend-backend communication
 * 
 * This service provides a typed interface for calling Tauri commands
 * and listening to backend events.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  AudioDevice,
  AudioCaptureStatus,
  AudioStats,
  AudioCaptureConfig,
  StartCaptureRequest,
  AudioLevelEvent,
  AudioStatusEvent,
  AudioDeviceChangeEvent,
  AudioPermissionStatus,
} from '../types/audio.types';

export class TauriAudioService {
  private eventListeners: Map<string, UnlistenFn> = new Map();

  /**
   * Initialize the audio service on the backend
   */
  async initAudioService(): Promise<void> {
    await invoke('init_audio_service');
  }

  /**
   * Get available audio input devices
   */
  async getAudioInputDevices(): Promise<AudioDevice[]> {
    return await invoke<AudioDevice[]>('get_audio_input_devices');
  }

  /**
   * Start audio capture
   */
  async startAudioCapture(request: StartCaptureRequest): Promise<void> {
    await invoke('start_audio_capture', { request });
  }

  /**
   * Stop audio capture
   */
  async stopAudioCapture(): Promise<void> {
    await invoke('stop_audio_capture');
  }

  /**
   * Get current audio capture status
   */
  async getAudioCaptureStatus(): Promise<AudioCaptureStatus> {
    return await invoke<AudioCaptureStatus>('get_audio_capture_status');
  }

  /**
   * Get current audio levels (one-time)
   */
  async getAudioLevels(): Promise<AudioLevelEvent> {
    return await invoke<AudioLevelEvent>('get_audio_levels');
  }

  /**
   * Get audio capture statistics
   */
  async getAudioStats(): Promise<AudioStats> {
    return await invoke<AudioStats>('get_audio_stats');
  }

  /**
   * Set the active audio device
   */
  async setAudioDevice(deviceName: string): Promise<void> {
    await invoke('set_audio_device', { deviceName });
  }

  /**
   * Get current audio configuration
   */
  async getAudioConfig(): Promise<AudioCaptureConfig> {
    return await invoke<AudioCaptureConfig>('get_audio_config');
  }

  /**
   * Update audio configuration
   */
  async setAudioConfig(config: AudioCaptureConfig): Promise<void> {
    await invoke('set_audio_config', { config });
  }

  /**
   * Refresh audio device list
   */
  async refreshAudioDevices(): Promise<AudioDevice[]> {
    return await invoke<AudioDevice[]>('refresh_audio_devices');
  }

  /**
   * Subscribe to audio level updates
   */
  async subscribeToAudioLevels(
    callback: (event: AudioLevelEvent) => void
  ): Promise<void> {
    const unlisten = await listen<AudioLevelEvent>('audio_level_update', (event) => {
      callback(event.payload);
    });
    
    this.eventListeners.set('audio_level_update', unlisten);
  }

  /**
   * Subscribe to audio status changes
   */
  async subscribeToAudioStatus(
    callback: (event: AudioStatusEvent) => void
  ): Promise<void> {
    const unlisten = await listen<AudioStatusEvent>('audio_status_changed', (event) => {
      callback(event.payload);
    });
    
    this.eventListeners.set('audio_status_changed', unlisten);
  }

  /**
   * Subscribe to audio device changes
   */
  async subscribeToDeviceChanges(
    callback: (event: AudioDeviceChangeEvent) => void
  ): Promise<void> {
    const unlisten = await listen<AudioDeviceChangeEvent>('audio_devices_changed', (event) => {
      callback(event.payload);
    });
    
    this.eventListeners.set('audio_devices_changed', unlisten);
  }

  /**
   * Unsubscribe from a specific event
   */
  async unsubscribeFromEvent(eventName: string): Promise<void> {
    const unlisten = this.eventListeners.get(eventName);
    if (unlisten) {
      unlisten();
      this.eventListeners.delete(eventName);
    }
  }

  /**
   * Unsubscribe from all events
   */
  async unsubscribeFromAllEvents(): Promise<void> {
    for (const [_eventName, unlisten] of this.eventListeners) {
      unlisten();
    }
    this.eventListeners.clear();
  }

  /**
   * Health check for the audio service
   */
  async healthCheck(): Promise<{ status: string; components: { audio: string } }> {
    return await invoke('health_check');
  }

  /**
   * Check current audio permissions
   */
  async checkAudioPermissions(): Promise<AudioPermissionStatus> {
    return await invoke('check_audio_permissions');
  }

  /**
   * Request audio permissions from the system
   */
  async requestAudioPermissions(): Promise<AudioPermissionStatus> {
    return await invoke('request_audio_permissions');
  }
}

// Singleton instance
export const tauriAudioService = new TauriAudioService();

// Error handling utility
export class TauriServiceError extends Error {
  constructor(
    public readonly command: string,
    public readonly originalError: any,
    message?: string
  ) {
    super(message || `Tauri command '${command}' failed: ${originalError}`);
    this.name = 'TauriServiceError';
  }
}

/**
 * Wrapper for Tauri commands with error handling
 */
export async function safeTauriInvoke<T>(
  command: string,
  args?: Record<string, any>
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command '${command}' failed:`, error);
    throw new TauriServiceError(command, error);
  }
}

/**
 * Utility to check if we're running in Tauri
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export default tauriAudioService;