import React, { useState } from 'react';

interface DateRangeFilterProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (startDate: string | null, endDate: string | null) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onDateChange
}) => {
  const [showCustomRange, setShowCustomRange] = useState(false);

  const getDatePreset = (preset: string): { start: string | null; end: string | null } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday.toISOString(),
          end: today.toISOString()
        };
      case 'last_week':
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          start: lastWeek.toISOString(),
          end: null
        };
      case 'last_month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        return {
          start: lastMonth.toISOString(),
          end: null
        };
      case 'last_3_months':
        const last3Months = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
        return {
          start: last3Months.toISOString(),
          end: null
        };
      case 'last_year':
        const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        return {
          start: lastYear.toISOString(),
          end: null
        };
      default:
        return { start: null, end: null };
    }
  };

  const handlePresetClick = (preset: string) => {
    const { start, end } = getDatePreset(preset);
    onDateChange(start, end);
    setShowCustomRange(false);
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      onDateChange(value || null, endDate);
    } else {
      onDateChange(startDate, value || null);
    }
  };

  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const presets = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last_week', label: 'Last 7 days' },
    { key: 'last_month', label: 'Last month' },
    { key: 'last_3_months', label: 'Last 3 months' },
    { key: 'last_year', label: 'Last year' }
  ];

  const isPresetActive = (preset: string): boolean => {
    const { start, end } = getDatePreset(preset);
    return startDate === start && endDate === end;
  };

  return (
    <div className="space-y-3">
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <button
            key={preset.key}
            onClick={() => handlePresetClick(preset.key)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              isPresetActive(preset.key)
                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomRange(!showCustomRange)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            showCustomRange
              ? 'bg-blue-100 border-blue-300 text-blue-800'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Custom Range
        </button>
      </div>

      {/* Custom Date Range Inputs */}
      {showCustomRange && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => handleCustomDateChange('start', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={formatDateForInput(endDate)}
              onChange={(e) => handleCustomDateChange('end', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Clear Date Range */}
      {(startDate || endDate) && (
        <button
          onClick={() => onDateChange(null, null)}
          className="text-xs text-red-600 hover:text-red-800 transition-colors"
        >
          Clear date range
        </button>
      )}
    </div>
  );
};