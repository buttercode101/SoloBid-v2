import { Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import { LoadingScreen } from './app/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './lib/auth';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingScreen />}>
          <AppRoutes />
        </Suspense>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
