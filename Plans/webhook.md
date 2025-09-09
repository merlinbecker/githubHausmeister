# Webhook Weiterleitung - Implementierungsplan

## Übersicht

Dieses Feature ermöglicht es Benutzern, eine konfigurierbare URL zu definieren, an die alle eingehenden Webhooks von den überwachten Repositories weitergeleitet werden. Die weitergeleiteten Webhooks haben einen transformierten Payload mit den Feldern `repository`, `title` und `text`.

## Architektur

### Datenbank-Schema Erweiterung

**Tabelle: `users`**
- Neues Feld: `webhook_forward_url` (TEXT, optional)
- Speichert die URL, an die Webhooks weitergeleitet werden sollen

### API Endpoints

**GET `/api/user/webhook-forward-url`**
- Gibt die aktuelle Webhook-Weiterleitungs-URL des Benutzers zurück
- Authentifizierung erforderlich

**POST `/api/user/webhook-forward-url`**
- Setzt oder aktualisiert die Webhook-Weiterleitungs-URL
- Body: `{ "forwardUrl": "https://example.com/webhook" }`
- Validierung: URL-Format prüfen
- Authentifizierung erforderlich

### Webhook-Weiterleitung

**Implementierung im bestehenden Webhook-Handler (`/api/webhook`)**

1. Nach erfolgreicher Verarbeitung eines Webhooks
2. Für alle Benutzer, die das entsprechende Repository überwachen
3. Wenn `webhook_forward_url` konfiguriert ist
4. Transformierter Payload senden:

```json
{
  "repository": "owner/repo-name",
  "title": "Webhook-spezifischer Titel",
  "text": "Webhook-spezifische Beschreibung"
}
```

### Payload-Transformation Logik

**Pull Request Events:**
- Title: `"Pull Request ${action}: #${number} ${title}"`
- Text: `"${action} by ${actor} in ${repository}"`

**Issues Events:**
- Title: `"Issue ${action}: #${number} ${title}"`  
- Text: `"${action} by ${actor} in ${repository}"`

**CI/CD Events (workflow_run, check_suite, check_run):**
- Title: `"CI ${conclusion}: ${workflow_name}"`
- Text: `"${conclusion} in ${repository} by ${actor}"`

**Generic Events:**
- Title: `"${event} Event"`
- Text: `"${event} triggered in ${repository} by ${actor}"`

### Frontend UI

**User Settings Bereich erweitern**
- Neues Eingabefeld für Webhook Forward URL
- URL-Validierung im Frontend
- Save/Update Button
- Optional: Test-Button zum Testen der Weiterleitung

## Implementierungsschritte

### Phase 1: Backend Implementation (2-3 Stunden)

1. **Schema Update**
   - `shared/schema.ts`: `webhook_forward_url` zu `users` Tabelle hinzufügen
   - Migration durchführen

2. **API Endpoints**  
   - `server/routes.ts`: GET/POST Endpoints für webhook forward URL
   - Input-Validierung (URL-Format)
   - Error Handling

3. **Webhook Forwarding Logic**
   - `server/routes.ts`: Forwarding-Funktion implementieren
   - Payload-Transformation für verschiedene Event-Types
   - HTTP Client für Weiterleitung
   - Fehlerbehandlung (Timeout, Retry-Logic)

### Phase 2: Frontend Implementation (1-2 Stunden)

4. **User Settings UI**
   - Komponente für Webhook Forward URL Setting
   - Integration in bestehende Settings-Seite
   - Form-Validierung und Fehlerbehandlung

5. **API Integration**
   - `client/src/lib/api.ts`: API-Funktionen für Forward URL
   - TanStack Query Integration für Caching

### Phase 3: Testing & Documentation (1 Stunde)

6. **Testing**
   - Manuelle Tests mit verschiedenen Webhook-Events
   - URL-Validierung testen  
   - Error-Scenarios testen

7. **Documentation**
   - README Update mit Feature-Beschreibung
   - Code-Kommentare erweitern

## Technische Details

### HTTP Client für Forwarding

```typescript
async function forwardWebhook(url: string, payload: TransformedPayload) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Hausmeister-Forwarder/1.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      console.warn(`Webhook forward failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Webhook forward error:', error);
    // Do not fail original webhook processing
  }
}
```

### Security Considerations

1. **URL Validation**: Nur HTTPS URLs erlauben (außer localhost für Development)
2. **Rate Limiting**: Schutz vor Missbrauch der Forwarding-Funktion
3. **Timeout**: 10 Sekunden Timeout für Forward-Requests
4. **Error Isolation**: Forwarding-Fehler dürfen Original-Webhook nicht beeinträchtigen

## Integration mit bestehender Architektur

### Kompatibilität
- Bestehende Webhook-Verarbeitung bleibt unverändert
- Forwarding ist opt-in (nur wenn URL konfiguriert)
- Keine Breaking Changes für bestehende Funktionalität

### Performance
- Asynchrone Forwarding-Requests
- Parallele Weiterleitung für mehrere Benutzer
- Caching der Forward-URLs

## Erweiterungsmöglichkeiten (Future Scope)

1. **Webhook-Filter**: Nur bestimmte Event-Types weiterleiten
2. **Custom Headers**: Benutzer-definierte HTTP Headers
3. **Webhook-Signatures**: HMAC-Signierung der weitergeleiteten Payloads
4. **Retry-Mechanismus**: Exponential backoff bei Fehlern
5. **Webhook-Logs**: Dashboard für Forward-Status und Fehler

---

**Geschätzte Implementierungszeit**: 4-6 Stunden  
**Priorität**: Medium  
**Abhängigkeiten**: Keine