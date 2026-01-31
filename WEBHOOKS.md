# Webhook-Dokumentation

## Übersicht

Die Webhook-Funktionalität ermöglicht es, Leads automatisch aus externen Quellen zu erstellen. Jeder Webhook ist einer Lead-Quelle zugeordnet und kann individuell konfiguriert werden.

## Webhook-Model

Jeder Webhook hat folgende Eigenschaften:
- **name**: Bezeichnung des Webhooks (z.B. "Website Formular", "Zapier Integration")
- **source**: Lead-Quelle (wird als `source` beim Lead gespeichert)
- **secret**: Eindeutiger Token für Authentifizierung (wird automatisch generiert)
- **url**: Optional: URL für eigene Webhooks
- **isActive**: Aktiv/Deaktiviert Status
- **settings**: JSON-Konfiguration für Feld-Mapping und weitere Optionen

## API-Endpunkte

### Webhook-Management

#### GET /api/webhooks
Ruft alle Webhooks ab (ohne Secrets)

#### POST /api/webhooks
Erstellt einen neuen Webhook

**Request Body:**
```json
{
  "name": "Website Formular",
  "source": "Website Form",
  "url": "https://example.com/webhook",
  "settings": {
    "fieldMapping": {
      "name": "fullName",
      "email": "emailAddress"
    },
    "autoTags": ["Website", "Formular"],
    "checkDuplicates": true
  }
}
```

**Response:**
```json
{
  "id": "...",
  "name": "Website Formular",
  "source": "Website Form",
  "secret": "abc123...", // Nur beim Erstellen zurückgegeben
  "url": "https://example.com/webhook",
  "isActive": true,
  "settings": {...},
  "createdAt": "...",
  "updatedAt": "..."
}
```

#### GET /api/webhooks/[id]
Ruft einen einzelnen Webhook ab (mit Secret)

#### PUT /api/webhooks/[id]
Aktualisiert einen Webhook

**Request Body:**
```json
{
  "name": "Neuer Name",
  "isActive": false,
  "settings": {...}
}
```

#### DELETE /api/webhooks/[id]
Löscht einen Webhook

### Eingehende Webhooks

#### POST /api/webhooks/incoming/[webhookId]
Empfängt eingehende Webhook-Daten und erstellt Leads
**Kein Secret erforderlich** - nur die URL wird benötigt (wie bei Zoho, GoHighLevel)

**URL:** `https://your-domain.com/api/webhooks/incoming/[WEBHOOK_ID]`

**Request Body (Beispiel):**
```json
{
  "name": "Max Mustermann",
  "businessName": "Mustermann GmbH",
  "email": "max@mustermann.de",
  "phone": "+49 123 456789",
  "website": "https://mustermann.de",
  "address": "Musterstraße 123, 12345 Musterstadt",
  "city": "Musterstadt",
  "zipCode": "12345",
  "country": "DE",
  "category": "Restaurant"
}
```

**Response (Success):**
```json
{
  "success": true,
  "lead": {
    "id": "...",
    "name": "Max Mustermann",
    "source": "Website Form",
    ...
  },
  "message": "Lead erfolgreich erstellt"
}
```

**Response (Duplicate):**
```json
{
  "error": "Lead existiert bereits",
  "existingLeadId": "...",
  "existingLead": {...}
}
```

## Feld-Mapping

Das Feld-Mapping ermöglicht es, verschiedene Payload-Formate zu unterstützen:

**Beispiel Settings:**
```json
{
  "fieldMapping": {
    "name": "fullName",
    "email": "emailAddress",
    "phone": "telephone",
    "address": "streetAddress"
  }
}
```

Wenn der Payload `fullName` enthält, wird es als `name` gespeichert.

## Automatische Tags

Webhooks können automatisch Tags zu neuen Leads hinzufügen:

**Beispiel Settings:**
```json
{
  "autoTags": ["Website", "Formular", "2024"]
}
```

## Duplikat-Prüfung

Standardmäßig wird auf Duplikate geprüft (basierend auf E-Mail oder Telefon). Dies kann deaktiviert werden:

```json
{
  "checkDuplicates": false
}
```

## Verwendung mit Zapier

1. Erstelle einen Webhook in der App
2. Kopiere die `webhookId` aus der angezeigten URL
3. In Zapier: Verwende "Webhooks by Zapier" → "Catch Hook"
4. URL: `https://your-domain.com/api/webhooks/incoming/[WEBHOOK_ID]`
5. Sende Lead-Daten als JSON

## Verwendung mit Typeform

1. Erstelle einen Webhook in der App
2. Kopiere die Webhook-URL
3. In Typeform: Settings → Integrations → Webhooks
4. URL: `https://your-domain.com/api/webhooks/incoming/[WEBHOOK_ID]`
5. Mappe Formularfelder auf Lead-Felder

## Verwendung mit GoHighLevel / Zoho

1. Erstelle einen Webhook in der App
2. Kopiere die Webhook-URL
3. In GoHighLevel/Zoho: Settings → Integrations → Webhooks
4. URL: `https://your-domain.com/api/webhooks/incoming/[WEBHOOK_ID]`
5. Kein Secret erforderlich - nur die URL

## Beispiel: Website-Formular

```html
<form action="https://your-domain.com/api/webhooks/incoming/[WEBHOOK_ID]" method="POST">
  <input name="name" required>
  <input name="email" type="email" required>
  <input name="phone">
  <input name="businessName">
  <button type="submit">Absenden</button>
</form>
```

## Sicherheit

- Jeder Webhook hat eine eindeutige `webhookId` in der URL
- Webhooks können deaktiviert werden (`isActive: false`)
- Optional: Secret kann für zusätzliche Authentifizierung hinzugefügt werden
- Duplikat-Prüfung verhindert doppelte Leads
- Die `webhookId` ist kryptographisch sicher generiert

## Migration

Nach dem Hinzufügen des Webhook-Models muss die Datenbank migriert werden:

```bash
npx prisma migrate dev --name add_webhooks
```
