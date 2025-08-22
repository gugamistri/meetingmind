import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// AI-related types (matching Rust types)
export interface SummaryResult {
  id: string;
  meeting_id: string;
  template_id?: number;
  content: string;
  model_used: string;
  provider: 'openai' | 'claude';
  cost_usd: number;
  processing_time_ms: number;
  token_count?: number;
  confidence_score?: number;
  created_at: string;
}

export interface SummaryTemplate {
  id: number;
  name: string;
  description?: string;
  prompt_template: string;
  meeting_type: 'standup' | 'client' | 'brainstorm' | 'all_hands' | 'custom';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProcessingProgress {
  operation_id: string;
  stage: 'initializing' | 'cost_estimation' | 'text_preprocessing' | 'sending_to_provider' | 'awaiting_response' | 'post_processing' | 'completed' | 'failed';
  progress: number; // 0.0 to 1.0
  estimated_time_remaining_ms?: number;
  message: string;
}

export interface CostEstimation {
  estimated_cost: number;
  provider: 'openai' | 'claude';
  operation_type: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  can_afford: boolean;
  budget_impact: BudgetImpact;
}

export interface BudgetImpact {
  daily_before: number;
  daily_after: number;
  monthly_before: number;
  monthly_after: number;
  daily_budget: number;
  monthly_budget: number;
}

export interface UsageStats {
  daily_spend: number;
  monthly_spend: number;
  daily_budget: number;
  monthly_budget: number;
  daily_remaining: number;
  monthly_remaining: number;
  daily_utilization: number;
  monthly_utilization: number;
  warning_level: 'Normal' | 'Info' | 'Warning' | 'Critical';
}

export interface TemplateContext {
  meeting_title?: string;
  meeting_duration?: string;
  meeting_date?: string;
  participants?: string;
  participant_count?: number;
  transcription_length?: number;
  meeting_type?: string;
  organizer?: string;
  summary_length_preference?: string;
}

interface AIState {
  // Summary state
  summaries: Record<string, SummaryResult>; // meetingId -> summary
  currentSummary: SummaryResult | null;
  isGeneratingSummary: boolean;
  summaryError: string | null;

  // Template state
  templates: SummaryTemplate[];
  selectedTemplate: SummaryTemplate | null;
  isLoadingTemplates: boolean;
  templateError: string | null;

  // Processing state
  activeTasks: Record<string, ProcessingProgress>; // taskId -> progress
  
  // Cost tracking state
  usageStats: UsageStats | null;
  costEstimate: CostEstimation | null;
  isLoadingCosts: boolean;
  costError: string | null;

  // UI state
  showCostTracker: boolean;
  showTemplateManager: boolean;
  selectedMeetingType: 'standup' | 'client' | 'brainstorm' | 'all_hands' | 'custom';

  // Actions
  setSummaries: (summaries: Record<string, SummaryResult>) => void;
  addSummary: (summary: SummaryResult) => void;
  setCurrentSummary: (summary: SummaryResult | null) => void;
  setIsGeneratingSummary: (isGenerating: boolean) => void;
  setSummaryError: (error: string | null) => void;

  setTemplates: (templates: SummaryTemplate[]) => void;
  addTemplate: (template: SummaryTemplate) => void;
  updateTemplate: (template: SummaryTemplate) => void;
  deleteTemplate: (templateId: number) => void;
  setSelectedTemplate: (template: SummaryTemplate | null) => void;
  setIsLoadingTemplates: (isLoading: boolean) => void;
  setTemplateError: (error: string | null) => void;

  updateTaskProgress: (taskId: string, progress: ProcessingProgress) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;

  setUsageStats: (stats: UsageStats | null) => void;
  setCostEstimate: (estimate: CostEstimation | null) => void;
  setIsLoadingCosts: (isLoading: boolean) => void;
  setCostError: (error: string | null) => void;

  setShowCostTracker: (show: boolean) => void;
  setShowTemplateManager: (show: boolean) => void;
  setSelectedMeetingType: (type: 'standup' | 'client' | 'brainstorm' | 'all_hands' | 'custom') => void;

  // Reset functions
  reset: () => void;
  resetSummaryState: () => void;
  resetTemplateState: () => void;
  resetCostState: () => void;
}

const initialState = {
  // Summary state
  summaries: {},
  currentSummary: null,
  isGeneratingSummary: false,
  summaryError: null,

  // Template state
  templates: [],
  selectedTemplate: null,
  isLoadingTemplates: false,
  templateError: null,

  // Processing state
  activeTasks: {},

  // Cost tracking state
  usageStats: null,
  costEstimate: null,
  isLoadingCosts: false,
  costError: null,

  // UI state
  showCostTracker: false,
  showTemplateManager: false,
  selectedMeetingType: 'custom' as const,
};

export const useAIStore = create<AIState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Summary actions
    setSummaries: (summaries) => set({ summaries }),
    addSummary: (summary) => set(state => ({
      summaries: {
        ...state.summaries,
        [summary.meeting_id]: summary
      }
    })),
    setCurrentSummary: (summary) => set({ currentSummary: summary }),
    setIsGeneratingSummary: (isGenerating) => set({ isGeneratingSummary: isGenerating }),
    setSummaryError: (error) => set({ summaryError: error }),

    // Template actions
    setTemplates: (templates) => set({ templates }),
    addTemplate: (template) => set(state => ({
      templates: [...state.templates, template]
    })),
    updateTemplate: (template) => set(state => ({
      templates: state.templates.map(t => t.id === template.id ? template : t)
    })),
    deleteTemplate: (templateId) => set(state => ({
      templates: state.templates.filter(t => t.id !== templateId)
    })),
    setSelectedTemplate: (template) => set({ selectedTemplate: template }),
    setIsLoadingTemplates: (isLoading) => set({ isLoadingTemplates: isLoading }),
    setTemplateError: (error) => set({ templateError: error }),

    // Processing actions
    updateTaskProgress: (taskId, progress) => set(state => ({
      activeTasks: {
        ...state.activeTasks,
        [taskId]: progress
      }
    })),
    removeTask: (taskId) => set(state => {
      const { [taskId]: removed, ...rest } = state.activeTasks;
      return { activeTasks: rest };
    }),
    clearCompletedTasks: () => set(state => {
      const activeTasks = Object.entries(state.activeTasks)
        .filter(([_, progress]) => progress.stage !== 'completed' && progress.stage !== 'failed')
        .reduce((acc, [taskId, progress]) => {
          acc[taskId] = progress;
          return acc;
        }, {} as Record<string, ProcessingProgress>);
      
      return { activeTasks };
    }),

    // Cost tracking actions
    setUsageStats: (stats) => set({ usageStats: stats }),
    setCostEstimate: (estimate) => set({ costEstimate: estimate }),
    setIsLoadingCosts: (isLoading) => set({ isLoadingCosts: isLoading }),
    setCostError: (error) => set({ costError: error }),

    // UI actions
    setShowCostTracker: (show) => set({ showCostTracker: show }),
    setShowTemplateManager: (show) => set({ showTemplateManager: show }),
    setSelectedMeetingType: (type) => set({ selectedMeetingType: type }),

    // Reset functions
    reset: () => set(initialState),
    resetSummaryState: () => set({
      summaries: {},
      currentSummary: null,
      isGeneratingSummary: false,
      summaryError: null,
    }),
    resetTemplateState: () => set({
      templates: [],
      selectedTemplate: null,
      isLoadingTemplates: false,
      templateError: null,
    }),
    resetCostState: () => set({
      usageStats: null,
      costEstimate: null,
      isLoadingCosts: false,
      costError: null,
    }),
  }))
);

// Selectors for computed values
export const useAISelectors = () => {
  const activeTasks = useAIStore(state => state.activeTasks);
  const usageStats = useAIStore(state => state.usageStats);
  const templates = useAIStore(state => state.templates);
  const selectedMeetingType = useAIStore(state => state.selectedMeetingType);

  return {
    hasActiveTasks: Object.keys(activeTasks).length > 0,
    activeTaskCount: Object.keys(activeTasks).length,
    isOverBudget: usageStats ? 
      (usageStats.daily_utilization >= 1.0 || usageStats.monthly_utilization >= 1.0) : 
      false,
    budgetWarningLevel: usageStats?.warning_level || 'Normal',
    templatesByType: templates.filter(t => t.meeting_type === selectedMeetingType),
    defaultTemplate: templates.find(t => t.meeting_type === selectedMeetingType && t.is_default),
  };
};