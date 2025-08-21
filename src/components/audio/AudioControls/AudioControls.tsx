/**
 * AudioControls component for starting/stopping audio recording
 * 
 * Provides user interface controls for audio capture operations with
 * real-time status feedback and error handling.
 */

import React, { useCallback, useEffect } from 'react';
import { useAudioStore, useAudioStatus, useAudioError } from '../../../stores/audio.store';
import { AudioCaptureStatus } from '../../../types/audio.types';
import { Button } from '../../common/Button';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import clsx from 'clsx';

export interface AudioControlsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (error: string) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  className,
  size = 'md',
  showStatus = true,
  onRecordingStart,
  onRecordingStop,
  onError,
}) => {
  const { isRecording, isStarting, isStopping, hasError } = useAudioStatus();
  const error = useAudioError();
  const { startRecording, stopRecording, clearError } = useAudioStore();

  // Handle recording start
  const handleStartRecording = useCallback(async () => {
    try {
      clearError();
      await startRecording();
      onRecordingStart?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      onError?.(errorMessage);
    }
  }, [startRecording, onRecordingStart, onError, clearError]);

  // Handle recording stop
  const handleStopRecording = useCallback(async () => {
    try {
      clearError();
      await stopRecording();
      onRecordingStop?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      onError?.(errorMessage);
    }
  }, [stopRecording, onRecordingStop, onError, clearError]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Space bar to toggle recording (when not in an input field)
      if (event.code === 'Space' && !isInputFocused()) {
        event.preventDefault();
        if (isRecording) {
          handleStopRecording();
        } else if (!isStarting && !isStopping) {
          handleStartRecording();
        }
      }
    };

    const isInputFocused = () => {
      const activeElement = document.activeElement;
      return activeElement?.tagName === 'INPUT' || 
             activeElement?.tagName === 'TEXTAREA' || 
             activeElement?.hasAttribute('contenteditable');
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isRecording, isStarting, isStopping, handleStartRecording, handleStopRecording]);

  // Size-based styling
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Status text
  const getStatusText = () => {
    if (hasError && error) return `Error: ${error}`;
    if (isStarting) return 'Starting recording...';
    if (isStopping) return 'Stopping recording...';
    if (isRecording) return 'Recording active';
    return 'Ready to record';
  };

  // Status color
  const getStatusColor = () => {
    if (hasError) return 'text-red-600';
    if (isStarting || isStopping) return 'text-yellow-600';
    if (isRecording) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className={clsx('flex flex-col items-center space-y-2', className)}>
      {/* Main record button */}
      <div className="flex items-center space-x-2">
        {isRecording ? (
          <Button
            variant="danger"
            size={size}
            onClick={handleStopRecording}
            disabled={isStopping}
            className={clsx(
              sizeClasses[size],
              'flex items-center space-x-2 transition-all duration-200',
              'hover:shadow-lg focus:ring-red-500',
              isRecording && 'animate-pulse'
            )}
            aria-label="Stop recording"
          >
            {isStopping ? (
              <LoadingSpinner className={iconSizes[size]} />
            ) : (
              <StopIcon className={iconSizes[size]} />
            )}
            <span>Stop Recording</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            size={size}
            onClick={handleStartRecording}
            disabled={isStarting || hasError}
            className={clsx(
              sizeClasses[size],
              'flex items-center space-x-2 transition-all duration-200',
              'hover:shadow-lg focus:ring-emerald-500'
            )}
            aria-label="Start recording"
          >
            {isStarting ? (
              <LoadingSpinner className={iconSizes[size]} />
            ) : (
              <RecordIcon className={iconSizes[size]} />
            )}
            <span>Start Recording</span>
          </Button>
        )}
      </div>

      {/* Status indicator */}
      {showStatus && (
        <div className={clsx(
          'text-sm font-medium transition-colors duration-200',
          getStatusColor()
        )}>
          {getStatusText()}
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {!isStarting && !isStopping && (
        <div className="text-xs text-gray-400">
          Press Space to {isRecording ? 'stop' : 'start'}
        </div>
      )}

      {/* Error display */}
      {hasError && error && (
        <div className="max-w-xs text-xs text-red-600 text-center bg-red-50 px-2 py-1 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

// Record icon component
const RecordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
  </svg>
);

// Stop icon component
const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export default AudioControls;