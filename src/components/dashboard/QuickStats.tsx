/**
 * QuickStats component for displaying meeting statistics on the dashboard
 * 
 * Shows key meeting metrics with trend indicators and visual formatting.
 */

import React from 'react';
import { Card } from '../common/Card';
import { MeetingStats, formatMeetingDuration } from '../../types/meeting.types';
import clsx from 'clsx';

export interface QuickStatsProps {
  stats: MeetingStats | null;
  isLoading?: boolean;
  className?: string;
}

interface StatCardData {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
  description?: string;
}

export const QuickStats: React.FC<QuickStatsProps> = ({
  stats,
  isLoading = false,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="w-12 h-4 bg-gray-200 rounded"></div>
              </div>
              <div className="w-20 h-8 bg-gray-200 rounded mb-1"></div>
              <div className="w-24 h-3 bg-gray-200 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        <Card className="p-4 text-center text-gray-500">
          <p>No statistics available</p>
        </Card>
      </div>
    );
  }

  const statCards: StatCardData[] = [
    {
      label: 'Total Meetings',
      value: stats.totalMeetings,
      description: 'All recorded meetings',
      color: 'primary',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Total Time',
      value: formatMeetingDuration(stats.totalDurationMs),
      description: 'Combined meeting duration',
      color: 'secondary',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'This Week',
      value: stats.weeklyMeetings,
      description: `${stats.todaysMeetings} today`,
      color: 'success',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'AI Summaries',
      value: stats.recordingsWithAiSummary,
      description: `${Math.round((stats.recordingsWithAiSummary / Math.max(stats.totalMeetings, 1)) * 100)}% coverage`,
      color: 'info',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  ];

  const getColorClasses = (color: StatCardData['color']) => {
    const colorMap = {
      primary: {
        icon: 'text-emerald-600 bg-emerald-100',
        text: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
      secondary: {
        icon: 'text-teal-600 bg-teal-100',
        text: 'text-teal-600',
        bg: 'bg-teal-50',
      },
      success: {
        icon: 'text-green-600 bg-green-100',
        text: 'text-green-600',
        bg: 'bg-green-50',
      },
      warning: {
        icon: 'text-yellow-600 bg-yellow-100',
        text: 'text-yellow-600',
        bg: 'bg-yellow-50',
      },
      info: {
        icon: 'text-blue-600 bg-blue-100',
        text: 'text-blue-600',
        bg: 'bg-blue-50',
      },
    };
    return colorMap[color];
  };

  return (
    <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {statCards.map((stat) => {
        const colors = getColorClasses(stat.color);
        
        return (
          <Card 
            key={stat.label}
            className={clsx(
              'p-4 transition-all duration-200 hover:shadow-md border-l-4',
              stat.color === 'primary' && 'border-l-emerald-500',
              stat.color === 'secondary' && 'border-l-teal-500',
              stat.color === 'success' && 'border-l-green-500',
              stat.color === 'warning' && 'border-l-yellow-500',
              stat.color === 'info' && 'border-l-blue-500',
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={clsx('p-2 rounded-lg', colors.icon)}>
                {stat.icon}
              </div>
              
              {/* Trend indicator could go here in the future */}
              <div className="text-xs text-gray-400">
                {/* Placeholder for trend arrow */}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">
                {stat.value}
              </div>
              
              <div className="text-sm font-medium text-gray-600">
                {stat.label}
              </div>
              
              {stat.description && (
                <div className="text-xs text-gray-500">
                  {stat.description}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default QuickStats;