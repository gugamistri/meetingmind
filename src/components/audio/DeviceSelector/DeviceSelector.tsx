/**
 * DeviceSelector component for choosing audio input devices
 * 
 * Provides a dropdown interface for selecting audio devices with
 * device availability indicators and refresh capabilities.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useAudioStore, useAudioDevices, useAudioError } from '../../../stores/audio.store';
import { AudioDevice } from '../../../types/audio.types';
import { Button } from '../../common/Button';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import clsx from 'clsx';

export interface DeviceSelectorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showRefreshButton?: boolean;
  showDeviceStatus?: boolean;
  onDeviceChange?: (device: AudioDevice) => void;
  onError?: (error: string) => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  className,
  size = 'md',
  showRefreshButton = true,
  showDeviceStatus = true,
  onDeviceChange,
  onError,
}) => {
  const { devices, currentDevice } = useAudioDevices();
  const error = useAudioError();
  const { switchDevice, refreshDevices, clearError } = useAudioStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle device selection
  const handleDeviceSelect = useCallback(async (device: AudioDevice) => {
    if (!device.is_available) {
      onError?.('Selected device is not available');
      return;
    }

    if (device.name === currentDevice?.name) {
      setIsOpen(false);
      return;
    }

    try {
      clearError();
      await switchDevice(device.name);
      setIsOpen(false);
      onDeviceChange?.(device);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch device';
      onError?.(errorMessage);
    }
  }, [currentDevice, switchDevice, onDeviceChange, onError, clearError]);

  // Handle device refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      clearError();
      await refreshDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh devices';
      onError?.(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshDevices, onError, clearError]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.device-selector')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Size-based styling
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-3',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Get device status icon
  const getDeviceStatusIcon = (device: AudioDevice) => {
    if (!device.is_available) {
      return <OfflineIcon className={clsx(iconSizes[size], 'text-red-500')} />;
    }
    if (device.is_default) {
      return <DefaultIcon className={clsx(iconSizes[size], 'text-blue-500')} />;
    }
    return <OnlineIcon className={clsx(iconSizes[size], 'text-green-500')} />;
  };

  // Get device status text
  const getDeviceStatusText = (device: AudioDevice) => {
    if (!device.is_available) return 'Unavailable';
    if (device.is_default) return 'Default device';
    return 'Available';
  };

  return (
    <div className={clsx('device-selector relative', className)}>
      {/* Main selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between',
          'border border-gray-300 rounded-md bg-white shadow-sm',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
          'transition-colors duration-200',
          sizeClasses[size],
          error && 'border-red-300 bg-red-50'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Device status icon */}
          {currentDevice && showDeviceStatus && getDeviceStatusIcon(currentDevice)}
          
          {/* Device name */}
          <span className="truncate">
            {currentDevice?.name || 'No device selected'}
          </span>
        </div>
        
        {/* Dropdown arrow */}
        <ChevronDownIcon 
          className={clsx(
            iconSizes[size],
            'text-gray-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className={clsx(
          'absolute z-50 w-full mt-1',
          'bg-white border border-gray-200 rounded-md shadow-lg',
          'max-h-60 overflow-auto'
        )}>
          {/* Refresh button */}
          {showRefreshButton && (
            <div className="p-2 border-b border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full flex items-center justify-center space-x-2"
              >
                {isRefreshing ? (
                  <LoadingSpinner className="w-3 h-3" />
                ) : (
                  <RefreshIcon className="w-3 h-3" />
                )}
                <span>Refresh Devices</span>
              </Button>
            </div>
          )}

          {/* Device list */}
          <div className="py-1">
            {devices.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No audio devices found
              </div>
            ) : (
              devices.map((device, index) => (
                <button
                  key={`${device.name}-${index}`}
                  onClick={() => handleDeviceSelect(device)}
                  className={clsx(
                    'w-full flex items-center space-x-2 px-3 py-2',
                    'text-left hover:bg-gray-100 focus:bg-gray-100',
                    'focus:outline-none transition-colors duration-150',
                    currentDevice?.name === device.name && 'bg-emerald-50 text-emerald-900',
                    !device.is_available && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={!device.is_available}
                >
                  {/* Status icon */}
                  {showDeviceStatus && getDeviceStatusIcon(device)}
                  
                  {/* Device info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="truncate font-medium">
                        {device.name}
                      </span>
                      {currentDevice?.name === device.name && (
                        <CheckIcon className={clsx(iconSizes[size], 'text-emerald-600')} />
                      )}
                    </div>
                    
                    {showDeviceStatus && (
                      <div className="text-xs text-gray-500">
                        {getDeviceStatusText(device)}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-1 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

// Icon components
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const OnlineIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const OfflineIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
  </svg>
);

const DefaultIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export default DeviceSelector;