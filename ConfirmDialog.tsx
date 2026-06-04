import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';

// Pages
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import EstimateBuilder from './pages/EstimateBuilder';
import ClientView from './pages/ClientView';
import Invoices from './pages/Invoices';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Clients from './pages/Clients';
import RecurringInvoices from './pages/RecurringInvoices';

const ProtectedRoute = ({ children, requireOnboarding = true }: { children: React.ReactNode, requireOnboarding?: boolean }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  
  // If no user, we allow them to see the app (Layout + Dashboard) in guest mode
  // But for specific protected actions/pages, we might redirect them
  if (!user) return <Navigate to="/login" />;
  
  if (requireOnboarding && !profile) return <Navigate to="/onboarding" />;

  return <>{children}</>;
};

const OnboardingRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (profile) return <Navigate to="/" />;

  return <>{children}</>;
};

const PublicAppRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
          <Route path="/client/estimate/:id" element={<ClientView />} />
          
          <Route path="/" element={<PublicAppRoute><Layout /></PublicAppRoute>}>
            <Route index element={<Dashboard />} />
            
            {/* These routes require authentication */}
            <Route path="estimates/new" element={<ProtectedRoute><EstimateBuilder /></ProtectedRoute>} />
            <Route path="estimates/:id" element={<ProtectedRoute><EstimateBuilder /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="recurring" element={<ProtectedRoute><RecurringInvoices /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Route>
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
