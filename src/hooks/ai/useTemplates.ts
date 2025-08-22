import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useAIStore, SummaryTemplate, TemplateContext } from '../../stores/ai.store';

interface CreateTemplateOptions {
  name: string;
  description?: string;
  promptTemplate: string;
  meetingType: 'standup' | 'client' | 'brainstorm' | 'all_hands' | 'custom';
  isDefault?: boolean;
}

interface TemplatePreview {
  original: string;
  processed: string;
  variables: string[];
  context: TemplateContext;
}

interface TemplateTestResult {
  processed_template: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_openai: number;
  estimated_cost_claude: number;
  estimated_time_ms: number;
}

interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

export const useTemplates = () => {
  const {
    templates,
    selectedTemplate,
    isLoadingTemplates,
    templateError,
    selectedMeetingType,
    setTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setSelectedTemplate,
    setIsLoadingTemplates,
    setTemplateError,
    setSelectedMeetingType,
  } = useAIStore();

  // Load all templates
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      setTemplateError(null);

      const allTemplates = await invoke<SummaryTemplate[]>('get_all_templates');
      setTemplates(allTemplates);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load templates';
      setTemplateError(errorMessage);
      throw error;
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [setIsLoadingTemplates, setTemplateError, setTemplates]);

  // Load templates by type
  const loadTemplatesByType = useCallback(async (meetingType: string) => {
    try {
      setIsLoadingTemplates(true);
      setTemplateError(null);

      const typeTemplates = await invoke<SummaryTemplate[]>('get_templates_by_type', {
        meetingType,
      });

      return typeTemplates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load templates by type';
      setTemplateError(errorMessage);
      throw error;
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [setIsLoadingTemplates, setTemplateError]);

  // Get template by ID
  const getTemplate = useCallback(async (templateId: number): Promise<SummaryTemplate | null> => {
    try {
      setTemplateError(null);
      const template = await invoke<SummaryTemplate | null>('get_template', {
        templateId,
      });

      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get template';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError]);

  // Create new template
  const createTemplate = useCallback(async (options: CreateTemplateOptions): Promise<number> => {
    try {
      setTemplateError(null);

      const templateId = await invoke<number>('create_template', {
        name: options.name,
        description: options.description,
        promptTemplate: options.promptTemplate,
        meetingType: options.meetingType,
        isDefault: options.isDefault || false,
      });

      // Reload templates to get the new one
      await loadTemplates();

      return templateId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError, loadTemplates]);

  // Update template
  const updateTemplateData = useCallback(async (template: SummaryTemplate): Promise<void> => {
    try {
      setTemplateError(null);

      await invoke('update_template', {
        template,
      });

      updateTemplate(template);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update template';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError, updateTemplate]);

  // Delete template
  const deleteTemplateData = useCallback(async (templateId: number): Promise<void> => {
    try {
      setTemplateError(null);

      await invoke('delete_template', {
        templateId,
      });

      deleteTemplate(templateId);

      // Clear selection if the deleted template was selected
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete template';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError, deleteTemplate, selectedTemplate, setSelectedTemplate]);

  // Preview template
  const previewTemplate = useCallback(async (
    template: SummaryTemplate,
    context?: TemplateContext
  ): Promise<TemplatePreview> => {
    try {
      setTemplateError(null);

      const preview = await invoke<TemplatePreview>('preview_template', {
        template,
        context,
      });

      return preview;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preview template';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError]);

  // Test template
  const testTemplate = useCallback(async (
    template: SummaryTemplate,
    transcription: string,
    context: TemplateContext
  ): Promise<TemplateTestResult> => {
    try {
      setTemplateError(null);

      const result = await invoke<TemplateTestResult>('test_template', {
        template,
        transcription,
        context,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test template';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError]);

  // Export templates
  const exportTemplates = useCallback(async (): Promise<string> => {
    try {
      setTemplateError(null);

      const exportData = await invoke<string>('export_templates');
      return exportData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export templates';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError]);

  // Import templates
  const importTemplates = useCallback(async (jsonData: string): Promise<ImportResult> => {
    try {
      setTemplateError(null);

      const result = await invoke<ImportResult>('import_templates', {
        jsonData,
      });

      // Reload templates after import
      await loadTemplates();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import templates';
      setTemplateError(errorMessage);
      throw error;
    }
  }, [setTemplateError, loadTemplates]);

  // Get templates for current meeting type
  const templatesForCurrentType = templates.filter(
    t => t.meeting_type === selectedMeetingType
  );

  // Get default template for current meeting type
  const defaultTemplate = templatesForCurrentType.find(t => t.is_default);

  // Load templates on component mount
  useEffect(() => {
    if (templates.length === 0 && !isLoadingTemplates) {
      loadTemplates();
    }
  }, [templates.length, isLoadingTemplates, loadTemplates]);

  return {
    // State
    templates,
    selectedTemplate,
    isLoadingTemplates,
    templateError,
    selectedMeetingType,

    // Computed
    templatesForCurrentType,
    defaultTemplate,

    // Actions
    loadTemplates,
    loadTemplatesByType,
    getTemplate,
    createTemplate,
    updateTemplate: updateTemplateData,
    deleteTemplate: deleteTemplateData,
    previewTemplate,
    testTemplate,
    exportTemplates,
    importTemplates,
    setSelectedTemplate,
    setSelectedMeetingType,

    // Utilities
    hasTemplates: templates.length > 0,
    hasTemplatesForType: templatesForCurrentType.length > 0,
  };
};