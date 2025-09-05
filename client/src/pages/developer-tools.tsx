import { useQuery } from '@tanstack/react-query';
import { getStatus } from '@/lib/api';
import { Link } from 'wouter';
import { PushNotificationTester } from '@/components/PushNotificationTester';
import { DelayedNotificationTester } from '@/components/DelayedNotificationTester';
import { MentraOSTester } from '@/components/MentraOSTester';
import { ArrowLeft, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DeveloperTools() {
  const { data: _appState, refetch: _refetch } = useQuery({
    queryKey: ['/api/status'],
    queryFn: getStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="min-h-screen bg-github-bg text-github-text font-sans">
      {/* Header */}
      <header className="bg-github-surface border-b border-github-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <Wrench className="text-2xl text-github-blue" size={24} />
              <h1 className="text-xl font-bold text-github-text">
                Developer Tools
              </h1>
              <span className="px-2 py-1 bg-orange-500/20 text-orange-500 text-xs rounded-full font-medium">
                DEBUG
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-github-surface border border-github-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-github-text mb-2">
            Notification Debugging
          </h2>
          <p className="text-github-muted text-sm mb-4">
            Umfassende Tests für Push-Benachrichtigungen, Browser-Kompatibilität
            und verzögerte Benachrichtigungen.
          </p>
        </div>

        {/* Push Notification Tester */}
        <PushNotificationTester />

        {/* Delayed Notification Tester */}
        <DelayedNotificationTester />

        {/* MentraOS Integration Tester */}
        <div className="bg-github-surface border border-github-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-github-text mb-2">
            MentraOS Integration Testing
          </h2>
          <p className="text-github-muted text-sm mb-4">
            Test and manage evenrealities G1 smartglasses integration, voice commands, and AR notifications.
          </p>
        </div>
        <MentraOSTester />
      </main>

      {/* Footer */}
      <footer className="bg-github-surface border-t border-github-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-github-muted">
            Developer Tools • GitHub Hausmeister •
            <Link href="/" className="text-github-blue hover:underline ml-1">
              Zurück zum Dashboard
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
