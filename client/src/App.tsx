import React from 'react';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/pages/dashboard';
import DeveloperTools from '@/pages/developer-tools';
import Login from '@/pages/login';
import MockLoginPage from '@/pages/mock-login';
import NotFound from '@/pages/not-found';
import { StartupNotificationPrompt } from '@/components/StartupNotificationPrompt';

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mx-auto mb-4"></div>
          <p className="text-github-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark">
      <Switch>
        {isAuthenticated ? (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/dev-tools" component={DeveloperTools} />
            <Route component={NotFound} />
          </>
        ) : (
          <>
            <Route path="/mock-login" component={MockLoginPage} />
            <Route path="*" component={Login} />
          </>
        )}
      </Switch>
      {/* Show notification prompt only for authenticated users */}
      {isAuthenticated && <StartupNotificationPrompt />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
