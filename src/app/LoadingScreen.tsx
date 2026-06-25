import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Preparing SoloBid…' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
        <p className="text-sm font-medium text-zinc-500">{message}</p>
      </div>
    </div>
  );
}
