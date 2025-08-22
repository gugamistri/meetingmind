import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SummaryView } from './SummaryView';
import { SummaryResult, SummaryTemplate } from '../../../stores/ai.store';
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
  Copy: () => <div data-testid="copy-icon" />,
  Download: () => <div data-testid="download-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  DollarSign: () => <div data-testid="dollar-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
}));

const mockUseSummarization = useSummarization as any;
const mockUseTemplates = useTemplates as any;
const mockUseCostTracking = useCostTracking as any;

const createMockSummary = (overrides: Partial<SummaryResult> = {}): SummaryResult => ({
  id: 'summary-123',
  meeting_id: 'meeting-456',
  template_id: 1,
  content: 'This is a test meeting summary with key points and action items.',
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

const createMockTemplates = (): SummaryTemplate[] => [
  createMockTemplate({ id: 1, name: 'Standup Template', meeting_type: 'standup' }),
  createMockTemplate({ id: 2, name: 'Client Meeting', meeting_type: 'client' }),
  createMockTemplate({ id: 3, name: 'Brainstorm Session', meeting_type: 'brainstorm' }),
];

describe('SummaryView', () => {
  const defaultProps = {
    summary: createMockSummary(),
    meetingId: 'meeting-456',
    onRegenerate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock returns
    mockUseSummarization.mockReturnValue({
      regenerateSummary: vi.fn(),
    });
    
    mockUseTemplates.mockReturnValue({
      templates: createMockTemplates(),
      templatesForCurrentType: createMockTemplates(),
    });
    
    mockUseCostTracking.mockReturnValue({
      formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render summary content and metadata', () => {
      render(<SummaryView {...defaultProps} />);

      expect(screen.getByText('Meeting Summary')).toBeInTheDocument();
      expect(screen.getByText('OPENAI')).toBeInTheDocument();
      expect(screen.getByText(defaultProps.summary.content)).toBeInTheDocument();
    });

    it('should display provider badge with correct styling', () => {
      const { rerender } = render(<SummaryView {...defaultProps} />);

      // Test OpenAI provider
      const openAIBadge = screen.getByText('OPENAI');
      expect(openAIBadge).toHaveClass('bg-green-100', 'text-green-800');

      // Test Claude provider
      const claudeSummary = createMockSummary({ provider: 'claude' });
      rerender(<SummaryView {...defaultProps} summary={claudeSummary} />);
      
      const claudeBadge = screen.getByText('CLAUDE');
      expect(claudeBadge).toHaveClass('bg-purple-100', 'text-purple-800');
    });

    it('should display action buttons', () => {
      render(<SummaryView {...defaultProps} />);

      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
      expect(screen.getByText('Regenerate')).toBeInTheDocument();
      
      expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
      expect(screen.getByTestId('download-icon')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });

    it('should display metadata with icons', () => {
      render(<SummaryView {...defaultProps} />);

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByTestId('dollar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('zap-icon')).toBeInTheDocument();
      
      expect(screen.getByText('2.5s')).toBeInTheDocument(); // processing time
      expect(screen.getByText('$0.15')).toBeInTheDocument(); // cost
      expect(screen.getByText('250 tokens')).toBeInTheDocument(); // token count
    });
  });

  describe('Copy Functionality', () => {
    it('should copy summary content to clipboard when copy button is clicked', async () => {
      render(<SummaryView {...defaultProps} />);

      const copyButton = screen.getByText('Copy');
      
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.summary.content);
    });

    it('should handle clipboard write failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard failed')),
        },
      });

      render(<SummaryView {...defaultProps} />);

      const copyButton = screen.getByText('Copy');
      
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Download Functionality', () => {
    it('should create download link when download button is clicked', () => {
      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      render(<SummaryView {...defaultProps} />);

      const downloadButton = screen.getByText('Download');
      fireEvent.click(downloadButton);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('meeting-summary-meeting-456.md');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should create blob with correct content and type', () => {
      const originalBlob = global.Blob;
      global.Blob = vi.fn().mockImplementation((content, options) => ({
        content,
        options,
      })) as any;

      render(<SummaryView {...defaultProps} />);

      const downloadButton = screen.getByText('Download');
      fireEvent.click(downloadButton);

      expect(global.Blob).toHaveBeenCalledWith(
        [defaultProps.summary.content],
        { type: 'text/markdown' }
      );

      global.Blob = originalBlob;
    });
  });

  describe('Regenerate Functionality', () => {
    it('should toggle regenerate options when regenerate button is clicked', () => {
      render(<SummaryView {...defaultProps} />);

      const regenerateButton = screen.getByText('Regenerate');
      
      // Options should not be visible initially
      expect(screen.queryByText('Regenerate with different template')).not.toBeInTheDocument();
      
      fireEvent.click(regenerateButton);
      
      // Options should be visible after click
      expect(screen.getByText('Regenerate with different template')).toBeInTheDocument();
      expect(screen.getByText('Select Template')).toBeInTheDocument();
      expect(screen.getByText('Choose a template...')).toBeInTheDocument();
    });

    it('should populate template dropdown with available templates', () => {
      render(<SummaryView {...defaultProps} />);

      // Open regenerate options
      const regenerateButton = screen.getByText('Regenerate');
      fireEvent.click(regenerateButton);

      const templateSelect = screen.getByRole('combobox');
      expect(templateSelect).toBeInTheDocument();

      // Check for template options
      expect(screen.getByText('Standup Template (standup)')).toBeInTheDocument();
      expect(screen.getByText('Client Meeting (client)')).toBeInTheDocument();
      expect(screen.getByText('Brainstorm Session (brainstorm)')).toBeInTheDocument();
    });

    it('should enable regenerate button only when template is selected', () => {
      render(<SummaryView {...defaultProps} />);

      // Open regenerate options
      fireEvent.click(screen.getByText('Regenerate'));

      const regenerateButton = screen.getAllByText('Regenerate').find(btn => 
        btn.closest('button')?.disabled !== undefined
      ) as HTMLElement;
      const templateSelect = screen.getByRole('combobox');

      // Initially disabled
      expect(regenerateButton.closest('button')).toBeDisabled();

      // Enable after selecting template
      fireEvent.change(templateSelect, { target: { value: '1' } });
      expect(regenerateButton.closest('button')).not.toBeDisabled();

      // Disable again when cleared
      fireEvent.change(templateSelect, { target: { value: '' } });
      expect(regenerateButton.closest('button')).toBeDisabled();
    });

    it('should call regenerateSummary with correct parameters', async () => {
      const mockRegenerateSummary = vi.fn().mockResolvedValue(createMockSummary({ id: 'new-summary' }));
      mockUseSummarization.mockReturnValue({
        regenerateSummary: mockRegenerateSummary,
      });

      render(<SummaryView {...defaultProps} />);

      // Open regenerate options
      fireEvent.click(screen.getByText('Regenerate'));

      // Select template
      const templateSelect = screen.getByRole('combobox');
      fireEvent.change(templateSelect, { target: { value: '2' } });

      // Click regenerate
      const regenerateButton = screen.getAllByText('Regenerate')[1];
      
      await act(async () => {
        fireEvent.click(regenerateButton);
      });

      expect(mockRegenerateSummary).toHaveBeenCalledWith({
        meetingId: 'meeting-456',
        newTemplateId: 2,
        context: expect.objectContaining({
          meeting_date: '2025-01-15',
          transcription_length: 250,
        }),
      });
    });

    it('should show loading state during regeneration', async () => {
      const mockRegenerateSummary = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockSummary()), 100))
      );
      mockUseSummarization.mockReturnValue({
        regenerateSummary: mockRegenerateSummary,
      });

      render(<SummaryView {...defaultProps} />);

      // Open regenerate options and select template
      fireEvent.click(screen.getByText('Regenerate'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });

      // Start regeneration
      const regenerateButton = screen.getAllByText('Regenerate')[1];
      
      act(() => {
        fireEvent.click(regenerateButton);
      });

      // Should show loading state
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Regenerating...')).toBeInTheDocument();
      expect(regenerateButton.closest('button')).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Regenerating...')).not.toBeInTheDocument();
      });
    });

    it('should call onRegenerate callback with new summary', async () => {
      const newSummary = createMockSummary({ id: 'new-summary', content: 'New content' });
      const mockRegenerateSummary = vi.fn().mockResolvedValue(newSummary);
      mockUseSummarization.mockReturnValue({
        regenerateSummary: mockRegenerateSummary,
      });

      const onRegenerateMock = vi.fn();

      render(<SummaryView {...defaultProps} onRegenerate={onRegenerateMock} />);

      // Open regenerate options, select template, and regenerate
      fireEvent.click(screen.getByText('Regenerate'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
      
      await act(async () => {
        fireEvent.click(screen.getAllByText('Regenerate')[1]);
      });

      expect(onRegenerateMock).toHaveBeenCalledWith(newSummary);
    });

    it('should handle regeneration errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockRegenerateSummary = vi.fn().mockRejectedValue(new Error('API Error'));
      mockUseSummarization.mockReturnValue({
        regenerateSummary: mockRegenerateSummary,
      });

      render(<SummaryView {...defaultProps} />);

      // Open regenerate options, select template, and regenerate
      fireEvent.click(screen.getByText('Regenerate'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
      
      await act(async () => {
        fireEvent.click(screen.getAllByText('Regenerate')[1]);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to regenerate summary:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should cancel regenerate options when cancel button is clicked', () => {
      render(<SummaryView {...defaultProps} />);

      // Open regenerate options
      fireEvent.click(screen.getByText('Regenerate'));
      expect(screen.getByText('Regenerate with different template')).toBeInTheDocument();

      // Select a template
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'));

      // Options should be hidden and selection cleared
      expect(screen.queryByText('Regenerate with different template')).not.toBeInTheDocument();
    });
  });

  describe('Formatting Functions', () => {
    it('should format processing time correctly', () => {
      const testCases = [
        { input: 500, expected: '500ms' },
        { input: 1500, expected: '1.5s' },
        { input: 2500, expected: '2.5s' },
        { input: 10000, expected: '10.0s' },
      ];

      testCases.forEach(({ input, expected }) => {
        const summary = createMockSummary({ processing_time_ms: input });
        render(<SummaryView {...defaultProps} summary={summary} />);
        
        expect(screen.getByText(expected)).toBeInTheDocument();
        
        // Clean up for next iteration
        screen.getByText(expected).closest('.bg-white')?.remove();
      });
    });

    it('should format timestamp correctly', () => {
      const summary = createMockSummary({ created_at: '2025-01-15T10:30:00Z' });
      render(<SummaryView {...defaultProps} summary={summary} />);

      // Should display localized timestamp
      const timestamp = new Date('2025-01-15T10:30:00Z').toLocaleString();
      expect(screen.getByText(timestamp)).toBeInTheDocument();
    });

    it('should format token count with locale string', () => {
      const summary = createMockSummary({ token_count: 12345 });
      render(<SummaryView {...defaultProps} summary={summary} />);

      expect(screen.getByText('12,345 tokens')).toBeInTheDocument();
    });
  });

  describe('Provider Badge Colors', () => {
    it('should apply correct colors for different providers', () => {
      const testCases = [
        { provider: 'openai', expectedClass: 'bg-green-100 text-green-800' },
        { provider: 'claude', expectedClass: 'bg-purple-100 text-purple-800' },
      ];

      testCases.forEach(({ provider, expectedClass }) => {
        const summary = createMockSummary({ provider: provider as any });
        const { unmount } = render(<SummaryView {...defaultProps} summary={summary} />);
        
        const badge = screen.getByText(provider.toUpperCase());
        expectedClass.split(' ').forEach(className => {
          expect(badge).toHaveClass(className);
        });
        
        unmount();
      });
    });

    it('should apply default color for unknown provider', () => {
      const summary = createMockSummary({ provider: 'unknown' as any });
      render(<SummaryView {...defaultProps} summary={summary} />);

      const badge = screen.getByText('UNKNOWN');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing token count gracefully', () => {
      const summary = createMockSummary({ token_count: undefined });
      render(<SummaryView {...defaultProps} summary={summary} />);

      expect(screen.queryByTestId('zap-icon')).not.toBeInTheDocument();
      expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
    });

    it('should work without onRegenerate callback', async () => {
      const mockRegenerateSummary = vi.fn().mockResolvedValue(createMockSummary());
      mockUseSummarization.mockReturnValue({
        regenerateSummary: mockRegenerateSummary,
      });

      render(<SummaryView summary={defaultProps.summary} meetingId={defaultProps.meetingId} />);

      // Should still work without throwing
      fireEvent.click(screen.getByText('Regenerate'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
      
      await act(async () => {
        fireEvent.click(screen.getAllByText('Regenerate')[1]);
      });

      expect(mockRegenerateSummary).toHaveBeenCalled();
    });

    it('should handle empty template list', () => {
      mockUseTemplates.mockReturnValue({
        templates: [],
        templatesForCurrentType: [],
      });

      render(<SummaryView {...defaultProps} />);

      fireEvent.click(screen.getByText('Regenerate'));

      const templateSelect = screen.getByRole('combobox');
      expect(templateSelect).toBeInTheDocument();
      expect(screen.getByText('Choose a template...')).toBeInTheDocument();
      
      // Should only have the placeholder option
      const options = templateSelect.querySelectorAll('option');
      expect(options).toHaveLength(1);
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      const summary = createMockSummary({ content: longContent });
      
      render(<SummaryView {...defaultProps} summary={summary} />);

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle zero cost and processing time', () => {
      const summary = createMockSummary({ 
        cost_usd: 0, 
        processing_time_ms: 0 
      });
      
      render(<SummaryView {...defaultProps} summary={summary} />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('0ms')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<SummaryView {...defaultProps} />);

      // Open regenerate options
      fireEvent.click(screen.getByText('Regenerate'));

      const templateSelect = screen.getByRole('combobox');
      expect(templateSelect).toBeInTheDocument();
      
      const label = screen.getByText('Select Template');
      expect(label).toBeInTheDocument();
    });

    it('should have proper button states for disabled buttons', () => {
      render(<SummaryView {...defaultProps} />);

      fireEvent.click(screen.getByText('Regenerate'));

      const regenerateButton = screen.getAllByText('Regenerate')[1];
      expect(regenerateButton.closest('button')).toBeDisabled();
      expect(regenerateButton.closest('button')).toHaveAttribute('disabled');
    });
  });
});