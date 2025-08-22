import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import { useSummarization } from './useSummarization';
import { useAIStore, SummaryResult, ProcessingProgress, TemplateContext } from '../../stores/ai.store';

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

const createMockSummary = (overrides: Partial<SummaryResult> = {}): SummaryResult => ({
  id: 'summary-123',
  meeting_id: 'meeting-456',
  template_id: 1,
  content: 'Generated summary content',
  model_used: 'gpt-4',
  provider: 'openai',
  cost_usd: 0.15,
  processing_time_ms: 2500,
  token_count: 250,
  confidence_score: 0.95,
  created_at: '2025-01-15T10:30:00Z',
  ...overrides,
});

const createMockProgress = (overrides: Partial<ProcessingProgress> = {}): ProcessingProgress => ({
  operation_id: 'op-123',
  stage: 'initializing',
  progress: 0.0,
  estimated_time_remaining_ms: 5000,
  message: 'Initializing summary generation...',
  ...overrides,
});

const createMockStoreState = (overrides = {}) => ({
  currentSummary: null,
  isGeneratingSummary: false,
  summaryError: null,
  activeTasks: {},
  setCurrentSummary: vi.fn(),
  setIsGeneratingSummary: vi.fn(),
  setSummaryError: vi.fn(),
  addSummary: vi.fn(),
  updateTaskProgress: vi.fn(),
  removeTask: vi.fn(),
  ...overrides,
});

describe('useSummarization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default store mock
    mockUseAIStore.mockReturnValue(createMockStoreState());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial State and Store Integration', () => {
    it('should return initial state from store', () => {
      const mockStoreState = createMockStoreState({
        currentSummary: createMockSummary(),
        isGeneratingSummary: true,
        summaryError: 'Test error',
        activeTasks: { 'task-1': createMockProgress() },
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useSummarization());

      expect(result.current.currentSummary).toEqual(mockStoreState.currentSummary);
      expect(result.current.isGeneratingSummary).toBe(true);
      expect(result.current.summaryError).toBe('Test error');
      expect(result.current.activeTasks).toEqual(mockStoreState.activeTasks);
    });

    it('should provide utility functions', () => {
      const { result } = renderHook(() => useSummarization());

      expect(typeof result.current.generateSummary).toBe('function');
      expect(typeof result.current.getMeetingSummary).toBe('function');
      expect(typeof result.current.searchSummaries).toBe('function');
      expect(typeof result.current.getRecentSummaries).toBe('function');
      expect(typeof result.current.regenerateSummary).toBe('function');
      expect(typeof result.current.getProcessingProgress).toBe('function');
      expect(typeof result.current.cancelTask).toBe('function');
    });

    it('should calculate computed properties correctly', () => {
      const activeTasks = {
        'task-1': createMockProgress(),
        'task-2': createMockProgress(),
      };
      
      mockUseAIStore.mockReturnValue(createMockStoreState({
        activeTasks,
      }));

      const { result } = renderHook(() => useSummarization());

      expect(result.current.hasActiveTasks).toBe(true);
      expect(result.current.activeTaskCount).toBe(2);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary synchronously', async () => {
      const mockSummary = createMockSummary();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        templateId: 1,
        meetingType: 'standup',
        context: { meeting_title: 'Test Meeting' },
        synchronous: true,
      };

      let generatedSummary: SummaryResult | string | undefined;
      await act(async () => {
        generatedSummary = await result.current.generateSummary(options);
      });

      expect(mockInvoke).toHaveBeenCalledWith('generate_summary_sync', {
        meetingId: 'meeting-456',
        templateId: 1,
        meetingType: 'standup',
        context: { meeting_title: 'Test Meeting' },
      });
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(true);
      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(mockStoreState.addSummary).toHaveBeenCalledWith(mockSummary);
      expect(mockStoreState.setCurrentSummary).toHaveBeenCalledWith(mockSummary);
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(false);
      expect(generatedSummary).toEqual(mockSummary);
    });

    it('should generate summary asynchronously', async () => {
      const taskId = 'task-123';
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(taskId);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        templateId: 1,
        synchronous: false,
      };

      let result_taskId: SummaryResult | string | undefined;
      await act(async () => {
        result_taskId = await result.current.generateSummary(options);
      });

      expect(mockInvoke).toHaveBeenCalledWith('generate_summary_async', {
        meetingId: 'meeting-456',
        templateId: 1,
        meetingType: undefined,
        context: undefined,
      });
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(true);
      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(mockStoreState.setIsGeneratingSummary).not.toHaveBeenCalledWith(false); // Should not be called for async
      expect(result_taskId).toBe(taskId);
    });

    it('should handle generation errors', async () => {
      const mockError = new Error('Generation failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        synchronous: true,
      };

      await act(async () => {
        try {
          await result.current.generateSummary(options);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith('Generation failed');
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(false);
    });

    it('should handle non-Error objects', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue('String error');

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        synchronous: true,
      };

      await act(async () => {
        try {
          await result.current.generateSummary(options);
        } catch (error) {
          expect(error).toBe('String error');
        }
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith('Failed to generate summary');
    });

    it('should handle optional parameters', async () => {
      const mockSummary = createMockSummary();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        synchronous: true,
      };

      await act(async () => {
        await result.current.generateSummary(options);
      });

      expect(mockInvoke).toHaveBeenCalledWith('generate_summary_sync', {
        meetingId: 'meeting-456',
        templateId: undefined,
        meetingType: undefined,
        context: undefined,
      });
    });
  });

  describe('getMeetingSummary', () => {
    it('should get meeting summary successfully', async () => {
      const mockSummary = createMockSummary();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useSummarization());

      let summary: SummaryResult | null | undefined;
      await act(async () => {
        summary = await result.current.getMeetingSummary('meeting-456');
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_meeting_summary', {
        meetingId: 'meeting-456',
      });
      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(mockStoreState.addSummary).toHaveBeenCalledWith(mockSummary);
      expect(mockStoreState.setCurrentSummary).toHaveBeenCalledWith(mockSummary);
      expect(summary).toEqual(mockSummary);
    });

    it('should handle null summary response', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(null);

      const { result } = renderHook(() => useSummarization());

      let summary: SummaryResult | null | undefined;
      await act(async () => {
        summary = await result.current.getMeetingSummary('meeting-456');
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(mockStoreState.addSummary).not.toHaveBeenCalled();
      expect(mockStoreState.setCurrentSummary).not.toHaveBeenCalled();
      expect(summary).toBeNull();
    });

    it('should handle get summary errors', async () => {
      const mockError = new Error('Database error');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      await act(async () => {
        try {
          await result.current.getMeetingSummary('meeting-456');
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith('Database error');
    });
  });

  describe('searchSummaries', () => {
    it('should search summaries successfully', async () => {
      const mockSummaries = [
        createMockSummary({ id: 'summary-1' }),
        createMockSummary({ id: 'summary-2' }),
      ];
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummaries);

      const { result } = renderHook(() => useSummarization());

      let summaries: SummaryResult[] | undefined;
      await act(async () => {
        summaries = await result.current.searchSummaries('test query', 10);
      });

      expect(mockInvoke).toHaveBeenCalledWith('search_summaries', {
        query: 'test query',
        limit: 10,
      });
      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(summaries).toEqual(mockSummaries);
    });

    it('should use default limit when not provided', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useSummarization());

      await act(async () => {
        await result.current.searchSummaries('test query');
      });

      expect(mockInvoke).toHaveBeenCalledWith('search_summaries', {
        query: 'test query',
        limit: 20,
      });
    });

    it('should handle search errors', async () => {
      const mockError = new Error('Search failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      await act(async () => {
        try {
          await result.current.searchSummaries('test query');
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith('Search failed');
    });
  });

  describe('getRecentSummaries', () => {
    it('should get recent summaries successfully', async () => {
      const mockSummaries = [
        createMockSummary({ id: 'summary-1', created_at: '2025-01-15T10:30:00Z' }),
        createMockSummary({ id: 'summary-2', created_at: '2025-01-14T10:30:00Z' }),
      ];
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummaries);

      const { result } = renderHook(() => useSummarization());

      let summaries: SummaryResult[] | undefined;
      await act(async () => {
        summaries = await result.current.getRecentSummaries(5);
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_recent_summaries', {
        limit: 5,
      });
      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(summaries).toEqual(mockSummaries);
    });

    it('should use default limit when not provided', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useSummarization());

      await act(async () => {
        await result.current.getRecentSummaries();
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_recent_summaries', {
        limit: 10,
      });
    });

    it('should handle get recent summaries errors', async () => {
      const mockError = new Error('Database error');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      await act(async () => {
        try {
          await result.current.getRecentSummaries();
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith('Database error');
    });
  });

  describe('regenerateSummary', () => {
    it('should regenerate summary successfully', async () => {
      const mockSummary = createMockSummary({ content: 'Regenerated content' });
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        newTemplateId: 2,
        context: { meeting_title: 'Test Meeting' },
      };

      let regeneratedSummary: SummaryResult | undefined;
      await act(async () => {
        regeneratedSummary = await result.current.regenerateSummary(options);
      });

      expect(mockInvoke).toHaveBeenCalledWith('regenerate_summary', {
        meetingId: 'meeting-456',
        newTemplateId: 2,
        context: { meeting_title: 'Test Meeting' },
      });
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(true);
      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith(null);
      expect(mockStoreState.addSummary).toHaveBeenCalledWith(mockSummary);
      expect(mockStoreState.setCurrentSummary).toHaveBeenCalledWith(mockSummary);
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(false);
      expect(regeneratedSummary).toEqual(mockSummary);
    });

    it('should handle optional context parameter', async () => {
      const mockSummary = createMockSummary();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        newTemplateId: 2,
      };

      await act(async () => {
        await result.current.regenerateSummary(options);
      });

      expect(mockInvoke).toHaveBeenCalledWith('regenerate_summary', {
        meetingId: 'meeting-456',
        newTemplateId: 2,
        context: undefined,
      });
    });

    it('should handle regeneration errors', async () => {
      const mockError = new Error('Regeneration failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      const options = {
        meetingId: 'meeting-456',
        newTemplateId: 2,
      };

      await act(async () => {
        try {
          await result.current.regenerateSummary(options);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setSummaryError).toHaveBeenCalledWith('Regeneration failed');
      expect(mockStoreState.setIsGeneratingSummary).toHaveBeenCalledWith(false);
    });
  });

  describe('getProcessingProgress', () => {
    it('should get processing progress successfully', async () => {
      const mockProgress = createMockProgress({ progress: 0.5, stage: 'processing' });
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockProgress);

      const { result } = renderHook(() => useSummarization());

      let progress: ProcessingProgress | null | undefined;
      await act(async () => {
        progress = await result.current.getProcessingProgress('task-123');
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_processing_progress', {
        taskId: 'task-123',
      });
      expect(mockStoreState.updateTaskProgress).toHaveBeenCalledWith('task-123', mockProgress);
      expect(progress).toEqual(mockProgress);
    });

    it('should handle null progress response', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(null);

      const { result } = renderHook(() => useSummarization());

      let progress: ProcessingProgress | null | undefined;
      await act(async () => {
        progress = await result.current.getProcessingProgress('task-123');
      });

      expect(mockStoreState.updateTaskProgress).not.toHaveBeenCalled();
      expect(progress).toBeNull();
    });

    it('should handle progress errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Progress check failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      let progress: ProcessingProgress | null | undefined;
      await act(async () => {
        progress = await result.current.getProcessingProgress('task-123');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to get processing progress:', mockError);
      expect(progress).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('cancelTask', () => {
    it('should cancel task successfully', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(true);

      const { result } = renderHook(() => useSummarization());

      let cancelled: boolean | undefined;
      await act(async () => {
        cancelled = await result.current.cancelTask('task-123');
      });

      expect(mockInvoke).toHaveBeenCalledWith('cancel_task', {
        taskId: 'task-123',
      });
      expect(mockStoreState.removeTask).toHaveBeenCalledWith('task-123');
      expect(cancelled).toBe(true);
    });

    it('should handle task not cancelled', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(false);

      const { result } = renderHook(() => useSummarization());

      let cancelled: boolean | undefined;
      await act(async () => {
        cancelled = await result.current.cancelTask('task-123');
      });

      expect(mockStoreState.removeTask).not.toHaveBeenCalled();
      expect(cancelled).toBe(false);
    });

    it('should handle cancel errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Cancel failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSummarization());

      let cancelled: boolean | undefined;
      await act(async () => {
        cancelled = await result.current.cancelTask('task-123');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to cancel task:', mockError);
      expect(cancelled).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Task Polling Effect', () => {
    it('should poll active tasks for progress updates', async () => {
      const mockProgress = createMockProgress({ progress: 0.5, stage: 'processing' });
      const activeTasks = {
        'task-1': createMockProgress(),
        'task-2': createMockProgress(),
      };
      const mockStoreState = createMockStoreState({
        activeTasks,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockProgress);

      renderHook(() => useSummarization());

      // Fast-forward time by 1 second to trigger polling
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_processing_progress', {
          taskId: 'task-1',
        });
        expect(mockInvoke).toHaveBeenCalledWith('get_processing_progress', {
          taskId: 'task-2',
        });
      });
    });

    it('should remove completed tasks after delay', async () => {
      const completedProgress = createMockProgress({ stage: 'completed' });
      const activeTasks = { 'task-1': createMockProgress() };
      const mockStoreState = createMockStoreState({ activeTasks });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(completedProgress);

      renderHook(() => useSummarization());

      // Fast-forward time by 1 second to trigger polling
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Wait for polling to complete
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Fast-forward by 2 more seconds to trigger task removal
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockStoreState.removeTask).toHaveBeenCalledWith('task-1');
      });
    });

    it('should remove failed tasks after delay', async () => {
      const failedProgress = createMockProgress({ stage: 'failed' });
      const activeTasks = { 'task-1': createMockProgress() };
      const mockStoreState = createMockStoreState({ activeTasks });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(failedProgress);

      renderHook(() => useSummarization());

      // Fast-forward time by 1 second to trigger polling
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Wait for polling to complete
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Fast-forward by 2 more seconds to trigger task removal
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockStoreState.removeTask).toHaveBeenCalledWith('task-1');
      });
    });

    it('should not poll when no active tasks', () => {
      const mockStoreState = createMockStoreState({
        activeTasks: {},
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      renderHook(() => useSummarization());

      // Fast-forward time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should cleanup polling interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const activeTasks = { 'task-1': createMockProgress() };
      const mockStoreState = createMockStoreState({ activeTasks });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { unmount } = renderHook(() => useSummarization());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    it('should handle polling errors gracefully', async () => {
      const activeTasks = { 'task-1': createMockProgress() };
      const mockStoreState = createMockStoreState({ activeTasks });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(new Error('Polling failed'));

      renderHook(() => useSummarization());

      // Fast-forward time by 1 second to trigger polling
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should not crash the application
    });
  });

  describe('Computed Properties', () => {
    it('should calculate hasActiveTasks correctly', () => {
      const { result, rerender } = renderHook(() => useSummarization());

      // Initially no active tasks
      mockUseAIStore.mockReturnValue(createMockStoreState({
        activeTasks: {},
      }));
      rerender();

      expect(result.current.hasActiveTasks).toBe(false);

      // Add active tasks
      mockUseAIStore.mockReturnValue(createMockStoreState({
        activeTasks: { 'task-1': createMockProgress() },
      }));
      rerender();

      expect(result.current.hasActiveTasks).toBe(true);
    });

    it('should calculate activeTaskCount correctly', () => {
      const { result, rerender } = renderHook(() => useSummarization());

      mockUseAIStore.mockReturnValue(createMockStoreState({
        activeTasks: {},
      }));
      rerender();

      expect(result.current.activeTaskCount).toBe(0);

      mockUseAIStore.mockReturnValue(createMockStoreState({
        activeTasks: {
          'task-1': createMockProgress(),
          'task-2': createMockProgress(),
          'task-3': createMockProgress(),
        },
      }));
      rerender();

      expect(result.current.activeTaskCount).toBe(3);
    });
  });
});