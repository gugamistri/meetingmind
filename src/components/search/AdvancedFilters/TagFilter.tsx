import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/common/useDebounce';

interface TagFilterProps {
  selectedTags: string[];
  availableTags: string[];
  onSelectionChange: (tags: string[]) => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({
  selectedTags,
  availableTags,
  onSelectionChange
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredTags, setFilteredTags] = useState(availableTags);
  const debouncedInput = useDebounce(inputValue, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedInput) {
      const filtered = availableTags.filter(tag =>
        tag.toLowerCase().includes(debouncedInput.toLowerCase()) &&
        !selectedTags.includes(tag)
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(
        availableTags.filter(tag => !selectedTags.includes(tag))
      );
    }
  }, [debouncedInput, availableTags, selectedTags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagSelect = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onSelectionChange([...selectedTags, tag]);
    }
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleTagRemove = (tag: string) => {
    onSelectionChange(selectedTags.filter(t => t !== tag));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last selected tag when backspace is pressed on empty input
      handleTagRemove(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags.length > 0) {
        // Select first filtered tag on Enter
        handleTagSelect(filteredTags[0]);
      } else if (inputValue.trim()) {
        // Create new tag if no matches
        handleCreateNewTag();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        handleCreateNewTag();
      }
    }
  };

  const handleCreateNewTag = () => {
    const trimmedInput = inputValue.trim().toLowerCase();
    if (trimmedInput && !selectedTags.includes(trimmedInput)) {
      onSelectionChange([...selectedTags, trimmedInput]);
      setInputValue('');
      setIsOpen(false);
    }
  };

  // Predefined tag suggestions for common meeting categories
  const suggestedTags = [
    'standup', 'retrospective', 'planning', 'review', 'brainstorm',
    'one-on-one', 'all-hands', 'training', 'client', 'internal',
    'important', 'follow-up', 'decision', 'action-items'
  ].filter(tag => 
    !selectedTags.includes(tag) && 
    !availableTags.includes(tag) &&
    tag.includes(debouncedInput.toLowerCase())
  );

  return (
    <div className="relative">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              #{tag}
              <button
                onClick={() => handleTagRemove(tag)}
                className="p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                aria-label={`Remove ${tag} tag`}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type tags... (press comma or enter to add)"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {/* Create new tag option */}
            {inputValue.trim() && (
              <button
                onClick={handleCreateNewTag}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4 text-blue-500" />
                <span>Create tag "<span className="font-medium">#{inputValue.trim().toLowerCase()}</span>"</span>
              </button>
            )}

            {/* Existing tags */}
            {filteredTags.length > 0 && (
              <>
                {filteredTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagSelect(tag)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </>
            )}

            {/* Suggested tags */}
            {suggestedTags.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
                  Suggested tags:
                </div>
                {suggestedTags.slice(0, 5).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagSelect(tag)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors text-gray-600"
                  >
                    #{tag}
                  </button>
                ))}
              </>
            )}

            {/* No results message */}
            {filteredTags.length === 0 && suggestedTags.length === 0 && !inputValue.trim() && (
              <div className="px-3 py-2 text-sm text-gray-500">
                {availableTags.length === selectedTags.length
                  ? 'All available tags selected'
                  : 'Type to create or search for tags'
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-1 text-xs text-gray-500">
        Press comma or enter to add tags. Use # before tag names.
      </div>
    </div>
  );
};