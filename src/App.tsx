import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AppInfo {
  name: string;
  version: string;
  description: string;
}

interface HealthStatus {
  status: string;
  timestamp: string;
  components: {
    database: string;
    audio: string;
    ai: string;
  };
}

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch app information and health status
        const [appInfoResult, healthResult] = await Promise.all([
          invoke<AppInfo>('get_app_info'),
          invoke<HealthStatus>('health_check'),
        ]);

        setAppInfo(appInfoResult);
        setHealthStatus(healthResult);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch app data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAppData();
  }, []);

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div
            className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4'
            role='status'
            aria-label='Loading'
          ></div>
          <p className='text-gray-600'>Loading MeetingMind...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='card max-w-md w-full mx-4'>
          <div className='card-body text-center'>
            <div className='w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-6 h-6 text-danger-600'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <h2 className='text-lg font-semibold text-danger-800 mb-2'>Application Error</h2>
            <p className='text-gray-600 mb-4'>{error}</p>
            <button className='btn btn-primary' onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50'>
      <div className='container mx-auto px-4 py-8'>
        {/* Header */}
        <header className='text-center mb-12'>
          <div className='w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-8 h-8 text-white'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
              />
            </svg>
          </div>
          <h1 className='text-4xl font-bold text-gray-900 mb-2'>
            {appInfo?.name || 'MeetingMind'}
          </h1>
          <p className='text-xl text-gray-600'>
            {appInfo?.description || 'Privacy-first AI Meeting Assistant'}
          </p>
          <p className='text-sm text-gray-500 mt-2'>Version {appInfo?.version || '0.1.0'}</p>
        </header>

        {/* Application Status */}
        <div className='max-w-2xl mx-auto mb-8'>
          <div className='card'>
            <div className='card-header'>
              <h2 className='text-lg font-semibold text-gray-900'>Application Status</h2>
            </div>
            <div className='card-body'>
              <div className='flex items-center justify-between mb-4'>
                <span className='text-gray-600'>Overall Status</span>
                <div className='flex items-center'>
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${healthStatus?.status === 'healthy' ? 'bg-success-500' : 'bg-warning-500'}`}
                  ></div>
                  <span className='text-sm font-medium capitalize'>
                    {healthStatus?.status || 'Unknown'}
                  </span>
                </div>
              </div>

              {healthStatus && (
                <div className='space-y-3'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-gray-600'>Database</span>
                    <span className='font-medium capitalize text-gray-800'>
                      {healthStatus.components.database}
                    </span>
                  </div>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-gray-600'>Audio System</span>
                    <span className='font-medium capitalize text-gray-800'>
                      {healthStatus.components.audio}
                    </span>
                  </div>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-gray-600'>AI Engine</span>
                    <span className='font-medium capitalize text-gray-800'>
                      {healthStatus.components.ai}
                    </span>
                  </div>
                  <div className='flex items-center justify-between text-sm pt-2 border-t border-gray-200'>
                    <span className='text-gray-600'>Last Updated</span>
                    <span className='font-medium text-gray-800'>
                      {new Date(healthStatus.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className='max-w-2xl mx-auto'>
          <h2 className='text-xl font-semibold text-gray-900 mb-4 text-center'>Getting Started</h2>
          <div className='grid md:grid-cols-2 gap-4'>
            <div className='card'>
              <div className='card-body text-center'>
                <div className='w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4'>
                  <svg
                    className='w-6 h-6 text-primary-600'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4'
                    />
                  </svg>
                </div>
                <h3 className='font-semibold text-gray-900 mb-2'>Audio Setup</h3>
                <p className='text-sm text-gray-600 mb-4'>
                  Configure your microphone and audio settings
                </p>
                <button className='btn btn-primary btn-sm'>Configure Audio</button>
              </div>
            </div>

            <div className='card'>
              <div className='card-body text-center'>
                <div className='w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center mx-auto mb-4'>
                  <svg
                    className='w-6 h-6 text-secondary-600'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                    />
                  </svg>
                </div>
                <h3 className='font-semibold text-gray-900 mb-2'>AI Models</h3>
                <p className='text-sm text-gray-600 mb-4'>Download and configure AI models</p>
                <button className='btn btn-secondary btn-sm'>Setup AI</button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className='text-center mt-12 text-sm text-gray-500'>
          <p>MeetingMind - Built with Tauri, React, and Rust</p>
          <p>Your privacy is our priority. All processing happens locally on your device.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
