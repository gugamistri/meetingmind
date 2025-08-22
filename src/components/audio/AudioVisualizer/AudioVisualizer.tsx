/**
 * AudioVisualizer component for real-time audio level display
 * 
 * Provides visual feedback of audio levels with smooth animations,
 * color-coded level indicators, and peak level tracking.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAudioLevel, useAudioStatus } from '../../../stores/audio.store';
import { AUDIO_LEVEL_THRESHOLDS } from '../../../types/audio.types';
import clsx from 'clsx';

export interface AudioVisualizerProps {
  className?: string;
  type?: 'bar' | 'circular' | 'waveform';
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  showPeakLevel?: boolean;
  smoothing?: number; // 0-1, higher = more smoothing
  colorScheme?: 'default' | 'mono' | 'rainbow';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  className,
  type = 'bar',
  size = 'md',
  showLabels = true,
  showPeakLevel = true,
  smoothing = 0.8,
  colorScheme = 'default',
}) => {
  const rawAudioLevel = useAudioLevel();
  const { isRecording } = useAudioStatus();
  
  // Smoothed audio level for better visual experience
  const [smoothedLevel, setSmoothedLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>([]);
  
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Convert linear level to dB
  const levelToDb = (level: number): number => {
    return level > 0 ? 20 * Math.log10(level) : -100;
  };

  // Convert level to percentage (0-100)
  const levelToPercentage = (level: number): number => {
    const db = levelToDb(level);
    // Map -60dB to 0dB range to 0-100%
    return Math.max(0, Math.min(100, (db + 60) / 60 * 100));
  };

  // Get color based on level
  const getLevelColor = (level: number, scheme: string = colorScheme): string => {
    if (!isRecording) return 'bg-gray-300';
    
    const db = levelToDb(level);
    
    if (scheme === 'mono') {
      return 'bg-gray-600';
    }
    
    if (scheme === 'rainbow') {
      if (db >= AUDIO_LEVEL_THRESHOLDS.HIGH) return 'bg-purple-500';
      if (db >= AUDIO_LEVEL_THRESHOLDS.MEDIUM) return 'bg-blue-500';
      if (db >= AUDIO_LEVEL_THRESHOLDS.LOW) return 'bg-green-500';
      return 'bg-gray-400';
    }
    
    // Default color scheme
    if (db >= AUDIO_LEVEL_THRESHOLDS.CLIP) return 'bg-red-500';
    if (db >= AUDIO_LEVEL_THRESHOLDS.HIGH) return 'bg-orange-500';
    if (db >= AUDIO_LEVEL_THRESHOLDS.MEDIUM) return 'bg-yellow-500';
    if (db >= AUDIO_LEVEL_THRESHOLDS.LOW) return 'bg-green-500';
    return 'bg-emerald-300';
  };

  // Smooth level changes with animation
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateRef.current;
      
      if (deltaTime >= 16) { // ~60fps
        setSmoothedLevel(prev => {
          const target = rawAudioLevel;
          const smoothingFactor = Math.pow(smoothing, deltaTime / 16);
          return prev * smoothingFactor + target * (1 - smoothingFactor);
        });
        
        // Update peak level with decay
        setPeakLevel(prev => {
          const decayFactor = Math.pow(0.95, deltaTime / 16);
          return Math.max(rawAudioLevel, prev * decayFactor);
        });
        
        lastUpdateRef.current = now;
      }
      
      if (isRecording) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isRecording) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setSmoothedLevel(0);
      setPeakLevel(0);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [rawAudioLevel, isRecording, smoothing]);

  // Update level history for waveform
  useEffect(() => {
    if (type === 'waveform') {
      setLevelHistory(prev => {
        const newHistory = [...prev, smoothedLevel];
        return newHistory.slice(-50); // Keep last 50 samples
      });
    }
  }, [smoothedLevel, type]);

  // Size configurations
  const sizeConfigs = useMemo(() => ({
    sm: { height: 'h-4', width: 'w-32', thickness: 'h-1' },
    md: { height: 'h-6', width: 'w-48', thickness: 'h-1.5' },
    lg: { height: 'h-8', width: 'w-64', thickness: 'h-2' },
  }), []);

  const config = sizeConfigs[size];

  // Render bar visualizer
  const renderBarVisualizer = () => {
    const percentage = levelToPercentage(smoothedLevel);
    const peakPercentage = levelToPercentage(peakLevel);
    
    return (
      <div className={clsx('flex flex-col space-y-1', className)}>
        {/* Level bar container */}
        <div className={clsx(
          'relative bg-gray-200 rounded-full overflow-hidden',
          config.height,
          config.width
        )}>
          {/* Active level bar */}
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-75 ease-out',
              getLevelColor(smoothedLevel)
            )}
            style={{ width: `${percentage}%` }}
          />
          
          {/* Peak indicator */}
          {showPeakLevel && peakPercentage > 0 && (
            <div
              className="absolute top-0 h-full w-0.5 bg-white shadow-sm transition-all duration-150"
              style={{ left: `${peakPercentage}%` }}
            />
          )}
        </div>
        
        {/* Labels */}
        {showLabels && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>{isRecording ? `${levelToDb(smoothedLevel).toFixed(1)}dB` : 'Silent'}</span>
            {showPeakLevel && (
              <span>Peak: {levelToDb(peakLevel).toFixed(1)}dB</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render circular visualizer
  const renderCircularVisualizer = () => {
    const percentage = levelToPercentage(smoothedLevel);
    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <div className={clsx('flex flex-col items-center space-y-2', className)}>
        {/* Circular level indicator */}
        <div className="relative">
          <svg width="100" height="100" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="rgb(229 231 235)" // gray-200
              strokeWidth="6"
              fill="none"
            />
            
            {/* Level arc */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={clsx(
                'transition-all duration-75 ease-out',
                isRecording ? 'text-emerald-500' : 'text-gray-300'
              )}
              style={{
                color: getLevelColor(smoothedLevel).replace('bg-', '').replace(/(\w+)-(\d+)/, 'rgb(var(--color-$1-$2))')
              }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={clsx(
                'text-sm font-medium',
                isRecording ? 'text-gray-900' : 'text-gray-400'
              )}>
                {isRecording ? `${percentage.toFixed(0)}%` : '--'}
              </div>
              {showLabels && (
                <div className="text-xs text-gray-500">
                  {levelToDb(smoothedLevel).toFixed(0)}dB
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render waveform visualizer
  const renderWaveformVisualizer = () => {
    const barWidth = 3;
    const barSpacing = 1;
    // Map size to approximate pixel width for bar calculation
    const widthMapping = { sm: 128, md: 192, lg: 256 };
    const approximateWidth = widthMapping[size];
    const maxBars = Math.floor(approximateWidth / (barWidth + barSpacing));
    const visibleHistory = levelHistory.slice(-maxBars);
    
    return (
      <div className={clsx('flex flex-col space-y-1', className)}>
        {/* Waveform container */}
        <div className={clsx(
          'flex items-end space-x-px bg-gray-100 rounded p-2',
          config.height,
          config.width
        )}>
          {visibleHistory.map((level, index) => {
            const height = Math.max(2, levelToPercentage(level) / 100 * 20); // 20px max height
            
            return (
              <div
                key={index}
                className={clsx(
                  'rounded-sm transition-all duration-75',
                  getLevelColor(level)
                )}
                style={{
                  width: `${barWidth}px`,
                  height: `${height}px`,
                }}
              />
            );
          })}
          
          {/* Fill remaining space with silent bars */}
          {Array.from({ length: Math.max(0, maxBars - visibleHistory.length) }, (_, index) => (
            <div
              key={`empty-${index}`}
              className="bg-gray-300 rounded-sm"
              style={{
                width: `${barWidth}px`,
                height: '2px',
              }}
            />
          ))}
        </div>
        
        {/* Labels */}
        {showLabels && (
          <div className="text-xs text-gray-500 text-center">
            {isRecording ? 'Live Waveform' : 'No Signal'}
          </div>
        )}
      </div>
    );
  };

  // Render based on type
  switch (type) {
    case 'circular':
      return renderCircularVisualizer();
    case 'waveform':
      return renderWaveformVisualizer();
    case 'bar':
    default:
      return renderBarVisualizer();
  }
};

export default AudioVisualizer;