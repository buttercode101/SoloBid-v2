import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../lib/auth';
import { LoadingScreen } from './LoadingScreen';

interface RouteGuardProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { user, authState, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (!authState.onboardingComplete || !authState.profileComplete) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function OnboardingRoute({ children }: RouteGuardProps) {
  const { user, authState, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (authState.onboardingComplete && authState.profileComplete) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export function GuestRoute({ children }: RouteGuardProps) {
  const { user, authState, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && (!authState.onboardingComplete || !authState.profileComplete)) return <Navigate to="/onboarding" replace />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export function NotFoundRoute() {
  const { user, authState, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  const returnPath = user && authState.onboardingComplete && authState.profileComplete ? '/dashboard' : '/onboarding';

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-white">
          <FileText className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Route not found</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">This page is not available.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          The link may be expired or mistyped. We can take you back to the right starting point.
        </p>
        <Button className="mt-6 w-full rounded-2xl" asChild>
          <Link to={user ? returnPath : '/'}>
            {user ? 'Return to SoloBid' : 'Return to landing page'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
