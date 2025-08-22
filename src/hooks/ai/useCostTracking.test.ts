import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import { useCostTracking } from './useCostTracking';
import { useAIStore, UsageStats, CostEstimation } from '../../stores/ai.store';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock the AI store
vi.mock('../../stores/ai.store', () => ({
  useAIStore: vi.fn(),
}));

const mockInvoke = invoke as any;
const mockUseAIStore = useAIStore as any;

const createMockUsageStats = (overrides: Partial<UsageStats> = {}): UsageStats => ({
  daily_spend: 2.50,
  monthly_spend: 45.75,
  daily_budget: 10.00,
  monthly_budget: 100.00,
  daily_remaining: 7.50,
  monthly_remaining: 54.25,
  daily_utilization: 0.25,
  monthly_utilization: 0.4575,
  warning_level: 'Normal',
  ...overrides,
});

const createMockCostEstimate = (overrides: Partial<CostEstimation> = {}): CostEstimation => ({
  estimated_cost: 0.15,
  provider: 'openai',
  operation_type: 'summarization',
  estimated_input_tokens: 2000,
  estimated_output_tokens: 300,
  can_afford: true,
  budget_impact: {
    daily_before: 2.50,
    daily_after: 2.65,
    monthly_before: 45.75,
    monthly_after: 45.90,
    daily_budget: 10.00,
    monthly_budget: 100.00,
  },
  ...overrides,
});

const createMockStoreState = (overrides = {}) => ({
  usageStats: null,
  costEstimate: null,
  isLoadingCosts: false,
  costError: null,
  setUsageStats: vi.fn(),
  setCostEstimate: vi.fn(),
  setIsLoadingCosts: vi.fn(),
  setCostError: vi.fn(),
  ...overrides,
});

describe('useCostTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default store mock
    mockUseAIStore.mockReturnValue(createMockStoreState());
    
    // Mock URL methods for download functionality
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    
    // Mock DOM methods for download
    document.createElement = vi.fn().mockReturnValue({
      href: '',
      download: '',
      click: vi.fn(),
    });
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial State and Store Integration', () => {
    it('should return initial state from store', () => {
      const mockStoreState = createMockStoreState({
        usageStats: createMockUsageStats(),
        costEstimate: createMockCostEstimate(),
        isLoadingCosts: true,
        costError: 'Test error',
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useCostTracking());

      expect(result.current.usageStats).toEqual(mockStoreState.usageStats);
      expect(result.current.costEstimate).toEqual(mockStoreState.costEstimate);
      expect(result.current.isLoadingCosts).toBe(true);
      expect(result.current.costError).toBe('Test error');
    });

    it('should provide utility functions', () => {
      const { result } = renderHook(() => useCostTracking());

      expect(typeof result.current.loadUsageStats).toBe('function');
      expect(typeof result.current.estimateCost).toBe('function');
      expect(typeof result.current.getProviderStats).toBe('function');
      expect(typeof result.current.exportUsageData).toBe('function');
      expect(typeof result.current.downloadUsageReport).toBe('function');
      expect(typeof result.current.healthCheckServices).toBe('function');
      expect(typeof result.current.formatCurrency).toBe('function');
      expect(typeof result.current.formatPercentage).toBe('function');
      expect(typeof result.current.getBudgetStatus).toBe('function');
    });
  });

  describe('loadUsageStats', () => {
    it('should load usage stats successfully', async () => {
      const mockStats = createMockUsageStats();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useCostTracking());

      let loadedStats: UsageStats | undefined;
      await act(async () => {
        loadedStats = await result.current.loadUsageStats();
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_usage_stats');
      expect(mockStoreState.setIsLoadingCosts).toHaveBeenCalledWith(true);
      expect(mockStoreState.setCostError).toHaveBeenCalledWith(null);
      expect(mockStoreState.setUsageStats).toHaveBeenCalledWith(mockStats);
      expect(mockStoreState.setIsLoadingCosts).toHaveBeenCalledWith(false);
      expect(loadedStats).toEqual(mockStats);
    });

    it('should handle loading errors', async () => {
      const mockError = new Error('Network error');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        try {
          await result.current.loadUsageStats();
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setCostError).toHaveBeenCalledWith('Network error');
      expect(mockStoreState.setIsLoadingCosts).toHaveBeenCalledWith(false);
    });

    it('should handle non-Error objects', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue('String error');

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        try {
          await result.current.loadUsageStats();
        } catch (error) {
          expect(error).toBe('String error');
        }
      });

      expect(mockStoreState.setCostError).toHaveBeenCalledWith('Failed to load usage stats');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost successfully', async () => {
      const mockEstimate = createMockCostEstimate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockEstimate);

      const { result } = renderHook(() => useCostTracking());

      let estimate: CostEstimation | undefined;
      await act(async () => {
        estimate = await result.current.estimateCost('Test transcription', 'Test template', 500);
      });

      expect(mockInvoke).toHaveBeenCalledWith('estimate_cost', {
        transcriptionText: 'Test transcription',
        templateText: 'Test template',
        maxOutputTokens: 500,
      });
      expect(mockStoreState.setCostError).toHaveBeenCalledWith(null);
      expect(mockStoreState.setCostEstimate).toHaveBeenCalledWith(mockEstimate);
      expect(estimate).toEqual(mockEstimate);
    });

    it('should handle optional parameters', async () => {
      const mockEstimate = createMockCostEstimate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockEstimate);

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        await result.current.estimateCost('Test transcription');
      });

      expect(mockInvoke).toHaveBeenCalledWith('estimate_cost', {
        transcriptionText: 'Test transcription',
        templateText: undefined,
        maxOutputTokens: undefined,
      });
    });

    it('should handle estimation errors', async () => {
      const mockError = new Error('Estimation failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        try {
          await result.current.estimateCost('Test transcription');
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setCostError).toHaveBeenCalledWith('Estimation failed');
    });
  });

  describe('getProviderStats', () => {
    it('should get provider stats successfully', async () => {
      const mockStats = {
        provider: 'openai' as const,
        total_cost: 10.50,
        total_operations: 42,
        total_input_tokens: 50000,
        total_output_tokens: 15000,
        avg_cost_per_operation: 0.25,
        period_days: 30,
      };
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useCostTracking());

      let stats: any;
      await act(async () => {
        stats = await result.current.getProviderStats('openai', 30);
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_provider_stats', {
        provider: 'openai',
        days: 30,
      });
      expect(stats).toEqual(mockStats);
    });

    it('should use default days parameter', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue({});

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        await result.current.getProviderStats('claude');
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_provider_stats', {
        provider: 'claude',
        days: 30,
      });
    });
  });

  describe('exportUsageData', () => {
    it('should export usage data successfully', async () => {
      const mockData = 'csv,data,here';
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() => useCostTracking());

      let data: string | undefined;
      await act(async () => {
        data = await result.current.exportUsageData('2025-01-01', '2025-01-31', 'csv');
      });

      expect(mockInvoke).toHaveBeenCalledWith('export_usage_data', {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'csv',
      });
      expect(data).toBe(mockData);
    });

    it('should use default format', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue('data');

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        await result.current.exportUsageData('2025-01-01', '2025-01-31');
      });

      expect(mockInvoke).toHaveBeenCalledWith('export_usage_data', {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'csv',
      });
    });
  });

  describe('healthCheckServices', () => {
    it('should check service health successfully', async () => {
      const mockHealth = [
        {
          provider: 'openai' as const,
          is_healthy: true,
          rate_limit_status: {
            requests_remaining: 100,
            tokens_remaining: 50000,
            reset_time: '2025-01-15T12:00:00Z',
          },
          circuit_breaker_state: 'closed',
        },
        {
          provider: 'claude' as const,
          is_healthy: false,
          circuit_breaker_state: 'open',
        },
      ];
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useCostTracking());

      let health: any;
      await act(async () => {
        health = await result.current.healthCheckServices();
      });

      expect(mockInvoke).toHaveBeenCalledWith('health_check_ai_services');
      expect(health).toEqual(mockHealth);
    });
  });

  describe('downloadUsageReport', () => {
    it('should download CSV report successfully', async () => {
      const mockData = 'Date,Cost,Provider\n2025-01-15,0.15,openai';
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockData);

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn().mockReturnValue(mockLink);

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        await result.current.downloadUsageReport('2025-01-01', '2025-01-31', 'csv');
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe('usage-report-2025-01-01-2025-01-31.csv');
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should download JSON report successfully', async () => {
      const mockData = '{"usage": "data"}';
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockData);

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn().mockReturnValue(mockLink);

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        await result.current.downloadUsageReport('2025-01-01', '2025-01-31', 'json');
      });

      expect(mockLink.download).toBe('usage-report-2025-01-01-2025-01-31.json');
    });

    it('should handle download errors', async () => {
      const mockError = new Error('Export failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCostTracking());

      await act(async () => {
        try {
          await result.current.downloadUsageReport('2025-01-01', '2025-01-31');
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });
    });
  });

  describe('Format Functions', () => {
    it('should format currency correctly', () => {
      const { result } = renderHook(() => useCostTracking());

      expect(result.current.formatCurrency(0.1234)).toBe('$0.1234');
      expect(result.current.formatCurrency(10.50)).toBe('$10.50');
      expect(result.current.formatCurrency(0.001)).toBe('$0.0010');
      expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    });

    it('should format percentage correctly', () => {
      const { result } = renderHook(() => useCostTracking());

      expect(result.current.formatPercentage(0.25)).toBe('25.0%');
      expect(result.current.formatPercentage(0.756)).toBe('75.6%');
      expect(result.current.formatPercentage(1.0)).toBe('100.0%');
      expect(result.current.formatPercentage(1.234)).toBe('123.4%');
    });
  });

  describe('getBudgetStatus', () => {
    it('should calculate budget status correctly', () => {
      const mockUsageStats = createMockUsageStats({
        daily_spend: 7.50,
        daily_budget: 10.00,
        daily_remaining: 2.50,
        daily_utilization: 0.75,
        monthly_spend: 80.00,
        monthly_budget: 100.00,
        monthly_remaining: 20.00,
        monthly_utilization: 0.80,
        warning_level: 'Warning',
      });
      
      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: mockUsageStats,
      }));

      const { result } = renderHook(() => useCostTracking());

      const budgetStatus = result.current.getBudgetStatus();

      expect(budgetStatus).toEqual({
        daily: {
          used: 7.50,
          remaining: 2.50,
          total: 10.00,
          utilization: 0.75,
          isOverBudget: false,
        },
        monthly: {
          used: 80.00,
          remaining: 20.00,
          total: 100.00,
          utilization: 0.80,
          isOverBudget: false,
        },
        warningLevel: 'Warning',
        isOverBudget: false,
      });
    });

    it('should detect over budget scenarios', () => {
      const mockUsageStats = createMockUsageStats({
        daily_utilization: 1.2,
        monthly_utilization: 0.8,
      });
      
      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: mockUsageStats,
      }));

      const { result } = renderHook(() => useCostTracking());

      const budgetStatus = result.current.getBudgetStatus();

      expect(budgetStatus?.daily.isOverBudget).toBe(true);
      expect(budgetStatus?.monthly.isOverBudget).toBe(false);
      expect(budgetStatus?.isOverBudget).toBe(true);
    });

    it('should return null when no usage stats', () => {
      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: null,
      }));

      const { result } = renderHook(() => useCostTracking());

      expect(result.current.getBudgetStatus()).toBeNull();
    });
  });

  describe('Computed Properties', () => {
    it('should calculate hasUsageStats correctly', () => {
      const { rerender } = renderHook(() => useCostTracking());

      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: null,
      }));
      rerender();

      expect(useAIStore().usageStats).toBeNull();

      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: createMockUsageStats(),
      }));
      rerender();

      expect(useAIStore().usageStats).not.toBeNull();
    });

    it('should calculate isOverBudget correctly', () => {
      const { result } = renderHook(() => useCostTracking());

      // Test with no stats
      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: null,
      }));
      
      expect(result.current.isOverBudget).toBe(false);

      // Test with over budget
      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: createMockUsageStats({
          daily_utilization: 1.2,
          monthly_utilization: 0.8,
        }),
      }));

      expect(result.current.isOverBudget).toBe(true);
    });

    it('should get warning level correctly', () => {
      const { result } = renderHook(() => useCostTracking());

      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: createMockUsageStats({
          warning_level: 'Critical',
        }),
      }));

      expect(result.current.warningLevel).toBe('Critical');

      mockUseAIStore.mockReturnValue(createMockStoreState({
        usageStats: null,
      }));

      expect(result.current.warningLevel).toBe('Normal');
    });
  });

  describe('Auto-refresh Effect', () => {
    it('should set up auto-refresh interval', async () => {
      const mockLoadUsageStats = vi.fn().mockResolvedValue(createMockUsageStats());
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(createMockUsageStats());

      renderHook(() => useCostTracking());

      // Fast-forward time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_usage_stats');
      });
    });

    it('should handle auto-refresh errors silently', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(new Error('Network error'));

      renderHook(() => useCostTracking());

      // Fast-forward time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should cleanup interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = renderHook(() => useCostTracking());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Initial Data Loading Effect', () => {
    it('should load initial data when no usage stats', async () => {
      const mockStoreState = createMockStoreState({
        usageStats: null,
        isLoadingCosts: false,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(createMockUsageStats());

      renderHook(() => useCostTracking());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_usage_stats');
      });
    });

    it('should not load data when already loading', () => {
      const mockStoreState = createMockStoreState({
        usageStats: null,
        isLoadingCosts: true,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      renderHook(() => useCostTracking());

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should not load data when stats already exist', () => {
      const mockStoreState = createMockStoreState({
        usageStats: createMockUsageStats(),
        isLoadingCosts: false,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      renderHook(() => useCostTracking());

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});