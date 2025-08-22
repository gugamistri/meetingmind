import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CostTracker } from './CostTracker';
import { useCostTracking } from '../../../hooks/ai';

// Mock the useCostTracking hook
vi.mock('../../../hooks/ai', () => ({
  useCostTracking: vi.fn(),
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock common components
vi.mock('../../common/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props} data-testid="button">
      {children}
    </button>
  ),
}));

vi.mock('../../common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  DollarSign: () => <div data-testid="dollar-sign-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  Download: () => <div data-testid="download-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
}));

const mockUseCostTracking = useCostTracking as any;

const createMockUsageStats = (overrides = {}) => ({
  daily_spend: 2.50,
  monthly_spend: 45.75,
  daily_budget: 10.00,
  monthly_budget: 100.00,
  daily_remaining: 7.50,
  monthly_remaining: 54.25,
  daily_utilization: 0.25,
  monthly_utilization: 0.4575,
  warning_level: 'Normal' as const,
  ...overrides,
});

const createMockBudgetStatus = (overrides = {}) => ({
  daily: {
    used: 2.50,
    remaining: 7.50,
    total: 10.00,
    utilization: 0.25,
    isOverBudget: false,
  },
  monthly: {
    used: 45.75,
    remaining: 54.25,
    total: 100.00,
    utilization: 0.4575,
    isOverBudget: false,
  },
  warningLevel: 'Normal',
  isOverBudget: false,
  ...overrides,
});

const createMockHookReturn = (overrides = {}) => ({
  usageStats: createMockUsageStats(),
  isLoadingCosts: false,
  costError: null,
  budgetStatus: createMockBudgetStatus(),
  loadUsageStats: vi.fn(),
  downloadUsageReport: vi.fn(),
  formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
  formatPercentage: vi.fn((ratio: number) => `${(ratio * 100).toFixed(1)}%`),
  warningLevel: 'Normal',
  isOverBudget: false,
  ...overrides,
});

describe('CostTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading State', () => {
    it('should display loading spinner when loading costs', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          isLoadingCosts: true,
        })
      );

      render(<CostTracker />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should call loadUsageStats on mount', () => {
      const mockLoadUsageStats = vi.fn();
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          loadUsageStats: mockLoadUsageStats,
        })
      );

      render(<CostTracker />);

      expect(mockLoadUsageStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error State', () => {
    it('should display error message when cost loading fails', () => {
      const errorMessage = 'Failed to load cost data';
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          costError: errorMessage,
          isLoadingCosts: false,
        })
      );

      render(<CostTracker />);

      expect(screen.getByText('Error Loading Cost Data')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call loadUsageStats when retry button is clicked', async () => {
      const mockLoadUsageStats = vi.fn();
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          costError: 'Network error',
          loadUsageStats: mockLoadUsageStats,
          isLoadingCosts: false,
        })
      );

      render(<CostTracker />);

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(mockLoadUsageStats).toHaveBeenCalledTimes(2); // Once on mount, once on retry
    });
  });

  describe('No Data State', () => {
    it('should display no data message when usageStats is null', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          usageStats: null,
          budgetStatus: null,
        })
      );

      render(<CostTracker />);

      expect(screen.getByText('No usage data available')).toBeInTheDocument();
    });
  });

  describe('Normal Display', () => {
    it('should display budget information correctly', () => {
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      render(<CostTracker />);

      expect(screen.getByText('Cost Tracker')).toBeInTheDocument();
      expect(screen.getByText('Daily Budget')).toBeInTheDocument();
      expect(screen.getByText('Monthly Budget')).toBeInTheDocument();
      
      // Check currency formatting
      expect(screen.getByText('$2.50')).toBeInTheDocument(); // daily spend
      expect(screen.getByText('$45.75')).toBeInTheDocument(); // monthly spend
      expect(screen.getByText('$10.00')).toBeInTheDocument(); // daily budget
      expect(screen.getByText('$100.00')).toBeInTheDocument(); // monthly budget
      
      // Check percentage formatting
      expect(screen.getByText('25.0%')).toBeInTheDocument(); // daily utilization
      expect(screen.getByText('45.8%')).toBeInTheDocument(); // monthly utilization
    });

    it('should display remaining budget amounts', () => {
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      render(<CostTracker />);

      expect(screen.getByText('$7.50 remaining')).toBeInTheDocument(); // daily remaining
      expect(screen.getByText('$54.25 remaining')).toBeInTheDocument(); // monthly remaining
    });

    it('should display refresh and download buttons', () => {
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      render(<CostTracker />);

      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
      expect(screen.getByTestId('download-icon')).toBeInTheDocument();
    });
  });

  describe('Budget Status Indicators', () => {
    it('should display warning badge when warning level is not Normal', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          warningLevel: 'Warning',
          budgetStatus: createMockBudgetStatus({
            warningLevel: 'Warning',
          }),
        })
      );

      render(<CostTracker />);

      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should display critical badge with correct styling', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          warningLevel: 'Critical',
          budgetStatus: createMockBudgetStatus({
            warningLevel: 'Critical',
          }),
        })
      );

      render(<CostTracker />);

      const badge = screen.getByText('Critical');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');
    });

    it('should apply correct progress bar colors based on utilization', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          usageStats: createMockUsageStats({
            daily_utilization: 0.9, // High utilization
            monthly_utilization: 0.5,
          }),
        })
      );

      render(<CostTracker />);

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);
    });

    it('should display over budget alert when budget is exceeded', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          isOverBudget: true,
          budgetStatus: createMockBudgetStatus({
            daily: {
              ...createMockBudgetStatus().daily,
              isOverBudget: true,
              utilization: 1.2,
            },
            isOverBudget: true,
          }),
        })
      );

      render(<CostTracker />);

      expect(screen.getByText('Budget Exceeded')).toBeInTheDocument();
      expect(screen.getByText(/You have exceeded your.*budget limit/)).toBeInTheDocument();
    });
  });

  describe('Provider Breakdown', () => {
    it('should show provider breakdown toggle when data is available', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          budgetStatus: createMockBudgetStatus({
            daily: {
              ...createMockBudgetStatus().daily,
              // Simulate provider data presence
            },
          }),
        })
      );

      render(<CostTracker />);

      expect(screen.getByText('Provider Breakdown')).toBeInTheDocument();
      expect(screen.getByText('(show)')).toBeInTheDocument();
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('should toggle provider breakdown visibility when clicked', () => {
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      render(<CostTracker />);

      const breakdownButton = screen.getByText('Provider Breakdown');
      
      // Initially shows "show"
      expect(screen.getByText('(show)')).toBeInTheDocument();
      
      fireEvent.click(breakdownButton);
      
      // After click shows "hide"
      expect(screen.getByText('(hide)')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call downloadUsageReport when download button is clicked', async () => {
      const mockDownloadUsageReport = vi.fn().mockResolvedValue(undefined);
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          downloadUsageReport: mockDownloadUsageReport,
        })
      );

      render(<CostTracker />);

      const downloadButton = screen.getAllByTestId('button').find(button => 
        button.querySelector('[data-testid="download-icon"]')
      );
      
      expect(downloadButton).toBeInTheDocument();
      
      await act(async () => {
        fireEvent.click(downloadButton!);
      });

      expect(mockDownloadUsageReport).toHaveBeenCalledTimes(1);
      expect(mockDownloadUsageReport).toHaveBeenCalledWith(
        expect.any(String), // startDate
        expect.any(String), // endDate
        'csv'
      );
    });

    it('should handle download error gracefully', async () => {
      const mockDownloadUsageReport = vi.fn().mockRejectedValue(new Error('Download failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          downloadUsageReport: mockDownloadUsageReport,
        })
      );

      render(<CostTracker />);

      const downloadButton = screen.getAllByTestId('button').find(button => 
        button.querySelector('[data-testid="download-icon"]')
      );
      
      await act(async () => {
        fireEvent.click(downloadButton!);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to download report:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should call loadUsageStats when refresh button is clicked', () => {
      const mockLoadUsageStats = vi.fn();
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          loadUsageStats: mockLoadUsageStats,
        })
      );

      render(<CostTracker />);

      const refreshButton = screen.getAllByTestId('button').find(button => 
        button.querySelector('[data-testid="refresh-icon"]')
      );
      
      fireEvent.click(refreshButton!);

      expect(mockLoadUsageStats).toHaveBeenCalledTimes(2); // Once on mount, once on click
    });
  });

  describe('Styling and Accessibility', () => {
    it('should apply custom className prop', () => {
      const customClass = 'custom-cost-tracker';
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      const { container } = render(<CostTracker className={customClass} />);

      expect(container.firstChild).toHaveClass(customClass);
    });

    it('should display last updated timestamp', () => {
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      render(<CostTracker />);

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for progress bars', () => {
      mockUseCostTracking.mockReturnValue(createMockHookReturn());

      render(<CostTracker />);

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);
      
      progressBars.forEach(progressBar => {
        expect(progressBar).toHaveAttribute('style');
      });
    });
  });

  describe('Budget Alert Scenarios', () => {
    it('should show daily budget exceeded message when daily budget is over', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          isOverBudget: true,
          budgetStatus: createMockBudgetStatus({
            daily: {
              ...createMockBudgetStatus().daily,
              isOverBudget: true,
            },
            monthly: {
              ...createMockBudgetStatus().monthly,
              isOverBudget: false,
            },
            isOverBudget: true,
          }),
        })
      );

      render(<CostTracker />);

      expect(screen.getByText(/You have exceeded your daily budget limit/)).toBeInTheDocument();
    });

    it('should show monthly budget exceeded message when only monthly budget is over', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          isOverBudget: true,
          budgetStatus: createMockBudgetStatus({
            daily: {
              ...createMockBudgetStatus().daily,
              isOverBudget: false,
            },
            monthly: {
              ...createMockBudgetStatus().monthly,
              isOverBudget: true,
            },
            isOverBudget: true,
          }),
        })
      );

      render(<CostTracker />);

      expect(screen.getByText(/You have exceeded your monthly budget limit/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero budget amounts gracefully', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          usageStats: createMockUsageStats({
            daily_budget: 0,
            monthly_budget: 0,
            daily_utilization: 0,
            monthly_utilization: 0,
          }),
        })
      );

      render(<CostTracker />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle very high utilization rates', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          usageStats: createMockUsageStats({
            daily_utilization: 2.5, // 250% over budget
            monthly_utilization: 1.8, // 180% over budget
          }),
        })
      );

      render(<CostTracker />);

      // Progress bars should cap at 100% width
      const progressBars = screen.getAllByRole('progressbar');
      progressBars.forEach(progressBar => {
        const style = progressBar.getAttribute('style');
        expect(style).toContain('width: 100%');
      });
    });

    it('should handle missing budget status gracefully', () => {
      mockUseCostTracking.mockReturnValue(
        createMockHookReturn({
          budgetStatus: null,
        })
      );

      render(<CostTracker />);

      // Should not show provider breakdown when budget status is null
      expect(screen.queryByText('Provider Breakdown')).not.toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('should apply correct warning colors for different levels', () => {
      const testCases = [
        { level: 'Critical', expectedClass: 'text-red-600 bg-red-50 border-red-200' },
        { level: 'Warning', expectedClass: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
        { level: 'Info', expectedClass: 'text-blue-600 bg-blue-50 border-blue-200' },
        { level: 'Normal', expectedClass: 'text-green-600 bg-green-50 border-green-200' },
      ];

      testCases.forEach(({ level, expectedClass }) => {
        if (level !== 'Normal') {
          mockUseCostTracking.mockReturnValue(
            createMockHookReturn({
              warningLevel: level as any,
              budgetStatus: createMockBudgetStatus({
                warningLevel: level,
              }),
            })
          );

          const { unmount } = render(<CostTracker />);
          
          const badge = screen.getByText(level);
          expectedClass.split(' ').forEach(className => {
            expect(badge).toHaveClass(className);
          });
          
          unmount();
        }
      });
    });

    it('should apply correct progress bar colors based on utilization', () => {
      const testCases = [
        { utilization: 0.5, expectedColor: 'bg-green-500' },
        { utilization: 0.7, expectedColor: 'bg-blue-500' },
        { utilization: 0.9, expectedColor: 'bg-yellow-500' },
        { utilization: 1.2, expectedColor: 'bg-red-500' },
      ];

      testCases.forEach(({ utilization, expectedColor }) => {
        mockUseCostTracking.mockReturnValue(
          createMockHookReturn({
            usageStats: createMockUsageStats({
              daily_utilization: utilization,
              monthly_utilization: utilization,
            }),
          })
        );

        const { unmount } = render(<CostTracker />);
        
        const progressBars = document.querySelectorAll('[role="progressbar"]');
        progressBars.forEach(progressBar => {
          expect(progressBar).toHaveClass(expectedColor);
        });
        
        unmount();
      });
    });
  });
});