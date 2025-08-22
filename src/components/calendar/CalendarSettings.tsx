import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

interface CalendarAccount {
  id: number;
  provider: string;
  account_email: string;
  is_active: boolean;
  auto_start_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface SyncStatus {
  last_sync: string | null;
  events_synced: number;
  sync_in_progress: boolean;
  last_error: string | null;
}

export const CalendarSettings: React.FC = () => {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Record<number, SyncStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    
    // Set up event listener for calendar events
    const unsubscribe = window.__TAURI__.event.listen('calendar-event', (event: any) => {
      handleCalendarEvent(event.payload);
    });

    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const accountsData = await invoke<CalendarAccount[]>('get_calendar_accounts');
      setAccounts(accountsData);
      
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
      setSyncStatuses(statuses);
    } catch (err) {
      setError('Failed to load calendar accounts');
      console.error('Error loading accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalendarEvent = (event: any) => {
    switch (event.event) {
      case 'SyncStarted':
        setSyncStatuses(prev => ({
          ...prev,
          [event.data.account_id]: {
            ...prev[event.data.account_id],
            sync_in_progress: true,
          },
        }));
        break;
      case 'SyncCompleted':
        setSyncStatuses(prev => ({
          ...prev,
          [event.data.account_id]: event.data.status,
        }));
        break;
      case 'SyncFailed':
        setSyncStatuses(prev => ({
          ...prev,
          [event.data.account_id]: {
            ...prev[event.data.account_id],
            sync_in_progress: false,
            last_error: event.data.error,
          },
        }));
        break;
      case 'AccountsUpdated':
        loadAccounts();
        break;
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Start OAuth flow
      const authResponse = await invoke<{authorization_url: string, state: string}>('start_calendar_auth', {
        request: { provider: 'google' },
      });

      // Open browser for OAuth
      await invoke('open_oauth_browser', {
        authorizationUrl: authResponse.authorization_url,
      });

      // Note: The completion of OAuth would be handled by a callback URL
      // that would trigger the complete_calendar_auth command
      // For now, we show a message to the user
      setError('Please complete the authorization in your browser, then refresh this page.');
      
    } catch (err) {
      setError('Failed to start Google Calendar connection');
      console.error('OAuth error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleAutoStart = async (accountId: number, enabled: boolean) => {
    try {
      await invoke('update_calendar_auto_start', {
        request: {
          account_id: accountId,
          auto_start_enabled: enabled,
        },
      });
      
      setAccounts(prev => 
        prev.map(account => 
          account.id === accountId 
            ? { ...account, auto_start_enabled: enabled }
            : account
        )
      );
    } catch (err) {
      setError('Failed to update auto-start setting');
      console.error('Auto-start toggle error:', err);
    }
  };

  const syncAccount = async (accountId: number) => {
    try {
      await invoke<number>('sync_calendar_events', {
        request: {
          account_id: accountId,
          hours_ahead: 24,
        },
      });
    } catch (err) {
      setError('Failed to sync calendar events');
      console.error('Sync error:', err);
    }
  };

  const disconnectAccount = async (accountId: number) => {
    if (!confirm('Are you sure you want to disconnect this calendar account? All cached data will be deleted.')) {
      return;
    }

    try {
      await invoke('delete_calendar_account', { accountId });
      setAccounts(prev => prev.filter(account => account.id !== accountId));
      setSyncStatuses(prev => {
        const { [accountId]: deleted, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      setError('Failed to disconnect calendar account');
      console.error('Disconnect error:', err);
    }
  };

  const formatLastSync = (lastSync: string | null): string => {
    if (!lastSync) return 'Never';
    
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Calendar Integration</h2>
        <Button
          onClick={connectGoogleCalendar}
          disabled={isConnecting}
          variant="primary"
        >
          {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-800 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-4">
        {accounts.length === 0 ? (
          <Card className="p-6 text-center">
            <div className="text-gray-500">
              <p className="mb-4">No calendar accounts connected.</p>
              <p className="text-sm">
                Connect your Google Calendar to enable automatic meeting detection
                and pre-populated meeting metadata.
              </p>
            </div>
          </Card>
        ) : (
          accounts.map((account) => {
            const syncStatus = syncStatuses[account.id];
            return (
              <Card key={account.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 font-semibold">
                        {account.provider === 'google' ? 'G' : account.provider.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {account.account_email}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {account.provider} Calendar
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => syncAccount(account.id)}
                      disabled={syncStatus?.sync_in_progress}
                      variant="secondary"
                      size="sm"
                    >
                      {syncStatus?.sync_in_progress ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      onClick={() => disconnectAccount(account.id)}
                      variant="secondary"
                      size="sm"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Sync Status</h4>
                    <div className="text-sm text-gray-600">
                      <p>Last sync: {formatLastSync(syncStatus?.last_sync || null)}</p>
                      <p>Events cached: {syncStatus?.events_synced || 0}</p>
                      {syncStatus?.last_error && (
                        <p className="text-red-600 mt-1">Error: {syncStatus.last_error}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Settings</h4>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={account.auto_start_enabled}
                        onChange={(e) => toggleAutoStart(account.id, e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-600">
                        Auto-start recording for meetings
                      </span>
                    </label>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Privacy Notice</h3>
        <p className="text-sm text-blue-800">
          Calendar data is stored locally on your device and used only for meeting detection
          and metadata enhancement. No calendar information is sent to external AI services
          unless you explicitly choose to include it in summaries.
        </p>
      </div>
    </div>
  );
};