import React, { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useTranscriptionStore } from '../../../stores/transcription.store';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import clsx from 'clsx';

export interface TranscriptionChunk {
  id: string;
  text: string;
  confidence: number;
  language: string;
  start_time_ms: number;
  end_time_ms: number;
  word_count: number;
  model_used: string;
  processing_time_ms: number;
  processed_locally: boolean;
  created_at: string;
}

export interface RealTimeTranscriptionProps {
  /** Session ID for the transcription */
  sessionId?: string;
  /** Maximum number of chunks to display */
  maxChunks?: number;
  /** Whether to auto-scroll to latest chunk */
  autoScroll?: boolean;
  /** Confidence threshold for displaying chunks */
  confidenceThreshold?: number;
  /** Custom CSS classes */
  className?: string;
  /** Event handlers */
  onChunkReceived?: (chunk: TranscriptionChunk) => void;
  onError?: (error: string) => void;
}

export const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  sessionId,
  maxChunks = 50,
  autoScroll = true,
  confidenceThreshold = 0.0,
  className,
  onChunkReceived,
  onError,
}) => {
  const [chunks, setChunks] = useState<TranscriptionChunk[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isTranscribing, currentSession } = useTranscriptionStore();

  const effectiveSessionId = sessionId || currentSession?.id;

  // Auto-scroll to bottom when new chunks arrive
  const scrollToBottom = () => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  // Handle new transcription chunks
  const handleTranscriptionChunk = (chunk: TranscriptionChunk) => {
    if (chunk.confidence >= confidenceThreshold) {
      setChunks(prev => {
        const updated = [...prev, chunk];
        // Keep only the latest chunks within limit
        return updated.slice(-maxChunks);
      });
      onChunkReceived?.(chunk);
      
      // Auto-scroll after state update
      setTimeout(scrollToBottom, 100);
    }
  };

  // Handle transcription errors
  const handleTranscriptionError = (errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  };

  // Set up event listeners
  useEffect(() => {
    let unlistenChunk: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        setIsListening(true);
        
        // Listen for transcription chunks
        unlistenChunk = await listen('transcription-chunk', (event: any) => {
          const data = event.payload;
          if (!effectiveSessionId || data.session_id === effectiveSessionId) {
            handleTranscriptionChunk(data.chunk);
          }
        });

        // Listen for transcription errors
        unlistenError = await listen('transcription-error', (event: any) => {
          const data = event.payload;
          if (!effectiveSessionId || data.session_id === effectiveSessionId) {
            handleTranscriptionError(data.error);
          }
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to set up event listeners';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    };

    setupListeners();

    return () => {
      setIsListening(false);
      unlistenChunk?.();
      unlistenError?.();
    };
  }, [effectiveSessionId, confidenceThreshold, onChunkReceived, onError]);

  // Clear chunks when session changes
  useEffect(() => {
    setChunks([]);
    setError(null);
  }, [effectiveSessionId]);

  // Format timestamp for display
  const formatTimestamp = (timestampMs: number) => {
    const seconds = timestampMs / 1000;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get confidence color class
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get processing indicator
  const getProcessingIndicator = (processedLocally: boolean) => {
    return processedLocally ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Local
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
        Cloud
      </span>
    );
  };

  if (!isTranscribing && chunks.length === 0) {
    return (
      <div className={clsx(
        'flex items-center justify-center h-64 text-gray-500',
        className
      )}>
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No transcription active</p>
          <p className="text-sm">Start a meeting to see real-time transcription</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-medium text-gray-900">Live Transcription</h3>
          {isListening && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>{chunks.length} chunks</span>
          {effectiveSessionId && (
            <span>Session: {effectiveSessionId.slice(0, 8)}...</span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner />
          <span className="ml-2 text-gray-600">Loading transcription...</span>
        </div>
      )}

      {/* Transcription Chunks */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {chunks.length === 0 && !isLoading ? (
          <div className="text-center text-gray-500 py-8">
            <p>Waiting for transcription...</p>
          </div>
        ) : (
          chunks.map((chunk, index) => (
            <div
              key={chunk.id}
              className={clsx(
                'bg-white rounded-lg border border-gray-200 p-4 shadow-sm',
                'hover:shadow-md transition-shadow duration-200'
              )}
            >
              {/* Chunk Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    #{index + 1}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(chunk.start_time_ms)}
                  </span>
                  <span className={clsx('text-sm font-medium', getConfidenceColor(chunk.confidence))}>
                    {Math.round(chunk.confidence * 100)}%
                  </span>
                  {getProcessingIndicator(chunk.processed_locally)}
                </div>
                
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{chunk.language.toUpperCase()}</span>
                  <span>•</span>
                  <span>{chunk.word_count} words</span>
                  <span>•</span>
                  <span>{chunk.processing_time_ms}ms</span>
                </div>
              </div>

              {/* Chunk Content */}
              <p className="text-gray-900 leading-relaxed">
                {chunk.text}
              </p>

              {/* Chunk Footer */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Model: {chunk.model_used}</span>
                  <span>
                    Duration: {Math.round((chunk.end_time_ms - chunk.start_time_ms) / 1000)}s
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Threshold: {Math.round(confidenceThreshold * 100)}%</span>
            <span>Max chunks: {maxChunks}</span>
          </div>
          
          {autoScroll && (
            <button
              onClick={scrollToBottom}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Scroll to latest
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeTranscription;