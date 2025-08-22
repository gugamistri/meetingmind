import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { 
  useAIStore, 
  useAISelectors,
  SummaryResult, 
  SummaryTemplate, 
  ProcessingProgress, 
  CostEstimation, 
  UsageStats 
} from './ai.store';

const createMockSummary = (overrides: Partial<SummaryResult> = {}): SummaryResult => ({
  id: 'summary-123',
  meeting_id: 'meeting-456',
  template_id: 1,
  content: 'Test summary content',
  model_used: 'gpt-4',
  provider: 'openai',
  cost_usd: 0.15,
  processing_time_ms: 2500,
  token_count: 250,
  confidence_score: 0.95,
  created_at: '2025-01-15T10:30:00Z',
  ...overrides,
});

const createMockTemplate = (overrides: Partial<SummaryTemplate> = {}): SummaryTemplate => ({
  id: 1,
  name: 'Standup Template',
  description: 'Daily standup meeting template',
  prompt_template: 'Summarize this standup meeting...',
  meeting_type: 'standup',
  is_default: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
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

describe('AI Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useAIStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAIStore());

      expect(result.current.summaries).toEqual({});
      expect(result.current.currentSummary).toBeNull();
      expect(result.current.isGeneratingSummary).toBe(false);
      expect(result.current.summaryError).toBeNull();

      expect(result.current.templates).toEqual([]);
      expect(result.current.selectedTemplate).toBeNull();
      expect(result.current.isLoadingTemplates).toBe(false);
      expect(result.current.templateError).toBeNull();

      expect(result.current.activeTasks).toEqual({});

      expect(result.current.usageStats).toBeNull();
      expect(result.current.costEstimate).toBeNull();
      expect(result.current.isLoadingCosts).toBe(false);
      expect(result.current.costError).toBeNull();

      expect(result.current.showCostTracker).toBe(false);
      expect(result.current.showTemplateManager).toBe(false);
      expect(result.current.selectedMeetingType).toBe('custom');
    });
  });

  describe('Summary Actions', () => {
    it('should set summaries', () => {
      const { result } = renderHook(() => useAIStore());
      const summaries = {
        'meeting-1': createMockSummary({ meeting_id: 'meeting-1' }),
        'meeting-2': createMockSummary({ meeting_id: 'meeting-2' }),
      };

      act(() => {
        result.current.setSummaries(summaries);
      });

      expect(result.current.summaries).toEqual(summaries);
    });

    it('should add summary', () => {
      const { result } = renderHook(() => useAIStore());
      const summary = createMockSummary();

      act(() => {
        result.current.addSummary(summary);
      });

      expect(result.current.summaries[summary.meeting_id]).toEqual(summary);
    });

    it('should add multiple summaries without overwriting', () => {
      const { result } = renderHook(() => useAIStore());
      const summary1 = createMockSummary({ meeting_id: 'meeting-1' });
      const summary2 = createMockSummary({ meeting_id: 'meeting-2' });

      act(() => {
        result.current.addSummary(summary1);
        result.current.addSummary(summary2);
      });

      expect(result.current.summaries).toEqual({
        'meeting-1': summary1,
        'meeting-2': summary2,
      });
    });

    it('should update existing summary when adding with same meeting_id', () => {
      const { result } = renderHook(() => useAIStore());
      const originalSummary = createMockSummary({ content: 'Original content' });
      const updatedSummary = createMockSummary({ content: 'Updated content' });

      act(() => {
        result.current.addSummary(originalSummary);
        result.current.addSummary(updatedSummary);
      });

      expect(result.current.summaries[updatedSummary.meeting_id]).toEqual(updatedSummary);
      expect(result.current.summaries[updatedSummary.meeting_id].content).toBe('Updated content');
    });

    it('should set current summary', () => {
      const { result } = renderHook(() => useAIStore());
      const summary = createMockSummary();

      act(() => {
        result.current.setCurrentSummary(summary);
      });

      expect(result.current.currentSummary).toEqual(summary);
    });

    it('should set is generating summary', () => {
      const { result } = renderHook(() => useAIStore());

      act(() => {
        result.current.setIsGeneratingSummary(true);
      });

      expect(result.current.isGeneratingSummary).toBe(true);

      act(() => {
        result.current.setIsGeneratingSummary(false);
      });

      expect(result.current.isGeneratingSummary).toBe(false);
    });

    it('should set summary error', () => {
      const { result } = renderHook(() => useAIStore());
      const error = 'Failed to generate summary';

      act(() => {
        result.current.setSummaryError(error);
      });

      expect(result.current.summaryError).toBe(error);

      act(() => {
        result.current.setSummaryError(null);
      });

      expect(result.current.summaryError).toBeNull();
    });
  });

  describe('Template Actions', () => {
    it('should set templates', () => {
      const { result } = renderHook(() => useAIStore());
      const templates = [
        createMockTemplate({ id: 1, name: 'Template 1' }),
        createMockTemplate({ id: 2, name: 'Template 2' }),
      ];

      act(() => {
        result.current.setTemplates(templates);
      });

      expect(result.current.templates).toEqual(templates);
    });

    it('should add template', () => {
      const { result } = renderHook(() => useAIStore());
      const template = createMockTemplate();

      act(() => {
        result.current.addTemplate(template);
      });

      expect(result.current.templates).toEqual([template]);
    });

    it('should add multiple templates', () => {
      const { result } = renderHook(() => useAIStore());
      const template1 = createMockTemplate({ id: 1, name: 'Template 1' });
      const template2 = createMockTemplate({ id: 2, name: 'Template 2' });

      act(() => {
        result.current.addTemplate(template1);
        result.current.addTemplate(template2);
      });

      expect(result.current.templates).toEqual([template1, template2]);
    });

    it('should update template', () => {
      const { result } = renderHook(() => useAIStore());
      const originalTemplate = createMockTemplate({ name: 'Original Name' });
      const updatedTemplate = createMockTemplate({ name: 'Updated Name' });

      act(() => {
        result.current.addTemplate(originalTemplate);
        result.current.updateTemplate(updatedTemplate);
      });

      expect(result.current.templates[0]).toEqual(updatedTemplate);
      expect(result.current.templates[0].name).toBe('Updated Name');
    });

    it('should not update template with non-existent id', () => {
      const { result } = renderHook(() => useAIStore());
      const existingTemplate = createMockTemplate({ id: 1 });
      const nonExistentTemplate = createMockTemplate({ id: 999, name: 'Non-existent' });

      act(() => {
        result.current.addTemplate(existingTemplate);
        result.current.updateTemplate(nonExistentTemplate);
      });

      expect(result.current.templates).toEqual([existingTemplate]);
    });

    it('should delete template', () => {
      const { result } = renderHook(() => useAIStore());
      const template1 = createMockTemplate({ id: 1, name: 'Template 1' });
      const template2 = createMockTemplate({ id: 2, name: 'Template 2' });

      act(() => {
        result.current.addTemplate(template1);
        result.current.addTemplate(template2);
        result.current.deleteTemplate(1);
      });

      expect(result.current.templates).toEqual([template2]);
    });

    it('should not delete template with non-existent id', () => {
      const { result } = renderHook(() => useAIStore());
      const template = createMockTemplate({ id: 1 });

      act(() => {
        result.current.addTemplate(template);
        result.current.deleteTemplate(999);
      });

      expect(result.current.templates).toEqual([template]);
    });

    it('should set selected template', () => {
      const { result } = renderHook(() => useAIStore());
      const template = createMockTemplate();

      act(() => {
        result.current.setSelectedTemplate(template);
      });

      expect(result.current.selectedTemplate).toEqual(template);
    });

    it('should set is loading templates', () => {
      const { result } = renderHook(() => useAIStore());

      act(() => {
        result.current.setIsLoadingTemplates(true);
      });

      expect(result.current.isLoadingTemplates).toBe(true);
    });

    it('should set template error', () => {
      const { result } = renderHook(() => useAIStore());
      const error = 'Failed to load templates';

      act(() => {
        result.current.setTemplateError(error);
      });

      expect(result.current.templateError).toBe(error);
    });
  });

  describe('Processing Actions', () => {
    it('should update task progress', () => {
      const { result } = renderHook(() => useAIStore());
      const taskId = 'task-123';
      const progress = createMockProgress();

      act(() => {
        result.current.updateTaskProgress(taskId, progress);
      });

      expect(result.current.activeTasks[taskId]).toEqual(progress);
    });

    it('should update multiple tasks', () => {
      const { result } = renderHook(() => useAIStore());
      const task1 = createMockProgress({ operation_id: 'op-1' });
      const task2 = createMockProgress({ operation_id: 'op-2' });

      act(() => {
        result.current.updateTaskProgress('task-1', task1);
        result.current.updateTaskProgress('task-2', task2);
      });

      expect(result.current.activeTasks).toEqual({
        'task-1': task1,
        'task-2': task2,
      });
    });

    it('should update existing task progress', () => {
      const { result } = renderHook(() => useAIStore());
      const taskId = 'task-123';
      const initialProgress = createMockProgress({ progress: 0.25 });
      const updatedProgress = createMockProgress({ progress: 0.75 });

      act(() => {
        result.current.updateTaskProgress(taskId, initialProgress);
        result.current.updateTaskProgress(taskId, updatedProgress);
      });

      expect(result.current.activeTasks[taskId]).toEqual(updatedProgress);
      expect(result.current.activeTasks[taskId].progress).toBe(0.75);
    });

    it('should remove task', () => {
      const { result } = renderHook(() => useAIStore());
      const task1 = createMockProgress({ operation_id: 'op-1' });
      const task2 = createMockProgress({ operation_id: 'op-2' });

      act(() => {
        result.current.updateTaskProgress('task-1', task1);
        result.current.updateTaskProgress('task-2', task2);
        result.current.removeTask('task-1');
      });

      expect(result.current.activeTasks).toEqual({ 'task-2': task2 });
    });

    it('should not fail when removing non-existent task', () => {
      const { result } = renderHook(() => useAIStore());
      const task = createMockProgress();

      act(() => {
        result.current.updateTaskProgress('task-1', task);
        result.current.removeTask('non-existent');
      });

      expect(result.current.activeTasks).toEqual({ 'task-1': task });
    });

    it('should clear completed tasks', () => {
      const { result } = renderHook(() => useAIStore());
      const completedTask = createMockProgress({ stage: 'completed' });
      const failedTask = createMockProgress({ stage: 'failed' });
      const activeTask = createMockProgress({ stage: 'processing' });

      act(() => {
        result.current.updateTaskProgress('completed', completedTask);
        result.current.updateTaskProgress('failed', failedTask);
        result.current.updateTaskProgress('active', activeTask);
        result.current.clearCompletedTasks();
      });

      expect(result.current.activeTasks).toEqual({ 'active': activeTask });
    });
  });

  describe('Cost Tracking Actions', () => {
    it('should set usage stats', () => {
      const { result } = renderHook(() => useAIStore());
      const stats = createMockUsageStats();

      act(() => {
        result.current.setUsageStats(stats);
      });

      expect(result.current.usageStats).toEqual(stats);
    });

    it('should set cost estimate', () => {
      const { result } = renderHook(() => useAIStore());
      const estimate = createMockCostEstimate();

      act(() => {
        result.current.setCostEstimate(estimate);
      });

      expect(result.current.costEstimate).toEqual(estimate);
    });

    it('should set is loading costs', () => {
      const { result } = renderHook(() => useAIStore());

      act(() => {
        result.current.setIsLoadingCosts(true);
      });

      expect(result.current.isLoadingCosts).toBe(true);
    });

    it('should set cost error', () => {
      const { result } = renderHook(() => useAIStore());
      const error = 'Failed to load cost data';

      act(() => {
        result.current.setCostError(error);
      });

      expect(result.current.costError).toBe(error);
    });
  });

  describe('UI Actions', () => {
    it('should set show cost tracker', () => {
      const { result } = renderHook(() => useAIStore());

      act(() => {
        result.current.setShowCostTracker(true);
      });

      expect(result.current.showCostTracker).toBe(true);
    });

    it('should set show template manager', () => {
      const { result } = renderHook(() => useAIStore());

      act(() => {
        result.current.setShowTemplateManager(true);
      });

      expect(result.current.showTemplateManager).toBe(true);
    });

    it('should set selected meeting type', () => {
      const { result } = renderHook(() => useAIStore());

      act(() => {
        result.current.setSelectedMeetingType('standup');
      });

      expect(result.current.selectedMeetingType).toBe('standup');
    });
  });

  describe('Reset Functions', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() => useAIStore());

      // Set some state
      act(() => {
        result.current.addSummary(createMockSummary());
        result.current.addTemplate(createMockTemplate());
        result.current.setUsageStats(createMockUsageStats());
        result.current.setShowCostTracker(true);
      });

      // Verify state was set
      expect(Object.keys(result.current.summaries)).toHaveLength(1);
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.usageStats).not.toBeNull();
      expect(result.current.showCostTracker).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify state was reset
      expect(result.current.summaries).toEqual({});
      expect(result.current.templates).toEqual([]);
      expect(result.current.usageStats).toBeNull();
      expect(result.current.showCostTracker).toBe(false);
    });

    it('should reset summary state', () => {
      const { result } = renderHook(() => useAIStore());

      // Set summary state
      act(() => {
        result.current.addSummary(createMockSummary());
        result.current.setCurrentSummary(createMockSummary());
        result.current.setIsGeneratingSummary(true);
        result.current.setSummaryError('Error');
      });

      // Reset summary state
      act(() => {
        result.current.resetSummaryState();
      });

      // Verify only summary state was reset
      expect(result.current.summaries).toEqual({});
      expect(result.current.currentSummary).toBeNull();
      expect(result.current.isGeneratingSummary).toBe(false);
      expect(result.current.summaryError).toBeNull();
    });

    it('should reset template state', () => {
      const { result } = renderHook(() => useAIStore());

      // Set template state
      act(() => {
        result.current.addTemplate(createMockTemplate());
        result.current.setSelectedTemplate(createMockTemplate());
        result.current.setIsLoadingTemplates(true);
        result.current.setTemplateError('Error');
      });

      // Reset template state
      act(() => {
        result.current.resetTemplateState();
      });

      // Verify only template state was reset
      expect(result.current.templates).toEqual([]);
      expect(result.current.selectedTemplate).toBeNull();
      expect(result.current.isLoadingTemplates).toBe(false);
      expect(result.current.templateError).toBeNull();
    });

    it('should reset cost state', () => {
      const { result } = renderHook(() => useAIStore());

      // Set cost state
      act(() => {
        result.current.setUsageStats(createMockUsageStats());
        result.current.setCostEstimate(createMockCostEstimate());
        result.current.setIsLoadingCosts(true);
        result.current.setCostError('Error');
      });

      // Reset cost state
      act(() => {
        result.current.resetCostState();
      });

      // Verify only cost state was reset
      expect(result.current.usageStats).toBeNull();
      expect(result.current.costEstimate).toBeNull();
      expect(result.current.isLoadingCosts).toBe(false);
      expect(result.current.costError).toBeNull();
    });

    it('should not affect other state when resetting specific state', () => {
      const { result } = renderHook(() => useAIStore());

      // Set all types of state
      act(() => {
        result.current.addSummary(createMockSummary());
        result.current.addTemplate(createMockTemplate());
        result.current.setUsageStats(createMockUsageStats());
      });

      // Reset only summary state
      act(() => {
        result.current.resetSummaryState();
      });

      // Verify other state remains
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.usageStats).not.toBeNull();
    });
  });

  describe('AI Selectors', () => {
    it('should calculate hasActiveTasks correctly', () => {
      const { result } = renderHook(() => useAISelectors());

      // Initially no active tasks
      expect(result.current.hasActiveTasks).toBe(false);

      // Add a task
      act(() => {
        useAIStore.getState().updateTaskProgress('task-1', createMockProgress());
      });

      expect(result.current.hasActiveTasks).toBe(true);
    });

    it('should calculate activeTaskCount correctly', () => {
      const { result } = renderHook(() => useAISelectors());

      expect(result.current.activeTaskCount).toBe(0);

      act(() => {
        useAIStore.getState().updateTaskProgress('task-1', createMockProgress());
        useAIStore.getState().updateTaskProgress('task-2', createMockProgress());
      });

      expect(result.current.activeTaskCount).toBe(2);
    });

    it('should calculate isOverBudget correctly', () => {
      const { result } = renderHook(() => useAISelectors());

      // Initially not over budget
      expect(result.current.isOverBudget).toBe(false);

      // Set usage stats with over budget
      act(() => {
        useAIStore.getState().setUsageStats(
          createMockUsageStats({ daily_utilization: 1.2 })
        );
      });

      expect(result.current.isOverBudget).toBe(true);
    });

    it('should get budget warning level correctly', () => {
      const { result } = renderHook(() => useAISelectors());

      expect(result.current.budgetWarningLevel).toBe('Normal');

      act(() => {
        useAIStore.getState().setUsageStats(
          createMockUsageStats({ warning_level: 'Warning' })
        );
      });

      expect(result.current.budgetWarningLevel).toBe('Warning');
    });

    it('should filter templates by type correctly', () => {
      const { result } = renderHook(() => useAISelectors());

      const standupTemplate = createMockTemplate({ meeting_type: 'standup' });
      const clientTemplate = createMockTemplate({ meeting_type: 'client' });

      act(() => {
        useAIStore.getState().setTemplates([standupTemplate, clientTemplate]);
        useAIStore.getState().setSelectedMeetingType('standup');
      });

      expect(result.current.templatesByType).toEqual([standupTemplate]);
    });

    it('should find default template correctly', () => {
      const { result } = renderHook(() => useAISelectors());

      const defaultTemplate = createMockTemplate({ 
        meeting_type: 'standup',
        is_default: true 
      });
      const nonDefaultTemplate = createMockTemplate({ 
        meeting_type: 'standup',
        is_default: false 
      });

      act(() => {
        useAIStore.getState().setTemplates([nonDefaultTemplate, defaultTemplate]);
        useAIStore.getState().setSelectedMeetingType('standup');
      });

      expect(result.current.defaultTemplate).toEqual(defaultTemplate);
    });

    it('should handle case when no default template exists', () => {
      const { result } = renderHook(() => useAISelectors());

      const template = createMockTemplate({ 
        meeting_type: 'standup',
        is_default: false 
      });

      act(() => {
        useAIStore.getState().setTemplates([template]);
        useAIStore.getState().setSelectedMeetingType('standup');
      });

      expect(result.current.defaultTemplate).toBeUndefined();
    });
  });

  describe('State Persistence and Immutability', () => {
    it('should maintain immutability when adding summaries', () => {
      const { result } = renderHook(() => useAIStore());
      const originalSummaries = result.current.summaries;
      const summary = createMockSummary();

      act(() => {
        result.current.addSummary(summary);
      });

      expect(result.current.summaries).not.toBe(originalSummaries);
      expect(originalSummaries).toEqual({});
    });

    it('should maintain immutability when adding templates', () => {
      const { result } = renderHook(() => useAIStore());
      const originalTemplates = result.current.templates;
      const template = createMockTemplate();

      act(() => {
        result.current.addTemplate(template);
      });

      expect(result.current.templates).not.toBe(originalTemplates);
      expect(originalTemplates).toEqual([]);
    });

    it('should maintain immutability when updating task progress', () => {
      const { result } = renderHook(() => useAIStore());
      const originalTasks = result.current.activeTasks;
      const progress = createMockProgress();

      act(() => {
        result.current.updateTaskProgress('task-1', progress);
      });

      expect(result.current.activeTasks).not.toBe(originalTasks);
      expect(originalTasks).toEqual({});
    });
  });

  describe('Complex State Interactions', () => {
    it('should handle complex workflow of summary generation', () => {
      const { result } = renderHook(() => useAIStore());

      // Start generation
      act(() => {
        result.current.setIsGeneratingSummary(true);
        result.current.setSummaryError(null);
      });

      expect(result.current.isGeneratingSummary).toBe(true);
      expect(result.current.summaryError).toBeNull();

      // Add progress tracking
      const progress = createMockProgress({ stage: 'processing', progress: 0.5 });
      act(() => {
        result.current.updateTaskProgress('summary-task', progress);
      });

      expect(result.current.activeTasks['summary-task']).toEqual(progress);

      // Complete generation
      const summary = createMockSummary();
      act(() => {
        result.current.addSummary(summary);
        result.current.setCurrentSummary(summary);
        result.current.setIsGeneratingSummary(false);
        result.current.removeTask('summary-task');
      });

      expect(result.current.summaries[summary.meeting_id]).toEqual(summary);
      expect(result.current.currentSummary).toEqual(summary);
      expect(result.current.isGeneratingSummary).toBe(false);
      expect(result.current.activeTasks['summary-task']).toBeUndefined();
    });

    it('should handle error scenarios correctly', () => {
      const { result } = renderHook(() => useAIStore());

      // Start with loading state
      act(() => {
        result.current.setIsLoadingTemplates(true);
        result.current.setIsLoadingCosts(true);
        result.current.setIsGeneratingSummary(true);
      });

      // Add errors
      act(() => {
        result.current.setTemplateError('Template load failed');
        result.current.setCostError('Cost calculation failed');
        result.current.setSummaryError('Summary generation failed');
      });

      // Clear loading states
      act(() => {
        result.current.setIsLoadingTemplates(false);
        result.current.setIsLoadingCosts(false);
        result.current.setIsGeneratingSummary(false);
      });

      expect(result.current.templateError).toBe('Template load failed');
      expect(result.current.costError).toBe('Cost calculation failed');
      expect(result.current.summaryError).toBe('Summary generation failed');
      expect(result.current.isLoadingTemplates).toBe(false);
      expect(result.current.isLoadingCosts).toBe(false);
      expect(result.current.isGeneratingSummary).toBe(false);
    });
  });
});