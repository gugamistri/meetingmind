/**
 * Settings page - placeholder component
 * 
 * Will eventually contain audio, AI, privacy, and application settings
 */

import React from 'react';
import { Card } from '../components/common/Card';

const Settings: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-lg text-gray-600 mt-1">
            Configure audio, AI, privacy, and application preferences
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Audio Settings */}
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Audio Settings</h3>
            <p className="text-gray-600 mb-4">
              Configure microphone, recording quality, and audio processing options.
            </p>
            <p className="text-sm text-gray-500">Coming soon...</p>
          </Card>

          {/* AI Settings */}
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI & Transcription</h3>
            <p className="text-gray-600 mb-4">
              Configure AI models, transcription settings, and summary preferences.
            </p>
            <p className="text-sm text-gray-500">Coming soon...</p>
          </Card>

          {/* Privacy Settings */}
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Privacy & Security</h3>
            <p className="text-gray-600 mb-4">
              Manage data retention, encryption, and privacy preferences.
            </p>
            <p className="text-sm text-gray-500">Coming soon...</p>
          </Card>

          {/* Application Settings */}
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Application</h3>
            <p className="text-gray-600 mb-4">
              Customize interface, notifications, and general application behavior.
            </p>
            <p className="text-sm text-gray-500">Coming soon...</p>
          </Card>

          {/* Export & Backup */}
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Export & Backup</h3>
            <p className="text-gray-600 mb-4">
              Configure data export formats and automatic backup settings.
            </p>
            <p className="text-sm text-gray-500">Coming soon...</p>
          </Card>

          {/* About */}
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
            <p className="text-gray-600 mb-4">
              Application information, updates, and support resources.
            </p>
            <p className="text-sm text-gray-500">Coming soon...</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;