import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Speaker } from '@/types/transcription.types';
import { Card } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface SpeakerManagerProps {
  meetingId: number;
  speakers?: Speaker[];
  onSpeakerUpdate?: (speakers: Speaker[]) => void;
  selectedSpeakerId?: number;
  onSpeakerSelect?: (speakerId?: number) => void;
  mode?: 'full' | 'selector'; // full = management interface, selector = dropdown selector
}

// Color palette for speakers
const SPEAKER_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#EC4899', // Pink
  '#6366F1', // Indigo
];

// Speaker creation/editing form
const SpeakerForm: React.FC<{
  speaker?: Speaker | null;
  onSave: (speakerData: Partial<Speaker>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}> = ({ speaker, onSave, onCancel, isLoading = false }) => {
  const [name, setName] = useState(speaker?.name || '');
  const [email, setEmail] = useState(speaker?.email || '');
  const [colorHex, setColorHex] = useState(speaker?.colorHex || SPEAKER_COLORS[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    await onSave({
      id: speaker?.id,
      name: name.trim(),
      email: email.trim() || undefined,
      colorHex,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="speaker-name" className="block text-sm font-medium text-gray-700">
          Name *
        </label>
        <input
          id="speaker-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="Enter speaker name"
          required
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label htmlFor="speaker-email" className="block text-sm font-medium text-gray-700">
          Email (optional)
        </label>
        <input
          id="speaker-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="Enter email address"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {SPEAKER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setColorHex(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                colorHex === color 
                  ? 'border-gray-900 scale-110' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              style={{ backgroundColor: color }}
              disabled={isLoading}
              title={color}
            />
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center"
          disabled={isLoading || !name.trim()}
        >
          {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
          {speaker ? 'Update' : 'Create'} Speaker
        </button>
      </div>
    </form>
  );
};

// Individual speaker card for full management mode
const SpeakerCard: React.FC<{
  speaker: Speaker;
  onEdit: (speaker: Speaker) => void;
  onDelete: (speakerId: number) => void;
  isDeleting?: boolean;
}> = ({ speaker, onEdit, onDelete, isDeleting = false }) => {
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${speaker.name || 'this speaker'}?`)) {
      onDelete(speaker.id);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
            style={{ backgroundColor: speaker.colorHex }}
          >
            {speaker.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h4 className="font-medium text-gray-900">
              {speaker.name || 'Unknown Speaker'}
            </h4>
            {speaker.email && (
              <p className="text-sm text-gray-500">{speaker.email}</p>
            )}
            <p className="text-xs text-gray-400">
              {speaker.totalMeetings} meeting{speaker.totalMeetings !== 1 ? 's' : ''} •{' '}
              Last seen: {speaker.lastSeen.toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(speaker)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit speaker"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
            title="Delete speaker"
          >
            {isDeleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Speaker selector dropdown for use in transcription editor
const SpeakerSelector: React.FC<{
  speakers: Speaker[];
  selectedSpeakerId?: number;
  onSelect: (speakerId?: number) => void;
  onAddNew: () => void;
  disabled?: boolean;
}> = ({ speakers, selectedSpeakerId, onSelect, onAddNew, disabled = false }) => {
  return (
    <div className="flex items-center space-x-2">
      <select
        value={selectedSpeakerId || ''}
        onChange={(e) => onSelect(e.target.value ? parseInt(e.target.value, 10) : undefined)}
        className="text-sm font-medium bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        disabled={disabled}
      >
        <option value="">Unknown Speaker</option>
        {speakers.map(speaker => (
          <option key={speaker.id} value={speaker.id}>
            {speaker.name || `Speaker ${speaker.id}`}
          </option>
        ))}
      </select>
      
      <button
        type="button"
        onClick={onAddNew}
        className="p-1 text-emerald-600 hover:text-emerald-700 transition-colors"
        title="Add new speaker"
        disabled={disabled}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

// Main SpeakerManager component
export const SpeakerManager: React.FC<SpeakerManagerProps> = ({
  meetingId,
  speakers = [],
  onSpeakerUpdate,
  selectedSpeakerId,
  onSpeakerSelect,
  mode = 'full',
}) => {
  const [localSpeakers, setLocalSpeakers] = useState<Speaker[]>(speakers);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null | 'new'>(null);
  const [deletingSpeakerId, setDeletingSpeakerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Update local speakers when prop changes
  useEffect(() => {
    setLocalSpeakers(speakers);
  }, [speakers]);

  const handleSaveSpeaker = useCallback(async (speakerData: Partial<Speaker>) => {
    setIsLoading(true);
    setError(null);

    try {
      if (speakerData.id) {
        // Update existing speaker
        await invoke<void>('update_speaker', {
          speakerId: speakerData.id,
          name: speakerData.name,
          email: speakerData.email,
          colorHex: speakerData.colorHex,
        });
        
        setLocalSpeakers(prev =>
          prev.map(s =>
            s.id === speakerData.id
              ? { ...s, ...speakerData, name: speakerData.name! }
              : s
          )
        );
      } else {
        // Create new speaker
        const newSpeaker = await invoke<Speaker>('create_speaker', {
          meetingId,
          name: speakerData.name,
          email: speakerData.email,
          colorHex: speakerData.colorHex,
        });
        
        setLocalSpeakers(prev => [...prev, newSpeaker]);
      }

      // Notify parent component
      onSpeakerUpdate?.(localSpeakers);
      setEditingSpeaker(null);
    } catch (err) {
      console.error('Failed to save speaker:', err);
      setError(err instanceof Error ? err.message : 'Failed to save speaker');
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, onSpeakerUpdate, localSpeakers]);

  const handleDeleteSpeaker = useCallback(async (speakerId: number) => {
    setDeletingSpeakerId(speakerId);
    setError(null);

    try {
      await invoke<void>('delete_speaker', { speakerId });
      
      setLocalSpeakers(prev => prev.filter(s => s.id !== speakerId));
      onSpeakerUpdate?.(localSpeakers.filter(s => s.id !== speakerId));
    } catch (err) {
      console.error('Failed to delete speaker:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete speaker');
    } finally {
      setDeletingSpeakerId(null);
    }
  }, [onSpeakerUpdate, localSpeakers]);

  if (mode === 'selector') {
    return (
      <SpeakerSelector
        speakers={localSpeakers}
        selectedSpeakerId={selectedSpeakerId}
        onSelect={onSpeakerSelect || (() => {})}
        onAddNew={() => setEditingSpeaker('new')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Speaker Form Modal/Inline */}
      {editingSpeaker && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingSpeaker === 'new' ? 'Add New Speaker' : 'Edit Speaker'}
            </h3>
            <SpeakerForm
              speaker={editingSpeaker === 'new' ? null : editingSpeaker}
              onSave={handleSaveSpeaker}
              onCancel={() => setEditingSpeaker(null)}
              isLoading={isLoading}
            />
          </div>
        </Card>
      )}

      {/* Speaker List */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Meeting Speakers ({localSpeakers.length})
            </h3>
            {!editingSpeaker && (
              <button
                onClick={() => setEditingSpeaker('new')}
                className="px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Speaker
              </button>
            )}
          </div>

          {localSpeakers.length > 0 ? (
            <div className="space-y-3">
              {localSpeakers.map(speaker => (
                <SpeakerCard
                  key={speaker.id}
                  speaker={speaker}
                  onEdit={setEditingSpeaker}
                  onDelete={handleDeleteSpeaker}
                  isDeleting={deletingSpeakerId === speaker.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No speakers yet</h4>
              <p className="text-gray-600 mb-4">
                Add speakers to help identify who said what in your meeting transcription.
              </p>
              <button
                onClick={() => setEditingSpeaker('new')}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
              >
                Add First Speaker
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SpeakerManager;