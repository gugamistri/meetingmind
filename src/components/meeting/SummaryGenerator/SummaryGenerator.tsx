import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Card } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface SummaryTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  estimatedTokens: number;
  icon: string;
}

interface SummaryProvider {
  id: string;
  name: string;
  models: string[];
  costPerToken: number;
  isAvailable: boolean;
  requiresApiKey: boolean;
}

interface GeneratedSummary {
  id: string;
  meetingId: string;
  templateId: string;
  templateName: string;
  content: string;
  modelUsed: string;
  provider: string;
  tokenCount: number;
  costUsd: number;
  processingTimeMs: number;
  confidenceScore?: number;
  createdAt: string;
}

interface SummaryGeneratorProps {
  meetingId: number;
  onSummaryGenerated?: (summary: GeneratedSummary) => void;
  existingSummaries?: GeneratedSummary[];
  transcriptionContent?: string;
}

const SUMMARY_TEMPLATES: SummaryTemplate[] = [
  {
    id: 'standup',
    name: 'Daily Standup',
    description: 'Focus on what was done, what will be done, and any blockers',
    systemPrompt: 'Summarize this standup meeting focusing on: 1) What each person accomplished, 2) What they plan to work on next, 3) Any blockers or issues mentioned, 4) Action items and decisions made.',
    estimatedTokens: 200,
    icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    id: 'client',
    name: 'Client Meeting',
    description: 'Professional summary with key decisions, next steps, and deliverables',
    systemPrompt: 'Create a professional client meeting summary including: 1) Meeting purpose and agenda items covered, 2) Key decisions made, 3) Client feedback and concerns, 4) Agreed deliverables and timelines, 5) Next steps and follow-up actions.',
    estimatedTokens: 300,
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorming Session',
    description: 'Capture ideas, creative solutions, and innovation concepts',
    systemPrompt: 'Summarize this brainstorming session by organizing: 1) Main ideas and concepts discussed, 2) Creative solutions proposed, 3) Pros and cons of different approaches, 4) Decisions on which ideas to pursue, 5) Action items for implementation.',
    estimatedTokens: 250,
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  {
    id: 'project',
    name: 'Project Review',
    description: 'Status updates, milestones, risks, and resource allocation',
    systemPrompt: 'Create a project review summary covering: 1) Current project status and milestone progress, 2) Key achievements and deliverables completed, 3) Risks, issues, and mitigation strategies, 4) Resource allocation and team updates, 5) Timeline adjustments and next milestones.',
    estimatedTokens: 350,
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    id: 'custom',
    name: 'Custom Template',
    description: 'Define your own summary structure and focus areas',
    systemPrompt: '',
    estimatedTokens: 200,
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
];

const AI_PROVIDERS: SummaryProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    costPerToken: 0.00003, // Approximate cost per token for GPT-4
    isAvailable: true,
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    models: ['claude-3-sonnet', 'claude-3-haiku', 'claude-2'],
    costPerToken: 0.000015, // Approximate cost per token for Claude-3
    isAvailable: true,
    requiresApiKey: true,
  },
  {
    id: 'local',
    name: 'Local AI (Ollama)',
    models: ['llama2', 'mistral', 'codellama'],
    costPerToken: 0,
    isAvailable: false, // Would be dynamically checked
    requiresApiKey: false,
  },
];

// Template selector component
const TemplateSelector: React.FC<{
  selectedTemplate: SummaryTemplate | null;
  onSelect: (template: SummaryTemplate) => void;
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
}> = ({ selectedTemplate, onSelect, customPrompt, onCustomPromptChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Choose Summary Template
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUMMARY_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className={`p-4 text-left border-2 rounded-lg transition-all hover:border-emerald-300 ${
                selectedTemplate?.id === template.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-lg ${
                  selectedTemplate?.id === template.id ? 'bg-emerald-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-5 h-5 ${
                    selectedTemplate?.id === template.id ? 'text-emerald-600' : 'text-gray-600'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={template.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    ~{template.estimatedTokens} tokens
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedTemplate?.id === 'custom' && (
        <div>
          <label htmlFor="custom-prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Custom Instructions
          </label>
          <textarea
            id="custom-prompt"
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Describe what you want to focus on in the summary..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Be specific about what information you want extracted and how it should be structured.
          </p>
        </div>
      )}
    </div>
  );
};

// Provider and model selector
const ProviderSelector: React.FC<{
  selectedProvider: SummaryProvider | null;
  selectedModel: string;
  onProviderSelect: (provider: SummaryProvider) => void;
  onModelSelect: (model: string) => void;
}> = ({ selectedProvider, selectedModel, onProviderSelect, onModelSelect }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          AI Provider
        </label>
        <div className="space-y-2">
          {AI_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => onProviderSelect(provider)}
              disabled={!provider.isAvailable}
              className={`w-full p-3 text-left border rounded-lg transition-all ${
                !provider.isAvailable
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : selectedProvider?.id === provider.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{provider.name}</h4>
                  <p className="text-sm text-gray-600">
                    {provider.costPerToken === 0 
                      ? 'Free (runs locally)' 
                      : `~$${(provider.costPerToken * 1000).toFixed(3)} per 1K tokens`
                    }
                  </p>
                </div>
                {!provider.isAvailable && (
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    Not Available
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedProvider && (
        <div>
          <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-2">
            Model
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => onModelSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {selectedProvider.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

// Cost estimation component
const CostEstimation: React.FC<{
  template: SummaryTemplate | null;
  provider: SummaryProvider | null;
  transcriptionLength: number;
}> = ({ template, provider, transcriptionLength }) => {
  if (!template || !provider) return null;

  const estimatedInputTokens = Math.ceil(transcriptionLength / 4); // Rough estimate: 4 chars per token
  const estimatedOutputTokens = template.estimatedTokens;
  const totalTokens = estimatedInputTokens + estimatedOutputTokens;
  const estimatedCost = totalTokens * provider.costPerToken;

  return (
    <Card>
      <div className="p-4 bg-blue-50">
        <h4 className="font-medium text-blue-900 mb-3">Cost Estimation</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Input tokens (transcription):</span>
            <span className="font-medium">{estimatedInputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Output tokens (summary):</span>
            <span className="font-medium">{estimatedOutputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-blue-200 pt-2">
            <span className="font-medium text-blue-900">Total estimated cost:</span>
            <span className="font-bold text-blue-900">
              {provider.costPerToken === 0 ? 'Free' : `$${estimatedCost.toFixed(4)}`}
            </span>
          </div>
        </div>
        
        {provider.requiresApiKey && (
          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
            💡 Tip: Actual cost may vary based on final token usage. You'll be charged by {provider.name}.
          </div>
        )}
      </div>
    </Card>
  );
};

// Main SummaryGenerator component
export const SummaryGenerator: React.FC<SummaryGeneratorProps> = ({
  meetingId,
  onSummaryGenerated,
  existingSummaries = [],
  transcriptionContent = '',
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<SummaryTemplate | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<SummaryProvider | null>(AI_PROVIDERS[0]);
  const [selectedModel, setSelectedModel] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected model when provider changes
  useEffect(() => {
    if (selectedProvider && selectedProvider.models.length > 0) {
      setSelectedModel(selectedProvider.models[0]);
    }
  }, [selectedProvider]);

  const handleGenerateSummary = useCallback(async () => {
    if (!selectedTemplate || !selectedProvider || !selectedModel) return;

    const prompt = selectedTemplate.id === 'custom' ? customPrompt : selectedTemplate.systemPrompt;
    if (!prompt.trim()) {
      setError('Please provide instructions for the summary');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const summary = await invoke<GeneratedSummary>('generate_meeting_summary', {
        meetingId: meetingId.toString(),
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        systemPrompt: prompt,
        provider: selectedProvider.id,
        model: selectedModel,
        transcriptionContent,
      });

      setGeneratedSummary(summary);
      onSummaryGenerated?.(summary);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedTemplate,
    selectedProvider,
    selectedModel,
    customPrompt,
    meetingId,
    transcriptionContent,
    onSummaryGenerated,
  ]);

  const handleRegenerateSummary = useCallback(() => {
    setGeneratedSummary(null);
    setError(null);
  }, []);

  const canGenerate = selectedTemplate && selectedProvider && selectedModel && 
    (selectedTemplate.id !== 'custom' || customPrompt.trim());

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {generatedSummary ? (
        // Display generated summary
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Generated Summary</h3>
            <button
              onClick={handleRegenerateSummary}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Generate New Summary
            </button>
          </div>
          
          <Card>
            <div className="p-6">
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{generatedSummary.templateName}</h4>
                  <span className="text-xs text-gray-500">
                    {new Date(generatedSummary.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Model: {generatedSummary.modelUsed}</span>
                  <span>Provider: {generatedSummary.provider}</span>
                  <span>Tokens: {generatedSummary.tokenCount.toLocaleString()}</span>
                  {generatedSummary.costUsd > 0 && (
                    <span>Cost: ${generatedSummary.costUsd.toFixed(4)}</span>
                  )}
                  <span>Time: {(generatedSummary.processingTimeMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
              
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-900">
                  {generatedSummary.content}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        // Summary generation form
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Generate AI Summary</h3>
            <p className="text-sm text-gray-600">
              Create an intelligent summary of your meeting using AI. Choose a template and provider to get started.
            </p>
          </div>

          <TemplateSelector
            selectedTemplate={selectedTemplate}
            onSelect={setSelectedTemplate}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />

          <ProviderSelector
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onProviderSelect={setSelectedProvider}
            onModelSelect={setSelectedModel}
          />

          {selectedTemplate && selectedProvider && (
            <CostEstimation
              template={selectedTemplate}
              provider={selectedProvider}
              transcriptionLength={transcriptionContent.length}
            />
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {existingSummaries.length > 0 && (
                <span>{existingSummaries.length} existing summaries</span>
              )}
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={!canGenerate || isGenerating}
              className="px-6 py-3 font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isGenerating && <LoadingSpinner size="sm" className="mr-2" />}
              {isGenerating ? 'Generating Summary...' : 'Generate Summary'}
            </button>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <div className="p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-amber-800">Privacy Notice</h4>
              <p className="text-sm text-amber-700 mt-1">
                {selectedProvider?.id === 'local' 
                  ? 'Your meeting data will be processed locally on your device. No data is sent to external services.'
                  : `Your meeting transcription will be sent to ${selectedProvider?.name} for summary generation. Please ensure this complies with your data privacy requirements.`
                }
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SummaryGenerator;