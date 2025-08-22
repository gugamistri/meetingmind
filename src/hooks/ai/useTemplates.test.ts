import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import { useTemplates } from './useTemplates';
import { useAIStore, SummaryTemplate, TemplateContext } from '../../stores/ai.store';

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
  createMockTemplate({ id: 2, name: 'Client Meeting', meeting_type: 'client', is_default: true }),
  createMockTemplate({ id: 3, name: 'Brainstorm Session', meeting_type: 'brainstorm', is_default: false }),
  createMockTemplate({ id: 4, name: 'Custom Standup', meeting_type: 'standup', is_default: false }),
];

const createMockStoreState = (overrides = {}) => ({
  templates: [],
  selectedTemplate: null,
  isLoadingTemplates: false,
  templateError: null,
  selectedMeetingType: 'custom' as const,
  setTemplates: vi.fn(),
  addTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  setSelectedTemplate: vi.fn(),
  setIsLoadingTemplates: vi.fn(),
  setTemplateError: vi.fn(),
  setSelectedMeetingType: vi.fn(),
  ...overrides,
});

describe('useTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default store mock
    mockUseAIStore.mockReturnValue(createMockStoreState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State and Store Integration', () => {
    it('should return initial state from store', () => {
      const mockStoreState = createMockStoreState({
        templates: createMockTemplates(),
        selectedTemplate: createMockTemplate(),
        isLoadingTemplates: true,
        templateError: 'Test error',
        selectedMeetingType: 'standup',
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useTemplates());

      expect(result.current.templates).toEqual(mockStoreState.templates);
      expect(result.current.selectedTemplate).toEqual(mockStoreState.selectedTemplate);
      expect(result.current.isLoadingTemplates).toBe(true);
      expect(result.current.templateError).toBe('Test error');
      expect(result.current.selectedMeetingType).toBe('standup');
    });

    it('should provide utility functions', () => {
      const { result } = renderHook(() => useTemplates());

      expect(typeof result.current.loadTemplates).toBe('function');
      expect(typeof result.current.loadTemplatesByType).toBe('function');
      expect(typeof result.current.getTemplate).toBe('function');
      expect(typeof result.current.createTemplate).toBe('function');
      expect(typeof result.current.updateTemplate).toBe('function');
      expect(typeof result.current.deleteTemplate).toBe('function');
      expect(typeof result.current.previewTemplate).toBe('function');
      expect(typeof result.current.testTemplate).toBe('function');
      expect(typeof result.current.exportTemplates).toBe('function');
      expect(typeof result.current.importTemplates).toBe('function');
      expect(typeof result.current.setSelectedTemplate).toBe('function');
      expect(typeof result.current.setSelectedMeetingType).toBe('function');
    });
  });

  describe('loadTemplates', () => {
    it('should load all templates successfully', async () => {
      const mockTemplates = createMockTemplates();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockTemplates);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        await result.current.loadTemplates();
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_all_templates');
      expect(mockStoreState.setIsLoadingTemplates).toHaveBeenCalledWith(true);
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(mockStoreState.setTemplates).toHaveBeenCalledWith(mockTemplates);
      expect(mockStoreState.setIsLoadingTemplates).toHaveBeenCalledWith(false);
    });

    it('should handle loading errors', async () => {
      const mockError = new Error('Database error');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.loadTemplates();
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Database error');
      expect(mockStoreState.setIsLoadingTemplates).toHaveBeenCalledWith(false);
    });

    it('should handle non-Error objects', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue('String error');

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.loadTemplates();
        } catch (error) {
          expect(error).toBe('String error');
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Failed to load templates');
    });
  });

  describe('loadTemplatesByType', () => {
    it('should load templates by type successfully', async () => {
      const mockTemplates = createMockTemplates().filter(t => t.meeting_type === 'standup');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockTemplates);

      const { result } = renderHook(() => useTemplates());

      let templates: SummaryTemplate[] | undefined;
      await act(async () => {
        templates = await result.current.loadTemplatesByType('standup');
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_templates_by_type', {
        meetingType: 'standup',
      });
      expect(mockStoreState.setIsLoadingTemplates).toHaveBeenCalledWith(true);
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(mockStoreState.setIsLoadingTemplates).toHaveBeenCalledWith(false);
      expect(templates).toEqual(mockTemplates);
    });

    it('should handle load by type errors', async () => {
      const mockError = new Error('Load failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.loadTemplatesByType('standup');
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Load failed');
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID successfully', async () => {
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useTemplates());

      let template: SummaryTemplate | null | undefined;
      await act(async () => {
        template = await result.current.getTemplate(1);
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_template', {
        templateId: 1,
      });
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(template).toEqual(mockTemplate);
    });

    it('should handle null template response', async () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(null);

      const { result } = renderHook(() => useTemplates());

      let template: SummaryTemplate | null | undefined;
      await act(async () => {
        template = await result.current.getTemplate(999);
      });

      expect(template).toBeNull();
    });

    it('should handle get template errors', async () => {
      const mockError = new Error('Template not found');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.getTemplate(1);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Template not found');
    });
  });

  describe('createTemplate', () => {
    it('should create template successfully', async () => {
      const templateId = 5;
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke
        .mockResolvedValueOnce(templateId) // create_template
        .mockResolvedValueOnce(createMockTemplates()); // get_all_templates (reload)

      const { result } = renderHook(() => useTemplates());

      const createOptions = {
        name: 'New Template',
        description: 'A new template',
        promptTemplate: 'Summarize this meeting...',
        meetingType: 'client' as const,
        isDefault: true,
      };

      let createdId: number | undefined;
      await act(async () => {
        createdId = await result.current.createTemplate(createOptions);
      });

      expect(mockInvoke).toHaveBeenCalledWith('create_template', {
        name: 'New Template',
        description: 'A new template',
        promptTemplate: 'Summarize this meeting...',
        meetingType: 'client',
        isDefault: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith('get_all_templates'); // Reload call
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(createdId).toBe(templateId);
    });

    it('should handle optional parameters', async () => {
      const templateId = 5;
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke
        .mockResolvedValueOnce(templateId)
        .mockResolvedValueOnce([]);

      const { result } = renderHook(() => useTemplates());

      const createOptions = {
        name: 'Simple Template',
        promptTemplate: 'Summarize this meeting...',
        meetingType: 'custom' as const,
      };

      await act(async () => {
        await result.current.createTemplate(createOptions);
      });

      expect(mockInvoke).toHaveBeenCalledWith('create_template', {
        name: 'Simple Template',
        description: undefined,
        promptTemplate: 'Summarize this meeting...',
        meetingType: 'custom',
        isDefault: false,
      });
    });

    it('should handle create template errors', async () => {
      const mockError = new Error('Creation failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      const createOptions = {
        name: 'New Template',
        promptTemplate: 'Summarize this meeting...',
        meetingType: 'custom' as const,
      };

      await act(async () => {
        try {
          await result.current.createTemplate(createOptions);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Creation failed');
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const mockTemplate = createMockTemplate({ name: 'Updated Template' });
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        await result.current.updateTemplate(mockTemplate);
      });

      expect(mockInvoke).toHaveBeenCalledWith('update_template', {
        template: mockTemplate,
      });
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(mockStoreState.updateTemplate).toHaveBeenCalledWith(mockTemplate);
    });

    it('should handle update template errors', async () => {
      const mockError = new Error('Update failed');
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.updateTemplate(mockTemplate);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Update failed');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const mockStoreState = createMockStoreState({
        selectedTemplate: null,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        await result.current.deleteTemplate(1);
      });

      expect(mockInvoke).toHaveBeenCalledWith('delete_template', {
        templateId: 1,
      });
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(mockStoreState.deleteTemplate).toHaveBeenCalledWith(1);
    });

    it('should clear selection when deleting selected template', async () => {
      const selectedTemplate = createMockTemplate({ id: 1 });
      const mockStoreState = createMockStoreState({
        selectedTemplate,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        await result.current.deleteTemplate(1);
      });

      expect(mockStoreState.deleteTemplate).toHaveBeenCalledWith(1);
      expect(mockStoreState.setSelectedTemplate).toHaveBeenCalledWith(null);
    });

    it('should not clear selection when deleting different template', async () => {
      const selectedTemplate = createMockTemplate({ id: 2 });
      const mockStoreState = createMockStoreState({
        selectedTemplate,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        await result.current.deleteTemplate(1);
      });

      expect(mockStoreState.deleteTemplate).toHaveBeenCalledWith(1);
      expect(mockStoreState.setSelectedTemplate).not.toHaveBeenCalled();
    });

    it('should handle delete template errors', async () => {
      const mockError = new Error('Delete failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.deleteTemplate(1);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Delete failed');
    });
  });

  describe('previewTemplate', () => {
    it('should preview template successfully', async () => {
      const mockPreview = {
        original: 'Hello {{meeting_title}}',
        processed: 'Hello Weekly Standup',
        variables: ['meeting_title'],
        context: { meeting_title: 'Weekly Standup' },
      };
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockPreview);

      const { result } = renderHook(() => useTemplates());

      const context = { meeting_title: 'Weekly Standup' };
      let preview: any;
      await act(async () => {
        preview = await result.current.previewTemplate(mockTemplate, context);
      });

      expect(mockInvoke).toHaveBeenCalledWith('preview_template', {
        template: mockTemplate,
        context,
      });
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(preview).toEqual(mockPreview);
    });

    it('should handle optional context parameter', async () => {
      const mockPreview = {
        original: 'Hello {{meeting_title}}',
        processed: 'Hello {{meeting_title}}',
        variables: ['meeting_title'],
        context: {},
      };
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockPreview);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        await result.current.previewTemplate(mockTemplate);
      });

      expect(mockInvoke).toHaveBeenCalledWith('preview_template', {
        template: mockTemplate,
        context: undefined,
      });
    });

    it('should handle preview template errors', async () => {
      const mockError = new Error('Preview failed');
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.previewTemplate(mockTemplate);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Preview failed');
    });
  });

  describe('testTemplate', () => {
    it('should test template successfully', async () => {
      const mockTestResult = {
        processed_template: 'Summarize this standup meeting with title "Weekly Standup"...',
        estimated_input_tokens: 2000,
        estimated_output_tokens: 300,
        estimated_cost_openai: 0.15,
        estimated_cost_claude: 0.12,
        estimated_time_ms: 2500,
      };
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockTestResult);

      const { result } = renderHook(() => useTemplates());

      const transcription = 'Sample transcription text';
      const context = { meeting_title: 'Weekly Standup' };
      let testResult: any;
      await act(async () => {
        testResult = await result.current.testTemplate(mockTemplate, transcription, context);
      });

      expect(mockInvoke).toHaveBeenCalledWith('test_template', {
        template: mockTemplate,
        transcription,
        context,
      });
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(testResult).toEqual(mockTestResult);
    });

    it('should handle test template errors', async () => {
      const mockError = new Error('Test failed');
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.testTemplate(mockTemplate, 'transcription', {});
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Test failed');
    });
  });

  describe('exportTemplates', () => {
    it('should export templates successfully', async () => {
      const mockExportData = JSON.stringify(createMockTemplates());
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(mockExportData);

      const { result } = renderHook(() => useTemplates());

      let exportData: string | undefined;
      await act(async () => {
        exportData = await result.current.exportTemplates();
      });

      expect(mockInvoke).toHaveBeenCalledWith('export_templates');
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(exportData).toBe(mockExportData);
    });

    it('should handle export templates errors', async () => {
      const mockError = new Error('Export failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      await act(async () => {
        try {
          await result.current.exportTemplates();
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Export failed');
    });
  });

  describe('importTemplates', () => {
    it('should import templates successfully', async () => {
      const mockImportResult = {
        imported: 3,
        failed: 1,
        errors: ['Template validation failed'],
      };
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke
        .mockResolvedValueOnce(mockImportResult) // import_templates
        .mockResolvedValueOnce(createMockTemplates()); // get_all_templates (reload)

      const { result } = renderHook(() => useTemplates());

      const jsonData = JSON.stringify(createMockTemplates());
      let importResult: any;
      await act(async () => {
        importResult = await result.current.importTemplates(jsonData);
      });

      expect(mockInvoke).toHaveBeenCalledWith('import_templates', {
        jsonData,
      });
      expect(mockInvoke).toHaveBeenCalledWith('get_all_templates'); // Reload call
      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith(null);
      expect(importResult).toEqual(mockImportResult);
    });

    it('should handle import templates errors', async () => {
      const mockError = new Error('Import failed');
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTemplates());

      const jsonData = '{"invalid": "data"}';
      await act(async () => {
        try {
          await result.current.importTemplates(jsonData);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(mockStoreState.setTemplateError).toHaveBeenCalledWith('Import failed');
    });
  });

  describe('Computed Properties', () => {
    it('should filter templates for current type correctly', () => {
      const mockTemplates = createMockTemplates();
      const mockStoreState = createMockStoreState({
        templates: mockTemplates,
        selectedMeetingType: 'standup',
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useTemplates());

      const expectedTemplates = mockTemplates.filter(t => t.meeting_type === 'standup');
      expect(result.current.templatesForCurrentType).toEqual(expectedTemplates);
      expect(result.current.templatesForCurrentType).toHaveLength(2);
    });

    it('should find default template for current type', () => {
      const mockTemplates = createMockTemplates();
      const mockStoreState = createMockStoreState({
        templates: mockTemplates,
        selectedMeetingType: 'standup',
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useTemplates());

      const expectedDefault = mockTemplates.find(
        t => t.meeting_type === 'standup' && t.is_default
      );
      expect(result.current.defaultTemplate).toEqual(expectedDefault);
    });

    it('should return undefined when no default template exists', () => {
      const mockTemplates = createMockTemplates().map(t => ({ ...t, is_default: false }));
      const mockStoreState = createMockStoreState({
        templates: mockTemplates,
        selectedMeetingType: 'standup',
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useTemplates());

      expect(result.current.defaultTemplate).toBeUndefined();
    });

    it('should calculate hasTemplates correctly', () => {
      const { result, rerender } = renderHook(() => useTemplates());

      // Initially no templates
      mockUseAIStore.mockReturnValue(createMockStoreState({
        templates: [],
      }));
      rerender();

      expect(result.current.hasTemplates).toBe(false);

      // Add templates
      mockUseAIStore.mockReturnValue(createMockStoreState({
        templates: createMockTemplates(),
      }));
      rerender();

      expect(result.current.hasTemplates).toBe(true);
    });

    it('should calculate hasTemplatesForType correctly', () => {
      const { result, rerender } = renderHook(() => useTemplates());

      // No templates for selected type
      mockUseAIStore.mockReturnValue(createMockStoreState({
        templates: createMockTemplates(),
        selectedMeetingType: 'all_hands',
      }));
      rerender();

      expect(result.current.hasTemplatesForType).toBe(false);

      // Has templates for selected type
      mockUseAIStore.mockReturnValue(createMockStoreState({
        templates: createMockTemplates(),
        selectedMeetingType: 'standup',
      }));
      rerender();

      expect(result.current.hasTemplatesForType).toBe(true);
    });
  });

  describe('Auto-loading Effect', () => {
    it('should load templates on mount when none exist', async () => {
      const mockStoreState = createMockStoreState({
        templates: [],
        isLoadingTemplates: false,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);
      mockInvoke.mockResolvedValue(createMockTemplates());

      renderHook(() => useTemplates());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_all_templates');
      });
    });

    it('should not load templates when already exist', () => {
      const mockStoreState = createMockStoreState({
        templates: createMockTemplates(),
        isLoadingTemplates: false,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      renderHook(() => useTemplates());

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should not load templates when already loading', () => {
      const mockStoreState = createMockStoreState({
        templates: [],
        isLoadingTemplates: true,
      });
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      renderHook(() => useTemplates());

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Store Action Forwarding', () => {
    it('should forward setSelectedTemplate calls', () => {
      const mockTemplate = createMockTemplate();
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useTemplates());

      act(() => {
        result.current.setSelectedTemplate(mockTemplate);
      });

      expect(mockStoreState.setSelectedTemplate).toHaveBeenCalledWith(mockTemplate);
    });

    it('should forward setSelectedMeetingType calls', () => {
      const mockStoreState = createMockStoreState();
      
      mockUseAIStore.mockReturnValue(mockStoreState);

      const { result } = renderHook(() => useTemplates());

      act(() => {
        result.current.setSelectedMeetingType('client');
      });

      expect(mockStoreState.setSelectedMeetingType).toHaveBeenCalledWith('client');
    });
  });
});