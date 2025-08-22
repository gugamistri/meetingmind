/**
 * Calendar Management page - placeholder component
 * 
 * Will eventually contain calendar integration settings and meeting auto-detection
 */

import React from 'react';
import { Card } from '../components/common/Card';

const CalendarManagement: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Calendar Integration</h1>
          <p className="text-lg text-gray-600 mt-1">
            Connect your calendar and configure automatic meeting detection
          </p>
        </div>
        
        <div className="space-y-6">
          {/* Integration Status */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Integration Status</h2>
              <div className="flex items-center text-sm text-gray-500">
                <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
                Not Connected
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Google Calendar */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.89-1.99 2L3 19a2 2 0 002 2h14c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Google Calendar</h3>
                    <p className="text-sm text-gray-500">Not connected</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Connect your Google Calendar to automatically detect scheduled meetings.
                </p>
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  Connect Google Calendar
                </button>
              </div>

              {/* Outlook Calendar */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-blue-700 rounded flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 9h10v1H7zm0 2h10v1H7zm0 2h7v1H7zm12-8v14H5V5h14zm2-2H3v18h18V3z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Outlook Calendar</h3>
                    <p className="text-sm text-gray-500">Not connected</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Connect your Outlook Calendar for comprehensive meeting detection.
                </p>
                <button className="w-full px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors duration-200">
                  Connect Outlook Calendar
                </button>
              </div>
            </div>
          </Card>

          {/* Auto-Detection Settings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Auto-Detection Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Automatic Recording</h3>
                  <p className="text-sm text-gray-500">Start recording when a calendar meeting begins</p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 left-0.5 transition-transform duration-200"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Meeting Notifications</h3>
                  <p className="text-sm text-gray-500">Get notified before meetings start</p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 left-0.5 transition-transform duration-200"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Auto-Title Generation</h3>
                  <p className="text-sm text-gray-500">Use calendar event titles for recordings</p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 left-0.5 transition-transform duration-200"></div>
                </div>
              </div>
            </div>
          </Card>

          {/* Upcoming Events */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Events</h2>
            
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600">
                Connect a calendar service to see your upcoming meetings here.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalendarManagement;