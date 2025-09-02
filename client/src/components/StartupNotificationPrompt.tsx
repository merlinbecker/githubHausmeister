import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bell, X } from 'lucide-react';
import { useNotificationPrompt } from '../hooks/useNotificationPrompt';

export function StartupNotificationPrompt() {
  const { shouldShow, requestPermission, dismissPrompt } = useNotificationPrompt();

  if (!shouldShow) {
    return null;
  }

  const handleAllow = async () => {
    await requestPermission();
  };

  const handleDismiss = () => {
    dismissPrompt();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Benachrichtigungen aktivieren</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Erhalten Sie Benachrichtigungen über wichtige Wartungsaufgaben, auch wenn 
            die App geschlossen ist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Vorteile:</strong>
            </p>
            <ul className="text-sm text-blue-600 dark:text-blue-400 mt-1 ml-4 list-disc">
              <li>Sofortige Benachrichtigung bei Task-Abschluss</li>
              <li>Updates zu Pull Request Status</li>
              <li>Copilot Zuweisungsbestätigungen</li>
              <li>Funktioniert auch bei geschlossener App</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAllow} className="flex-1">
              <Bell className="h-4 w-4 mr-2" />
              Aktivieren
            </Button>
            <Button variant="outline" onClick={handleDismiss} className="flex-1">
              Später
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Sie können Benachrichtigungen jederzeit in den Einstellungen anpassen oder deaktivieren.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}