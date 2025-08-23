import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ExportFormat, ExportOptions, ExportResult } from '@/types/transcription.types';
import { DetailedMeeting } from '@/types/meeting.types';
import { Card } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface ExportManagerProps {
  meeting: DetailedMeeting;
  isOpen: boolean;
  onClose: () => void;
}

interface ExportProgress {
  isExporting: boolean;
  currentStep?: string;
  progress?: number;
}

const formatOptions = [
  {
    format: ExportFormat.Markdown,
    label: 'Markdown',
    description: 'Plain text with markdown formatting',
    icon: 'M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z'
  },
  {
    format: ExportFormat.PDF,
    label: 'PDF',
    description: 'Formatted document for sharing',
    icon: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z'
  },
  {
    format: ExportFormat.DOCX,
    label: 'Word Document',
    description: 'Microsoft Word compatible format',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z'
  },
  {
    format: ExportFormat.JSON,
    label: 'JSON',
    description: 'Machine-readable data format',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'
  },
  {
    format: ExportFormat.TXT,
    label: 'Plain Text',
    description: 'Simple text format',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  }
];

const ExportManager: React.FC<ExportManagerProps> = ({
  meeting,
  isOpen,
  onClose
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.Markdown);
  const [exportOptions, setExportOptions] = useState<Partial<ExportOptions>>({
    includeTimestamps: true,
    includeSpeakers: true,
    includeConfidenceScores: false,
    includeMetadata: true,
    dateFormat: 'YYYY-MM-DD HH:mm:ss'
  });
  const [progress, setProgress] = useState<ExportProgress>({ isExporting: false });
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (progress.isExporting) return;

    setProgress({ isExporting: true, currentStep: 'Preparing export...', progress: 0 });
    setError(null);
    setExportResult(null);

    try {
      const options: ExportOptions = {
        format: selectedFormat,
        ...exportOptions
      } as ExportOptions;

      setProgress({ isExporting: true, currentStep: 'Generating export file...', progress: 50 });

      const result = await invoke<ExportResult>('export_meeting', {
        meetingId: meeting.id,
        options
      });

      setProgress({ isExporting: true, currentStep: 'Export complete!', progress: 100 });
      setExportResult(result);

      // Auto-clear progress after showing success
      setTimeout(() => {
        setProgress({ isExporting: false });
      }, 1500);

    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setProgress({ isExporting: false });
    }
  }, [meeting.id, selectedFormat, exportOptions, progress.isExporting]);

  const handleDownload = useCallback(async () => {
    if (!exportResult) return;

    try {
      // Use Tauri's shell API to open file location or download
      if (exportResult.downloadUrl) {
        window.open(exportResult.downloadUrl, '_blank');
      } else {
        // Open file location
        await invoke('show_in_folder', { path: exportResult.filePath });
      }
    } catch (err) {
      console.error('Failed to open export file:', err);
      setError('Failed to open export file');
    }
  }, [exportResult]);

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Export Meeting</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={progress.isExporting}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Meeting info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-1">{meeting.title}</h3>
            <p className="text-sm text-gray-600">
              {new Date(meeting.startTime).toLocaleDateString()} • 
              {meeting.participants?.length || 0} participant{meeting.participants?.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Format selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="space-y-2">
              {formatOptions.map((option) => (
                <label
                  key={option.format}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFormat === option.format
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={option.format}
                    checked={selectedFormat === option.format}
                    onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                    className="mt-1 mr-3"
                    disabled={progress.isExporting}
                  />
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                      </svg>
                      <span className="font-medium text-gray-900">{option.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Export options */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Options
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeTimestamps}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    includeTimestamps: e.target.checked
                  }))}
                  className="mr-3"
                  disabled={progress.isExporting}
                />
                <span className="text-sm text-gray-700">Include timestamps</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSpeakers}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    includeSpeakers: e.target.checked
                  }))}
                  className="mr-3"
                  disabled={progress.isExporting}
                />
                <span className="text-sm text-gray-700">Include speaker identification</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeConfidenceScores}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    includeConfidenceScores: e.target.checked
                  }))}
                  className="mr-3"
                  disabled={progress.isExporting}
                />
                <span className="text-sm text-gray-700">Include confidence scores</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    includeMetadata: e.target.checked
                  }))}
                  className="mr-3"
                  disabled={progress.isExporting}
                />
                <span className="text-sm text-gray-700">Include meeting metadata</span>
              </label>
            </div>
          </div>

          {/* Progress display */}
          {progress.isExporting && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center mb-2">
                <LoadingSpinner className="mr-2" />
                <span className="text-sm font-medium text-blue-900">
                  {progress.currentStep}
                </span>
              </div>
              {progress.progress !== undefined && (
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Success display */}
          {exportResult && !progress.isExporting && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 mb-1">
                    Export completed successfully
                  </p>
                  <p className="text-sm text-green-700">
                    File size: {formatFileSize(exportResult.sizeBytes)}
                  </p>
                  {exportResult.expiresAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Expires: {new Date(exportResult.expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 mb-1">Export failed</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-3">
            {exportResult ? (
              <>
                <button
                  onClick={handleDownload}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  Open File
                </button>
                <button
                  onClick={() => {
                    setExportResult(null);
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  Export Another
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleExport}
                  disabled={progress.isExporting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {progress.isExporting ? 'Exporting...' : 'Start Export'}
                </button>
                <button
                  onClick={onClose}
                  disabled={progress.isExporting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ExportManager;