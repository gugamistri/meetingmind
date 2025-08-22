/**
 * Meeting state management using Zustand
 * 
 * Manages meeting data, dashboard state, and meeting operations
 * with optimistic updates and error handling.
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { 
  Meeting, 
  MeetingStats, 
  DashboardData, 
  MeetingListRequest, 
  MeetingListResponse,
  CreateMeetingRequest,
  UpdateMeetingRequest,
  MeetingFilters,
  MeetingRecordingSession,
  MeetingStatus
} from '../types/meeting.types';

interface MeetingStore {
  // State
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  recentMeetings: Meeting[];
  meetingStats: MeetingStats | null;
  dashboardData: DashboardData | null;
  activeRecordingSession: MeetingRecordingSession | null;
  
  // Loading states
  isLoading: boolean;
  isDashboardLoading: boolean;
  isMeetingListLoading: boolean;
  isCreatingMeeting: boolean;
  isUpdatingMeeting: boolean;
  
  // Error states
  error: string | null;
  dashboardError: string | null;
  meetingListError: string | null;
  
  // Pagination and filters
  currentFilters: MeetingFilters;
  totalMeetingCount: number;
  hasMoreMeetings: boolean;
  
  // Actions
  loadDashboardData: () => Promise<void>;
  loadMeetingList: (request?: MeetingListRequest) => Promise<void>;
  loadMoreMeetings: () => Promise<void>;
  refreshMeetings: () => Promise<void>;
  createMeeting: (meeting: CreateMeetingRequest) => Promise<Meeting>;
  updateMeeting: (meeting: UpdateMeetingRequest) => Promise<Meeting>;
  deleteMeeting: (meetingId: number) => Promise<void>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  setFilters: (filters: MeetingFilters) => void;
  startMeetingRecording: (meetingId: number) => Promise<void>;
  stopMeetingRecording: () => Promise<void>;
  clearError: () => void;
  clearDashboardError: () => void;
  clearMeetingListError: () => void;
}

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  // Initial state
  meetings: [],
  currentMeeting: null,
  recentMeetings: [],
  meetingStats: null,
  dashboardData: null,
  activeRecordingSession: null,
  
  // Loading states
  isLoading: false,
  isDashboardLoading: false,
  isMeetingListLoading: false,
  isCreatingMeeting: false,
  isUpdatingMeeting: false,
  
  // Error states
  error: null,
  dashboardError: null,
  meetingListError: null,
  
  // Pagination and filters
  currentFilters: {},
  totalMeetingCount: 0,
  hasMoreMeetings: false,

  // Actions
  loadDashboardData: async () => {
    set({ isDashboardLoading: true, dashboardError: null });
    
    try {
      // Load dashboard data from backend
      const dashboardData = await invoke<DashboardData>('get_dashboard_data');
      
      set({
        dashboardData,
        recentMeetings: dashboardData.recentMeetings,
        meetingStats: dashboardData.meetingStats,
        currentMeeting: dashboardData.currentMeeting || null,
        isDashboardLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data';
      set({
        dashboardError: errorMessage,
        isDashboardLoading: false,
      });
    }
  },

  loadMeetingList: async (request: MeetingListRequest = {}) => {
    set({ isMeetingListLoading: true, meetingListError: null });
    
    try {
      const response = await invoke<MeetingListResponse>('get_meetings', { 
        request: {
          limit: 10,
          offset: 0,
          sortBy: 'start_time',
          sortOrder: 'desc',
          ...request,
        }
      });
      
      set({
        meetings: response.meetings,
        totalMeetingCount: response.totalCount,
        hasMoreMeetings: response.hasMore,
        isMeetingListLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load meetings';
      set({
        meetingListError: errorMessage,
        isMeetingListLoading: false,
      });
    }
  },

  loadMoreMeetings: async () => {
    const { meetings, hasMoreMeetings, currentFilters } = get();
    if (!hasMoreMeetings || get().isMeetingListLoading) return;
    
    set({ isLoading: true });
    
    try {
      const response = await invoke<MeetingListResponse>('get_meetings', {
        request: {
          limit: 10,
          offset: meetings.length,
          filters: currentFilters,
          sortBy: 'start_time',
          sortOrder: 'desc',
        }
      });
      
      set({
        meetings: [...meetings, ...response.meetings],
        hasMoreMeetings: response.hasMore,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more meetings';
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  refreshMeetings: async () => {
    const { currentFilters } = get();
    await get().loadMeetingList({ filters: currentFilters });
  },

  createMeeting: async (meetingData: CreateMeetingRequest): Promise<Meeting> => {
    set({ isCreatingMeeting: true, error: null });
    
    try {
      const newMeeting = await invoke<Meeting>('create_meeting', { meeting: meetingData });
      
      // Optimistically add to meetings list
      const { meetings } = get();
      set({
        meetings: [newMeeting, ...meetings],
        isCreatingMeeting: false,
      });
      
      // Refresh dashboard data
      get().loadDashboardData();
      
      return newMeeting;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create meeting';
      set({
        error: errorMessage,
        isCreatingMeeting: false,
      });
      throw error;
    }
  },

  updateMeeting: async (meetingData: UpdateMeetingRequest): Promise<Meeting> => {
    set({ isUpdatingMeeting: true, error: null });
    
    try {
      const updatedMeeting = await invoke<Meeting>('update_meeting', { meeting: meetingData });
      
      // Update in meetings list
      const { meetings } = get();
      const updatedMeetings = meetings.map(m => 
        m.id === updatedMeeting.id ? updatedMeeting : m
      );
      
      set({
        meetings: updatedMeetings,
        currentMeeting: get().currentMeeting?.id === updatedMeeting.id ? updatedMeeting : get().currentMeeting,
        isUpdatingMeeting: false,
      });
      
      return updatedMeeting;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update meeting';
      set({
        error: errorMessage,
        isUpdatingMeeting: false,
      });
      throw error;
    }
  },

  deleteMeeting: async (meetingId: number): Promise<void> => {
    set({ isLoading: true, error: null });
    
    try {
      await invoke('delete_meeting', { meetingId });
      
      // Remove from meetings list
      const { meetings } = get();
      const filteredMeetings = meetings.filter(m => m.id !== meetingId);
      
      set({
        meetings: filteredMeetings,
        currentMeeting: get().currentMeeting?.id === meetingId ? null : get().currentMeeting,
        isLoading: false,
      });
      
      // Refresh dashboard data
      get().loadDashboardData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete meeting';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  setCurrentMeeting: (meeting: Meeting | null) => {
    set({ currentMeeting: meeting });
  },

  setFilters: (filters: MeetingFilters) => {
    set({ currentFilters: filters });
    // Reload meetings with new filters
    get().loadMeetingList({ filters });
  },

  startMeetingRecording: async (meetingId: number): Promise<void> => {
    set({ isLoading: true, error: null });
    
    try {
      const session = await invoke<MeetingRecordingSession>('start_meeting_recording', { meetingId });
      
      // Update meeting status to in_progress
      const { meetings } = get();
      const updatedMeetings = meetings.map(m => 
        m.id === meetingId ? { ...m, status: MeetingStatus.InProgress } : m
      );
      
      set({
        meetings: updatedMeetings,
        activeRecordingSession: session,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  stopMeetingRecording: async (): Promise<void> => {
    const { activeRecordingSession } = get();
    if (!activeRecordingSession) return;
    
    set({ isLoading: true, error: null });
    
    try {
      await invoke('stop_meeting_recording', { sessionId: activeRecordingSession.sessionId });
      
      // Update meeting status to completed
      const { meetings } = get();
      const updatedMeetings = meetings.map(m => 
        m.id === activeRecordingSession.meetingId ? { ...m, status: MeetingStatus.Completed } : m
      );
      
      set({
        meetings: updatedMeetings,
        activeRecordingSession: null,
        isLoading: false,
      });
      
      // Refresh dashboard data
      get().loadDashboardData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearDashboardError: () => {
    set({ dashboardError: null });
  },

  clearMeetingListError: () => {
    set({ meetingListError: null });
  },
}));

// Utility hooks for specific store data
export const useDashboardData = () => {
  const store = useMeetingStore();
  return {
    dashboardData: store.dashboardData,
    recentMeetings: store.recentMeetings,
    meetingStats: store.meetingStats,
    isLoading: store.isDashboardLoading,
    error: store.dashboardError,
    refresh: store.loadDashboardData,
  };
};

export const useMeetingList = () => {
  const store = useMeetingStore();
  return {
    meetings: store.meetings,
    isLoading: store.isMeetingListLoading,
    error: store.meetingListError,
    hasMore: store.hasMoreMeetings,
    totalCount: store.totalMeetingCount,
    filters: store.currentFilters,
    loadMeetings: store.loadMeetingList,
    loadMore: store.loadMoreMeetings,
    setFilters: store.setFilters,
    refresh: store.refreshMeetings,
  };
};

export const useCurrentMeeting = () => {
  const store = useMeetingStore();
  return {
    currentMeeting: store.currentMeeting,
    setCurrentMeeting: store.setCurrentMeeting,
  };
};

export const useMeetingActions = () => {
  const store = useMeetingStore();
  return {
    createMeeting: store.createMeeting,
    updateMeeting: store.updateMeeting,
    deleteMeeting: store.deleteMeeting,
    isCreating: store.isCreatingMeeting,
    isUpdating: store.isUpdatingMeeting,
    error: store.error,
    clearError: store.clearError,
  };
};

export const useRecordingSession = () => {
  const store = useMeetingStore();
  return {
    activeSession: store.activeRecordingSession,
    startRecording: store.startMeetingRecording,
    stopRecording: store.stopMeetingRecording,
    isLoading: store.isLoading,
    error: store.error,
  };
};