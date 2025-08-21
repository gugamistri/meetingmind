import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <div className='min-h-screen flex flex-col bg-gray-50'>
        {/* Header - placeholder for future navigation */}
        <header className='bg-white shadow-sm border-b border-gray-200'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='flex justify-between items-center h-16'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 rounded bg-primary-600 flex items-center justify-center'>
                    <svg
                      className='w-5 h-5 text-white'
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
                </div>
                <div className='ml-3'>
                  <h1 className='text-lg font-semibold text-gray-900'>MeetingMind</h1>
                </div>
              </div>

              {/* Placeholder for user menu/settings */}
              <div className='flex items-center space-x-4'>
                <button className='btn btn-secondary btn-sm'>Settings</button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className='flex-1 overflow-hidden'>{children}</main>

        {/* Footer - placeholder */}
        <footer className='bg-white border-t border-gray-200 py-4'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <p className='text-center text-sm text-gray-500'>
              MeetingMind - Privacy-first AI Meeting Assistant
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};
