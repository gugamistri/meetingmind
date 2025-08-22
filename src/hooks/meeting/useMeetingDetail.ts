import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import type { DetailedMeeting, Summary, ActionItem, MeetingInsight } from '@/types/meeting.types';
import type { DetailedTranscription } from '@/types/transcription.types';

// Backend response type (matching Rust struct)
interface MeetingDetailResponse {
  meeting: {
    id: number;
    title: string;
    description?: string;
    start_time: string;
    end_time?: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    created_at: string;
    updated_at: string;
  };
  participants: Array<{
    id: number;
    meeting_id: number;
    name: string;
    email?: string;
    role: 'organizer' | 'participant' | 'presenter';
    joined_at?: string;
    left_at?: string;
    created_at: string;
  }>;
  transcription_sessions: any[];
  transcriptions: any[];
  summaries: Array<{
    id: string;
    meeting_id: string;
    template_id?: number;
    content: string;
    model_used: string;
    provider: 'openai' | 'claude';
    cost_usd?: number;
    processing_time_ms: number;
    token_count?: number;
    confidence_score?: number;
    created_at: string;
  }>;
  has_audio_file: boolean;
  audio_file_path?: string;
}

interface UseMeetingDetailReturn {
  meeting: DetailedMeeting | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateMeeting: (updates: { title?: string; description?: string }) => Promise<void>;
  deleteMeeting: () => Promise<void>;
  duplicateMeeting: () => Promise<DetailedMeeting>;
  archiveMeeting: (archived: boolean) => Promise<void>;
}

export const useMeetingDetail = (meetingId: number): UseMeetingDetailReturn => {
  const [meeting, setMeeting] = useState<DetailedMeeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert backend response to frontend types
  const convertMeetingResponse = useCallback((response: MeetingDetailResponse): DetailedMeeting => {
    const { meeting: meetingData, participants, summaries, has_audio_file, audio_file_path } = response;
    
    return {
      id: meetingData.id,
      title: meetingData.title,
      description: meetingData.description,
      startTime: new Date(meetingData.start_time),
      endTime: meetingData.end_time ? new Date(meetingData.end_time) : undefined,
      status: meetingData.status as any,
      createdAt: new Date(meetingData.created_at),
      updatedAt: new Date(meetingData.updated_at),
      duration: meetingData.end_time ? 
        new Date(meetingData.end_time).getTime() - new Date(meetingData.start_time).getTime() : 
        undefined,
      participants: participants.map(p => ({
        id: p.id,
        meetingId: p.meeting_id,
        name: p.name,
        email: p.email,
        role: p.role as any,
        joinedAt: p.joined_at ? new Date(p.joined_at) : undefined,
        leftAt: p.left_at ? new Date(p.left_at) : undefined,
        createdAt: new Date(p.created_at),
      })),
      audioFilePath: audio_file_path,
      summaries: summaries.map(s => ({
        id: s.id,
        meetingId: parseInt(s.meeting_id),
        templateId: s.template_id,
        templateName: 'General Meeting', // TODO: Get from template repository
        content: s.content,
        modelUsed: s.model_used,
        provider: s.provider,
        costUsd: s.cost_usd,
        tokenCount: s.token_count,
        processingTimeMs: s.processing_time_ms,
        confidenceScore: s.confidence_score,
        createdAt: new Date(s.created_at),
      })),
      hasTranscription: response.transcriptions.length > 0,
      hasAiSummary: summaries.length > 0,
      // TODO: Add transcription, actionItems, insights when backend supports them
    };
  }, []);

  const fetchMeetingDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await invoke<MeetingDetailResponse>('get_meeting_detail', {
        meetingId,
      });
      
      const convertedMeeting = convertMeetingResponse(response);
      setMeeting(convertedMeeting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch meeting details');
      console.error('Failed to fetch meeting details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId, convertMeetingResponse]);

  const updateMeeting = useCallback(async (updates: { title?: string; description?: string }) => {
    try {
      await invoke('update_meeting', {
        meetingId,
        updateRequest: updates,
      });
      
      // Refetch the meeting to get updated data
      await fetchMeetingDetail();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update meeting');
    }
  }, [meetingId, fetchMeetingDetail]);

  const deleteMeeting = useCallback(async () => {
    try {
      await invoke('delete_meeting', {
        meetingId,
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  }, [meetingId]);

  const duplicateMeeting = useCallback(async (): Promise<DetailedMeeting> => {
    try {
      const response = await invoke<MeetingDetailResponse>('duplicate_meeting', {
        meetingId,
      });
      
      return convertMeetingResponse(response);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to duplicate meeting');
    }
  }, [meetingId, convertMeetingResponse]);

  const archiveMeeting = useCallback(async (archived: boolean) => {
    try {
      await invoke('archive_meeting', {
        meetingId,
        archived,
      });
      
      // Refetch the meeting to get updated status
      await fetchMeetingDetail();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to archive meeting');
    }
  }, [meetingId, fetchMeetingDetail]);

  // Initial data fetch
  useEffect(() => {
    fetchMeetingDetail();
  }, [fetchMeetingDetail]);

  return {
    meeting,
    isLoading,
    error,
    refetch: fetchMeetingDetail,
    updateMeeting,
    deleteMeeting,
    duplicateMeeting,
    archiveMeeting,
  };
};