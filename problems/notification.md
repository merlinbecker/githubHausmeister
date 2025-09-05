# Push-Notification-Probleme: Vollständige Analyse

## Zusammenfassung

Das GitHub Hausmeister-System zeigt persistente Probleme mit Web-Push-Notifications. Trotz mehrerer Lösungsversuche scheitern Push-Benachrichtigungen konsistent bei allen Push-Service-Anbietern mit JWT-Authentication-Fehlern.

## Aktuelle Fehlermeldungen (Stand: 05.09.2025, 06:08-06:10 Uhr)

```
❌ Failed to send push notification: WebPushError: Received unexpected response code
statusCode: 401
headers: {
  'x-wns-error-description': 'JWT Authentication Failed, unabled to validate token signature',
  'x-wns-status': 'dropped',
  'x-wns-notificationstatus': 'dropped'
}
endpoint: 'https://wns2-am3p.notify.windows.com/w/?token=...'

❌ Failed to send push notification: WebPushError: Received unexpected response code  
statusCode: 403
headers: {
  'content-security-policy-report-only': "script-src 'none'; form-action 'none';..."
}
body: 'permission denied: invalid JWT provided'
endpoint: 'https://fcm.googleapis.com/fcm/send/...'
```

**Betroffene Push-Services:**
- FCM (Firebase Cloud Messaging) - Google Chrome: 403 "invalid JWT provided"
- WNS (Windows Notification Service) - Microsoft Edge: 401 "JWT Authentication Failed"

**Test-Ergebnisse:** `{"success":true,"sent":0,"failed":5}` - Alle Push-Versuche schlagen fehl.

## Historie der Lösungsversuche

### Phase 1: API-Polling-Optimierung
**Problem:** Übermäßige Server-Last durch aggressive Polling-Intervalle
- Automatische `/api/mentra` Requests alle 3 Sekunden eliminiert
- Webhook-Polling von 5 auf 30 Sekunden reduziert
- **Ergebnis:** Performance verbessert, Push-Problem blieb bestehen

### Phase 2: VAPID-Konfigurationsbereinigung  
**Problem:** Doppelte VAPID-Details in globalem Setup und lokalen Send-Optionen
- Duplikat `vapidDetails` aus `sendNotification` Optionen entfernt
- Nur globale `setVapidDetails()` beibehalten
- **Ergebnis:** Konfigurationskonflikt behoben, JWT-Fehler blieben

### Phase 3: VAPID-Key-Regenerierung
**Problem:** Verdacht auf defekte VAPID-Keys
- Neue kryptographisch korrekte VAPID-Keys generiert:
  - Public Key: 65 Bytes (BEEZCJGVw2HNcq_likvUNl_Wa4iHUOgD0sADtiCnegbWJ5gbGz2ozG1B9UOe60eb_qUOHpvWyNGz7MM_ZEG_dDg)
  - Private Key: 32 Bytes (J5gbGz2ozG1B9UOe60eb_qUOHpvWyNGz7MM_ZEG_dDg)
- **Ergebnis:** Key-Validierung erfolgreich, JWT-Fehler bestehen weiter

### Phase 4: VAPID_SUBJECT Format-Korrektur
**Problem:** `VAPID_SUBJECT` ohne "mailto:" Präfix führte zu "not a valid URL" Fehler
- Automatische "mailto:" Präfix-Erkennung und -Korrektur implementiert in `initializeWebPush()`
- Environment Variable: `VAPID_SUBJECT=merlinbecker@users.noreply.github.com` (ohne mailto:)
- Code-Korrektur: Prüfung und automatisches Hinzufügen von "mailto:" wenn fehlend
- **Ergebnis:** Initialisierung erfolgreich, aber Sende-Operation schlägt weiter fehl

### Phase 5: Lokale VAPID-Details Entfernung
**Problem:** Lokale `vapidDetails` in `sendPushNotification()` überschrieben globale Einstellungen
- Lokale `vapidDetails` komplett aus Sende-Optionen entfernt
- Nur globale VAPID-Einstellungen verwendet
- **Ergebnis:** Konfigurationskonsistenz erreicht, JWT-Authentifizierung schlägt weiter fehl

## Technischer Ablauf der Push-Notification

### 1. Initialisierung (beim Server-Start)
**Datei:** `server/lib/webPush.ts` → `initializeWebPush()`
```typescript
// VAPID-Keys aus Environment laden
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
let subject = process.env.VAPID_SUBJECT || 'mailto:merlinbecker@users.noreply.github.com';

// mailto: Präfix sicherstellen
if (subject && !subject.startsWith('mailto:') && !subject.startsWith('http')) {
  subject = `mailto:${subject}`;
}

// Global webpush konfigurieren
webpush.setVapidDetails(subject, publicKey, privateKey);
```

### 2. Client-seitige Subscription
**Datei:** `client/src/hooks/usePushNotifications.ts` → `subscribe()`
```typescript
// VAPID Public Key vom Server holen
const vapidResponse = await fetch('/api/push/vapid-public-key');
const { publicKey } = await vapidResponse.json();

// Browser Push Manager Subscription
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(publicKey),
});

// Subscription an Server senden
await fetch('/api/push/subscribe', {
  method: 'POST',
  body: JSON.stringify(subscription.toJSON()),
});
```

### 3. Push-Notification Versand
**Datei:** `server/lib/webPush.ts` → `sendPushNotification()`
```typescript
// Nur TTL-Option, keine lokalen VAPID-Details
const options = {
  TTL: 86400 // 24 hours
  // No local vapidDetails - use global setVapidDetails()
};

// Web-push library Aufruf
await webpush.sendNotification(subscription, JSON.stringify(payload), options);
```

### 4. Test-Trigger
**Datei:** `client/src/components/PushNotificationTester.tsx`
- UI-Component für manuelle Tests
- Route: `POST /api/push/test` für Server-Tests
- Comprehensive Testing mit Browser-Detection

## Beteiligte Code-Dateien

### Backend (Node.js/Express)
- **`server/lib/webPush.ts`** - Haupt-Push-Notification-Logik
- **`server/routes.ts`** - API-Endpunkte für Push-Funktionen  
- **`server/index.ts`** - Server-Initialisierung mit `initializeWebPush()` Aufruf

### Frontend (React)
- **`client/src/hooks/usePushNotifications.ts`** - React Hook für Push-Funktionalität
- **`client/src/components/PushNotificationTester.tsx`** - Test-UI-Component
- **`client/src/lib/serviceWorker.ts`** - Service Worker Reset-Funktionen

### Konfiguration
- **Environment Variables:**
  - `VAPID_PUBLIC_KEY` - 65-Byte VAPID Public Key (Base64URL)
  - `VAPID_PRIVATE_KEY` - 32-Byte VAPID Private Key (Base64URL)  
  - `VAPID_SUBJECT` - E-Mail ohne "mailto:" Präfix (wird automatisch hinzugefügt)

## Push-Service-Endpunkte

**Identifizierte Endpunkt-Typen:**
1. **FCM (Google Chrome):** `https://fcm.googleapis.com/fcm/send/...`
2. **WNS (Microsoft Edge):** `https://wns2-am3p.notify.windows.com/w/?token=...`

## IST-Zustand Systemstatus

### Erfolgreich funktionierende Bereiche
- ✅ VAPID-Keys-Validierung (65/32 Bytes korrekt)
- ✅ Web-push Bibliothek Initialisierung 
- ✅ Service Worker Registration
- ✅ Browser Push Manager Subscription
- ✅ Server-seitige Subscription-Speicherung
- ✅ API-Endpunkt Erreichbarkeit

### Persistierende Probleme
- ❌ JWT-Token-Generierung oder -Signierung inkorrekt
- ❌ Alle Push-Service-Provider lehnen Authentifizierung ab
- ❌ 0 erfolgreich gesendete Notifications bei allen Tests
- ❌ Sowohl Chrome (FCM) als auch Edge (WNS) betroffen

### Technische Symptome
- Server-Log zeigt erfolgreiche VAPID-Initialisierung
- Client kann sich erfolgreich für Push subscriben
- JWT-Authentifizierung schlägt bei allen Push-Services fehl
- Keine Browser-spezifischen Unterschiede in der Fehlerart

## Hypothesen zu Root-Cause (Nicht verifiziert)

Basierend auf den konsistenten JWT-Fehlern across alle Push-Services könnte das Problem liegen in:
1. **JWT-Claim-Struktur** - `aud`, `exp`, `sub` Claims möglicherweise inkorrekt
2. **Key-Format-Inkompatibilität** - Trotz korrekter Byte-Länge könnte Key-Encoding problematisch sein
3. **web-push Library Version** - Möglicherweise Inkompatibilität mit aktuellen Push-Service-APIs
4. **Signature-Algorithmus** - ECDSA P-256 Signature möglicherweise inkorrekt generiert

**Wichtig:** Diese sind unverfiizierte Hypothesen. Das eigentliche Problem bleibt ungelöst.