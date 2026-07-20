import React from 'react';
import { Zap } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Initializing System',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <div
          className={`${sizeClasses[size]} border-4 border-blue-100 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin`}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className={`${iconSizeClasses[size]} text-blue-600 dark:text-blue-400 animate-pulse`} />
        </div>
      </div>
      <p className="mt-6 text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">
        {message}
      </p>
    </div>
  );
};

export default LoadingSpinner;
