/**
 * Audio-related TypeScript type definitions
 * 
 * These types match the Rust backend types for consistent data flow
 * between frontend and backend via Tauri commands.
 */

// Audio device types
export interface AudioDevice {
  name: string;
  is_default: boolean;
  is_available: boolean;
  device_type: AudioDeviceType;
}

export enum AudioDeviceType {
  Input = 'Input',
  Output = 'Output',
}

// Audio configuration
export interface AudioCaptureConfig {
  sample_rate: number;
  channels: number;
  buffer_size: number;
}

// Audio capture status
export enum AudioCaptureStatus {
  Stopped = 'Stopped',
  Starting = 'Starting',
  Running = 'Running',
  Stopping = 'Stopping',
  Error = 'Error',
}

// Audio statistics
export interface AudioStats {
  samples_processed: number;
  buffer_overruns: number;
  buffer_underruns: number;
  average_latency_ms: number;
  peak_level: number;
  rms_level: number;
}

// Audio level event from backend
export interface AudioLevelEvent {
  rms_level: number;
  peak_level: number;
  rms_level_db: number;
  timestamp: number;
}

// Audio status change event from backend
export interface AudioStatusEvent {
  status: AudioCaptureStatus;
  timestamp: number;
}

// Audio device change event from backend
export interface AudioDeviceChangeEvent {
  devices: AudioDevice[];
  timestamp: number;
}

// Request types for Tauri commands
export interface StartCaptureRequest {
  device_name?: string;
  config?: AudioCaptureConfig;
}

// Audio visualization data
export interface AudioVisualizationData {
  levels: number[];
  peak_level: number;
  rms_level: number;
  timestamp: number;
}

// Audio recording state for UI components
export interface AudioRecordingState {
  isRecording: boolean;
  isStarting: boolean;
  isStopping: boolean;
  hasError: boolean;
  currentDevice?: AudioDevice;
  availableDevices: AudioDevice[];
  audioLevel: number;
  peakLevel: number;
  stats: AudioStats;
  config: AudioCaptureConfig;
}

// Default configurations
export const DEFAULT_AUDIO_CONFIG: AudioCaptureConfig = {
  sample_rate: 16000,
  channels: 1,
  buffer_size: 1024,
};

// Audio level thresholds for UI feedback
export const AUDIO_LEVEL_THRESHOLDS = {
  SILENCE: -60, // dB
  LOW: -40,     // dB
  MEDIUM: -20,  // dB
  HIGH: -10,    // dB
  CLIP: -3,     // dB
} as const;

// Audio quality indicators
export type AudioQualityLevel = 'poor' | 'fair' | 'good' | 'excellent';

export interface AudioQualityInfo {
  level: AudioQualityLevel;
  description: string;
  recommendations?: string[];
}

// Error types for audio operations
export interface AudioError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Audio recording session info
export interface AudioRecordingSession {
  id: string;
  start_time: Date;
  end_time?: Date;
  device_name: string;
  config: AudioCaptureConfig;
  stats: AudioStats;
  duration_ms: number;
}

// Utility type for audio level display
export interface AudioLevelDisplay {
  percentage: number; // 0-100
  db_level: number;
  color: string;
  label: string;
}

// Audio permissions status
export interface AudioPermissions {
  granted: boolean;
  error?: string;
  canRequest: boolean;
}

// Audio device capabilities
export interface AudioDeviceCapabilities {
  min_sample_rate: number;
  max_sample_rate: number;
  supported_channels: number[];
  supports_monitoring: boolean;
}

export default {
  AudioDeviceType,
  AudioCaptureStatus,
  DEFAULT_AUDIO_CONFIG,
  AUDIO_LEVEL_THRESHOLDS,
};