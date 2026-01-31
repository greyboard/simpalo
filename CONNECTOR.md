# Simpalo Connector - Universeller Lead-Grabber

Der Simpalo Connector ist ein JavaScript-Script, das auf Kundenwebseiten eingebunden werden kann, um automatisch Formular-Submits zu erfassen und an dein Simpalo-System zu senden.

## 🚀 Funktionsweise

Das Script:
1. **Fängt alle Formular-Submits ab** - Automatisch für alle Formulare auf der Seite
2. **Sammelt UTM-Parameter** - Aus URL und LocalStorage (bleiben über mehrere Seitenaufrufe erhalten)
3. **Sendet Daten an Webhook** - Per POST-Request an deinen konfigurierten Webhook
4. **Behält originale Logik bei** - Das Formular wird nach dem Webhook-Aufruf normal abgesendet

## 📦 Installation

### 1. Webhook erstellen

1. Gehe zu **Dashboard → Einstellungen → Webhooks**
2. Erstelle einen neuen Webhook (z.B. "Website Formular")
3. Kopiere die **Webhook-ID** aus der angezeigten URL

### 2. Script einbinden

Füge folgenden Code am Ende des `<body>` Tags der Kundenwebseite ein:

```html
<script 
  src="https://simpalo.de/connector.js" 
  data-webhook-id="YOUR_WEBHOOK_ID"
></script>
```

**Wichtig:** 
- Ersetze `YOUR_WEBHOOK_ID` mit deiner echten Webhook-ID
- Ersetze `https://simpalo.de` mit der URL deiner Simpalo-Installation
- Die Webhook-URL wird **automatisch generiert** basierend auf `NEXT_PUBLIC_API_URL` oder `NEXTAUTH_URL` aus den ENV-Variablen
- Keine manuelle URL-Konfiguration im Script nötig!

### 3. Beispiel

```html
<!DOCTYPE html>
<html>
<head>
  <title>Kontaktformular</title>
</head>
<body>
  <form action="/thank-you" method="POST">
    <input type="text" name="name" placeholder="Name" required>
    <input type="email" name="email" placeholder="E-Mail" required>
    <textarea name="message" placeholder="Nachricht" required></textarea>
    <button type="submit">Absenden</button>
  </form>

  <!-- Simpalo Connector -->
  <!-- Die Webhook-URL wird automatisch generiert: https://simpalo.de/api/webhooks/incoming/abc123xyz -->
  <script 
    src="https://simpalo.de/connector.js" 
    data-webhook-id="abc123xyz"
  ></script>
</body>
</html>
```

## 🔧 Funktionsdetails

### UTM-Tracking

Das Script erkennt automatisch UTM-Parameter in der URL:
- `utm_source` - Quelle (z.B. "google", "facebook")
- `utm_medium` - Medium (z.B. "cpc", "email")
- `utm_campaign` - Kampagne (z.B. "summer-sale")
- `utm_content` - Content (z.B. "logolink")
- `utm_term` - Term (z.B. "running shoes")

**Beispiel URL:**
```
https://example.com/contact?utm_source=google&utm_medium=cpc&utm_campaign=summer-sale
```

Die UTM-Parameter werden im LocalStorage gespeichert (Präfix: `smp_`) und bleiben über mehrere Seitenaufrufe erhalten, auch wenn der User auf andere Seiten navigiert.

### Payload-Struktur

Das Script sendet folgende Daten an den Webhook:

```json
{
  "formData": {
    "name": "Max Mustermann",
    "email": "max@example.de",
    "message": "Ich interessiere mich für..."
  },
  "utm": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "summer-sale"
  },
  "url": "https://example.com/contact",
  "referrer": "https://google.com",
  "timestamp": "2026-01-26T10:30:00.000Z",
  "userAgent": "Mozilla/5.0...",
  "language": "de-DE"
}
```

### Formular-Submit

Das Script:
1. Fängt den Submit ab (`preventDefault()`)
2. Sammelt alle Formulardaten
3. Sendet Daten an Webhook (non-blocking)
4. Führt das originale Formular-Submit aus (`form.submit()`)

**Wichtig:** Die originale Formular-Logik (Danke-Seite, E-Mail-Versand, etc.) bleibt vollständig erhalten!

## 🧪 Testen

### Lokale Tests

1. Öffne `http://localhost:3000/test-connector.html` im Browser
2. Öffne die Browser-Konsole (F12), um Logs zu sehen
3. Fülle das Formular aus und sende es ab
4. Prüfe in Simpalo, ob der Lead erstellt wurde

### Test mit UTM-Parametern

Füge UTM-Parameter zur URL hinzu:
```
http://localhost:3000/test-connector.html?utm_source=google&utm_medium=cpc&utm_campaign=test
```

Die UTM-Parameter werden automatisch erkannt und im LocalStorage gespeichert.

### Production-Test

1. Binde das Script auf einer Test-Webseite ein
2. Verwende eine echte Webhook-ID
3. Teste das Formular-Submit
4. Prüfe in Simpalo, ob der Lead erstellt wurde

## 📍 Bereitstellung in Next.js/Vercel

### Dynamische Script-Bereitstellung

Das Script wird **dynamisch über eine API-Route** bereitgestellt:

- `app/connector.js/route.ts` → `https://simpalo.de/connector.js`
- `public/test-connector.html` → `https://simpalo.de/test-connector.html`

**Vorteile der dynamischen Bereitstellung:**
- Die Webhook-URL wird automatisch aus ENV-Variablen generiert (`NEXT_PUBLIC_API_URL` oder `NEXTAUTH_URL`)
- Keine manuelle URL-Konfiguration nötig
- Funktioniert automatisch für jede Kunden-Installation

**Wichtig:** Die API-URL muss in den Vercel ENV-Variablen gesetzt sein:
```env
NEXT_PUBLIC_API_URL=https://simpalo.de/api
# Oder es wird automatisch aus NEXTAUTH_URL generiert
```

### Verifizierung

Nach dem Deployment kannst du prüfen:

```bash
# Prüfe, ob das Script erreichbar ist
curl https://simpalo.de/connector.js

# Prüfe Content-Type (sollte text/javascript sein)
curl -I https://simpalo.de/connector.js
```

### CORS-Header (optional)

Falls du CORS-Header für das Script setzen möchtest, kannst du `next.config.mjs` erweitern:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/connector.js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Content-Type',
            value: 'text/javascript',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Hinweis:** Normalerweise nicht nötig, da JavaScript-Dateien standardmäßig von allen Domains geladen werden können.

## 🔒 Sicherheit

- Das Script verwendet `no-cors` Mode für Cross-Origin Requests
- Webhook-Authentifizierung erfolgt über die Webhook-ID in der URL
- Keine sensiblen Daten werden im Script gespeichert
- LocalStorage wird nur für UTM-Parameter verwendet (nicht für persönliche Daten)

## 🐛 Debugging

### Browser-Konsole

Das Script loggt alle wichtigen Aktionen in die Browser-Konsole:

```
[Simpalo Connector] Initialisiert mit Webhook: https://...
[Simpalo Connector] Event-Listener registriert
[Simpalo Connector] Formular-Submit abgefangen: <form>
[Simpalo Connector] Payload: {...}
[Simpalo Connector] Daten an Webhook gesendet
```

### Häufige Probleme

**Problem:** Script wird nicht geladen
- **Lösung:** Prüfe, ob die URL korrekt ist: `https://simpalo.de/connector.js`
- **Lösung:** Prüfe Browser-Konsole auf Fehler

**Problem:** Webhook wird nicht aufgerufen
- **Lösung:** Prüfe, ob `data-webhook` Attribut korrekt gesetzt ist
- **Lösung:** Prüfe Browser-Konsole auf Fehler
- **Lösung:** Prüfe Network-Tab im Browser (F12 → Network)

**Problem:** Formular wird nicht abgesendet
- **Lösung:** Prüfe Browser-Konsole - das Script sollte "Formular-Submit abgefangen" loggen
- **Lösung:** Prüfe, ob das Formular ein `action` Attribut hat

**Problem:** UTM-Parameter werden nicht gespeichert
- **Lösung:** Prüfe LocalStorage im Browser (F12 → Application → Local Storage)
- **Lösung:** Prüfe, ob UTM-Parameter in der URL vorhanden sind

## 📚 Weitere Informationen

- **Webhook-Dokumentation:** Siehe `WEBHOOKS.md`
- **API-Dokumentation:** Siehe `README.md`
