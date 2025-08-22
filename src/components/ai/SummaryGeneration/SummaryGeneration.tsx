import React, { useState, useEffect } from 'react';
import { Play, DollarSign, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { SummaryResult, TemplateContext } from '../../../stores/ai.store';
import { useSummarization, useTemplates, useCostTracking } from '../../../hooks/ai';
import { Button } from '../../common/Button';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface SummaryGenerationProps {
  meetingId: string;
  transcriptionText: string;
  onSummaryGenerated?: (summary: SummaryResult) => void;
  onTaskStarted?: (taskId: string) => void;
}

export const SummaryGeneration: React.FC<SummaryGenerationProps> = ({
  meetingId,
  transcriptionText,
  onSummaryGenerated,
  onTaskStarted
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedMeetingType, setSelectedMeetingType] = useState<string>('custom');
  const [generateAsync, setGenerateAsync] = useState(true);
  const [context, setContext] = useState<TemplateContext>({});

  const { generateSummary, isGeneratingSummary, summaryError } = useSummarization();
  const { 
    templates, 
    loadTemplatesByType, 
    templatesForCurrentType, 
    defaultTemplate,
    setSelectedMeetingType 
  } = useTemplates();
  const { estimateCost, costEstimate, formatCurrency, budgetStatus } = useCostTracking();

  // Load templates for selected meeting type
  useEffect(() => {
    setSelectedMeetingType(selectedMeetingType as any);
    loadTemplatesByType(selectedMeetingType);
  }, [selectedMeetingType, setSelectedMeetingType, loadTemplatesByType]);

  // Auto-select default template when meeting type changes
  useEffect(() => {
    if (defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [defaultTemplate, selectedTemplateId]);

  // Get cost estimate when template changes
  useEffect(() => {
    if (selectedTemplateId && transcriptionText) {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      if (selectedTemplate) {
        estimateCost(transcriptionText, selectedTemplate.prompt_template);
      }
    }
  }, [selectedTemplateId, transcriptionText, templates, estimateCost]);

  const handleGenerate = async () => {
    try {
      const result = await generateSummary({
        meetingId,
        templateId: selectedTemplateId || undefined,
        meetingType: selectedMeetingType,
        context: Object.keys(context).length > 0 ? context : undefined,
        synchronous: !generateAsync,
      });

      if (typeof result === 'string') {
        // Async generation - return task ID
        onTaskStarted?.(result);
      } else {
        // Sync generation - return summary
        onSummaryGenerated?.(result);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const canGenerate = selectedTemplateId && transcriptionText.length > 0;
  const isOverBudget = budgetStatus?.isOverBudget || false;
  const showBudgetWarning = budgetStatus?.warningLevel === 'Warning' || budgetStatus?.warningLevel === 'Critical';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Summary</h3>

      {/* Meeting Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Meeting Type
        </label>
        <select
          value={selectedMeetingType}
          onChange={(e) => setSelectedMeetingType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="standup">Daily Standup</option>
          <option value="client">Client Meeting</option>
          <option value="brainstorm">Brainstorming Session</option>
          <option value="all_hands">All-Hands Meeting</option>
          <option value="custom">General Meeting</option>
        </select>
      </div>

      {/* Template Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Summary Template
        </label>
        <select
          value={selectedTemplateId || ''}
          onChange={(e) => setSelectedTemplateId(Number(e.target.value) || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="">Choose a template...</option>
          {templatesForCurrentType.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} {template.is_default && '(Default)'}
            </option>
          ))}
        </select>
        
        {selectedTemplate && selectedTemplate.description && (
          <p className="text-sm text-gray-600 mt-1">
            {selectedTemplate.description}
          </p>
        )}
      </div>

      {/* Processing Options */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={generateAsync}
            onChange={(e) => setGenerateAsync(e.target.checked)}
            className="mr-2 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-700">
            Generate in background (allows you to continue working)
          </span>
        </label>
      </div>

      {/* Cost Estimate */}
      {costEstimate && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Estimated Cost:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(costEstimate.estimated_cost)}
            </span>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-600">
              {costEstimate.estimated_input_tokens.toLocaleString()} input + {costEstimate.estimated_output_tokens.toLocaleString()} output tokens
            </span>
            <span className="text-xs text-gray-600">
              via {costEstimate.provider.toUpperCase()}
            </span>
          </div>

          {!costEstimate.can_afford && (
            <div className="flex items-center gap-1 mt-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Exceeds budget limits</span>
            </div>
          )}
        </div>
      )}

      {/* Budget Warning */}
      {showBudgetWarning && (
        <div className={`mb-4 p-3 rounded-md ${isOverBudget ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${isOverBudget ? 'text-red-600' : 'text-yellow-600'}`} />
            <span className={`text-sm font-medium ${isOverBudget ? 'text-red-800' : 'text-yellow-800'}`}>
              {isOverBudget ? 'Budget Exceeded' : 'Budget Warning'}
            </span>
          </div>
          <p className={`text-xs mt-1 ${isOverBudget ? 'text-red-700' : 'text-yellow-700'}`}>
            {isOverBudget 
              ? 'You have exceeded your daily or monthly budget limits.'
              : 'You are approaching your budget limits for AI operations.'
            }
          </p>
        </div>
      )}

      {/* Error Display */}
      {summaryError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Error</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{summaryError}</p>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {transcriptionText.length > 0 && (
            <span>{transcriptionText.length.toLocaleString()} characters to summarize</span>
          )}
        </div>
        
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={!canGenerate || isGeneratingSummary || (isOverBudget && costEstimate && !costEstimate.can_afford)}
          className="flex items-center gap-2"
        >
          {isGeneratingSummary ? (
            <>
              <LoadingSpinner size="sm" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate Summary
            </>
          )}
        </Button>
      </div>

      {/* Context Fields (Advanced) */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          Advanced Options
        </summary>
        
        <div className="mt-3 space-y-3 pl-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Meeting Title
              </label>
              <input
                type="text"
                value={context.meeting_title || ''}
                onChange={(e) => setContext(prev => ({ ...prev, meeting_title: e.target.value }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g., Weekly Team Sync"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Duration
              </label>
              <input
                type="text"
                value={context.meeting_duration || ''}
                onChange={(e) => setContext(prev => ({ ...prev, meeting_duration: e.target.value }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g., 30 minutes"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Participants
            </label>
            <input
              type="text"
              value={context.participants || ''}
              onChange={(e) => setContext(prev => ({ ...prev, participants: e.target.value }))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g., Alice, Bob, Charlie"
            />
          </div>
        </div>
      </details>
    </div>
  );
};