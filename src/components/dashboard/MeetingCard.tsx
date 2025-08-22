/**
 * MeetingCard component for displaying individual meetings in the dashboard
 * 
 * Shows meeting information with click navigation and quick actions.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { 
  Meeting, 
  MeetingAction,
  formatMeetingDuration,
  getMeetingDuration,
  getMeetingStatusColor
} from '../../types/meeting.types';
import clsx from 'clsx';

export interface MeetingCardProps {
  meeting: Meeting;
  onClick?: (meeting: Meeting) => void;
  onAction?: (action: MeetingAction, meeting: Meeting) => void;
  showActions?: boolean;
  className?: string;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onClick,
  onAction,
  showActions = true,
  className,
}) => {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(meeting);
    } else {
      navigate(`/meetings/${meeting.id}`);
    }
  };

  const handleAction = (action: MeetingAction, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowActionsMenu(false);
    
    if (onAction) {
      onAction(action, meeting);
    } else {
      // Default action handlers
      switch (action) {
        case 'view':
          navigate(`/meetings/${meeting.id}`);
          break;
        case 'edit':
          navigate(`/meetings/${meeting.id}/edit`);
          break;
        case 'view_transcription':
          navigate(`/meetings/${meeting.id}/transcription`);
          break;
        case 'view_summary':
          navigate(`/meetings/${meeting.id}/summary`);
          break;
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const duration = getMeetingDuration(meeting);
  const statusColor = getMeetingStatusColor(meeting.status);

  return (
    <Card 
      className={clsx(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01]',
        className
      )}
      onClick={handleClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Meeting title and status */}
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate mr-3">
                {meeting.title}
              </h3>
              <span className={clsx('text-xs px-2 py-1 rounded-full font-medium capitalize', statusColor)}>
                {meeting.status.replace('_', ' ')}
              </span>
            </div>

            {/* Meeting description */}
            {meeting.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {meeting.description}
              </p>
            )}

            {/* Meeting metadata */}
            <div className="flex items-center text-sm text-gray-500 space-x-4">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDate(meeting.startTime)}</span>
              </div>
              
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatTime(meeting.startTime)}</span>
              </div>

              {duration > 0 && (
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatMeetingDuration(duration)}</span>
                </div>
              )}
            </div>

            {/* Feature indicators */}
            <div className="flex items-center mt-3 space-x-3">
              {meeting.hasTranscription && (
                <div className="flex items-center text-xs text-green-600">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Transcribed</span>
                </div>
              )}
              
              {meeting.hasAiSummary && (
                <div className="flex items-center text-xs text-blue-600">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>AI Summary</span>
                </div>
              )}

              {meeting.participants && meeting.participants.length > 0 && (
                <div className="flex items-center text-xs text-gray-500">
                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <span>{meeting.participants.length} participants</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions menu */}
          {showActions && (
            <div className="relative ml-4">
              <button
                type="button"
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionsMenu(!showActionsMenu);
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {showActionsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={(e) => handleAction('view', e)}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Details
                    </button>

                    {meeting.hasTranscription && (
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        onClick={(e) => handleAction('view_transcription', e)}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Transcription
                      </button>
                    )}

                    {meeting.hasAiSummary && (
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        onClick={(e) => handleAction('view_summary', e)}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        View AI Summary
                      </button>
                    )}

                    <div className="border-t border-gray-200 my-1" />

                    <button
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={(e) => handleAction('export', e)}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </button>

                    <button
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                      onClick={(e) => handleAction('delete', e)}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MeetingCard;