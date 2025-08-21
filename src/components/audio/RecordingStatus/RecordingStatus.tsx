/**
 * RecordingStatus component for displaying current recording state
 * 
 * Shows recording status with visual indicators, timing information,
 * and basic statistics about the active recording session.
 */

import React, { useEffect, useState } from 'react';
import { useAudioStatus, useAudioStats, useAudioStore } from '../../../stores/audio.store';
import { AudioCaptureStatus } from '../../../types/audio.types';
import clsx from 'clsx';

export interface RecordingStatusProps {
  className?: string;
  showTimer?: boolean;
  showStats?: boolean;
  showDeviceInfo?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const RecordingStatus: React.FC<RecordingStatusProps> = ({
  className,
  showTimer = true,
  showStats = false,
  showDeviceInfo = false,
  size = 'md',
}) => {
  const { isRecording, isStarting, isStopping, hasError } = useAudioStatus();
  const stats = useAudioStats();
  const { currentDevice } = useAudioStore();
  
  const [recordingTime, setRecordingTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Track recording time
  useEffect(() => {
    if (isRecording) {
      if (!startTime) {
        setStartTime(Date.now());
      }
      
      const interval = setInterval(() => {
        if (startTime) {
          setRecordingTime(Date.now() - startTime);
        }
      }, 100);
      
      return () => clearInterval(interval);
    } else {
      setStartTime(null);
      setRecordingTime(0);
    }
  }, [isRecording, startTime]);

  // Format duration as MM:SS
  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  // Get status info
  const getStatusInfo = () => {
    if (hasError) {
      return {
        text: 'Error',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: <ErrorIcon className="w-4 h-4" />,
      };
    }
    
    if (isStarting) {
      return {
        text: 'Starting...',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        icon: <LoadingIcon className="w-4 h-4 animate-spin" />,
      };
    }
    
    if (isStopping) {
      return {
        text: 'Stopping...',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        icon: <LoadingIcon className="w-4 h-4 animate-spin" />,
      };
    }
    
    if (isRecording) {
      return {
        text: 'Recording',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: <RecordingIcon className="w-4 h-4 animate-pulse" />,
      };
    }
    
    return {
      text: 'Ready',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      icon: <ReadyIcon className="w-4 h-4" />,
    };
  };

  const statusInfo = getStatusInfo();

  // Size configurations
  const sizeConfigs = {
    sm: {
      container: 'text-sm',
      badge: 'px-2 py-1',
      spacing: 'space-y-1',
    },
    md: {
      container: 'text-base',
      badge: 'px-3 py-1.5',
      spacing: 'space-y-2',
    },
    lg: {
      container: 'text-lg',
      badge: 'px-4 py-2',
      spacing: 'space-y-3',
    },
  };

  const config = sizeConfigs[size];

  return (
    <div className={clsx('flex flex-col', config.container, config.spacing, className)}>
      {/* Main status badge */}
      <div className="flex items-center space-x-2">
        <div className={clsx(
          'inline-flex items-center space-x-2 rounded-full font-medium transition-all duration-200',
          config.badge,
          statusInfo.color,
          statusInfo.bgColor
        )}>
          {statusInfo.icon}
          <span>{statusInfo.text}</span>
        </div>

        {/* Recording timer */}
        {showTimer && isRecording && (
          <div className="font-mono text-lg font-bold text-gray-900">
            {formatDuration(recordingTime)}
          </div>
        )}
      </div>

      {/* Device information */}
      {showDeviceInfo && currentDevice && (
        <div className="flex items-center space-x-2 text-gray-600">
          <MicrophoneIcon className="w-4 h-4" />
          <span className="truncate">{currentDevice.name}</span>
          {currentDevice.is_default && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              Default
            </span>
          )}
        </div>
      )}

      {/* Recording statistics */}
      {showStats && isRecording && (
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex flex-col">
            <span className="font-medium">Samples</span>
            <span className="font-mono">{formatNumber(stats.samples_processed)}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="font-medium">Latency</span>
            <span className="font-mono">{stats.average_latency_ms.toFixed(1)}ms</span>
          </div>
          
          {stats.buffer_overruns > 0 && (
            <div className="flex flex-col">
              <span className="font-medium text-orange-600">Overruns</span>
              <span className="font-mono text-orange-600">{stats.buffer_overruns}</span>
            </div>
          )}
          
          {stats.buffer_underruns > 0 && (
            <div className="flex flex-col">
              <span className="font-medium text-red-600">Underruns</span>
              <span className="font-mono text-red-600">{stats.buffer_underruns}</span>
            </div>
          )}
        </div>
      )}

      {/* Quality indicator */}
      {isRecording && (
        <div className="flex items-center space-x-2 text-sm">
          <QualityIndicator level={stats.rms_level} />
        </div>
      )}
    </div>
  );
};

// Quality indicator component
const QualityIndicator: React.FC<{ level: number }> = ({ level }) => {
  const getQualityInfo = (level: number) => {
    const db = level > 0 ? 20 * Math.log10(level) : -100;
    
    if (db >= -10) {
      return { label: 'Excellent', color: 'text-green-600', bars: 4 };
    } else if (db >= -20) {
      return { label: 'Good', color: 'text-green-600', bars: 3 };
    } else if (db >= -40) {
      return { label: 'Fair', color: 'text-yellow-600', bars: 2 };
    } else {
      return { label: 'Poor', color: 'text-red-600', bars: 1 };
    }
  };

  const quality = getQualityInfo(level);

  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-gray-500">Quality:</span>
      <div className="flex space-x-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={clsx(
              'w-1 h-3 rounded-sm',
              i < quality.bars ? quality.color.replace('text-', 'bg-') : 'bg-gray-300'
            )}
          />
        ))}
      </div>
      <span className={clsx('text-xs font-medium', quality.color)}>
        {quality.label}
      </span>
    </div>
  );
};

// Icon components
const RecordingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const ReadyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LoadingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

export default RecordingStatus;