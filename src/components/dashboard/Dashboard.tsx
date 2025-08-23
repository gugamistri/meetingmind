/**
 * Main Dashboard component
 * 
 * Central hub showing recent meetings, statistics, and recording controls
 * with prominent "Start Recording" functionality and meeting management.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardData, useMeetingActions } from '../../stores/meeting.store';
import { useAudioStatus } from '../../stores/audio.store';
import { AudioControls } from '../audio/AudioControls';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { QuickStats } from './QuickStats';
import { MeetingCard } from './MeetingCard';
import { getGreetingForTime, MeetingAction, Meeting, CreateMeetingRequest } from '../../types/meeting.types';
import clsx from 'clsx';

export interface DashboardProps {
  className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  const { dashboardData, recentMeetings, meetingStats, isLoading, error, refresh } = useDashboardData();
  const { createMeeting, isCreating } = useMeetingActions();
  const { isRecording } = useAudioStatus();
  const [showQuickStart, setShowQuickStart] = useState(false);
  
  // Load dashboard data on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const greeting = getGreetingForTime();

  const handleQuickStartRecording = async () => {
    try {
      setShowQuickStart(true);
      
      // Create a quick meeting for the recording
      const quickMeeting: CreateMeetingRequest = {
        title: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        description: 'Quick recording session',
        startTime: new Date(),
      };
      
      await createMeeting(quickMeeting);
      setShowQuickStart(false);
    } catch (error) {
      setShowQuickStart(false);
      console.error('Failed to start quick recording:', error);
    }
  };

  const handleMeetingAction = (action: MeetingAction, meeting: Meeting) => {
    // Handle meeting actions
    switch (action) {
      case 'start_recording':
        // This would integrate with recording functionality
        console.log('Start recording for meeting:', meeting.id);
        break;
      case 'delete':
        // This would show a confirmation dialog
        console.log('Delete meeting:', meeting.id);
        break;
      default:
        // Other actions are handled by MeetingCard component
        break;
    }
  };

  if (error) {
    return (
      <div className={clsx('min-h-screen flex items-center justify-center', className)}>
        <Card className="max-w-md w-full mx-4 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button variant="primary" onClick={refresh}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={clsx('min-h-screen bg-gray-50', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with greeting and recording status */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">
                {greeting.greeting}
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                Welcome to your meeting dashboard
              </p>
            </div>
            
            {/* Recording status indicator */}
            {isRecording && (
              <div className="flex items-center bg-red-100 text-red-800 px-4 py-2 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm font-medium">Recording Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8">
          <QuickStats stats={meetingStats} isLoading={isLoading} />
        </div>

        {/* Recording Controls Section */}
        <div className="mb-8">
          <Card className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Start Recording
              </h2>
              <p className="text-gray-600 mb-6">
                Begin a new meeting recording with high-quality audio capture
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                {/* Main recording controls */}
                <AudioControls 
                  size="lg"
                  onRecordingStart={() => console.log('Recording started from dashboard')}
                  onRecordingStop={() => console.log('Recording stopped from dashboard')}
                />
                
                {/* Quick start button */}
                {!isRecording && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleQuickStartRecording}
                    disabled={showQuickStart || isCreating}
                    className="min-w-[140px]"
                  >
                    {showQuickStart || isCreating ? (
                      <LoadingSpinner className="w-5 h-5" />
                    ) : (
                      'Quick Start'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Meetings Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Recent Meetings
              </h2>
              <Link
                to="/meetings"
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                View all meetings →
              </Link>
            </div>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="flex space-x-4">
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                        <div className="h-3 bg-gray-200 rounded w-12"></div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : recentMeetings.length > 0 ? (
              <div className="space-y-4">
                {recentMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onAction={handleMeetingAction}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No meetings yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Start your first meeting recording to see it here
                </p>
                <Button variant="primary" onClick={handleQuickStartRecording}>
                  Start First Meeting
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar with quick actions and tips */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/meetings/new"
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Schedule Meeting</div>
                    <div className="text-xs text-gray-500">Plan a future recording</div>
                  </div>
                </Link>
                
                <Link
                  to="/settings"
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Audio Settings</div>
                    <div className="text-xs text-gray-500">Configure microphone</div>
                  </div>
                </Link>
                
                <Link
                  to="/calendar"
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Calendar Sync</div>
                    <div className="text-xs text-gray-500">Auto-detect meetings</div>
                  </div>
                </Link>
              </div>
            </Card>

            {/* Tips Card */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mr-3 mt-0.5">
                    <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Best Audio Quality</div>
                    <div className="text-xs text-gray-500">Use a dedicated microphone for clearer recordings</div>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Privacy First</div>
                    <div className="text-xs text-gray-500">All processing happens locally on your device</div>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center mr-3 mt-0.5">
                    <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Keyboard Shortcuts</div>
                    <div className="text-xs text-gray-500">Press Space to quickly start/stop recording</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;