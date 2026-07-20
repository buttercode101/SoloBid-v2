import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-[32px] mb-6" aria-hidden="true">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 max-w-xs mx-auto">
            The application encountered an unexpected error. Your data is safe.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all hover:bg-slate-800 dark:hover:bg-blue-700"
            aria-label="Reload application"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
