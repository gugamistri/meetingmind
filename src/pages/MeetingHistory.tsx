/**
 * Meeting History page - placeholder component
 * 
 * Will eventually show full meeting history with advanced filtering and search
 */

import React from 'react';
import { Card } from '../components/common/Card';

const MeetingHistory: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meeting History</h1>
          <p className="text-lg text-gray-600 mt-1">
            All your recorded meetings and transcriptions
          </p>
        </div>
        
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Meeting History Coming Soon
          </h2>
          <p className="text-gray-600 mb-4">
            This page will show your complete meeting history with advanced filtering and search capabilities.
          </p>
          <p className="text-sm text-gray-500">
            For now, you can view recent meetings from the dashboard.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default MeetingHistory;