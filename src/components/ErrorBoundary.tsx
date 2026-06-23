import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from './ui/button';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
          <div className="w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-white">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Something went wrong</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950">
              An error occurred
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{this.state.message}</p>
            <Button
              className="mt-6 w-full rounded-2xl"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
            >
              Return to SoloBid
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
