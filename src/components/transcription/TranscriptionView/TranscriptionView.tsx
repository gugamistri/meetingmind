import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TranscriptionChunk } from '../RealTimeTranscription/RealTimeTranscription';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import clsx from 'clsx';

export interface TranscriptionViewProps {
  /** Session ID to display transcriptions for */
  sessionId?: string;
  /** Meeting ID to display transcriptions for */
  meetingId?: number;
  /** Whether the view is read-only */
  readOnly?: boolean;
  /** Whether to show search functionality */
  showSearch?: boolean;
  /** Whether to show export options */
  showExport?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Event handlers */
  onTranscriptionSelect?: (chunk: TranscriptionChunk) => void;
  onError?: (error: string) => void;
}

interface SearchFilters {
  query: string;
  confidence_min: number;
  language: string;
  model: string;
  processed_locally?: boolean;
}

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  sessionId,
  meetingId,
  readOnly: _readOnly = false,
  showSearch = true,
  showExport = true,
  className,
  onTranscriptionSelect,
  onError,
}) => {
  const [transcriptions, setTranscriptions] = useState<TranscriptionChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    confidence_min: 0.0,
    language: 'all',
    model: 'all',
  });
  const [selectedChunk, setSelectedChunk] = useState<TranscriptionChunk | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'continuous'>('list');

  // Load transcriptions
  const loadTranscriptions = async () => {
    if (!sessionId && !meetingId) {
      setError('Either sessionId or meetingId must be provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let chunks: TranscriptionChunk[];
      
      if (sessionId) {
        // Get transcriptions for a specific session
        chunks = await invoke('get_session_transcriptions', { sessionId });
      } else if (meetingId) {
        // Get transcriptions for a meeting
        chunks = await invoke('get_meeting_transcriptions', { meetingId });
      } else {
        throw new Error('No valid identifier provided');
      }

      setTranscriptions(chunks);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transcriptions';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Search transcriptions
  const searchTranscriptions = async () => {
    if (!searchFilters.query.trim()) {
      await loadTranscriptions();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await invoke<any[]>('search_transcriptions', {
        query: searchFilters.query,
        filters: {
          confidence_min: searchFilters.confidence_min > 0 ? searchFilters.confidence_min : undefined,
          languages: searchFilters.language !== 'all' ? [searchFilters.language] : undefined,
          models: searchFilters.model !== 'all' ? [searchFilters.model] : undefined,
          processed_locally: searchFilters.processed_locally,
          session_ids: sessionId ? [sessionId] : undefined,
          meeting_ids: meetingId ? [meetingId] : undefined,
        },
        limit: 100,
        offset: 0,
      });

      setTranscriptions(results.map((result: any) => ({
        id: result.chunk_id,
        text: result.content,
        confidence: result.confidence,
        language: result.language,
        start_time_ms: result.start_timestamp * 1000,
        end_time_ms: result.end_timestamp * 1000,
        word_count: result.word_count,
        model_used: result.model_used,
        processing_time_ms: result.processing_time_ms,
        processed_locally: result.processed_locally,
        created_at: result.created_at,
      })));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search transcriptions';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Export transcriptions
  const exportTranscriptions = async (format: 'text' | 'json' | 'csv') => {
    try {
      const exportData = await invoke<string>('export_transcriptions', {
        sessionId: sessionId || undefined,
        meetingId: meetingId || undefined,
        format,
      });

      // Create download link
      const blob = new Blob([exportData], { 
        type: format === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcription-${sessionId || meetingId}-${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export transcriptions';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  // Load transcriptions on mount or when IDs change
  useEffect(() => {
    loadTranscriptions();
  }, [sessionId, meetingId]);

  // Filter and sort transcriptions
  const filteredTranscriptions = useMemo(() => {
    let filtered = [...transcriptions];

    // Apply search query if not using backend search
    if (searchQuery && !searchFilters.query) {
      filtered = filtered.filter(chunk =>
        chunk.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by timestamp
    filtered.sort((a, b) => a.start_time_ms - b.start_time_ms);

    return filtered;
  }, [transcriptions, searchQuery, searchFilters.query]);

  // Generate continuous text
  const continuousText = useMemo(() => {
    return filteredTranscriptions
      .map(chunk => chunk.text)
      .join(' ');
  }, [filteredTranscriptions]);

  // Format timestamp
  const formatTimestamp = (timestampMs: number) => {
    const seconds = timestampMs / 1000;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Handle chunk selection
  const handleChunkSelect = (chunk: TranscriptionChunk) => {
    setSelectedChunk(chunk);
    onTranscriptionSelect?.(chunk);
  };

  if (isLoading && transcriptions.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-64', className)}>
        <LoadingSpinner />
        <span className="ml-2 text-gray-600">Loading transcriptions...</span>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Transcription History
          </h3>
          
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white rounded-lg border border-gray-300">
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'px-3 py-1 text-sm font-medium rounded-l-lg',
                  viewMode === 'list'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('continuous')}
                className={clsx(
                  'px-3 py-1 text-sm font-medium rounded-r-lg',
                  viewMode === 'continuous'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                Continuous
              </button>
            </div>

            {/* Export Options */}
            {showExport && (
              <div className="relative">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      exportTranscriptions(e.target.value as 'text' | 'json' | 'csv');
                      e.target.value = '';
                    }
                  }}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>Export...</option>
                  <option value="text">Export as Text</option>
                  <option value="json">Export as JSON</option>
                  <option value="csv">Export as CSV</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        {showSearch && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search transcriptions..."
                value={searchFilters.query || searchQuery}
                onChange={(e) => {
                  if (searchFilters.query) {
                    setSearchFilters(prev => ({ ...prev, query: e.target.value }));
                  } else {
                    setSearchQuery(e.target.value);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                onClick={searchTranscriptions}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500"
              >
                Search
              </button>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Confidence
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={searchFilters.confidence_min}
                  onChange={(e) => setSearchFilters(prev => ({
                    ...prev,
                    confidence_min: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {Math.round(searchFilters.confidence_min * 100)}%
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={searchFilters.language}
                  onChange={(e) => setSearchFilters(prev => ({
                    ...prev,
                    language: e.target.value
                  }))}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="en">English</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={searchFilters.model}
                  onChange={(e) => setSearchFilters(prev => ({
                    ...prev,
                    model: e.target.value
                  }))}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="whisper-tiny">Tiny</option>
                  <option value="whisper-base">Base</option>
                  <option value="whisper-small">Small</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Processing
                </label>
                <select
                  value={searchFilters.processed_locally === undefined ? 'all' : 
                         searchFilters.processed_locally ? 'local' : 'cloud'}
                  onChange={(e) => setSearchFilters(prev => {
                    const newFilters = { ...prev };
                    if (e.target.value === 'all') {
                      delete newFilters.processed_locally;
                    } else {
                      newFilters.processed_locally = e.target.value === 'local';
                    }
                    return newFilters;
                  })}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="local">Local</option>
                  <option value="cloud">Cloud</option>
                </select>
              </div>
            </div>
          </div>
        )}
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {filteredTranscriptions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">No transcriptions found</p>
              <p className="text-sm">
                {searchQuery || searchFilters.query 
                  ? 'Try adjusting your search criteria'
                  : 'No transcriptions available for this session'
                }
              </p>
            </div>
          </div>
        ) : viewMode === 'continuous' ? (
          /* Continuous View */
          <div className="p-6 overflow-y-auto h-full">
            <div className="prose max-w-none">
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                {continuousText}
              </p>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="overflow-y-auto h-full">
            <div className="p-4 space-y-3">
              {filteredTranscriptions.map((chunk, index) => (
                <div
                  key={chunk.id}
                  onClick={() => handleChunkSelect(chunk)}
                  className={clsx(
                    'bg-white rounded-lg border border-gray-200 p-4 cursor-pointer',
                    'hover:shadow-md transition-shadow duration-200',
                    selectedChunk?.id === chunk.id && 'ring-2 ring-emerald-500 border-emerald-500'
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
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{chunk.language.toUpperCase()}</span>
                      <span>•</span>
                      <span>{chunk.word_count} words</span>
                    </div>
                  </div>

                  {/* Chunk Content */}
                  <p className="text-gray-900 leading-relaxed mb-2">
                    {chunk.text}
                  </p>

                  {/* Chunk Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Model: {chunk.model_used}</span>
                    <div className="flex items-center space-x-2">
                      <span>{chunk.processed_locally ? 'Local' : 'Cloud'}</span>
                      <span>•</span>
                      <span>{chunk.processing_time_ms}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{filteredTranscriptions.length} transcription chunks</span>
          {selectedChunk && (
            <span>Selected: {formatTimestamp(selectedChunk.start_time_ms)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionView;