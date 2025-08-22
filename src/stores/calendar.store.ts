import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/tauri';

export interface CalendarAccount {
  id: number;
  provider: string;
  account_email: string;
  is_active: boolean;
  auto_start_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id?: number;
  calendar_account_id: number;
  external_event_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  participants: string[];
  location?: string;
  meeting_url?: string;
  is_accepted: boolean;
  last_modified?: string;
  created_at: string;
}

export interface SyncStatus {
  last_sync?: string;
  events_synced: number;
  sync_in_progress: boolean;
  last_error?: string;
}

export interface DetectedMeeting {
  calendar_event: CalendarEvent;
  confidence: number;
  detection_time: string;
  countdown_seconds: number;
  auto_start_triggered: boolean;
}

export interface CalendarState {
  // Accounts
  accounts: CalendarAccount[];
  syncStatuses: Record<number, SyncStatus>;
  isLoading: boolean;
  
  // Events
  upcomingEvents: CalendarEvent[];
  detectedMeetings: DetectedMeeting[];
  
  // UI State
  isConnecting: boolean;
  error: string | null;
  
  // Actions
  loadAccounts: () => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  completeOAuthFlow: (code: string, state: string, email: string) => Promise<void>;
  syncAccount: (accountId: number) => Promise<void>;
  syncAllAccounts: () => Promise<void>;
  updateAutoStart: (accountId: number, enabled: boolean) => Promise<void>;
  disconnectAccount: (accountId: number) => Promise<void>;
  loadUpcomingEvents: (hoursAhead?: number) => Promise<void>;
  getMeetingConflicts: (startTime: string, endTime: string) => Promise<CalendarEvent[]>;
  
  // Event handlers
  handleCalendarEvent: (event: any) => void;
  clearError: () => void;
}

export const useCalendarStore = create<CalendarState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    accounts: [],
    syncStatuses: {},
    isLoading: false,
    upcomingEvents: [],
    detectedMeetings: [],
    isConnecting: false,
    error: null,

    // Actions
    loadAccounts: async () => {
      try {
        set({ isLoading: true, error: null });
        
        const accountsData = await invoke<CalendarAccount[]>('get_calendar_accounts');
        set({ accounts: accountsData });
        
        // Load sync status for each account
        const statuses: Record<number, SyncStatus> = {};
        for (const account of accountsData) {
          try {
            const status = await invoke<SyncStatus>('get_calendar_sync_status', {
              accountId: account.id,
            });
            statuses[account.id] = status;
          } catch (err) {
            console.warn(`Failed to load sync status for account ${account.id}:`, err);
          }
        }
        set({ syncStatuses: statuses });
        
      } catch (error) {
        console.error('Failed to load accounts:', error);
        set({ error: 'Failed to load calendar accounts' });
      } finally {
        set({ isLoading: false });
      }
    },

    connectGoogleCalendar: async () => {
      try {
        set({ isConnecting: true, error: null });
        
        const authResponse = await invoke<{authorization_url: string, state: string}>('start_calendar_auth', {
          request: { provider: 'google' },
        });

        await invoke('open_oauth_browser', {
          authorizationUrl: authResponse.authorization_url,
        });

        // Store the state for later verification
        localStorage.setItem('oauth_state', authResponse.state);
        
        set({ 
          error: 'Please complete the authorization in your browser. The page will update automatically when done.',
          isConnecting: false
        });
        
      } catch (error) {
        console.error('OAuth error:', error);
        set({ 
          error: 'Failed to start Google Calendar connection',
          isConnecting: false
        });
      }
    },

    completeOAuthFlow: async (code: string, state: string, email: string) => {
      try {
        set({ isLoading: true, error: null });
        
        const storedState = localStorage.getItem('oauth_state');
        if (storedState !== state) {
          throw new Error('Invalid OAuth state parameter');
        }

        const accountId = await invoke<number>('complete_calendar_auth', {
          request: {
            provider: 'google',
            code,
            state,
            account_email: email,
          },
        });

        localStorage.removeItem('oauth_state');
        
        // Reload accounts to show the new connection
        await get().loadAccounts();
        
        set({ error: null });
        
      } catch (error) {
        console.error('OAuth completion error:', error);
        set({ error: 'Failed to complete calendar authorization' });
      } finally {
        set({ isLoading: false });
      }
    },

    syncAccount: async (accountId: number) => {
      try {
        set(state => ({
          syncStatuses: {
            ...state.syncStatuses,
            [accountId]: {
              ...state.syncStatuses[accountId],
              sync_in_progress: true,
            },
          },
        }));

        const eventCount = await invoke<number>('sync_calendar_events', {
          request: {
            account_id: accountId,
            hours_ahead: 24,
          },
        });

        set(state => ({
          syncStatuses: {
            ...state.syncStatuses,
            [accountId]: {
              ...state.syncStatuses[accountId],
              sync_in_progress: false,
              events_synced: eventCount,
              last_sync: new Date().toISOString(),
              last_error: undefined,
            },
          },
        }));

      } catch (error) {
        console.error('Sync error:', error);
        set(state => ({
          syncStatuses: {
            ...state.syncStatuses,
            [accountId]: {
              ...state.syncStatuses[accountId],
              sync_in_progress: false,
              last_error: error instanceof Error ? error.message : 'Sync failed',
            },
          },
          error: 'Failed to sync calendar events',
        }));
      }
    },

    syncAllAccounts: async () => {
      const { accounts } = get();
      const syncPromises = accounts.map(account => get().syncAccount(account.id));
      
      try {
        await Promise.allSettled(syncPromises);
      } catch (error) {
        console.error('Error syncing all accounts:', error);
      }
    },

    updateAutoStart: async (accountId: number, enabled: boolean) => {
      try {
        await invoke('update_calendar_auto_start', {
          request: {
            account_id: accountId,
            auto_start_enabled: enabled,
          },
        });
        
        set(state => ({
          accounts: state.accounts.map(account => 
            account.id === accountId 
              ? { ...account, auto_start_enabled: enabled }
              : account
          ),
        }));
        
      } catch (error) {
        console.error('Auto-start toggle error:', error);
        set({ error: 'Failed to update auto-start setting' });
      }
    },

    disconnectAccount: async (accountId: number) => {
      try {
        await invoke('delete_calendar_account', { accountId });
        
        set(state => ({
          accounts: state.accounts.filter(account => account.id !== accountId),
          syncStatuses: Object.fromEntries(
            Object.entries(state.syncStatuses).filter(([id]) => parseInt(id) !== accountId)
          ),
        }));
        
      } catch (error) {
        console.error('Disconnect error:', error);
        set({ error: 'Failed to disconnect calendar account' });
      }
    },

    loadUpcomingEvents: async (hoursAhead = 24) => {
      try {
        const events = await invoke<CalendarEvent[]>('get_upcoming_meetings', {
          accountId: null, // Get from all accounts
          hoursAhead,
        });
        
        set({ upcomingEvents: events });
        
      } catch (error) {
        console.error('Failed to load upcoming events:', error);
        set({ error: 'Failed to load upcoming meetings' });
      }
    },

    getMeetingConflicts: async (startTime: string, endTime: string) => {
      try {
        return await invoke<CalendarEvent[]>('find_meeting_conflicts', {
          startTime,
          endTime,
        });
      } catch (error) {
        console.error('Failed to find meeting conflicts:', error);
        throw error;
      }
    },

    handleCalendarEvent: (event: any) => {
      const { type, data } = event;
      
      switch (type) {
        case 'MeetingDetected':
          set(state => {
            const existingIndex = state.detectedMeetings.findIndex(
              m => m.calendar_event.external_event_id === data.event.external_event_id
            );
            
            const newDetection: DetectedMeeting = {
              calendar_event: data.event,
              confidence: data.confidence,
              detection_time: new Date().toISOString(),
              countdown_seconds: data.countdown_seconds,
              auto_start_triggered: false,
            };
            
            if (existingIndex >= 0) {
              // Update existing detection
              const newDetectedMeetings = [...state.detectedMeetings];
              newDetectedMeetings[existingIndex] = newDetection;
              return { detectedMeetings: newDetectedMeetings };
            } else {
              // Add new detection
              return { detectedMeetings: [...state.detectedMeetings, newDetection] };
            }
          });
          break;
          
        case 'SyncStarted':
          set(state => ({
            syncStatuses: {
              ...state.syncStatuses,
              [data.account_id]: {
                ...state.syncStatuses[data.account_id],
                sync_in_progress: true,
              },
            },
          }));
          break;
          
        case 'SyncCompleted':
          set(state => ({
            syncStatuses: {
              ...state.syncStatuses,
              [data.account_id]: data.status,
            },
          }));
          // Reload upcoming events after sync
          get().loadUpcomingEvents();
          break;
          
        case 'SyncFailed':
          set(state => ({
            syncStatuses: {
              ...state.syncStatuses,
              [data.account_id]: {
                ...state.syncStatuses[data.account_id],
                sync_in_progress: false,
                last_error: data.error,
              },
            },
          }));
          break;
          
        case 'AutoStartTriggered':
          set(state => ({
            detectedMeetings: state.detectedMeetings.map(meeting =>
              meeting.calendar_event.external_event_id === data.event.external_event_id
                ? { ...meeting, auto_start_triggered: true }
                : meeting
            ),
          }));
          break;
          
        case 'AccountsUpdated':
          get().loadAccounts();
          break;
      }
    },

    clearError: () => {
      set({ error: null });
    },
  }))
);

// Auto-load accounts when the store is first used
useCalendarStore.getState().loadAccounts();