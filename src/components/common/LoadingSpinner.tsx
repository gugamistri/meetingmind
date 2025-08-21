import React from 'react';
import clsx from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-2',
  };

  return (
    <div className={clsx('flex flex-col items-center justify-center', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-primary-600 border-t-transparent',
          sizeClasses[size]
        )}
        role='status'
        aria-label='Loading'
      />
      {message && <p className='mt-2 text-sm text-gray-600'>{message}</p>}
    </div>
  );
};
