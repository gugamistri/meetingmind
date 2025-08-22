import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { useCostTracking } from '../../../hooks/ai';
import { Button } from '../../common/Button';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface CostTrackerProps {
  className?: string;
}

export const CostTracker: React.FC<CostTrackerProps> = ({ className = '' }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [showDetails, setShowDetails] = useState(false);

  const {
    usageStats,
    isLoadingCosts,
    costError,
    budgetStatus,
    loadUsageStats,
    downloadUsageReport,
    formatCurrency,
    formatPercentage,
    warningLevel,
    isOverBudget,
  } = useCostTracking();

  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats]);

  const handleRefresh = () => {
    loadUsageStats();
  };

  const handleDownloadReport = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await downloadUsageReport(startDate, endDate, 'csv');
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const getWarningColor = (level: string) => {
    switch (level) {
      case 'Critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getProgressBarColor = (utilization: number) => {
    if (utilization >= 1.0) return 'bg-red-500';
    if (utilization >= 0.8) return 'bg-yellow-500';
    if (utilization >= 0.6) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (isLoadingCosts) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (costError) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Error Loading Cost Data</span>
        </div>
        <p className="text-gray-600 text-sm mb-4">{costError}</p>
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!usageStats) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          No usage data available
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Cost Tracker</h3>
          {warningLevel !== 'Normal' && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getWarningColor(warningLevel)}`}>
              {warningLevel}
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadReport}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Daily Budget */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Daily Budget</span>
            <span className="text-sm text-gray-600">
              {formatPercentage(usageStats.daily_utilization)}
            </span>
          </div>
          
          <div className="mb-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Used:</span>
              <span className="font-medium">{formatCurrency(usageStats.daily_spend)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Budget:</span>
              <span className="font-medium">{formatCurrency(usageStats.daily_budget)}</span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(usageStats.daily_utilization)}`}
              style={{ width: `${Math.min(usageStats.daily_utilization * 100, 100)}%` }}
            />
          </div>
          
          <div className="text-xs text-gray-600 mt-1">
            {formatCurrency(usageStats.daily_remaining)} remaining
          </div>
        </div>

        {/* Monthly Budget */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly Budget</span>
            <span className="text-sm text-gray-600">
              {formatPercentage(usageStats.monthly_utilization)}
            </span>
          </div>
          
          <div className="mb-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Used:</span>
              <span className="font-medium">{formatCurrency(usageStats.monthly_spend)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Budget:</span>
              <span className="font-medium">{formatCurrency(usageStats.monthly_budget)}</span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(usageStats.monthly_utilization)}`}
              style={{ width: `${Math.min(usageStats.monthly_utilization * 100, 100)}%` }}
            />
          </div>
          
          <div className="text-xs text-gray-600 mt-1">
            {formatCurrency(usageStats.monthly_remaining)} remaining
          </div>
        </div>
      </div>

      {/* Provider Breakdown */}
      {budgetStatus && Object.keys(budgetStatus.daily).length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Provider Breakdown
            <span className="text-xs text-gray-500">
              ({showDetails ? 'hide' : 'show'})
            </span>
          </button>
        </div>
      )}

      {/* Budget Alerts */}
      {isOverBudget && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Budget Exceeded</span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            You have exceeded your {budgetStatus?.daily.isOverBudget ? 'daily' : 'monthly'} budget limit. 
            AI operations may be restricted until the next billing period.
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};