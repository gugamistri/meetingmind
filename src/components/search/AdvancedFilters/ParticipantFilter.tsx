import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/common/useDebounce';

interface ParticipantFilterProps {
  selectedParticipants: string[];
  availableParticipants: string[];
  onSelectionChange: (participants: string[]) => void;
}

export const ParticipantFilter: React.FC<ParticipantFilterProps> = ({
  selectedParticipants,
  availableParticipants,
  onSelectionChange
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredParticipants, setFilteredParticipants] = useState(availableParticipants);
  const debouncedInput = useDebounce(inputValue, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedInput) {
      const filtered = availableParticipants.filter(participant =>
        participant.toLowerCase().includes(debouncedInput.toLowerCase()) &&
        !selectedParticipants.includes(participant)
      );
      setFilteredParticipants(filtered);
    } else {
      setFilteredParticipants(
        availableParticipants.filter(participant => !selectedParticipants.includes(participant))
      );
    }
  }, [debouncedInput, availableParticipants, selectedParticipants]);

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

  const handleParticipantSelect = (participant: string) => {
    if (!selectedParticipants.includes(participant)) {
      onSelectionChange([...selectedParticipants, participant]);
    }
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleParticipantRemove = (participant: string) => {
    onSelectionChange(selectedParticipants.filter(p => p !== participant));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !inputValue && selectedParticipants.length > 0) {
      // Remove last selected participant when backspace is pressed on empty input
      handleParticipantRemove(selectedParticipants[selectedParticipants.length - 1]);
    } else if (e.key === 'Enter' && filteredParticipants.length > 0) {
      // Select first filtered participant on Enter
      e.preventDefault();
      handleParticipantSelect(filteredParticipants[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleAddCustomParticipant = () => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput && !selectedParticipants.includes(trimmedInput)) {
      onSelectionChange([...selectedParticipants, trimmedInput]);
      setInputValue('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Selected Participants */}
      {selectedParticipants.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedParticipants.map(participant => (
            <span
              key={participant}
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full"
            >
              {participant}
              <button
                onClick={() => handleParticipantRemove(participant)}
                className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors"
                aria-label={`Remove ${participant}`}
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
          placeholder="Type to search participants..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {filteredParticipants.length > 0 ? (
              <>
                {filteredParticipants.map(participant => (
                  <button
                    key={participant}
                    onClick={() => handleParticipantSelect(participant)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
                  >
                    {participant}
                  </button>
                ))}
              </>
            ) : (
              <div className="px-3 py-2">
                {inputValue.trim() ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-500">
                      No participants found matching "{inputValue}"
                    </div>
                    <button
                      onClick={handleAddCustomParticipant}
                      className="w-full px-3 py-1 text-sm bg-emerald-50 text-emerald-700 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      Add "{inputValue}" as participant
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    {availableParticipants.length === selectedParticipants.length
                      ? 'All participants selected'
                      : 'Type to search participants'
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};