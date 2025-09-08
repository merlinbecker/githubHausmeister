import React, { useState, useEffect } from 'react';
import { Github, User, Clock, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { loginWithGitHub } from '@/lib/auth';

interface MockUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
}

interface MockLoginResponse {
  users: MockUser[];
  mode: string;
}

export default function MockLogin() {
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch available mock users
    fetch('/api/auth/mock/users')
      .then((res) => res.json())
      .then((data: MockLoginResponse) => {
        setMockUsers(data.users);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch mock users:', err);
        setError('Failed to load mock users');
        setLoading(false);
      });
  }, []);

  const handleMockLogin = async (userId: string) => {
    setLoggingIn(userId);
    setError(null);

    try {
      const response = await fetch(`/api/auth/mock/login/${userId}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to dashboard
        window.location.href = '/';
      } else {
        setError(result.error || 'Mock login failed');
      }
    } catch (err) {
      console.error('Mock login error:', err);
      setError('Network error during mock login');
    } finally {
      setLoggingIn(null);
    }
  };

  const handleQuickLogin = async () => {
    setLoggingIn('quick');
    setError(null);

    try {
      const response = await fetch('/api/auth/mock/quick-login', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.redirected) {
        // Follow the redirect
        const result = await fetch(response.url, {
          credentials: 'include',
        });
        const data = await result.json();

        if (data.success) {
          window.location.href = '/';
        } else {
          setError(data.error || 'Quick login failed');
        }
      }
    } catch (err) {
      console.error('Quick login error:', err);
      setError('Network error during quick login');
    } finally {
      setLoggingIn(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center">
        <div className="text-center">
          <TestTube
            className="animate-spin mx-auto text-github-blue mb-4"
            size={48}
          />
          <p className="text-github-muted">Loading mock environment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-github-bg text-github-text flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <TestTube className="text-github-blue" size={48} />
            <h1 className="text-3xl font-bold text-github-text">
              Mock Testing Environment
            </h1>
          </div>
          <Badge
            variant="outline"
            className="mb-4 bg-github-amber/20 text-github-amber border-github-amber"
          >
            MOCK_LOGIN Enabled
          </Badge>
          <p className="text-github-muted text-lg">
            Choose a test user to simulate GitHub authentication and repository
            access
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-500 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Quick Login */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock size={20} />
              <span>Quick Start</span>
            </CardTitle>
            <CardDescription>
              Login with the default test user for quick testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleQuickLogin}
              disabled={loggingIn !== null}
              className="w-full bg-github-green hover:bg-github-green/80 text-white"
            >
              {loggingIn === 'quick'
                ? 'Logging in...'
                : 'Quick Login (Default User)'}
            </Button>
          </CardContent>
        </Card>

        {/* User Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Test Users</CardTitle>
            <CardDescription>
              Select a test user to simulate different scenarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-github-border rounded-lg bg-github-surface"
              >
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl} alt={user.username} />
                    <AvatarFallback>
                      <User size={20} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-github-text">
                      {user.username}
                    </h3>
                    <p className="text-sm text-github-muted">{user.email}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleMockLogin(user.id)}
                  disabled={loggingIn !== null}
                  variant="outline"
                  size="sm"
                >
                  {loggingIn === user.id ? 'Logging in...' : 'Login as User'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Production Mode Option */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Github size={20} />
              <span>Production Authentication</span>
            </CardTitle>
            <CardDescription>
              Use real GitHub OAuth (requires MOCK_LOGIN=false)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={loginWithGitHub}
              variant="outline"
              className="w-full"
              disabled
            >
              <Github size={20} className="mr-2" />
              Continue with GitHub (Disabled in Mock Mode)
            </Button>
            <p className="text-xs text-github-muted mt-3 text-center">
              To use real GitHub authentication, set MOCK_LOGIN=false in
              environment variables
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-github-muted">
            Mock mode provides simulated repositories and GitHub interactions
            for testing
          </p>
        </div>
      </div>
    </div>
  );
}
