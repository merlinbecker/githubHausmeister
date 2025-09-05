import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Smartphone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
} from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushNotificationTester() {
  const push = usePushNotifications();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const addTestResult = (message: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const runComprehensiveTest = async () => {
    setIsRunningTests(true);
    clearTestResults();

    try {
      // 1. Check Browser Support
      addTestResult('🔍 Prüfe Browser-Unterstützung...');
      if (!push.isSupported) {
        addTestResult('❌ Browser unterstützt keine Push-Benachrichtigungen');
        return;
      }
      addTestResult('✅ Browser unterstützt Push-Benachrichtigungen');

      // 1.1. Detect Browser for specific compatibility info
      const userAgent = navigator.userAgent;
      const isChrome =
        userAgent.includes('Chrome') && !userAgent.includes('Edg');
      const isEdge = userAgent.includes('Edg');
      const isFirefox = userAgent.includes('Firefox');
      const isSafari =
        userAgent.includes('Safari') && !userAgent.includes('Chrome');
      const isMobile =
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent
        );

      let browserInfo = '';
      if (isEdge) browserInfo = 'Microsoft Edge - Vollständige Unterstützung';
      else if (isChrome)
        browserInfo = 'Google Chrome - Vollständige Unterstützung';
      else if (isFirefox) browserInfo = 'Firefox - Vollständige Unterstützung';
      else if (isSafari)
        browserInfo = 'Safari - Nur als PWA unterstützt (iOS 16.4+)';
      else browserInfo = 'Unbekannter Browser';

      addTestResult(`🌐 Browser erkannt: ${browserInfo}`);
      if (isMobile) {
        addTestResult('📱 Mobiles Gerät erkannt - PWA Installation empfohlen');
      }

      // 2. Check Permission
      addTestResult(`🔒 Berechtigung-Status: ${push.permission}`);
      if (push.permission === 'denied') {
        addTestResult('❌ Benachrichtigungen wurden vom Benutzer verweigert');
        return;
      }

      // 3. Check Subscription
      if (!push.isSubscribed) {
        addTestResult('⚠️ Nicht für Push-Benachrichtigungen angemeldet');
        addTestResult('🔧 Versuche automatische Anmeldung...');

        const subscribed = await push.subscribe();
        if (subscribed) {
          addTestResult('✅ Automatische Anmeldung erfolgreich');
        } else {
          addTestResult('❌ Automatische Anmeldung fehlgeschlagen');
          return;
        }
      } else {
        addTestResult('✅ Für Push-Benachrichtigungen angemeldet');
      }

      // 4. Test Service Worker
      addTestResult('🔧 Prüfe Service Worker...');
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        addTestResult(`✅ Service Worker aktiv: ${registration.scope}`);

        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          addTestResult(
            `✅ Push-Subscription gefunden: ${subscription.endpoint.substring(0, 50)}...`
          );
        } else {
          addTestResult('❌ Keine Push-Subscription gefunden');
          return;
        }
      }

      // 5. Test VAPID Key
      addTestResult('🔑 Prüfe VAPID-Schlüssel...');
      try {
        const vapidResponse = await fetch('/api/push/vapid-public-key');
        const { publicKey } = await vapidResponse.json();
        if (publicKey) {
          addTestResult(
            `✅ VAPID Public Key: ${publicKey.substring(0, 20)}...`
          );
        } else {
          addTestResult('❌ VAPID Public Key nicht verfügbar');
        }
      } catch (error) {
        addTestResult(`❌ Fehler beim Abrufen des VAPID-Schlüssels: ${error}`);
      }

      // 6. Send Test Notification
      addTestResult('📤 Sende Test-Benachrichtigung...');
      const success = await push.sendTestNotification();
      if (success) {
        addTestResult('✅ Test-Benachrichtigung erfolgreich gesendet');
      } else {
        addTestResult('❌ Fehler beim Senden der Test-Benachrichtigung');
      }
    } catch (error) {
      addTestResult(`💥 Unerwarteter Fehler: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const sendCustomTestNotification = async () => {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        addTestResult(
          `✅ Custom Test gesendet - Erfolgreich: ${result.sent}, Fehlgeschlagen: ${result.failed}`
        );
      } else {
        const error = await response.text();
        addTestResult(`❌ Custom Test fehlgeschlagen: ${error}`);
      }
    } catch (error) {
      addTestResult(`💥 Custom Test Fehler: ${error}`);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push-Benachrichtigungen Tester
        </CardTitle>
        <CardDescription>
          Testen Sie die Funktionalität Ihrer Push-Benachrichtigungen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Badge variant={push.isSupported ? 'default' : 'destructive'}>
            {push.isSupported ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            Browser Support
          </Badge>
          <Badge
            variant={
              push.permission === 'granted'
                ? 'default'
                : push.permission === 'denied'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {push.permission === 'granted' ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : push.permission === 'denied' ? (
              <XCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            Permission: {push.permission}
          </Badge>
          <Badge variant={push.isSubscribed ? 'default' : 'secondary'}>
            {push.isSubscribed ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            Subscribed
          </Badge>
          <Badge variant={push.isLoading ? 'secondary' : 'default'}>
            {push.isLoading ? 'Loading...' : 'Ready'}
          </Badge>
        </div>

        {/* Test Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runComprehensiveTest}
            disabled={isRunningTests}
            variant="default"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Vollständiger Test
          </Button>

          <Button
            onClick={sendCustomTestNotification}
            disabled={!push.isSubscribed}
            variant="outline"
          >
            <Bell className="h-4 w-4 mr-2" />
            Server Test
          </Button>

          <Button
            onClick={push.sendTestNotification}
            disabled={!push.isSubscribed}
            variant="outline"
          >
            <Bell className="h-4 w-4 mr-2" />
            Client Test
          </Button>

          {push.isSubscribed && (
            <Button 
              onClick={async () => {
                const success = await push.unsubscribe();
                if (success) {
                  addTestResult('✅ Push-Subscription erfolgreich entfernt');
                  addTestResult('💡 Für frischen Start bitte Browser-Cache leeren (Ctrl+Shift+R)');
                } else {
                  addTestResult('❌ Fehler beim Entfernen der Push-Subscription');
                }
              }} 
              variant="destructive" 
              size="sm"
            >
              Subscription entfernen
            </Button>
          )}

          <Button onClick={clearTestResults} variant="ghost" size="sm">
            Clear Log
          </Button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="max-h-60 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {testResults.join('\n')}
                </pre>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Setup Instructions */}
        {!push.isSubscribed && push.permission !== 'denied' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Um Push-Benachrichtigungen zu testen, müssen Sie sich zunächst
              anmelden. Gehen Sie zu den Benachrichtigungseinstellungen und
              aktivieren Sie Push-Benachrichtigungen.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
