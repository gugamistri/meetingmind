/**
 * Meeting Details page - placeholder component
 * 
 * Will eventually show detailed meeting view with transcription, summary, and editing
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/common/Card';

const MeetingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meeting Details</h1>
          <p className="text-lg text-gray-600 mt-1">
            Meeting ID: {id}
          </p>
        </div>
        
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Meeting Details Coming Soon
          </h2>
          <p className="text-gray-600 mb-4">
            This page will show detailed meeting information including transcription, AI summaries, participants, and editing capabilities.
          </p>
          <p className="text-sm text-gray-500">
            The meeting detail view is currently under development.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default MeetingDetails;