import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingScreen } from './LoadingScreen';
import { GuestRoute, NotFoundRoute, OnboardingRoute, ProtectedRoute } from './RouteGuards';

const Layout = lazy(() => import('../components/Layout').then((module) => ({ default: module.Layout })));
const Login = lazy(() => import('../pages/Login'));
const Onboarding = lazy(() => import('../pages/Onboarding'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const QuoteBuilder = lazy(() => import('../pages/QuoteBuilder'));
const Invoices = lazy(() => import('../pages/Invoices'));
const Templates = lazy(() => import('../pages/Templates'));
const Settings = lazy(() => import('../pages/Settings'));
const Clients = lazy(() => import('../pages/Clients'));
const RecurringInvoices = lazy(() => import('../pages/RecurringInvoices'));
const ClientView = lazy(() => import('../pages/ClientView'));
const Reports = lazy(() => import('../pages/Reports'));

function ClientViewRoute() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading your quotation…" />}>
      <ClientView />
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
      <Route path="/client/estimate/:id" element={<ClientViewRoute />} />
      <Route path="/client/quote/:id" element={<ClientViewRoute />} />

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
  );
}
