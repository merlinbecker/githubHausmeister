# Push Notification Strategie für GitHub Hausmeister

## Überblick

Dieser Plan beschreibt die Implementierung eines Push-Notification-Systems für die GitHub Hausmeister Anwendung. Das System soll Benutzer über wichtige Ereignisse in ihrer automatisierten GitHub-Wartung in Echtzeit informieren, auch wenn die Anwendung nicht aktiv geöffnet ist.

## Aktuelle Architektur-Analyse

### Bestehende Webhook-Integration

Die Anwendung verarbeitet bereits folgende GitHub-Webhook-Events:

- `pull_request` - PR-Öffnung, Status-Änderungen, Ready-for-Review
- `workflow_run` - CI/CD Pipeline Status
- `check_suite` / `check_run` - CI-Check Status
- `issues` - Issue-Events (basic handling)

**Webhook-Verarbeitungsflow:**

```typescript
// server/routes.ts - Webhook Handler
POST /api/webhook -> verifySignature() -> parseWebhookPayload() ->
  handlePullRequestEvent() | handleCIEvent() | handleIssuesEvent()
```

**Aktuelle Event-Trigger-Punkte:**

1. **Task-Verarbeitung** (`server/lib/queue.ts`):
   - Task gestartet (`startNextIfIdle`)
   - Task abgeschlossen (`markTaskCompleted`)
   - Task fehlgeschlagen (`markTaskFailed`)

2. **PR-Lifecycle** (`server/routes.ts`):
   - Auto-merge erfolgreich
   - Auto-merge fehlgeschlagen
   - CI-Status Änderungen

3. **Issue-Management**:
   - Copilot-Assignment erfolgreich/fehlgeschlagen
   - Duplicate Issues erkannt

### Frontend-Architektur

- **Framework**: React 18 + TypeScript mit Vite
- **Routing**: wouter (lightweight router)
- **State Management**: TanStack Query
- **UI**: shadcn/ui components + Tailwind CSS
- **Authentication**: Session-basiert via GitHub OAuth

## Push-Notification Implementierungsplan

### Phase 1: PWA-Grundlagen

#### 1.1 PWA Manifest erstellen

**Datei**: `client/public/manifest.json`

```json
{
  "name": "GitHub Hausmeister",
  "short_name": "Hausmeister",
  "description": "Automated GitHub repository maintenance",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#1f6feb",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["developer", "productivity"],
  "screenshots": [
    {
      "src": "/screenshot-wide.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshot-narrow.png",
      "sizes": "720x1280",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

**Integration in HTML** (`client/index.html`):

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1f6feb" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

#### 1.2 Service Worker Registrierung

**Datei**: `client/src/lib/serviceWorker.ts`

```typescript
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

**Integration in main.tsx**:

```typescript
// client/src/main.tsx
import { registerServiceWorker } from './lib/serviceWorker';

createRoot(document.getElementById('root')!).render(<App />);

// Register service worker after app initialization
if (process.env.NODE_ENV === 'production') {
  registerServiceWorker();
}
```

#### 1.3 Service Worker Implementation

**Datei**: `client/public/sw.js`

```javascript
const CACHE_NAME = 'hausmeister-v1';
const urlsToCache = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event (basic caching strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Push event handler
self.addEventListener('push', (event) => {
  const options = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'open',
        title: 'Öffnen',
        icon: '/icon-192.png',
      },
      {
        action: 'close',
        title: 'Schließen',
      },
    ],
  };

  let notificationData = {};

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'GitHub Hausmeister',
        body: event.data.text() || 'Neue Benachrichtigung',
      };
    }
  }

  const title = notificationData.title || 'GitHub Hausmeister';
  const body =
    notificationData.body || 'Neue Aktivität in Ihrer Repository-Wartung';

  event.waitUntil(
    self.registration.showNotification(title, {
      ...options,
      body,
      tag: notificationData.tag || 'general',
      url: notificationData.url || '/',
      data: notificationData,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if app not open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
```

### Phase 2: VAPID-Keys und Server-Setup

#### 2.1 VAPID-Keys Generierung

**Datei**: `server/lib/vapid.ts`

```typescript
import crypto from 'crypto';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export function generateVapidKeys(): VapidKeys {
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  const publicKey = Buffer.from(keyPair.publicKey).toString('base64url');
  const privateKey = Buffer.from(keyPair.privateKey).toString('base64url');

  return { publicKey, privateKey };
}

// One-time key generation script
export function initializeVapidKeys() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const keys = generateVapidKeys();
    console.log('Generated VAPID Keys:');
    console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
    console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
    console.log('Add these to your environment variables');
  }
}
```

**Environment Variables** (`.env`):

```
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

#### 2.2 Web-Push Library Integration

**Installation**:

```bash
npm install web-push
npm install -D @types/web-push
```

**Datei**: `server/lib/webPush.ts`

```typescript
import webpush from 'web-push';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: any;
}

export function initializeWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      vapidDetails: {
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        publicKey: process.env.VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

export async function sendPushToMultipleSubscriptions(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{ successful: number; failed: number }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  );

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && r.value
  ).length;
  const failed = results.length - successful;

  return { successful, failed };
}
```

### Phase 3: Database-Schema für Push-Subscriptions

#### 3.1 Schema-Erweiterung

**Datei**: `shared/schema.ts` (Erweiterung)

```typescript
// Push subscription table
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dhKey: text('p256dh_key').notNull(),
    authKey: text('auth_key').notNull(),
    userAgent: text('user_agent'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    lastUsed: timestamp('last_used').defaultNow(),
  },
  (table) => [
    index('push_subscriptions_user_id_idx').on(table.userId),
    index('push_subscriptions_endpoint_idx').on(table.endpoint),
  ]
);

// Notification settings table
export const notificationSettings = pgTable(
  'notification_settings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskStarted: boolean('task_started').default(true),
    taskCompleted: boolean('task_completed').default(true),
    taskFailed: boolean('task_failed').default(true),
    prCreated: boolean('pr_created').default(true),
    prMerged: boolean('pr_merged').default(true),
    ciStatusChanged: boolean('ci_status_changed').default(false),
    copilotAssigned: boolean('copilot_assigned').default(true),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('notification_settings_user_id_idx').on(table.userId)]
);

// Types
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings =
  typeof notificationSettings.$inferInsert;
```

#### 3.2 Database Storage-Erweiterung

**Datei**: `server/lib/database-storage.ts` (Erweiterung)

```typescript
// Push subscription operations
async addPushSubscription(
  subscription: InsertPushSubscription
): Promise<PushSubscription> {
  const [inserted] = await db
    .insert(pushSubscriptions)
    .values(subscription)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        isActive: true,
        lastUsed: new Date(),
      },
    })
    .returning();
  return inserted;
}

async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      )
    );
}

async removePushSubscription(endpoint: string): Promise<boolean> {
  const result = await db
    .update(pushSubscriptions)
    .set({ isActive: false })
    .where(eq(pushSubscriptions.endpoint, endpoint));
  return result.rowCount > 0;
}

// Notification settings operations
async getUserNotificationSettings(userId: string): Promise<NotificationSettings> {
  const [settings] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId));

  if (!settings) {
    const [newSettings] = await db
      .insert(notificationSettings)
      .values({ userId })
      .returning();
    return newSettings;
  }

  return settings;
}

async updateNotificationSettings(
  userId: string,
  updates: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const [updated] = await db
    .update(notificationSettings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(notificationSettings.userId, userId))
    .returning();
  return updated;
}
```

### Phase 4: API-Endpunkte für Push-Subscriptions

#### 4.1 Subscription Management API

**Datei**: `server/routes.ts` (Erweiterung)

```typescript
// Get VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY,
  });
});

// Subscribe to push notifications
app.post(
  '/api/push/subscribe',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({
          error: 'Invalid subscription data',
        });
      }

      const subscription = await databaseStorage.addPushSubscription({
        userId: req.user!.id,
        endpoint,
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        userAgent: req.get('User-Agent'),
      });

      res.json({ success: true, id: subscription.id });
    } catch (error) {
      console.error('Error subscribing to push:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  }
);

// Unsubscribe from push notifications
app.post(
  '/api/push/unsubscribe',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          error: 'Endpoint required',
        });
      }

      await databaseStorage.removePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  }
);

// Get notification settings
app.get(
  '/api/push/settings',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await databaseStorage.getUserNotificationSettings(
        req.user!.id
      );
      res.json(settings);
    } catch (error) {
      console.error('Error getting notification settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }
);

// Update notification settings
app.put(
  '/api/push/settings',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updates = req.body;
      const settings = await databaseStorage.updateNotificationSettings(
        req.user!.id,
        updates
      );
      res.json(settings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

// Test notification endpoint
app.post(
  '/api/push/test',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const subscriptions = await databaseStorage.getUserPushSubscriptions(
        req.user!.id
      );

      if (subscriptions.length === 0) {
        return res.status(404).json({
          error: 'No active subscriptions found',
        });
      }

      const payload = {
        title: 'Test Benachrichtigung',
        body: 'Push-Benachrichtigungen funktionieren!',
        icon: '/icon-192.png',
        url: '/',
        tag: 'test',
      };

      const results = await sendPushToMultipleSubscriptions(
        subscriptions.map((sub) => ({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey,
          },
        })),
        payload
      );

      res.json({
        success: true,
        sent: results.successful,
        failed: results.failed,
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Failed to send test' });
    }
  }
);
```

### Phase 5: Client-Side Push-Subscription Management

#### 5.1 Push Notification Hook

**Datei**: `client/src/hooks/usePushNotifications.ts`

```typescript
import { useState, useEffect } from 'react';
import { urlBase64ToUint8Array } from '../lib/serviceWorker';

export interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
  });

  useEffect(() => {
    checkPushSupport();
  }, []);

  const checkPushSupport = async () => {
    const isSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        isLoading: false,
      }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setState((prev) => ({
        ...prev,
        isSupported: true,
        isSubscribed: !!subscription,
        permission: Notification.permission,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error checking push support:', error);
      setState((prev) => ({
        ...prev,
        isSupported: false,
        isLoading: false,
      }));
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    const permission = await Notification.requestPermission();
    setState((prev) => ({ ...prev, permission }));

    return permission === 'granted';
  };

  const subscribe = async (): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Get VAPID public key
      const vapidResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidResponse.json();

      // Subscribe to push manager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe on server');
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const sendTestNotification = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  };

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refresh: checkPushSupport,
  };
}
```

#### 5.2 Notification Settings Component

**Datei**: `client/src/components/NotificationSettings.tsx`

```tsx
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
```

### Phase 6: Integration in Webhook-Event-Handler

#### 6.1 Notification Service

**Datei**: `server/lib/notificationService.ts`

```typescript
import { databaseStorage } from './database-storage';
import {
  sendPushToMultipleSubscriptions,
  type NotificationPayload,
} from './webPush';

export enum NotificationType {
  TASK_STARTED = 'taskStarted',
  TASK_COMPLETED = 'taskCompleted',
  TASK_FAILED = 'taskFailed',
  PR_CREATED = 'prCreated',
  PR_MERGED = 'prMerged',
  CI_STATUS_CHANGED = 'ciStatusChanged',
  COPILOT_ASSIGNED = 'copilotAssigned',
}

export interface NotificationContext {
  userId: string;
  repositoryName?: string;
  taskTitle?: string;
  issueNumber?: number;
  pullNumber?: number;
  copilotAgent?: string;
  error?: string;
  url?: string;
}

export class NotificationService {
  private static getNotificationContent(
    type: NotificationType,
    context: NotificationContext
  ): NotificationPayload {
    const repo = context.repositoryName || 'Repository';

    switch (type) {
      case NotificationType.TASK_STARTED:
        return {
          title: '🚀 Task gestartet',
          body: `"${context.taskTitle}" in ${repo}`,
          icon: '/icon-192.png',
          tag: 'task-started',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.TASK_COMPLETED:
        return {
          title: '✅ Task abgeschlossen',
          body: `"${context.taskTitle}" in ${repo} erfolgreich beendet`,
          icon: '/icon-192.png',
          tag: 'task-completed',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.TASK_FAILED:
        return {
          title: '❌ Task fehlgeschlagen',
          body: `"${context.taskTitle}" in ${repo}: ${context.error || 'Unbekannter Fehler'}`,
          icon: '/icon-192.png',
          tag: 'task-failed',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.PR_CREATED:
        return {
          title: '📝 Pull Request erstellt',
          body: `Copilot hat PR #${context.pullNumber} in ${repo} geöffnet`,
          icon: '/icon-192.png',
          tag: 'pr-created',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.PR_MERGED:
        return {
          title: '🎉 Pull Request gemergt',
          body: `PR #${context.pullNumber} in ${repo} wurde automatisch gemergt`,
          icon: '/icon-192.png',
          tag: 'pr-merged',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.COPILOT_ASSIGNED:
        return {
          title: '🤖 Copilot zugewiesen',
          body: `${context.copilotAgent} wurde Issue #${context.issueNumber} in ${repo} zugewiesen`,
          icon: '/icon-192.png',
          tag: 'copilot-assigned',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.CI_STATUS_CHANGED:
        return {
          title: '🔄 CI-Status geändert',
          body: `Neuer Status für PR #${context.pullNumber} in ${repo}`,
          icon: '/icon-192.png',
          tag: 'ci-status',
          url: context.url || '/',
          data: { type, context },
        };

      default:
        return {
          title: 'GitHub Hausmeister',
          body: 'Neue Aktivität in Ihrer Repository-Wartung',
          icon: '/icon-192.png',
          tag: 'general',
          url: context.url || '/',
          data: { type, context },
        };
    }
  }

  public static async sendNotification(
    type: NotificationType,
    context: NotificationContext
  ): Promise<{ sent: number; failed: number }> {
    try {
      // Get user's notification settings
      const settings = await databaseStorage.getUserNotificationSettings(
        context.userId
      );

      // Check if this notification type is enabled
      const settingKey = type as keyof typeof settings;
      if (settings[settingKey] === false) {
        console.log(`Notification ${type} disabled for user ${context.userId}`);
        return { sent: 0, failed: 0 };
      }

      // Get user's push subscriptions
      const subscriptions = await databaseStorage.getUserPushSubscriptions(
        context.userId
      );

      if (subscriptions.length === 0) {
        console.log(`No push subscriptions found for user ${context.userId}`);
        return { sent: 0, failed: 0 };
      }

      // Generate notification content
      const payload = this.getNotificationContent(type, context);

      // Send to all user's devices
      const pushSubscriptions = subscriptions.map((sub) => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dhKey,
          auth: sub.authKey,
        },
      }));

      const results = await sendPushToMultipleSubscriptions(
        pushSubscriptions,
        payload
      );

      console.log(
        `Sent ${type} notification to user ${context.userId}: ${results.successful} successful, ${results.failed} failed`
      );

      return results;
    } catch (error) {
      console.error(`Error sending ${type} notification:`, error);
      return { sent: 0, failed: 1 };
    }
  }
}
```

#### 6.2 Integration in bestehende Event-Handler

**Datei**: `server/lib/queue.ts` (Modifikation)

```typescript
// In startNextIfIdle function, after task is started:
import { NotificationService, NotificationType } from './notificationService';

export async function startNextIfIdle(userId: string): Promise<void> {
  try {
    // ... existing code ...

    // After task is successfully started
    console.log(`Task ${nextTask.id} started successfully`);

    // Send notification
    await NotificationService.sendNotification(NotificationType.TASK_STARTED, {
      userId,
      repositoryName: `${nextTask.owner}/${nextTask.repo}`,
      taskTitle: nextTask.title,
      issueNumber: issue?.number,
      url: `https://github.com/${nextTask.owner}/${nextTask.repo}/issues/${issue?.number}`,
    });
  } catch (error) {
    console.error('Error starting next task:', error);
  }
}

export async function markTaskCompleted(taskId: string): Promise<void> {
  try {
    const task = await databaseStorage.getTaskById(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    await databaseStorage.updateTask(taskId, {
      status: 'completed',
    });

    // ... existing code ...

    // Send notification
    await NotificationService.sendNotification(
      NotificationType.TASK_COMPLETED,
      {
        userId: task.userId,
        repositoryName: `${task.owner}/${task.repo}`,
        taskTitle: task.title,
        issueNumber: task.issueNumber,
        pullNumber: task.pullNumber,
        url: task.pullNumber
          ? `https://github.com/${task.owner}/${task.repo}/pull/${task.pullNumber}`
          : `https://github.com/${task.owner}/${task.repo}/issues/${task.issueNumber}`,
      }
    );

    console.log(`Task ${taskId} marked as completed`);

    // ... rest of existing code ...
  } catch (error) {
    console.error('Error marking task as completed:', error);
  }
}

export async function markTaskFailed(
  taskId: string,
  reason?: string
): Promise<void> {
  try {
    const task = await databaseStorage.getTaskById(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    await databaseStorage.updateTask(taskId, {
      status: 'failed',
    });

    // Send notification
    await NotificationService.sendNotification(NotificationType.TASK_FAILED, {
      userId: task.userId,
      repositoryName: `${task.owner}/${task.repo}`,
      taskTitle: task.title,
      issueNumber: task.issueNumber,
      error: reason,
      url: task.issueNumber
        ? `https://github.com/${task.owner}/${task.repo}/issues/${task.issueNumber}`
        : '/',
    });

    console.log(
      `Task ${taskId} marked as failed: ${reason || 'Unknown error'}`
    );

    // ... rest of existing code ...
  } catch (error) {
    console.error('Error marking task as failed:', error);
  }
}
```

**Datei**: `server/routes.ts` (Modifikation der Webhook-Handler)

```typescript
// In handlePullRequestEvent function:
import {
  NotificationService,
  NotificationType,
} from './lib/notificationService';

async function handlePullRequestEvent(payload: any) {
  const action = payload.action;
  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  // ... existing code ...

  if (action === 'opened') {
    // PR was just created by Copilot
    await NotificationService.sendNotification(NotificationType.PR_CREATED, {
      userId: userRepo.userId,
      repositoryName: `${owner}/${repo}`,
      pullNumber: pr.number,
      issueNumber: activeTask.issueNumber,
      url: pr.html_url,
    });
  }

  // ... rest of existing code ...
}

// In tryAutoMergePR function, after successful merge:
async function tryAutoMergePR(/* ... parameters ... */) {
  try {
    // ... existing merge logic ...

    if (mergeResult.merged) {
      // Send merge notification
      const task = await databaseStorage.getTaskById(taskId);
      if (task) {
        await NotificationService.sendNotification(NotificationType.PR_MERGED, {
          userId: task.userId,
          repositoryName: `${owner}/${repo}`,
          pullNumber,
          url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
        });
      }

      // ... rest of existing code ...
    }
  } catch (error) {
    // ... error handling ...
  }
}
```

### Phase 7: iOS PWA Optimierungen

#### 7.1 PWA-spezifische Meta-Tags

**Datei**: `client/index.html` (Erweiterung)

```html
<!-- iOS PWA specific -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black-translucent"
/>
<meta name="apple-mobile-web-app-title" content="Hausmeister" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<link
  rel="apple-touch-startup-image"
  href="/splash-640x1136.png"
  media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
/>

<!-- Android/Chrome PWA -->
<meta name="mobile-web-app-capable" content="yes" />
<meta name="application-name" content="GitHub Hausmeister" />

<!-- Windows PWA -->
<meta name="msapplication-TileColor" content="#1f6feb" />
<meta name="msapplication-TileImage" content="/icon-192.png" />
```

#### 7.2 PWA-Installation-Prompt Component

**Datei**: `client/src/components/PWAInstallPrompt.tsx`

```tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Auto-show iOS prompt after delay
    if (iOS && !isStandalone) {
      const hasShownIOSPrompt = localStorage.getItem(
        'hausmeister-ios-prompt-shown'
      );
      if (!hasShownIOSPrompt) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('hausmeister-ios-prompt-shown', 'true');
    }
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
              App installieren
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-600 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-blue-700 dark:text-blue-300">
          {isIOS
            ? 'Installieren Sie die App für Push-Benachrichtigungen (iOS 16.4+)'
            : 'Installieren Sie die App für ein besseres Erlebnis'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isIOS ? (
          <div className="space-y-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              So installieren Sie die App:
            </p>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 pl-4">
              <li>
                1. Tippen Sie auf <strong>Teilen</strong> in Safari
              </li>
              <li>
                2. Wählen Sie <strong>"Zum Home-Bildschirm"</strong>
              </li>
              <li>
                3. Tippen Sie auf <strong>"Hinzufügen"</strong>
              </li>
            </ol>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Push-Benachrichtigungen funktionieren nur in der installierten
              App.
            </p>
          </div>
        ) : (
          <Button onClick={handleInstall} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Jetzt installieren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Phase 8: Testing und Debugging

#### 8.1 Notification Test Utilities

**Datei**: `server/lib/notificationTest.ts`

```typescript
import { NotificationService, NotificationType } from './notificationService';

export async function testAllNotificationTypes(userId: string): Promise<void> {
  const testContext = {
    userId,
    repositoryName: 'test/repository',
    taskTitle: 'Test Maintenance Task',
    issueNumber: 123,
    pullNumber: 456,
    copilotAgent: '@github-copilot',
    error: 'Test error message',
    url: 'https://github.com/test/repository',
  };

  const notificationTypes = Object.values(NotificationType);

  for (const type of notificationTypes) {
    console.log(`Testing notification type: ${type}`);
    try {
      await NotificationService.sendNotification(type, testContext);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay between notifications
    } catch (error) {
      console.error(`Failed to send ${type} notification:`, error);
    }
  }
}
```

#### 8.2 Debug API Endpoint

**Datei**: `server/routes.ts` (Debug-Endpunkt)

```typescript
// Debug endpoint for testing notifications
if (process.env.NODE_ENV === 'development') {
  app.post(
    '/api/debug/notifications/test-all',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { testAllNotificationTypes } = await import(
          './lib/notificationTest'
        );
        await testAllNotificationTypes(req.user!.id);
        res.json({ success: true, message: 'All notification types tested' });
      } catch (error) {
        console.error('Error testing notifications:', error);
        res.status(500).json({ error: 'Failed to test notifications' });
      }
    }
  );
}
```

## Implementierungsreihenfolge

### Sprint 1: PWA-Grundlagen (1-2 Wochen)

1. ✅ PWA Manifest erstellen und Icons hinzufügen
2. ✅ Service Worker Grundgerüst implementieren
3. ✅ Service Worker Registrierung im Frontend
4. ✅ PWA-Installation-Prompt Component

### Sprint 2: Push-Infrastructure (1 Woche)

1. ✅ VAPID-Keys generieren und konfigurieren
2. ✅ Web-Push Library Integration
3. ✅ Database Schema für Push-Subscriptions
4. ✅ API-Endpunkte für Subscription-Management

### Sprint 3: Frontend Push-Management (1 Woche)

1. ✅ usePushNotifications Hook
2. ✅ NotificationSettings Component
3. ✅ Integration in Dashboard
4. ✅ Permission-Handling und UX

### Sprint 4: Webhook-Integration (1 Woche)

1. ✅ NotificationService implementieren
2. ✅ Integration in bestehende Event-Handler
3. ✅ Notification-Content für verschiedene Events
4. ✅ Testing und Debugging-Tools

### Sprint 5: iOS-Optimierung und Testing (1 Woche)

1. ✅ iOS-spezifische PWA-Optimierungen
2. ✅ Umfassende Tests auf verschiedenen Geräten
3. ✅ Performance-Optimierung
4. ✅ Dokumentation und Deployment

## Technische Überlegungen

### Security

- **VAPID-Keys sicher speichern**: Environment Variables verwenden
- **Subscription-Validation**: Endpoint-URLs validieren
- **Rate Limiting**: Notification-Frequency begrenzen
- **User Consent**: Explizite Zustimmung für jeden Notification-Type

### Performance

- **Batch-Notifications**: Mehrere Subscriptions parallel verarbeiten
- **Error Handling**: Ungültige Subscriptions automatisch entfernen
- **Caching**: Service Worker Caching-Strategien optimieren
- **Database Indexing**: Indizes für Push-Subscription Queries

### UX Considerations

- **Permission Timing**: Erst nach Nutzer-Interaktion fragen
- **Notification Frequency**: Nicht zu häufig benachrichtigen
- **Content Relevance**: Relevante und actionable Notifications
- **iOS Installation**: Klare Anweisungen für PWA-Installation

### Monitoring

- **Success Rates**: Push-Delivery Success-Rates überwachen
- **User Engagement**: Notification-Click-Through-Rates messen
- **Error Tracking**: Failed-Push-Attempts loggen
- **Usage Analytics**: PWA-Installation und Usage-Patterns

## Fallback-Strategien

### Wenn Push nicht unterstützt

- **In-App Notifications**: Polling-basierte Updates im Frontend
- **Email Fallback**: Optional Email-Benachrichtigungen
- **Dashboard Indicators**: Visuelle Indikatoren für neue Events

### iOS Kompatibilität

- **Version Check**: iOS 16.4+ Detection
- **Installation Guide**: Schritt-für-Schritt Anweisungen
- **Progressive Enhancement**: App funktioniert auch ohne Push

### Browser-Kompatibilität

- **Feature Detection**: Service Worker und Push-API Support prüfen
- **Graceful Degradation**: Functionality ohne Push-Support
- **Legacy Browser**: Fallback für ältere Browser

## Wartung und Updates

### Service Worker Updates

- **Versioning**: Cache-Namen für Updates
- **Update-Detection**: Neue SW-Versionen automatisch aktivieren
- **Migration**: Datenmigrationen zwischen SW-Versionen

### VAPID-Key Rotation

- **Key Rotation**: Sichere VAPID-Key Aktualisierung
- **Subscription Migration**: Bestehende Subscriptions migrieren
- **Downtime Minimization**: Zero-Downtime Deployment

## Erfolg-Metriken

### Technische Metriken

- **Push-Delivery-Rate**: % erfolgreich gesendeter Notifications
- **PWA-Installation-Rate**: % Nutzer die App installieren
- **Subscription-Rate**: % Nutzer die Push aktivieren
- **Error Rate**: % fehlgeschlagener Push-Operationen

### Business Metriken

- **User Engagement**: Erhöhte App-Nutzung durch Push
- **Task Completion Awareness**: Schnellere Response auf Events
- **User Retention**: Verbesserte User Retention durch Notifications

### User Experience Metriken

- **Permission Grant Rate**: % Nutzer die Push-Permission erteilen
- **Notification Click Rate**: % geklickter Notifications
- **Unsubscribe Rate**: % Nutzer die Push deaktivieren
- **App Rating**: User-Feedback zu Push-Feature

---

## Fazit

Diese Push-Notification-Strategie transformiert GitHub Hausmeister von einer Web-Anwendung zu einer vollwertigen PWA mit modernen Push-Capabilities. Die Implementierung erfolgt in klar definierten Phasen mit expliziten Fallback-Strategien und berücksichtigt die spezifischen Anforderungen verschiedener Plattformen, insbesondere iOS.

Das System integriert sich nahtlos in die bestehende Webhook-Architektur und erweitert die User Experience erheblich, ohne die Kernfunktionalität zu beeinträchtigen. Durch die umfassende Konfigurierbarkeit können Nutzer die Benachrichtigungen nach ihren individuellen Bedürfnissen anpassen.
