import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { FileText, Loader2 } from 'lucide-react';

const Layout = lazy(() => import('./components/Layout').then((module) => ({ default: module.Layout })));
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuoteBuilder = lazy(() => import('./pages/QuoteBuilder'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Templates = lazy(() => import('./pages/Templates'));
const Settings = lazy(() => import('./pages/Settings'));
const Clients = lazy(() => import('./pages/Clients'));
const RecurringInvoices = lazy(() => import('./pages/RecurringInvoices'));
const ClientView = lazy(() => import('./pages/ClientView'));
const Reports = lazy(() => import('./pages/Reports'));

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center">
    <div className="space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
      <p className="text-sm font-medium text-zinc-500">Preparing SoloBid…</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, authState, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (!authState.onboardingComplete || !authState.profileComplete) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

const OnboardingRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, authState, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (authState.onboardingComplete && authState.profileComplete) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const LandingRoute = () => {
  const { user, authState, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && (!authState.onboardingComplete || !authState.profileComplete)) return <Navigate to="/onboarding" replace />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <Login />;
};

const NotFoundRoute = () => {
  const { user, authState, loading } = useAuth();

  if (loading) return <LoadingScreen />;

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
          <Link to={user ? (authState.onboardingComplete ? '/dashboard' : '/onboarding') : '/'}>
            {user ? 'Return to SoloBid' : 'Return to landing page'}
          </Link>
        </Button>
      </div>
    </div>
  );
};


export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/login" element={<LandingRoute />} />
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
          <Route path="/client/estimate/:id" element={
            <Suspense fallback={
              <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-4 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium text-zinc-500">Loading your quotation…</p>
              </div>
            }>
              <ClientView />
            </Suspense>
          } />
          <Route path="/client/quote/:id" element={
            <Suspense fallback={
              <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-4 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium text-zinc-500">Loading your quotation…</p>
              </div>
            }>
              <ClientView />
            </Suspense>
          } />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/quotes" element={<Navigate to="/dashboard" replace />} />
            <Route path="/quotes/new" element={<QuoteBuilder />} />
            <Route path="/quotes/:id" element={<QuoteBuilder />} />
            <Route path="/estimates" element={<Navigate to="/dashboard" replace />} />
            <Route path="/estimates/new" element={<QuoteBuilder />} />
            <Route path="/estimates/:id" element={<QuoteBuilder />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/recurring" element={<RecurringInvoices />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
        </Suspense>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
