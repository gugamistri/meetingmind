import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { TranscriptionSegment, Speaker, TranscriptionEdit } from '@/types/transcription.types';
import { formatTimestamp, getSpeakerColor } from '@/types/transcription.types';
import { Card } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SpeakerManager } from '@/components/meeting/SpeakerManager';

interface TranscriptionEditorProps {
  meetingId: number;
  segments?: TranscriptionSegment[];
  speakers?: Speaker[];
  isLoading?: boolean;
  onSegmentUpdate?: (edit: TranscriptionEdit) => void;
}

// Individual segment component with editing capabilities
const TranscriptionSegmentComponent: React.FC<{
  meetingId: number;
  segment: TranscriptionSegment;
  speakers: Speaker[];
  isEditing: boolean;
  editingText: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (newText: string, speakerId?: number) => void;
  onTextChange: (text: string) => void;
  onSpeakerChange: (speakerId: number | undefined) => void;
  onSpeakersUpdate: (speakers: Speaker[]) => void;
}> = ({
  meetingId,
  segment,
  speakers,
  isEditing,
  editingText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onTextChange,
  onSpeakerChange,
  onSpeakersUpdate,
}) => {
  const speaker = speakers.find(s => s.id === segment.speakerId);
  const speakerColor = speaker ? getSpeakerColor(speaker) : '#6B7280';
  const duration = segment.endTimestamp - segment.startTimestamp;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSaveEdit(editingText, segment.speakerId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  return (
    <div className="group border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      {/* Segment Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {/* Speaker Avatar */}
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: speakerColor }}
          >
            {speaker ? speaker.name?.charAt(0).toUpperCase() || 'U' : '?'}
          </div>
          
          {/* Speaker Selection */}
          {isEditing ? (
            <SpeakerManager
              meetingId={meetingId}
              speakers={speakers}
              selectedSpeakerId={segment.speakerId}
              onSpeakerSelect={onSpeakerChange}
              onSpeakerUpdate={onSpeakersUpdate}
              mode="selector"
            />
          ) : (
            <span className="text-sm font-medium text-gray-900">
              {speaker?.name || 'Unknown Speaker'}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span>{formatTimestamp(segment.startTimestamp)}</span>
          <span>•</span>
          <span>{formatTimestamp(duration)} duration</span>
          <span>•</span>
          <span>{Math.round(segment.confidence * 100)}% confidence</span>
          {segment.isEdited && (
            <>
              <span>•</span>
              <span className="text-orange-600 font-medium">Edited</span>
            </>
          )}
        </div>
      </div>
      
      {/* Segment Content */}
      <div className="relative">
        {isEditing ? (
          <div>
            <textarea
              value={editingText}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={Math.max(2, Math.ceil(editingText.length / 80))}
              placeholder="Enter transcription text..."
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-gray-500">
                Press Ctrl+Enter to save, Escape to cancel
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSaveEdit(editingText, segment.speakerId)}
                  className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative group">
            <p className="text-gray-900 leading-relaxed cursor-text" onClick={onStartEdit}>
              {segment.text}
            </p>
            
            {/* Edit Button (appears on hover) */}
            <button
              onClick={onStartEdit}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
              title="Edit this segment"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Search component for finding text within transcription
const TranscriptionSearch: React.FC<{
  onSearch: (query: string) => void;
  onClear: () => void;
  resultsCount: number;
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
}> = ({ onSearch, onClear, resultsCount, currentIndex, onNext, onPrevious }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onClear();
  };

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <form onSubmit={handleSubmit} className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in transcription..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {resultsCount > 0 && (
          <>
            <div className="text-sm text-gray-600">
              {currentIndex + 1} of {resultsCount}
            </div>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={onPrevious}
                disabled={resultsCount === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={resultsCount === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        )}
        
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
        >
          Search
        </button>
      </form>
    </div>
  );
};

// Main TranscriptionEditor component
export const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
  meetingId,
  segments = [],
  speakers = [],
  isLoading = false,
  onSegmentUpdate,
}) => {
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [localSegments, setLocalSegments] = useState<TranscriptionSegment[]>(segments);
  const [localSpeakers, setLocalSpeakers] = useState<Speaker[]>(speakers);
  const [isSaving, setIsSaving] = useState(false);

  // Update local segments and speakers when props change
  useEffect(() => {
    setLocalSegments(segments);
  }, [segments]);

  useEffect(() => {
    setLocalSpeakers(speakers);
  }, [speakers]);

  // Search functionality
  const searchSegments = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const results: number[] = [];
    localSegments.forEach((segment) => {
      if (segment.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(segment.id);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);
    setSearchQuery(query);

    // Scroll to first result
    if (results.length > 0) {
      const element = document.getElementById(`segment-${results[0]}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [localSegments]);

  const navigateSearchResults = useCallback((direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    const newIndex = direction === 'next' 
      ? (currentSearchIndex + 1) % searchResults.length
      : (currentSearchIndex - 1 + searchResults.length) % searchResults.length;

    setCurrentSearchIndex(newIndex);
    
    const segmentId = searchResults[newIndex];
    const element = document.getElementById(`segment-${segmentId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchResults, currentSearchIndex]);

  // Editing functionality
  const handleStartEdit = useCallback((segment: TranscriptionSegment) => {
    setEditingSegmentId(segment.id);
    setEditingText(segment.text);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSegmentId(null);
    setEditingText('');
  }, []);

  const handleSaveEdit = useCallback(async (segmentId: number, newText: string, speakerId?: number) => {
    if (newText.trim() === '') return;

    setIsSaving(true);
    try {
      // Call backend to update segment
      await invoke<void>('update_transcription_segment', {
        segmentId,
        text: newText.trim(),
        speakerId,
      });

      // Update local state
      setLocalSegments(prev => 
        prev.map(segment => 
          segment.id === segmentId 
            ? { 
                ...segment, 
                text: newText.trim(), 
                speakerId, 
                isEdited: true,
                speaker: localSpeakers.find(s => s.id === speakerId)
              }
            : segment
        )
      );

      // Call parent callback if provided
      onSegmentUpdate?.({
        segmentId,
        newText: newText.trim(),
        speakerId,
      });

      setEditingSegmentId(null);
      setEditingText('');
    } catch (error) {
      console.error('Failed to update transcription segment:', error);
      // TODO: Show error notification
    } finally {
      setIsSaving(false);
    }
  }, [onSegmentUpdate, localSpeakers]);

  const handleSpeakersUpdate = useCallback((updatedSpeakers: Speaker[]) => {
    setLocalSpeakers(updatedSpeakers);
  }, []);

  // Memoized filtered segments for search highlighting
  const displaySegments = useMemo(() => {
    return localSegments.map(segment => ({
      ...segment,
      isHighlighted: searchResults.includes(segment.id),
    }));
  }, [localSegments, searchResults]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          <span className="ml-3 text-gray-600">Loading transcription...</span>
        </div>
      </Card>
    );
  }

  if (localSegments.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transcription Available</h3>
          <p className="text-gray-600">
            This meeting doesn't have a transcription yet, or it's still being processed.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Search Interface */}
      <TranscriptionSearch
        onSearch={searchSegments}
        onClear={() => {
          setSearchQuery('');
          setSearchResults([]);
          setCurrentSearchIndex(0);
        }}
        resultsCount={searchResults.length}
        currentIndex={currentSearchIndex}
        onNext={() => navigateSearchResults('next')}
        onPrevious={() => navigateSearchResults('prev')}
      />

      {/* Transcription Stats */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <span>{localSegments.length} segments</span>
              <span>{localSpeakers.length} speakers</span>
              <span>
                {formatTimestamp(Math.max(...localSegments.map(s => s.endTimestamp)))} total
              </span>
              {localSegments.some(s => s.isEdited) && (
                <span className="text-orange-600 font-medium">
                  {localSegments.filter(s => s.isEdited).length} edited
                </span>
              )}
            </div>
            
            {isSaving && (
              <div className="flex items-center text-sm text-emerald-600">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Saving...</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Transcription Segments */}
      <div className="space-y-4">
        {displaySegments.map((segment) => (
          <div
            key={segment.id}
            id={`segment-${segment.id}`}
            className={segment.isHighlighted ? 'ring-2 ring-emerald-500 ring-opacity-50 rounded-lg' : ''}
          >
            <TranscriptionSegmentComponent
              meetingId={meetingId}
              segment={segment}
              speakers={localSpeakers}
              isEditing={editingSegmentId === segment.id}
              editingText={editingText}
              onStartEdit={() => handleStartEdit(segment)}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={(newText, speakerId) => handleSaveEdit(segment.id, newText, speakerId)}
              onTextChange={setEditingText}
              onSpeakerChange={(speakerId) => {
                // Update the editing segment's speaker immediately for visual feedback
                setLocalSegments(prev =>
                  prev.map(s => s.id === segment.id ? { 
                    ...s, 
                    speakerId,
                    speaker: localSpeakers.find(speaker => speaker.id === speakerId)
                  } : s)
                );
              }}
              onSpeakersUpdate={handleSpeakersUpdate}
            />
          </div>
        ))}
      </div>

      {/* Usage Instructions */}
      <Card className="mt-6">
        <div className="p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Editing Instructions</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Click on any text to start editing</li>
            <li>• Use Ctrl+Enter (Cmd+Enter on Mac) to save changes</li>
            <li>• Press Escape to cancel editing</li>
            <li>• Change speaker assignments using the dropdown while editing</li>
            <li>• Use search to quickly find specific text in the transcription</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default TranscriptionEditor;