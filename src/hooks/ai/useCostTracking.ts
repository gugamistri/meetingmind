import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useAIStore, CostEstimation, UsageStats } from '../../stores/ai.store';

interface ProviderStats {
  provider: 'openai' | 'claude';
  total_cost: number;
  total_operations: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_cost_per_operation: number;
  period_days: number;
}

interface ServiceHealth {
  provider: 'openai' | 'claude';
  is_healthy: boolean;
  rate_limit_status?: {
    requests_remaining?: number;
    tokens_remaining?: number;
    reset_time?: string;
    retry_after_seconds?: number;
  };
  circuit_breaker_state: string;
}

export const useCostTracking = () => {
  const {
    usageStats,
    costEstimate,
    isLoadingCosts,
    costError,
    setUsageStats,
    setCostEstimate,
    setIsLoadingCosts,
    setCostError,
  } = useAIStore();

  // Load usage statistics
  const loadUsageStats = useCallback(async (): Promise<UsageStats> => {
    try {
      setIsLoadingCosts(true);
      setCostError(null);

      const stats = await invoke<UsageStats>('get_usage_stats');
      setUsageStats(stats);
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load usage stats';
      setCostError(errorMessage);
      throw error;
    } finally {
      setIsLoadingCosts(false);
    }
  }, [setIsLoadingCosts, setCostError, setUsageStats]);

  // Estimate cost for operation
  const estimateCost = useCallback(async (
    transcriptionText: string,
    templateText?: string,
    maxOutputTokens?: number
  ): Promise<CostEstimation> => {
    try {
      setCostError(null);

      const estimate = await invoke<CostEstimation>('estimate_cost', {
        transcriptionText,
        templateText,
        maxOutputTokens,
      });

      setCostEstimate(estimate);
      return estimate;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to estimate cost';
      setCostError(errorMessage);
      throw error;
    }
  }, [setCostError, setCostEstimate]);

  // Get provider statistics
  const getProviderStats = useCallback(async (
    provider: 'openai' | 'claude',
    days: number = 30
  ): Promise<ProviderStats> => {
    try {
      setCostError(null);

      const stats = await invoke<ProviderStats>('get_provider_stats', {
        provider,
        days,
      });

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get provider stats';
      setCostError(errorMessage);
      throw error;
    }
  }, [setCostError]);

  // Export usage data
  const exportUsageData = useCallback(async (
    startDate: string,
    endDate: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> => {
    try {
      setCostError(null);

      const data = await invoke<string>('export_usage_data', {
        startDate,
        endDate,
        format,
      });

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export usage data';
      setCostError(errorMessage);
      throw error;
    }
  }, [setCostError]);

  // Health check AI services
  const healthCheckServices = useCallback(async (): Promise<ServiceHealth[]> => {
    try {
      setCostError(null);

      const health = await invoke<ServiceHealth[]>('health_check_ai_services');
      return health;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check service health';
      setCostError(errorMessage);
      throw error;
    }
  }, [setCostError]);

  // Download usage report
  const downloadUsageReport = useCallback(async (
    startDate: string,
    endDate: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<void> => {
    try {
      const data = await exportUsageData(startDate, endDate, format);
      
      // Create download link
      const blob = new Blob([data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `usage-report-${startDate}-${endDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      throw error;
    }
  }, [exportUsageData]);

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  }, []);

  // Format percentage
  const formatPercentage = useCallback((ratio: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(ratio);
  }, []);

  // Get budget status
  const getBudgetStatus = useCallback(() => {
    if (!usageStats) return null;

    const dailyStatus = {
      used: usageStats.daily_spend,
      remaining: usageStats.daily_remaining,
      total: usageStats.daily_budget,
      utilization: usageStats.daily_utilization,
      isOverBudget: usageStats.daily_utilization >= 1.0,
    };

    const monthlyStatus = {
      used: usageStats.monthly_spend,
      remaining: usageStats.monthly_remaining,
      total: usageStats.monthly_budget,
      utilization: usageStats.monthly_utilization,
      isOverBudget: usageStats.monthly_utilization >= 1.0,
    };

    return {
      daily: dailyStatus,
      monthly: monthlyStatus,
      warningLevel: usageStats.warning_level,
      isOverBudget: dailyStatus.isOverBudget || monthlyStatus.isOverBudget,
    };
  }, [usageStats]);

  // Auto-refresh usage stats
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadUsageStats().catch(console.error);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [loadUsageStats]);

  // Load initial data
  useEffect(() => {
    if (!usageStats && !isLoadingCosts) {
      loadUsageStats().catch(console.error);
    }
  }, [usageStats, isLoadingCosts, loadUsageStats]);

  return {
    // State
    usageStats,
    costEstimate,
    isLoadingCosts,
    costError,

    // Actions
    loadUsageStats,
    estimateCost,
    getProviderStats,
    exportUsageData,
    downloadUsageReport,
    healthCheckServices,

    // Utilities
    formatCurrency,
    formatPercentage,
    getBudgetStatus,

    // Computed
    budgetStatus: getBudgetStatus(),
    hasUsageStats: !!usageStats,
    isOverBudget: usageStats ? 
      (usageStats.daily_utilization >= 1.0 || usageStats.monthly_utilization >= 1.0) : 
      false,
    warningLevel: usageStats?.warning_level || 'Normal',
  };
};