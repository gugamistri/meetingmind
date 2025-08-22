import React, { useState } from 'react';
import { Copy, Download, RefreshCw, Clock, DollarSign, Zap } from 'lucide-react';
import { SummaryResult, TemplateContext } from '../../../stores/ai.store';
import { useSummarization, useTemplates, useCostTracking } from '../../../hooks/ai';
import { Button } from '../../common/Button';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface SummaryViewProps {
  summary: SummaryResult;
  meetingId: string;
  onRegenerate?: (summary: SummaryResult) => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  meetingId,
  onRegenerate
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const { regenerateSummary } = useSummarization();
  const { templates, templatesForCurrentType } = useTemplates();
  const { formatCurrency } = useCostTracking();

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summary.content);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([summary.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting-summary-${summary.meeting_id}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = async () => {
    if (!selectedTemplateId) return;

    try {
      setIsRegenerating(true);
      
      // Create basic context from summary metadata
      const context: TemplateContext = {
        meeting_date: new Date(summary.created_at).toISOString().split('T')[0],
        transcription_length: summary.token_count,
      };

      const newSummary = await regenerateSummary({
        meetingId,
        newTemplateId: selectedTemplateId,
        context,
      });

      setShowRegenerateOptions(false);
      setSelectedTemplateId(null);
      onRegenerate?.(newSummary);
    } catch (error) {
      console.error('Failed to regenerate summary:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatProcessingTime = (timeMs: number) => {
    if (timeMs < 1000) {
      return `${timeMs}ms`;
    }
    return `${(timeMs / 1000).toFixed(1)}s`;
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'bg-green-100 text-green-800';
      case 'claude':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Meeting Summary</h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getProviderBadgeColor(summary.provider)}`}>
            {summary.provider.toUpperCase()}
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyToClipboard}
            className="flex items-center gap-1"
          >
            <Copy className="w-4 h-4" />
            Copy
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowRegenerateOptions(!showRegenerateOptions)}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Summary Content */}
      <div className="mb-6">
        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {summary.content}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="border-t border-gray-200 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{formatProcessingTime(summary.processing_time_ms)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign className="w-4 h-4" />
            <span>{formatCurrency(summary.cost_usd)}</span>
          </div>
          
          {summary.token_count && (
            <div className="flex items-center gap-2 text-gray-600">
              <Zap className="w-4 h-4" />
              <span>{summary.token_count.toLocaleString()} tokens</span>
            </div>
          )}
          
          <div className="text-gray-500">
            {formatTimestamp(summary.created_at)}
          </div>
        </div>
      </div>

      {/* Regenerate Options */}
      {showRegenerateOptions && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Regenerate with different template
          </h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Template
              </label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(Number(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.meeting_type})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleRegenerate}
                disabled={!selectedTemplateId || isRegenerating}
                className="flex items-center gap-1"
              >
                {isRegenerating ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </>
                )}
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowRegenerateOptions(false);
                  setSelectedTemplateId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};