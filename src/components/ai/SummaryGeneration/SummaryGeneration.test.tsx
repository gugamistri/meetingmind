import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SummaryGeneration } from './SummaryGeneration';
import { SummaryResult, SummaryTemplate, CostEstimation, TemplateContext } from '../../../stores/ai.store';
import { useSummarization, useTemplates, useCostTracking } from '../../../hooks/ai';

// Mock the hooks
vi.mock('../../../hooks/ai', () => ({
  useSummarization: vi.fn(),
  useTemplates: vi.fn(),
  useCostTracking: vi.fn(),
}));

// Mock common components
vi.mock('../../common/Button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={className}
      data-testid="button"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('../../common/LoadingSpinner', () => ({
  LoadingSpinner: ({ size }: { size?: string }) => (
    <div data-testid="loading-spinner" data-size={size}>Loading...</div>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon" />,
  DollarSign: () => <div data-testid="dollar-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
}));

const mockUseSummarization = useSummarization as any;
const mockUseTemplates = useTemplates as any;
const mockUseCostTracking = useCostTracking as any;

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

const createMockTemplates = (): SummaryTemplate[] => [
  createMockTemplate({ id: 1, name: 'Standup Template', meeting_type: 'standup', is_default: true }),
  createMockTemplate({ id: 2, name: 'Client Meeting', meeting_type: 'client', is_default: false }),
  createMockTemplate({ id: 3, name: 'Brainstorm Session', meeting_type: 'brainstorm', is_default: false }),
];

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

describe('SummaryGeneration', () => {
  const defaultProps = {
    meetingId: 'meeting-456',
    transcriptionText: 'This is a sample transcription for testing purposes.',
    onSummaryGenerated: vi.fn(),
    onTaskStarted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock returns
    mockUseSummarization.mockReturnValue({
      generateSummary: vi.fn(),
      isGeneratingSummary: false,
      summaryError: null,
    });
    
    mockUseTemplates.mockReturnValue({
      templates: createMockTemplates(),
      loadTemplatesByType: vi.fn(),
      templatesForCurrentType: createMockTemplates(),
      defaultTemplate: createMockTemplate(),
      setSelectedMeetingType: vi.fn(),
    });
    
    mockUseCostTracking.mockReturnValue({
      estimateCost: vi.fn(),
      costEstimate: null,
      formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
      budgetStatus: createMockBudgetStatus(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render all form elements', () => {
      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
      expect(screen.getByText('Meeting Type')).toBeInTheDocument();
      expect(screen.getByText('Summary Template')).toBeInTheDocument();
      expect(screen.getByText('Generate in background (allows you to continue working)')).toBeInTheDocument();
      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    it('should show character count for transcription', () => {
      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText(/characters to summarize/)).toBeInTheDocument();
      expect(screen.getByText(/57 characters to summarize/)).toBeInTheDocument();
    });

    it('should display meeting type options', () => {
      render(<SummaryGeneration {...defaultProps} />);

      const meetingTypeSelect = screen.getByDisplayValue('General Meeting');
      expect(meetingTypeSelect).toBeInTheDocument();

      // Check all options are present
      expect(screen.getByText('Daily Standup')).toBeInTheDocument();
      expect(screen.getByText('Client Meeting')).toBeInTheDocument();
      expect(screen.getByText('Brainstorming Session')).toBeInTheDocument();
      expect(screen.getByText('All-Hands Meeting')).toBeInTheDocument();
      expect(screen.getByText('General Meeting')).toBeInTheDocument();
    });

    it('should display available templates', () => {
      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText('Choose a template...')).toBeInTheDocument();
      expect(screen.getByText('Standup Template (Default)')).toBeInTheDocument();
      expect(screen.getByText('Client Meeting')).toBeInTheDocument();
      expect(screen.getByText('Brainstorm Session')).toBeInTheDocument();
    });
  });

  describe('Meeting Type Selection', () => {
    it('should call loadTemplatesByType when meeting type changes', async () => {
      const mockLoadTemplatesByType = vi.fn();
      const mockSetSelectedMeetingType = vi.fn();
      
      mockUseTemplates.mockReturnValue({
        templates: createMockTemplates(),
        loadTemplatesByType: mockLoadTemplatesByType,
        templatesForCurrentType: createMockTemplates(),
        defaultTemplate: createMockTemplate(),
        setSelectedMeetingType: mockSetSelectedMeetingType,
      });

      render(<SummaryGeneration {...defaultProps} />);

      const meetingTypeSelect = screen.getByRole('combobox', { name: /meeting type/i });
      
      fireEvent.change(meetingTypeSelect, { target: { value: 'standup' } });

      expect(mockSetSelectedMeetingType).toHaveBeenCalledWith('standup');
      expect(mockLoadTemplatesByType).toHaveBeenCalledWith('standup');
    });

    it('should auto-select default template when meeting type changes', async () => {
      const standupTemplate = createMockTemplate({ 
        id: 5, 
        name: 'Standup Default', 
        meeting_type: 'standup',
        is_default: true 
      });

      mockUseTemplates.mockReturnValue({
        templates: createMockTemplates(),
        loadTemplatesByType: vi.fn(),
        templatesForCurrentType: [standupTemplate],
        defaultTemplate: standupTemplate,
        setSelectedMeetingType: vi.fn(),
      });

      render(<SummaryGeneration {...defaultProps} />);

      // Wait for auto-selection effect
      await waitFor(() => {
        const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
        expect(templateSelect).toHaveValue('5');
      });
    });
  });

  describe('Template Selection', () => {
    it('should show template description when template is selected', () => {
      render(<SummaryGeneration {...defaultProps} />);

      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      expect(screen.getByText('Daily standup meeting template')).toBeInTheDocument();
    });

    it('should call estimateCost when template is selected', async () => {
      const mockEstimateCost = vi.fn();
      
      mockUseCostTracking.mockReturnValue({
        estimateCost: mockEstimateCost,
        costEstimate: null,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus(),
      });

      render(<SummaryGeneration {...defaultProps} />);

      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      await waitFor(() => {
        expect(mockEstimateCost).toHaveBeenCalledWith(
          defaultProps.transcriptionText,
          'Summarize this standup meeting...'
        );
      });
    });
  });

  describe('Cost Estimation Display', () => {
    it('should display cost estimate when available', () => {
      const costEstimate = createMockCostEstimate();
      
      mockUseCostTracking.mockReturnValue({
        estimateCost: vi.fn(),
        costEstimate,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus(),
      });

      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText('Estimated Cost:')).toBeInTheDocument();
      expect(screen.getByText('$0.15')).toBeInTheDocument();
      expect(screen.getByText('2,000 input + 300 output tokens')).toBeInTheDocument();
      expect(screen.getByText('via OPENAI')).toBeInTheDocument();
    });

    it('should show budget exceeded warning when cannot afford', () => {
      const costEstimate = createMockCostEstimate({ can_afford: false });
      
      mockUseCostTracking.mockReturnValue({
        estimateCost: vi.fn(),
        costEstimate,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus(),
      });

      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
      expect(screen.getByText('Exceeds budget limits')).toBeInTheDocument();
    });
  });

  describe('Budget Warning Display', () => {
    it('should show budget warning when warning level is Warning', () => {
      mockUseCostTracking.mockReturnValue({
        estimateCost: vi.fn(),
        costEstimate: null,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus({ warningLevel: 'Warning' }),
      });

      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText('Budget Warning')).toBeInTheDocument();
      expect(screen.getByText('You are approaching your budget limits for AI operations.')).toBeInTheDocument();
    });

    it('should show budget exceeded warning when over budget', () => {
      mockUseCostTracking.mockReturnValue({
        estimateCost: vi.fn(),
        costEstimate: null,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus({ 
          warningLevel: 'Critical',
          isOverBudget: true,
        }),
      });

      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText('Budget Exceeded')).toBeInTheDocument();
      expect(screen.getByText('You have exceeded your daily or monthly budget limits.')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display summary error when present', () => {
      mockUseSummarization.mockReturnValue({
        generateSummary: vi.fn(),
        isGeneratingSummary: false,
        summaryError: 'Failed to connect to AI service',
      });

      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to connect to AI service')).toBeInTheDocument();
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });
  });

  describe('Generation Process', () => {
    it('should disable generate button when no template selected', () => {
      render(<SummaryGeneration {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      expect(generateButton).toBeDisabled();
    });

    it('should enable generate button when template is selected', () => {
      render(<SummaryGeneration {...defaultProps} />);

      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      expect(generateButton).not.toBeDisabled();
    });

    it('should call generateSummary with correct parameters for sync generation', async () => {
      const mockGenerateSummary = vi.fn().mockResolvedValue(createMockSummary());
      
      mockUseSummarization.mockReturnValue({
        generateSummary: mockGenerateSummary,
        isGeneratingSummary: false,
        summaryError: null,
      });

      render(<SummaryGeneration {...defaultProps} />);

      // Select template and disable async
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });
      
      const asyncCheckbox = screen.getByRole('checkbox');
      fireEvent.click(asyncCheckbox); // Disable async (make it sync)

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(mockGenerateSummary).toHaveBeenCalledWith({
        meetingId: 'meeting-456',
        templateId: 1,
        meetingType: 'custom',
        context: undefined,
        synchronous: true,
      });
    });

    it('should call generateSummary with context when provided', async () => {
      const mockGenerateSummary = vi.fn().mockResolvedValue(createMockSummary());
      
      mockUseSummarization.mockReturnValue({
        generateSummary: mockGenerateSummary,
        isGeneratingSummary: false,
        summaryError: null,
      });

      render(<SummaryGeneration {...defaultProps} />);

      // Select template
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      // Open advanced options and fill context
      const advancedOptions = screen.getByText('Advanced Options');
      fireEvent.click(advancedOptions);

      const titleInput = screen.getByPlaceholderText('e.g., Weekly Team Sync');
      fireEvent.change(titleInput, { target: { value: 'Weekly Standup' } });

      const durationInput = screen.getByPlaceholderText('e.g., 30 minutes');
      fireEvent.change(durationInput, { target: { value: '15 minutes' } });

      const participantsInput = screen.getByPlaceholderText('e.g., Alice, Bob, Charlie');
      fireEvent.change(participantsInput, { target: { value: 'Alice, Bob' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(mockGenerateSummary).toHaveBeenCalledWith({
        meetingId: 'meeting-456',
        templateId: 1,
        meetingType: 'custom',
        context: {
          meeting_title: 'Weekly Standup',
          meeting_duration: '15 minutes',
          participants: 'Alice, Bob',
        },
        synchronous: false,
      });
    });

    it('should show loading state during generation', async () => {
      mockUseSummarization.mockReturnValue({
        generateSummary: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(createMockSummary()), 100))
        ),
        isGeneratingSummary: true,
        summaryError: null,
      });

      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Generating...')).toBeInTheDocument();
      
      const generateButton = screen.getByRole('button', { name: /generating/i });
      expect(generateButton).toBeDisabled();
    });

    it('should call onSummaryGenerated for sync generation', async () => {
      const mockSummary = createMockSummary();
      const mockGenerateSummary = vi.fn().mockResolvedValue(mockSummary);
      
      mockUseSummarization.mockReturnValue({
        generateSummary: mockGenerateSummary,
        isGeneratingSummary: false,
        summaryError: null,
      });

      const onSummaryGenerated = vi.fn();

      render(
        <SummaryGeneration 
          {...defaultProps} 
          onSummaryGenerated={onSummaryGenerated}
        />
      );

      // Select template and generate
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      // Disable async mode
      const asyncCheckbox = screen.getByRole('checkbox');
      fireEvent.click(asyncCheckbox);

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(onSummaryGenerated).toHaveBeenCalledWith(mockSummary);
    });

    it('should call onTaskStarted for async generation', async () => {
      const taskId = 'task-123';
      const mockGenerateSummary = vi.fn().mockResolvedValue(taskId);
      
      mockUseSummarization.mockReturnValue({
        generateSummary: mockGenerateSummary,
        isGeneratingSummary: false,
        summaryError: null,
      });

      const onTaskStarted = vi.fn();

      render(
        <SummaryGeneration 
          {...defaultProps} 
          onTaskStarted={onTaskStarted}
        />
      );

      // Select template and generate (async is default)
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(onTaskStarted).toHaveBeenCalledWith(taskId);
    });

    it('should handle generation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockGenerateSummary = vi.fn().mockRejectedValue(new Error('AI service error'));
      
      mockUseSummarization.mockReturnValue({
        generateSummary: mockGenerateSummary,
        isGeneratingSummary: false,
        summaryError: null,
      });

      render(<SummaryGeneration {...defaultProps} />);

      // Select template and generate
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to generate summary:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Advanced Options', () => {
    it('should toggle advanced options visibility', () => {
      render(<SummaryGeneration {...defaultProps} />);

      // Advanced options should be collapsed initially
      expect(screen.queryByText('Meeting Title')).not.toBeInTheDocument();

      // Click to expand
      const advancedOptions = screen.getByText('Advanced Options');
      fireEvent.click(advancedOptions);

      // Should show advanced fields
      expect(screen.getByText('Meeting Title')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });

    it('should update context when advanced options are filled', () => {
      render(<SummaryGeneration {...defaultProps} />);

      // Open advanced options
      const advancedOptions = screen.getByText('Advanced Options');
      fireEvent.click(advancedOptions);

      // Fill in context fields
      const titleInput = screen.getByPlaceholderText('e.g., Weekly Team Sync');
      fireEvent.change(titleInput, { target: { value: 'Test Meeting' } });

      expect(titleInput).toHaveValue('Test Meeting');
    });
  });

  describe('Button States', () => {
    it('should disable generate button when over budget and cannot afford', () => {
      const costEstimate = createMockCostEstimate({ can_afford: false });
      
      mockUseCostTracking.mockReturnValue({
        estimateCost: vi.fn(),
        costEstimate,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus({ isOverBudget: true }),
      });

      render(<SummaryGeneration {...defaultProps} />);

      // Select template
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      expect(generateButton).toBeDisabled();
    });

    it('should enable generate button when over budget but can afford', () => {
      const costEstimate = createMockCostEstimate({ can_afford: true });
      
      mockUseCostTracking.mockReturnValue({
        estimateCost: vi.fn(),
        costEstimate,
        formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
        budgetStatus: createMockBudgetStatus({ isOverBudget: true }),
      });

      render(<SummaryGeneration {...defaultProps} />);

      // Select template
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transcription text', () => {
      render(<SummaryGeneration {...defaultProps} transcriptionText="" />);

      expect(screen.queryByText(/characters to summarize/)).not.toBeInTheDocument();
      
      // Should disable generate button
      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      expect(generateButton).toBeDisabled();
    });

    it('should handle empty template list', () => {
      mockUseTemplates.mockReturnValue({
        templates: [],
        loadTemplatesByType: vi.fn(),
        templatesForCurrentType: [],
        defaultTemplate: null,
        setSelectedMeetingType: vi.fn(),
      });

      render(<SummaryGeneration {...defaultProps} />);

      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      const options = templateSelect.querySelectorAll('option');
      expect(options).toHaveLength(1); // Only the placeholder option
    });

    it('should work without optional callbacks', async () => {
      const mockGenerateSummary = vi.fn().mockResolvedValue(createMockSummary());
      
      mockUseSummarization.mockReturnValue({
        generateSummary: mockGenerateSummary,
        isGeneratingSummary: false,
        summaryError: null,
      });

      render(
        <SummaryGeneration 
          meetingId={defaultProps.meetingId}
          transcriptionText={defaultProps.transcriptionText}
        />
      );

      // Should not throw error without callbacks
      const templateSelect = screen.getByRole('combobox', { name: /summary template/i });
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(mockGenerateSummary).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form elements', () => {
      render(<SummaryGeneration {...defaultProps} />);

      expect(screen.getByRole('combobox', { name: /meeting type/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /summary template/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should have proper button attributes', () => {
      render(<SummaryGeneration {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /generate summary/i });
      expect(generateButton).toHaveAttribute('disabled');
    });
  });
});