import React, { useState, useEffect } from 'react';
import { BookmarkIcon, TrashIcon, PencilIcon, ClockIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { SavedSearch, SearchQuery } from '@/types/search.types';
import { searchService } from '@/services/search.service';
import { SearchHistory } from './SearchHistory';

interface SavedSearchesProps {
  savedSearches: SavedSearch[];
  onSearchLoad: (search: SavedSearch) => void;
  onSearchDelete: (searchId: string) => void;
  onSearchSave: (name: string, query: SearchQuery) => void;
  currentQuery?: SearchQuery | null;
  className?: string;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  savedSearches,
  onSearchLoad,
  onSearchDelete,
  onSearchSave,
  currentQuery,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');

  const handleSaveCurrentSearch = () => {
    if (!currentQuery || !saveName.trim()) return;
    
    onSearchSave(saveName.trim(), currentQuery);
    setSaveName('');
    setShowSaveDialog(false);
  };

  const handleEditStart = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditName(search.name);
  };

  const handleEditSave = async (searchId: string) => {
    if (!editName.trim()) return;
    
    try {
      await searchService.updateSavedSearch(searchId, editName.trim());
      setEditingId(null);
      setEditName('');
      // Refresh the list - this would typically be handled by the parent component
    } catch (error) {
      console.error('Failed to update saved search:', error);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const formatSearchQuery = (query: SearchQuery): string => {
    const parts: string[] = [];
    
    if (query.query) {
      parts.push(`"${query.query}"`);
    }
    
    if (query.filters.participants && query.filters.participants.length > 0) {
      parts.push(`participants: ${query.filters.participants.join(', ')}`);
    }
    
    if (query.filters.tags && query.filters.tags.length > 0) {
      parts.push(`tags: ${query.filters.tags.join(', ')}`);
    }
    
    if (query.filters.date_start) {
      const date = new Date(query.filters.date_start).toLocaleDateString();
      parts.push(`from: ${date}`);
    }
    
    return parts.join(' • ') || 'Empty search';
  };

  const canSaveCurrentSearch = currentQuery && (currentQuery.query.trim() || 
    Object.values(currentQuery.filters).some(value => 
      Array.isArray(value) ? value.length > 0 : value !== null
    ));

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Search Management</h3>
        <div className="flex items-center gap-2">
          {canSaveCurrentSearch && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
            >
              <BookmarkIcon className="w-4 h-4" />
              Save Search
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4">
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'saved'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BookmarkSolidIcon className="w-4 h-4" />
                Saved ({savedSearches.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ClockIcon className="w-4 h-4" />
                History
              </div>
            </button>
          </div>

          {/* Content */}
          {activeTab === 'saved' && (
            <div className="space-y-2">
              {savedSearches.length > 0 ? (
                savedSearches.map(search => (
                  <div
                    key={search.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => onSearchLoad(search)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {editingId === search.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleEditSave(search.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSave(search.id);
                              if (e.key === 'Escape') handleEditCancel();
                            }}
                            className="font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-emerald-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{search.name}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {formatSearchQuery(search.query)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Last used: {new Date(search.last_used_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStart(search);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit name"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSearchDelete(search.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete saved search"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookmarkIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No saved searches yet</p>
                  <p className="text-sm">Save your frequently used searches for quick access</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <SearchHistory />
          )}
        </div>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Save Search</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Enter a name for this search..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
              
              {currentQuery && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Query
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                    {formatSearchQuery(currentQuery)}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCurrentSearch}
                  disabled={!saveName.trim()}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};