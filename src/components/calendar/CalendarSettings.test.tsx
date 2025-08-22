import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CalendarSettings } from './CalendarSettings';

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockUnsubscribe = vi.fn();

beforeEach(() => {
  // Reset mocks
  mockInvoke.mockReset();
  mockListen.mockReset();
  mockUnsubscribe.mockReset();

  // Setup default mock implementations
  mockListen.mockResolvedValue(mockUnsubscribe);
  
  // Mock global Tauri API
  global.window = {
    ...global.window,
    __TAURI__: {
      invoke: mockInvoke,
      event: {
        listen: mockListen,
      },
    },
  };

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Test data factories
const createMockAccount = (overrides = {}): any => ({
  id: 1,
  provider: 'google',
  account_email: 'test@example.com',
  is_active: true,
  auto_start_enabled: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockSyncStatus = (overrides = {}): any => ({
  last_sync: '2024-01-01T12:00:00Z',
  events_synced: 5,
  sync_in_progress: false,
  last_error: null,
  ...overrides,
});

describe('CalendarSettings', () => {
  describe('Initial Loading and Setup', () => {
    it('should render loading spinner initially', () => {
      // Setup: invoke call that never resolves
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      render(<CalendarSettings />);

      expect(screen.getByRole('generic')).toHaveClass('animate-spin');
    });

    it('should load calendar accounts on mount', async () => {
      // Setup: Mock successful account loading
      mockInvoke
        .mockResolvedValueOnce([createMockAccount()]) // get_calendar_accounts
        .mockResolvedValueOnce(createMockSyncStatus()); // get_calendar_sync_status

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_calendar_accounts');
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_calendar_sync_status', {
        accountId: 1,
      });
    });

    it('should setup calendar event listener on mount', async () => {
      mockInvoke.mockResolvedValue([]);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith('calendar-event', expect.any(Function));
      });
    });

    it('should cleanup event listener on unmount', async () => {
      mockInvoke.mockResolvedValue([]);

      const { unmount } = render(<CalendarSettings />);

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockUnsubscribe).toHaveBeenCalled();
      });
    });
  });

  describe('Account Display and Management', () => {
    it('should display empty state when no accounts are connected', async () => {
      mockInvoke.mockResolvedValue([]);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('No calendar accounts connected.')).toBeInTheDocument();
      });

      expect(screen.getByText(/Connect your Google Calendar to enable/)).toBeInTheDocument();
    });

    it('should display connected accounts with correct information', async () => {
      const mockAccount = createMockAccount({
        account_email: 'user@company.com',
        provider: 'google',
        auto_start_enabled: true,
      });
      
      const mockStatus = createMockSyncStatus({
        events_synced: 12,
        last_sync: '2024-01-01T14:30:00Z',
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('user@company.com')).toBeInTheDocument();
      });

      expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      expect(screen.getByText('Events cached: 12')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('should handle multiple calendar accounts', async () => {
      const accounts = [
        createMockAccount({
          id: 1,
          account_email: 'work@company.com',
          provider: 'google',
        }),
        createMockAccount({
          id: 2,
          account_email: 'personal@gmail.com',
          provider: 'google',
        }),
      ];

      const statuses = [
        createMockSyncStatus({ events_synced: 5 }),
        createMockSyncStatus({ events_synced: 3 }),
      ];

      mockInvoke
        .mockResolvedValueOnce(accounts)
        .mockResolvedValueOnce(statuses[0])
        .mockResolvedValueOnce(statuses[1]);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('work@company.com')).toBeInTheDocument();
      });

      expect(screen.getByText('personal@gmail.com')).toBeInTheDocument();
    });
  });

  describe('Google Calendar Connection - OAuth2 Flow', () => {
    it('should initiate Google Calendar OAuth flow on connect button click', async () => {
      mockInvoke.mockResolvedValue([]);
      
      const authResponse = {
        authorization_url: 'https://accounts.google.com/oauth/authorize?client_id=test',
        state: 'random_state_123',
      };

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Connect Google Calendar')).toBeInTheDocument();
      });

      // Setup OAuth flow mocks
      mockInvoke
        .mockResolvedValueOnce(authResponse) // start_calendar_auth
        .mockResolvedValueOnce(undefined); // open_oauth_browser

      fireEvent.click(screen.getByText('Connect Google Calendar'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('start_calendar_auth', {
          request: { provider: 'google' },
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith('open_oauth_browser', {
        authorizationUrl: authResponse.authorization_url,
      });
    });

    it('should disable connect button and show loading state during OAuth', async () => {
      mockInvoke.mockResolvedValue([]);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Connect Google Calendar')).toBeInTheDocument();
      });

      // Setup slow OAuth flow
      mockInvoke.mockImplementation((command) => {
        if (command === 'start_calendar_auth') {
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              authorization_url: 'https://test.com',
              state: 'state',
            }), 100);
          });
        }
        return Promise.resolve();
      });

      const connectButton = screen.getByText('Connect Google Calendar');
      fireEvent.click(connectButton);

      // Should show loading state
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(connectButton).toBeDisabled();
    });

    it('should handle OAuth connection errors gracefully', async () => {
      mockInvoke.mockResolvedValue([]);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Connect Google Calendar')).toBeInTheDocument();
      });

      // Setup OAuth failure
      mockInvoke.mockRejectedValueOnce(new Error('OAuth failed'));

      fireEvent.click(screen.getByText('Connect Google Calendar'));

      await waitFor(() => {
        expect(screen.getByText('Failed to start Google Calendar connection')).toBeInTheDocument();
      });

      // Error should be dismissible
      fireEvent.click(screen.getByText('×'));
      expect(screen.queryByText('Failed to start Google Calendar connection')).not.toBeInTheDocument();
    });
  });

  describe('Auto-Start Toggle Functionality - AC3 Testing', () => {
    it('should toggle auto-start setting when checkbox is clicked', async () => {
      const mockAccount = createMockAccount({
        auto_start_enabled: false,
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(createMockSyncStatus())
        .mockResolvedValueOnce(undefined); // update_calendar_auto_start

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).not.toBeChecked();
      });

      fireEvent.click(screen.getByRole('checkbox'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('update_calendar_auto_start', {
          request: {
            account_id: 1,
            auto_start_enabled: true,
          },
        });
      });

      // Checkbox should update optimistically
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('should handle auto-start toggle errors', async () => {
      const mockAccount = createMockAccount({
        auto_start_enabled: false,
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(createMockSyncStatus())
        .mockRejectedValueOnce(new Error('Update failed'));

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).not.toBeChecked();
      });

      fireEvent.click(screen.getByRole('checkbox'));

      await waitFor(() => {
        expect(screen.getByText('Failed to update auto-start setting')).toBeInTheDocument();
      });
    });

    it('should maintain separate auto-start settings per account', async () => {
      const accounts = [
        createMockAccount({
          id: 1,
          account_email: 'account1@test.com',
          auto_start_enabled: true,
        }),
        createMockAccount({
          id: 2,
          account_email: 'account2@test.com',
          auto_start_enabled: false,
        }),
      ];

      mockInvoke
        .mockResolvedValueOnce(accounts)
        .mockResolvedValueOnce(createMockSyncStatus())
        .mockResolvedValueOnce(createMockSyncStatus());

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('account1@test.com')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked(); // account1 enabled
      expect(checkboxes[1]).not.toBeChecked(); // account2 disabled
    });
  });

  describe('Calendar Sync Operations', () => {
    it('should trigger manual sync when sync button is clicked', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus)
        .mockResolvedValueOnce(5); // sync_calendar_events returns count

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('sync_calendar_events', {
          request: {
            account_id: 1,
            hours_ahead: 24,
          },
        });
      });
    });

    it('should disable sync button and show syncing state during sync', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus({
        sync_in_progress: true,
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
      });

      const syncButton = screen.getByText('Syncing...');
      expect(syncButton).toBeDisabled();
    });

    it('should handle sync errors appropriately', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus)
        .mockRejectedValueOnce(new Error('Sync failed'));

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(screen.getByText('Failed to sync calendar events')).toBeInTheDocument();
      });
    });
  });

  describe('Account Disconnection', () => {
    it('should show confirmation dialog before disconnecting account', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = vi.fn().mockReturnValue(false);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Disconnect'));

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to disconnect this calendar account? All cached data will be deleted.'
      );

      // Should not call disconnect if user cancels
      expect(mockInvoke).not.toHaveBeenCalledWith('delete_calendar_account', { accountId: 1 });

      window.confirm = originalConfirm;
    });

    it('should disconnect account when user confirms', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus)
        .mockResolvedValueOnce(undefined); // delete_calendar_account

      // Mock window.confirm to return true
      const originalConfirm = window.confirm;
      window.confirm = vi.fn().mockReturnValue(true);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('delete_calendar_account', { accountId: 1 });
      });

      // Account should be removed from UI
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();

      window.confirm = originalConfirm;
    });

    it('should handle disconnection errors', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus)
        .mockRejectedValueOnce(new Error('Disconnect failed'));

      const originalConfirm = window.confirm;
      window.confirm = vi.fn().mockReturnValue(true);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(screen.getByText('Failed to disconnect calendar account')).toBeInTheDocument();
      });

      window.confirm = originalConfirm;
    });
  });

  describe('Real-time Event Handling', () => {
    it('should handle sync started events', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus({
        sync_in_progress: false,
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      let eventHandler: any;
      mockListen.mockImplementation((eventName, handler) => {
        if (eventName === 'calendar-event') {
          eventHandler = handler;
        }
        return Promise.resolve(mockUnsubscribe);
      });

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });

      // Simulate sync started event
      eventHandler({
        payload: {
          event: 'SyncStarted',
          data: { account_id: 1 },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
      });
    });

    it('should handle sync completed events', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus({
        sync_in_progress: true,
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      let eventHandler: any;
      mockListen.mockImplementation((eventName, handler) => {
        if (eventName === 'calendar-event') {
          eventHandler = handler;
        }
        return Promise.resolve(mockUnsubscribe);
      });

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
      });

      // Simulate sync completed event
      eventHandler({
        payload: {
          event: 'SyncCompleted',
          data: {
            account_id: 1,
            status: {
              last_sync: '2024-01-01T15:00:00Z',
              events_synced: 10,
              sync_in_progress: false,
              last_error: null,
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });

      expect(screen.getByText('Events cached: 10')).toBeInTheDocument();
    });

    it('should handle sync failed events', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      let eventHandler: any;
      mockListen.mockImplementation((eventName, handler) => {
        if (eventName === 'calendar-event') {
          eventHandler = handler;
        }
        return Promise.resolve(mockUnsubscribe);
      });

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });

      // Simulate sync failed event
      eventHandler({
        payload: {
          event: 'SyncFailed',
          data: {
            account_id: 1,
            error: 'Rate limit exceeded',
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Error: Rate limit exceeded')).toBeInTheDocument();
      });
    });

    it('should reload accounts when AccountsUpdated event is received', async () => {
      mockInvoke.mockResolvedValue([]);

      let eventHandler: any;
      mockListen.mockImplementation((eventName, handler) => {
        if (eventName === 'calendar-event') {
          eventHandler = handler;
        }
        return Promise.resolve(mockUnsubscribe);
      });

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_calendar_accounts');
      });

      // Reset mock to count subsequent calls
      mockInvoke.mockClear();
      mockInvoke.mockResolvedValue([createMockAccount()]);

      // Simulate accounts updated event
      eventHandler({
        payload: {
          event: 'AccountsUpdated',
          data: {},
        },
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_calendar_accounts');
      });
    });
  });

  describe('Sync Status Display', () => {
    it('should format last sync time correctly', async () => {
      const now = new Date();
      const recentSync = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
      
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus({
        last_sync: recentSync.toISOString(),
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText(/Last sync: \d+ minutes ago/)).toBeInTheDocument();
      });
    });

    it('should show "Never" for accounts that have never synced', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus({
        last_sync: null,
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Last sync: Never')).toBeInTheDocument();
      });
    });

    it('should display sync errors when present', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus({
        last_error: 'Authentication token expired',
      });

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Error: Authentication token expired')).toBeInTheDocument();
      });
    });
  });

  describe('Privacy Notice', () => {
    it('should display privacy notice section', async () => {
      mockInvoke.mockResolvedValue([]);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Privacy Notice')).toBeInTheDocument();
      });

      expect(screen.getByText(/Calendar data is stored locally/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle account loading errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to load accounts'));

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load calendar accounts')).toBeInTheDocument();
      });
    });

    it('should handle sync status loading errors gracefully', async () => {
      const mockAccount = createMockAccount();
      
      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockRejectedValueOnce(new Error('Sync status failed'));

      // Should not crash on sync status error
      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      // Should show default sync status
      expect(screen.getByText('Events cached: 0')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Auto-start recording for meetings/)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const mockAccount = createMockAccount();
      const mockStatus = createMockSyncStatus();

      mockInvoke
        .mockResolvedValueOnce([mockAccount])
        .mockResolvedValueOnce(mockStatus);

      render(<CalendarSettings />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      // Checkbox should be focusable
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(checkbox).toHaveFocus();
    });
  });
});