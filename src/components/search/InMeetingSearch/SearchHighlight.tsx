import React from 'react';
import { InMeetingMatch } from '@/types/search.types';

interface SearchHighlightProps {
  match: InMeetingMatch;
  query: string;
  onClick?: () => void;
  maxLength?: number;
  contextBefore?: number;
  contextAfter?: number;
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({
  match,
  query,
  onClick,
  maxLength = 200,
  contextBefore = 50,
  contextAfter = 50
}) => {
  const highlightText = (text: string, searchQuery: string): React.ReactNode => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 text-yellow-900 px-1 rounded font-medium"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const getContextSnippet = (): string => {
    const { content, position } = match;
    const start = Math.max(0, position - contextBefore);
    const end = Math.min(content.length, position + query.length + contextAfter);
    
    let snippet = content.slice(start, end);
    
    // Add ellipsis if we're not at the beginning/end
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    // Truncate if still too long
    if (snippet.length > maxLength) {
      snippet = snippet.slice(0, maxLength) + '...';
    }
    
    return snippet;
  };

  const formatTimestamp = (timestamp: number): string => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = timestamp % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const snippet = getContextSnippet();

  return (
    <div
      className={`p-3 rounded-lg border border-gray-200 bg-gray-50 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-300' : ''
      }`}
      onClick={onClick}
    >
      {/* Match metadata */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium">
            {match.speaker || 'Unknown Speaker'}
          </span>
          {match.timestamp !== undefined && (
            <>
              <span>•</span>
              <span>{formatTimestamp(match.timestamp)}</span>
            </>
          )}
          {match.segment_id !== undefined && (
            <>
              <span>•</span>
              <span>Segment #{match.segment_id}</span>
            </>
          )}
        </div>
        
        {match.confidence !== undefined && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Match confidence:</span>
            <span className={`font-medium ${
              match.confidence > 0.8 ? 'text-green-600' :
              match.confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.round(match.confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Highlighted content snippet */}
      <div className="text-sm text-gray-700 leading-relaxed">
        {highlightText(snippet, query)}
      </div>

      {/* Match type indicator */}
      {match.match_type && (
        <div className="mt-2 text-xs text-gray-400">
          Match type: {match.match_type}
        </div>
      )}
    </div>
  );
};