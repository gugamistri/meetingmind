import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useAIStore, SummaryResult, TemplateContext, ProcessingProgress } from '../../stores/ai.store';

interface GenerateSummaryOptions {
  meetingId: string;
  templateId?: number;
  meetingType?: string;
  context?: TemplateContext;
  synchronous?: boolean;
}

interface RegenerateSummaryOptions {
  meetingId: string;
  newTemplateId: number;
  context?: TemplateContext;
}

export const useSummarization = () => {
  const {
    currentSummary,
    isGeneratingSummary,
    summaryError,
    activeTasks,
    setCurrentSummary,
    setIsGeneratingSummary,
    setSummaryError,
    addSummary,
    updateTaskProgress,
    removeTask
  } = useAIStore();

  // Generate summary
  const generateSummary = useCallback(async (options: GenerateSummaryOptions): Promise<string | SummaryResult> => {
    try {
      setIsGeneratingSummary(true);
      setSummaryError(null);

      if (options.synchronous) {
        // Synchronous generation
        const summary = await invoke<SummaryResult>('generate_summary_sync', {
          meetingId: options.meetingId,
          templateId: options.templateId,
          meetingType: options.meetingType,
          context: options.context,
        });

        addSummary(summary);
        setCurrentSummary(summary);
        return summary;
      } else {
        // Asynchronous generation
        const taskId = await invoke<string>('generate_summary_async', {
          meetingId: options.meetingId,
          templateId: options.templateId,
          meetingType: options.meetingType,
          context: options.context,
        });

        return taskId;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
      setSummaryError(errorMessage);
      throw error;
    } finally {
      if (options.synchronous) {
        setIsGeneratingSummary(false);
      }
    }
  }, [setIsGeneratingSummary, setSummaryError, addSummary, setCurrentSummary]);

  // Get meeting summary
  const getMeetingSummary = useCallback(async (meetingId: string): Promise<SummaryResult | null> => {
    try {
      setSummaryError(null);
      const summary = await invoke<SummaryResult | null>('get_meeting_summary', {
        meetingId,
      });

      if (summary) {
        addSummary(summary);
        setCurrentSummary(summary);
      }

      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get summary';
      setSummaryError(errorMessage);
      throw error;
    }
  }, [setSummaryError, addSummary, setCurrentSummary]);

  // Search summaries
  const searchSummaries = useCallback(async (query: string, limit = 20): Promise<SummaryResult[]> => {
    try {
      setSummaryError(null);
      const summaries = await invoke<SummaryResult[]>('search_summaries', {
        query,
        limit,
      });

      return summaries;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search summaries';
      setSummaryError(errorMessage);
      throw error;
    }
  }, [setSummaryError]);

  // Get recent summaries
  const getRecentSummaries = useCallback(async (limit = 10): Promise<SummaryResult[]> => {
    try {
      setSummaryError(null);
      const summaries = await invoke<SummaryResult[]>('get_recent_summaries', {
        limit,
      });

      return summaries;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get recent summaries';
      setSummaryError(errorMessage);
      throw error;
    }
  }, [setSummaryError]);

  // Regenerate summary
  const regenerateSummary = useCallback(async (options: RegenerateSummaryOptions): Promise<SummaryResult> => {
    try {
      setIsGeneratingSummary(true);
      setSummaryError(null);

      const summary = await invoke<SummaryResult>('regenerate_summary', {
        meetingId: options.meetingId,
        newTemplateId: options.newTemplateId,
        context: options.context,
      });

      addSummary(summary);
      setCurrentSummary(summary);
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate summary';
      setSummaryError(errorMessage);
      throw error;
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [setIsGeneratingSummary, setSummaryError, addSummary, setCurrentSummary]);

  // Get processing progress
  const getProcessingProgress = useCallback(async (taskId: string): Promise<ProcessingProgress | null> => {
    try {
      const progress = await invoke<ProcessingProgress | null>('get_processing_progress', {
        taskId,
      });

      if (progress) {
        updateTaskProgress(taskId, progress);
      }

      return progress;
    } catch (error) {
      console.error('Failed to get processing progress:', error);
      return null;
    }
  }, [updateTaskProgress]);

  // Cancel task
  const cancelTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const cancelled = await invoke<boolean>('cancel_task', {
        taskId,
      });

      if (cancelled) {
        removeTask(taskId);
      }

      return cancelled;
    } catch (error) {
      console.error('Failed to cancel task:', error);
      return false;
    }
  }, [removeTask]);

  // Poll active tasks for progress updates
  useEffect(() => {
    const taskIds = Object.keys(activeTasks);
    if (taskIds.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const taskId of taskIds) {
        const progress = await getProcessingProgress(taskId);
        if (progress && (progress.stage === 'completed' || progress.stage === 'failed')) {
          // Task is done, remove it after a short delay to show completion
          setTimeout(() => removeTask(taskId), 2000);
        }
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [activeTasks, getProcessingProgress, removeTask]);

  return {
    // State
    currentSummary,
    isGeneratingSummary,
    summaryError,
    activeTasks,

    // Actions
    generateSummary,
    getMeetingSummary,
    searchSummaries,
    getRecentSummaries,
    regenerateSummary,
    getProcessingProgress,
    cancelTask,

    // Computed
    hasActiveTasks: Object.keys(activeTasks).length > 0,
    activeTaskCount: Object.keys(activeTasks).length,
  };
};