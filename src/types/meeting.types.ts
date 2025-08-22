/**
 * Meeting-related TypeScript type definitions
 * 
 * These types match the Rust backend models for consistent data flow
 * between frontend and backend via Tauri commands.
 */

// Meeting status matching Rust enum
export enum MeetingStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

// Participant role matching Rust enum
export enum ParticipantRole {
  Organizer = 'organizer',
  Participant = 'participant',
  Presenter = 'presenter',
}

// Meeting entity matching Rust struct
export interface Meeting {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly status: MeetingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly duration?: number; // Calculated duration in milliseconds
  readonly participants?: Participant[];
  readonly transcriptionSummary?: string;
  readonly hasTranscription?: boolean;
  readonly hasAiSummary?: boolean;
}

// Participant entity
export interface Participant {
  readonly id: number;
  readonly meetingId: number;
  readonly name: string;
  readonly email?: string;
  readonly role: ParticipantRole;
  readonly joinedAt?: Date;
  readonly leftAt?: Date;
  readonly createdAt: Date;
}

// Meeting statistics for dashboard
export interface MeetingStats {
  readonly totalMeetings: number;
  readonly totalDurationMs: number;
  readonly todaysMeetings: number;
  readonly weeklyMeetings: number;
  readonly averageDurationMs: number;
  readonly completedMeetings: number;
  readonly recordingsWithTranscription: number;
  readonly recordingsWithAiSummary: number;
}

// Dashboard data structure
export interface DashboardData {
  readonly recentMeetings: Meeting[];
  readonly meetingStats: MeetingStats;
  readonly upcomingMeetings?: Meeting[];
  readonly currentMeeting?: Meeting;
}

// Meeting list filters and pagination
export interface MeetingFilters {
  readonly status?: MeetingStatus;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly searchTerm?: string;
  readonly hasTranscription?: boolean;
  readonly hasAiSummary?: boolean;
}

export interface MeetingListRequest {
  readonly limit?: number;
  readonly offset?: number;
  readonly filters?: MeetingFilters;
  readonly sortBy?: 'start_time' | 'created_at' | 'title' | 'duration';
  readonly sortOrder?: 'asc' | 'desc';
}

export interface MeetingListResponse {
  readonly meetings: Meeting[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

// Meeting creation and updates
export interface CreateMeetingRequest {
  readonly title: string;
  readonly description?: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly participants?: Omit<Participant, 'id' | 'meetingId' | 'createdAt'>[];
}

export interface UpdateMeetingRequest {
  readonly id: number;
  readonly title?: string;
  readonly description?: string;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly status?: MeetingStatus;
}

// Meeting quick actions
export type MeetingAction = 
  | 'view'
  | 'edit' 
  | 'delete'
  | 'export'
  | 'duplicate'
  | 'start_recording'
  | 'view_transcription'
  | 'view_summary';

// Meeting card display data
export interface MeetingCardData {
  readonly meeting: Meeting;
  readonly displayDuration: string;
  readonly displayDate: string;
  readonly statusColor: string;
  readonly actionItems?: number;
  readonly participants?: number;
}

// Time-based greeting
export type GreetingTimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface DashboardGreeting {
  readonly timeOfDay: GreetingTimeOfDay;
  readonly greeting: string;
  readonly userName?: string;
}

// Quick stats widget data
export interface QuickStatsData {
  readonly label: string;
  readonly value: string | number;
  readonly change?: number; // Percentage change from previous period
  readonly trend?: 'up' | 'down' | 'stable';
  readonly icon?: string;
  readonly color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

// Error types for meeting operations
export interface MeetingError {
  readonly code: string;
  readonly message: string;
  readonly meetingId?: number;
}

// Recording session info for meetings
export interface MeetingRecordingSession {
  readonly meetingId: number;
  readonly sessionId: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly status: 'active' | 'completed' | 'failed';
  readonly audioDevice: string;
  readonly hasTranscription: boolean;
  readonly transcriptionProgress?: number; // 0-100
}

// Utility functions for meeting data
export const getMeetingDuration = (meeting: Meeting): number => {
  if (!meeting.endTime) return 0;
  return new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime();
};

export const formatMeetingDuration = (durationMs: number): string => {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const getMeetingStatusColor = (status: MeetingStatus): string => {
  switch (status) {
    case MeetingStatus.Scheduled:
      return 'text-blue-600';
    case MeetingStatus.InProgress:
      return 'text-green-600';
    case MeetingStatus.Completed:
      return 'text-gray-600';
    case MeetingStatus.Cancelled:
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

export const getGreetingForTime = (): DashboardGreeting => {
  const hour = new Date().getHours();
  
  if (hour < 12) {
    return {
      timeOfDay: 'morning',
      greeting: 'Good morning',
    };
  } else if (hour < 18) {
    return {
      timeOfDay: 'afternoon', 
      greeting: 'Good afternoon',
    };
  } else {
    return {
      timeOfDay: 'evening',
      greeting: 'Good evening',
    };
  }
};

// Detailed meeting data for the meeting detail view
export interface DetailedMeeting extends Meeting {
  readonly audioFilePath?: string;
  readonly recordingSession?: MeetingRecordingSession;
  readonly transcription?: DetailedTranscription;
  readonly summaries?: Summary[];
  readonly actionItems?: ActionItem[];
  readonly insights?: MeetingInsight[];
}

// AI-generated summary data
export interface Summary {
  readonly id: string;
  readonly meetingId: number;
  readonly templateId?: number;
  readonly templateName: string;
  readonly content: string;
  readonly modelUsed: string;
  readonly provider: 'openai' | 'claude';
  readonly costUsd?: number;
  readonly tokenCount?: number;
  readonly processingTimeMs: number;
  readonly confidenceScore?: number;
  readonly createdAt: Date;
}

// Action items extracted from meetings
export interface ActionItem {
  readonly id: number;
  readonly meetingId: number;
  readonly text: string;
  readonly assignee?: string;
  readonly dueDate?: Date;
  readonly priority: 'low' | 'medium' | 'high';
  readonly status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Meeting insights from AI analysis
export interface MeetingInsight {
  readonly id: number;
  readonly meetingId: number;
  readonly type: 'sentiment' | 'topic' | 'decision' | 'risk' | 'opportunity';
  readonly title: string;
  readonly description: string;
  readonly confidence: number;
  readonly metadata?: Record<string, any>;
  readonly createdAt: Date;
}

// Import DetailedTranscription type (this will be used in DetailedMeeting)
import type { DetailedTranscription } from './transcription.types';

export default {
  MeetingStatus,
  ParticipantRole,
  getMeetingDuration,
  formatMeetingDuration,
  getMeetingStatusColor,
  getGreetingForTime,
};