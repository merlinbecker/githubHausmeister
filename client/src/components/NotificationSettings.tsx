import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationSettings {
  taskStarted: boolean;
  taskCompleted: boolean;
  taskFailed: boolean;
  prCreated: boolean;
  prMerged: boolean;
  ciStatusChanged: boolean;
  copilotAssigned: boolean;
}

export function NotificationSettings() {
  const push = usePushNotifications();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/push/settings', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    if (!settings) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await fetch('/api/push/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      // Revert on error
      setSettings(settings);
    }
  };

  const handleEnableNotifications = async () => {
    const hasPermission = await push.requestPermission();
    if (hasPermission) {
      await push.subscribe();
    }
  };

  if (isLoading || !settings) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push-Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Erhalten Sie Benachrichtigungen über wichtige Ereignisse, auch wenn
          die App geschlossen ist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Push Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium">Browser-Benachrichtigungen</p>
            <div className="flex gap-2">
              {!push.isSupported && (
                <Badge variant="destructive">Nicht unterstützt</Badge>
              )}
              {push.isSupported && push.permission === 'denied' && (
                <Badge variant="destructive">Blockiert</Badge>
              )}
              {push.isSupported && push.permission === 'default' && (
                <Badge variant="secondary">Nicht aktiviert</Badge>
              )}
              {push.isSupported && push.permission === 'granted' && (
                <Badge variant="default">
                  {push.isSubscribed ? 'Aktiv' : 'Berechtigung erteilt'}
                </Badge>
              )}
            </div>
          </div>

          {push.isSupported && (
            <div className="flex gap-2">
              {!push.isSubscribed && push.permission !== 'denied' && (
                <Button
                  onClick={handleEnableNotifications}
                  disabled={push.isLoading}
                  size="sm"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Aktivieren
                </Button>
              )}

              {push.isSubscribed && (
                <>
                  <Button
                    variant="outline"
                    onClick={push.sendTestNotification}
                    size="sm"
                  >
                    Test senden
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={push.unsubscribe}
                    disabled={push.isLoading}
                    size="sm"
                  >
                    <BellOff className="h-4 w-4 mr-2" />
                    Deaktivieren
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Notification Types */}
        {push.isSubscribed && (
          <div className="space-y-4">
            <h4 className="font-medium">Benachrichtigungstypen</h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Task gestartet</p>
                  <p className="text-xs text-muted-foreground">
                    Wenn ein neuer Wartungs-Task beginnt
                  </p>
                </div>
                <Switch
                  checked={settings.taskStarted}
                  onCheckedChange={(checked) =>
                    updateSetting('taskStarted', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Task abgeschlossen</p>
                  <p className="text-xs text-muted-foreground">
                    Wenn ein Wartungs-Task erfolgreich abgeschlossen wurde
                  </p>
                </div>
                <Switch
                  checked={settings.taskCompleted}
                  onCheckedChange={(checked) =>
                    updateSetting('taskCompleted', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Task fehlgeschlagen</p>
                  <p className="text-xs text-muted-foreground">
                    Wenn ein Wartungs-Task fehlschlägt
                  </p>
                </div>
                <Switch
                  checked={settings.taskFailed}
                  onCheckedChange={(checked) =>
                    updateSetting('taskFailed', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Pull Request erstellt</p>
                  <p className="text-xs text-muted-foreground">
                    Wenn Copilot einen PR öffnet
                  </p>
                </div>
                <Switch
                  checked={settings.prCreated}
                  onCheckedChange={(checked) =>
                    updateSetting('prCreated', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Pull Request gemergt</p>
                  <p className="text-xs text-muted-foreground">
                    Wenn ein PR automatisch gemergt wurde
                  </p>
                </div>
                <Switch
                  checked={settings.prMerged}
                  onCheckedChange={(checked) =>
                    updateSetting('prMerged', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Copilot zugewiesen</p>
                  <p className="text-xs text-muted-foreground">
                    Wenn Copilot erfolgreich einem Issue zugewiesen wurde
                  </p>
                </div>
                <Switch
                  checked={settings.copilotAssigned}
                  onCheckedChange={(checked) =>
                    updateSetting('copilotAssigned', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">CI-Status geändert</p>
                  <p className="text-xs text-muted-foreground">
                    Bei Änderungen des CI/CD-Status (kann häufig sein)
                  </p>
                </div>
                <Switch
                  checked={settings.ciStatusChanged}
                  onCheckedChange={(checked) =>
                    updateSetting('ciStatusChanged', checked)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* iOS PWA Note */}
        {push.isSupported && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>iOS Hinweis:</strong> Push-Benachrichtigungen
              funktionieren nur, wenn die App zum Homescreen hinzugefügt wurde
              (iOS 16.4+).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}