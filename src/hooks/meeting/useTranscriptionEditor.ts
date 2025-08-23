import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  TranscriptionSegment, 
  Speaker, 
  DetailedTranscription,
  TranscriptionEdit 
} from '@/types/transcription.types';

interface DetailedMeetingTranscription {
  id: number;
  meetingId: number;
  content: string;
  confidence: number;
  language: string;
  modelUsed: string;
  createdAt: string;
  segments: Array<{
    id: number;
    transcriptionId: number;
    speakerId?: number;
    text: string;
    startTimestamp: number;
    endTimestamp: number;
    confidence: number;
    isEdited: boolean;
  }>;
  speakers: Array<{
    id: number;
    name?: string;
    email?: string;
    colorHex: string;
    voiceFingerprint?: number[];
    totalMeetings: number;
    lastSeen: string;
  }>;
  totalDuration: number;
  processingTimeMs: number;
  processedLocally: boolean;
}

interface UseTranscriptionEditorReturn {
  transcription: DetailedTranscription | null;
  segments: TranscriptionSegment[];
  speakers: Speaker[];
  isLoading: boolean;
  error: string | null;
  updateSegment: (edit: TranscriptionEdit) => Promise<void>;
  updateSpeakerAssignment: (segmentId: number, speakerId?: number) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useTranscriptionEditor = (meetingId: number): UseTranscriptionEditorReturn => {
  const [transcription, setTranscription] = useState<DetailedTranscription | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transformBackendData = useCallback((backendData: DetailedMeetingTranscription): DetailedTranscription => {
    const transformedSpeakers: Speaker[] = backendData.speakers.map(speaker => ({
      id: speaker.id,
      name: speaker.name,
      email: speaker.email,
      colorHex: speaker.colorHex,
      voiceFingerprint: speaker.voiceFingerprint ? new Uint8Array(speaker.voiceFingerprint).buffer : undefined,
      totalMeetings: speaker.totalMeetings,
      lastSeen: new Date(speaker.lastSeen),
    }));

    const transformedSegments: TranscriptionSegment[] = backendData.segments.map(segment => ({
      id: segment.id,
      transcriptionId: segment.transcriptionId,
      speakerId: segment.speakerId,
      text: segment.text,
      startTimestamp: segment.startTimestamp,
      endTimestamp: segment.endTimestamp,
      confidence: segment.confidence,
      isEdited: segment.isEdited,
      speaker: transformedSpeakers.find(s => s.id === segment.speakerId),
    }));

    return {
      id: backendData.id,
      meetingId: backendData.meetingId,
      content: backendData.content,
      confidence: backendData.confidence,
      language: backendData.language,
      modelUsed: backendData.modelUsed,
      createdAt: new Date(backendData.createdAt),
      segments: transformedSegments,
      speakers: transformedSpeakers,
      totalDuration: backendData.totalDuration,
      processingTimeMs: backendData.processingTimeMs,
      processedLocally: backendData.processedLocally,
    };
  }, []);

  const fetchTranscription = useCallback(async () => {
    if (!meetingId) return;

    setIsLoading(true);
    setError(null);

    try {
      const backendData = await invoke<DetailedMeetingTranscription>('get_meeting_transcription', {
        meetingId,
      });

      const transformedData = transformBackendData(backendData);
      setTranscription(transformedData);
      setSegments(transformedData.segments);
      setSpeakers(transformedData.speakers);
    } catch (err) {
      console.error('Failed to fetch transcription:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transcription');
      setTranscription(null);
      setSegments([]);
      setSpeakers([]);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, transformBackendData]);

  const updateSegment = useCallback(async (edit: TranscriptionEdit) => {
    try {
      await invoke<void>('update_transcription_segment', {
        segmentId: edit.segmentId,
        text: edit.newText,
        speakerId: edit.speakerId,
      });

      // Update local state optimistically
      setSegments(prev =>
        prev.map(segment =>
          segment.id === edit.segmentId
            ? {
                ...segment,
                text: edit.newText,
                speakerId: edit.speakerId,
                isEdited: true,
                speaker: speakers.find(s => s.id === edit.speakerId),
              }
            : segment
        )
      );

      // Update the main transcription object if it exists
      if (transcription) {
        setTranscription(prev =>
          prev
            ? {
                ...prev,
                segments: prev.segments.map(segment =>
                  segment.id === edit.segmentId
                    ? {
                        ...segment,
                        text: edit.newText,
                        speakerId: edit.speakerId,
                        isEdited: true,
                        speaker: speakers.find(s => s.id === edit.speakerId),
                      }
                    : segment
                ),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to update segment:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update segment');
    }
  }, [speakers, transcription]);

  const updateSpeakerAssignment = useCallback(async (segmentId: number, speakerId?: number) => {
    try {
      await invoke<void>('update_speaker_assignment', {
        segmentId,
        speakerId,
      });

      // Update local state optimistically
      setSegments(prev =>
        prev.map(segment =>
          segment.id === segmentId
            ? {
                ...segment,
                speakerId,
                speaker: speakers.find(s => s.id === speakerId),
                isEdited: true,
              }
            : segment
        )
      );

      // Update the main transcription object if it exists
      if (transcription) {
        setTranscription(prev =>
          prev
            ? {
                ...prev,
                segments: prev.segments.map(segment =>
                  segment.id === segmentId
                    ? {
                        ...segment,
                        speakerId,
                        speaker: speakers.find(s => s.id === speakerId),
                        isEdited: true,
                      }
                    : segment
                ),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to update speaker assignment:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update speaker assignment');
    }
  }, [speakers, transcription]);

  const refetch = useCallback(async () => {
    await fetchTranscription();
  }, [fetchTranscription]);

  // Initial fetch
  useEffect(() => {
    fetchTranscription();
  }, [fetchTranscription]);

  return {
    transcription,
    segments,
    speakers,
    isLoading,
    error,
    updateSegment,
    updateSpeakerAssignment,
    refetch,
  };
};