import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMeetingDetail } from '@/hooks/meeting/useMeetingDetail';
import { formatMeetingDuration, getMeetingStatusColor } from '@/types/meeting.types';
import { Card } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Navigation breadcrumbs component
const Breadcrumbs: React.FC<{ meetingTitle?: string; onBack: () => void }> = ({ meetingTitle, onBack }) => {
  return (
    <nav className="flex items-center space-x-2 mb-6 text-sm">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </button>
      <span className="text-gray-400">/</span>
      <span className="text-gray-900 font-medium">
        {meetingTitle || 'Meeting Details'}
      </span>
    </nav>
  );
};

// Meeting metadata display component
const MeetingHeader: React.FC<{
  meeting: any;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}> = ({ meeting, onEdit, onDelete, onDuplicate, onExport }) => {
  const statusColor = getMeetingStatusColor(meeting.status);
  const duration = meeting.duration ? formatMeetingDuration(meeting.duration) : 'In progress';
  const participantCount = meeting.participants?.length || 0;

  return (
    <Card className="mb-6">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {meeting.title}
            </h1>
            
            <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6-6m0 0v6l-6-6" />
                </svg>
                {new Date(meeting.startTime).toLocaleString()}
              </div>
              
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {duration}
              </div>
              
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                {participantCount} participant{participantCount !== 1 ? 's' : ''}
              </div>
              
              <span className={`px-2 py-1 rounded-full text-xs font-medium bg-opacity-10 ${statusColor} bg-current`}>
                {meeting.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            {meeting.description && (
              <p className="text-gray-700 mb-4">
                {meeting.description}
              </p>
            )}
            
            <div className="flex items-center space-x-3 text-sm">
              {meeting.hasTranscription && (
                <span className="flex items-center text-green-600">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Transcription available
                </span>
              )}
              
              {meeting.hasAiSummary && (
                <span className="flex items-center text-blue-600">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI summary generated
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onEdit}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Edit
            </button>
            
            <button
              onClick={onExport}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Export
            </button>
            
            <div className="relative">
              <button
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                More
                <svg className="w-4 h-4 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* TODO: Add dropdown menu for duplicate, archive, delete actions */}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Main content tabs component
const ContentTabs: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasTranscription: boolean;
  hasSummary: boolean;
}> = ({ activeTab, onTabChange, hasTranscription, hasSummary }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ...(hasTranscription ? [{ id: 'transcription', label: 'Transcription', icon: 'M15.232 5.232l3.536 3.536M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }] : []),
    ...(hasSummary ? [{ id: 'summary', label: 'AI Summary', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }] : []),
    { id: 'insights', label: 'Insights', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
  ];

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

// Overview tab content
const OverviewContent: React.FC<{ meeting: any }> = ({ meeting }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Meeting Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Duration</dt>
              <dd className="text-sm text-gray-900">
                {meeting.duration ? formatMeetingDuration(meeting.duration) : 'In progress'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="text-sm text-gray-900">{meeting.status.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">
                {new Date(meeting.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </Card>
      
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
          {meeting.participants && meeting.participants.length > 0 ? (
            <div className="space-y-3">
              {meeting.participants.map((participant: any) => (
                <div key={participant.id} className="flex items-center">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-medium text-emerald-600">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                    <p className="text-xs text-gray-500">{participant.role}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No participants recorded</p>
          )}
        </div>
      </Card>
    </div>
  );
};

// Placeholder components for other tabs
const TranscriptionContent: React.FC = () => {
  return (
    <Card className="p-6">
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Transcription Editor</h3>
        <p className="text-gray-600">
          Transcription editing functionality will be implemented in the next task.
        </p>
      </div>
    </Card>
  );
};

const SummaryContent: React.FC<{ summaries?: any[] }> = ({ summaries = [] }) => {
  return (
    <Card className="p-6">
      {summaries.length > 0 ? (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <div key={summary.id} className="border-b border-gray-200 pb-4 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{summary.templateName}</h4>
                <span className="text-xs text-gray-500">
                  {new Date(summary.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary.content}</p>
              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                <span>Model: {summary.modelUsed}</span>
                <span>Provider: {summary.provider}</span>
                {summary.costUsd && <span>Cost: ${summary.costUsd.toFixed(4)}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No AI Summary</h3>
          <p className="text-gray-600 mb-4">
            This meeting doesn't have an AI-generated summary yet.
          </p>
          <button className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
            Generate Summary
          </button>
        </div>
      )}
    </Card>
  );
};

const InsightsContent: React.FC = () => {
  return (
    <Card className="p-6">
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Meeting Insights</h3>
        <p className="text-gray-600">
          Advanced insights and analytics will be available here.
        </p>
      </div>
    </Card>
  );
};

// Main component
const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const meetingId = id ? parseInt(id, 10) : 0;
  const { meeting, isLoading, error, refetch } = useMeetingDetail(meetingId);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [navigate, hasUnsavedChanges]);

  const handleEdit = useCallback(() => {
    // TODO: Implement edit functionality
    console.log('Edit meeting', meeting?.id);
  }, [meeting?.id]);

  const handleDelete = useCallback(() => {
    // TODO: Implement delete functionality with confirmation
    console.log('Delete meeting', meeting?.id);
  }, [meeting?.id]);

  const handleDuplicate = useCallback(() => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate meeting', meeting?.id);
  }, [meeting?.id]);

  const handleExport = useCallback(() => {
    // TODO: Implement export functionality
    console.log('Export meeting', meeting?.id);
  }, [meeting?.id]);

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Meeting</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 mr-3"
            >
              Try Again
            </button>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </Card>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting Not Found</h2>
            <p className="text-gray-600 mb-4">
              The meeting you're looking for doesn't exist or has been deleted.
            </p>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
            >
              Back to Dashboard
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumbs meetingTitle={meeting.title} onBack={handleBack} />
          
          <MeetingHeader
            meeting={meeting}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onExport={handleExport}
          />

          <ContentTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasTranscription={meeting.hasTranscription || false}
            hasSummary={meeting.hasAiSummary || false}
          />

          <div className="mt-6">
            {activeTab === 'overview' && <OverviewContent meeting={meeting} />}
            {activeTab === 'transcription' && <TranscriptionContent />}
            {activeTab === 'summary' && <SummaryContent summaries={meeting.summaries} />}
            {activeTab === 'insights' && <InsightsContent />}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MeetingDetailPage;