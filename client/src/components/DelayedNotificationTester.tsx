import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Clock, Bell, AlertCircle, CheckCircle, Timer } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function DelayedNotificationTester() {
  const push = usePushNotifications();
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [customMessage, setCustomMessage] = useState('Test-Benachrichtigung nach Verzögerung');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTests, setScheduledTests] = useState<Array<{
    id: string;
    scheduledAt: Date;
    delaySeconds: number;
    message: string;
    status: 'pending' | 'sent' | 'failed';
  }>>([]);

  const scheduleDelayedNotification = async () => {
    if (!push.isSubscribed) {
      alert('Sie müssen sich erst für Push-Benachrichtigungen anmelden.');
      return;
    }

    setIsScheduling(true);
    const testId = Date.now().toString();

    try {
      const response = await fetch('/api/push/schedule-delayed-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          delaySeconds,
          message: customMessage,
          testId,
        }),
      });

      if (response.ok) {
        const _result = await response.json();
        
        // Add test to local tracking
        setScheduledTests(prev => [...prev, {
          id: testId,
          scheduledAt: new Date(),
          delaySeconds,
          message: customMessage,
          status: 'pending'
        }]);

        alert(`✅ Verzögerte Benachrichtigung geplant! 
ID: ${testId}
Verzögerung: ${delaySeconds} Sekunden
Message: "${customMessage}"

Die Benachrichtigung wird in ${delaySeconds} Sekunden gesendet, auch wenn der Browser geschlossen ist.`);
      } else {
        const error = await response.text();
        alert(`❌ Fehler beim Planen der Benachrichtigung: ${error}`);
      }
    } catch (error) {
      console.error('💥 Fehler beim Planen der verzögerten Benachrichtigung:', error);
      alert('Unerwarteter Fehler beim Planen der Benachrichtigung.');
    } finally {
      setIsScheduling(false);
    }
  };

  const clearScheduledTests = () => {
    setScheduledTests([]);
  };

  // Update test status based on time
  const updateTestStatuses = () => {
    setScheduledTests(prev => prev.map(test => {
      const elapsed = (Date.now() - test.scheduledAt.getTime()) / 1000;
      if (test.status === 'pending' && elapsed >= test.delaySeconds + 2) {
        // Mark as sent if enough time has passed (adding 2 seconds buffer)
        return { ...test, status: 'sent' as const };
      }
      return test;
    }));
  };

  // Update statuses every 2 seconds
  React.useEffect(() => {
    const interval = setInterval(updateTestStatuses, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Verzögerte Push-Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Testen Sie verzögerte Benachrichtigungen, die auch funktionieren wenn der Browser geschlossen ist.
          Diese Funktion simuliert echte Push-Benachrichtigungen für geschlossene Apps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delay">Verzögerung (Sekunden)</Label>
            <Input
              id="delay"
              type="number"
              min="1"
              max="300"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 5)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Benachrichtigungstext</Label>
            <Input
              id="message"
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Ihre Test-Nachricht"
            />
          </div>
        </div>

        {/* Test Button */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={scheduleDelayedNotification}
            disabled={isScheduling || !push.isSubscribed}
            variant="default"
          >
            <Timer className="h-4 w-4 mr-2" />
            {isScheduling ? 'Wird geplant...' : 'Verzögerte Benachrichtigung planen'}
          </Button>
          
          {scheduledTests.length > 0 && (
            <Button 
              onClick={clearScheduledTests}
              variant="ghost"
              size="sm"
            >
              Test-Liste löschen
            </Button>
          )}
        </div>

        {/* Browser Compatibility Info */}
        <Alert>
          <Bell className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Browser-Kompatibilität für Push-Benachrichtigungen:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>✅ <strong>Chrome (63+):</strong> Vollständige Unterstützung inkl. Background Sync</li>
                <li>✅ <strong>Microsoft Edge (17+):</strong> Vollständige Unterstützung</li>
                <li>✅ <strong>Firefox (44+):</strong> Vollständige Unterstützung</li>
                <li>✅ <strong>Safari (iOS 16.4+):</strong> Nur als PWA (zum Homescreen hinzufügen)</li>
                <li>✅ <strong>Samsung Internet (4.0+):</strong> Vollständige Unterstützung</li>
                <li>✅ <strong>Mobile Chrome/Firefox:</strong> Unterstützt auf modernen Android-Geräten</li>
                <li>⚠️ <strong>iOS Safari (Web):</strong> Nicht unterstützt im Browser, nur als PWA</li>
              </ul>
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs">
                <p className="font-medium mb-1">Mobile Optimierungen:</p>
                <ul className="space-y-1">
                  <li>• <code>requireInteraction: true</code> - Notification bleibt sichtbar</li>
                  <li>• <code>badge</code> - App-Icon in der Benachrichtigung</li>
                  <li>• <code>tag</code> - Vermeidet Duplikate</li>
                  <li>• <code>icon</code> - Große Notification-Icons</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Für optimale Funktionalität auf mobilen Geräten sollte die App als PWA installiert werden.
                Microsoft Edge unterstützt Push-Benachrichtigungen vollständig seit Version 17.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Scheduled Tests List */}
        {scheduledTests.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Geplante Tests</h4>
            <div className="space-y-2">
              {scheduledTests.map((test) => {
                const elapsed = (Date.now() - test.scheduledAt.getTime()) / 1000;
                const remaining = Math.max(0, test.delaySeconds - elapsed);
                
                return (
                  <div key={test.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Test #{test.id.slice(-4)}</p>
                        <p className="text-xs text-muted-foreground">
                          "{test.message}"
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Geplant: {test.scheduledAt.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          test.status === 'sent' ? 'default' : 
                          test.status === 'failed' ? 'destructive' : 
                          'secondary'
                        }>
                          {test.status === 'sent' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {test.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {test.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {test.status === 'pending' ? `${Math.ceil(remaining)}s` : 
                           test.status === 'sent' ? 'Gesendet' : 'Fehler'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!push.isSubscribed && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Um verzögerte Push-Benachrichtigungen zu testen, müssen Sie sich zunächst für 
              Push-Benachrichtigungen anmelden. Gehen Sie zurück zum Dashboard und 
              aktivieren Sie Push-Benachrichtigungen in den Einstellungen.
            </AlertDescription>
          </Alert>
        )}

        {push.isSubscribed && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Test-Anleitung:</strong> Klicken Sie auf "Verzögerte Benachrichtigung planen", 
              schließen Sie dann Ihren Browser komplett oder wechseln Sie zu einer anderen App. 
              Nach der eingestellten Verzögerung sollten Sie eine Push-Benachrichtigung erhalten, 
              die Sie zurück zur App bringt.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}