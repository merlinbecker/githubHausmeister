import React, { useEffect, useState } from 'react';
import { Github, Shield, Zap, GitBranch, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loginWithGitHub } from '@/lib/auth';

interface AuthMode {
  mockMode: boolean;
  serviceType: 'mock' | 'production';
}

export default function Login() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication mode
    fetch('/api/auth/mode')
      .then(res => res.json())
      .then((data: AuthMode) => {
        setAuthMode(data);
        setLoading(false);
        
        // Auto-redirect to mock login if in mock mode
        if (data.mockMode) {
          window.location.href = '/mock-login';
        }
      })
      .catch(err => {
        console.error('Failed to check auth mode:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mx-auto mb-4"></div>
          <p className="text-github-muted">Checking authentication mode...</p>
        </div>
      </div>
    );
  }

  // If mock mode detected, show redirection message (should auto-redirect above)
  if (authMode?.mockMode) {
    return (
      <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center">
        <div className="text-center">
          <TestTube className="text-github-blue mx-auto mb-4" size={48} />
          <p className="text-github-muted">Redirecting to mock login...</p>
          <Button 
            onClick={() => window.location.href = '/mock-login'}
            className="mt-4"
            variant="outline"
          >
            Go to Mock Login
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Github className="text-4xl text-github-blue" size={48} />
            <h1 className="text-3xl font-bold text-github-text">
              GitHub Hausmeister
            </h1>
          </div>
          <p className="text-github-muted text-lg">
            Automated repository maintenance with GitHub Copilot integration
          </p>
        </div>

        <div className="bg-github-surface border border-github-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-github-text mb-4">
            Features
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Zap className="text-github-blue" size={20} />
              <span className="text-github-text">
                Automated chore issue creation
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <GitBranch className="text-github-green" size={20} />
              <span className="text-github-text">Copilot agent assignment</span>
            </div>
            <div className="flex items-center space-x-3">
              <Shield className="text-github-amber" size={20} />
              <span className="text-github-text">
                Auto-merge with CI validation
              </span>
            </div>
          </div>
        </div>

        <div className="bg-github-surface border border-github-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-github-text mb-4">
            Get Started
          </h2>
          <p className="text-github-muted mb-6">
            Sign in with your GitHub account to start automating repository
            maintenance tasks.
          </p>

          <Button
            onClick={loginWithGitHub}
            className="w-full bg-github-blue hover:bg-github-blue/80 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
            data-testid="button-github-login"
          >
            <Github size={20} />
            <span>Continue with GitHub</span>
          </Button>

          <p className="text-xs text-github-muted mt-4 text-center">
            We'll only access repositories you explicitly authorize for
            maintenance.
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-github-muted">
            Need help?{' '}
            <a href="#" className="text-github-blue hover:underline">
              View Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
