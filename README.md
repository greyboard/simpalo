# simpalo

Open-Source Lead-Generierungs- und CRM-Webapp für lokale Unternehmen. Leads verwalten, Kampagnen tracken, Webhooks und den Simpalo Connector für Kundenwebseiten nutzen.

**Website:** [https://simpalo.de](https://simpalo.de)

## 🧪 Demoversion

Zum Ausprobieren ohne eigene Installation:

| | |
|---|---|
| **URL** | [https://demo.simpalo.de/](https://demo.simpalo.de/) |
| **Benutzer** | `demo@simpalo.de` |
| **Passwort** | `Start12345&DEMO` |

## Features

- **Dashboard** – KPIs, Kontakte, Aufgaben
- **Leads & Kontakte** – Verwaltung mit Tags, Notizen, Kampagnen-Zuordnung
- **Kampagnen** – UTM-basiertes Tracking
- **Webhooks** – eingehende Leads (Zapier, Typeform, eigener Connector)
- **Simpalo Connector** – ein Script-Tag auf der Kundenwebseite fängt Formulare ab und sendet sie an deinen Webhook
- **E-Mail** – optional mit Mailgun (account- oder global-level)
- **Multi-Account** – Accounts, Benutzer, Rollen (Superadmin, Admin, User)
- **Auth** – NextAuth (Credentials), Superadmin per ENV

## Tech Stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **PostgreSQL** + **Prisma**
- **NextAuth.js**, **TanStack Query**, **Zod**, **Recharts**, **Lucide**

## Installation auf Vercel (komplett)

### 1. Repository verbinden

1. [Vercel](https://vercel.com) → **Add New Project**
2. Git-Provider wählen (GitHub, GitLab, Bitbucket), Repository auswählen
3. **Import** bestätigen

### 2. Datenbank anlegen

**Vercel Postgres (empfohlen):**

1. Im Projekt: **Storage** → **Create Database** → **Postgres**
2. Region wählen, anlegen
3. `DATABASE_URL` wird automatisch als Environment Variable gesetzt

**Externe Datenbank (z. B. Neon, Supabase):**

- PostgreSQL-Connection-String besorgen
- In Schritt 3 als `DATABASE_URL` eintragen

### 3. Environment Variables setzen

Im Projekt: **Settings** → **Environment Variables**. Für **Production** (und ggf. Preview) setzen:

| Variable | Pflicht | Beschreibung |
|----------|--------|--------------|
| `DATABASE_URL` | ✅ | PostgreSQL-Connection-String (bei Vercel Postgres oft schon gesetzt) |
| `NEXTAUTH_URL` | ✅ | App-URL, z. B. `https://dein-projekt.vercel.app` |
| `NEXTAUTH_SECRET` | ✅ | Zufälliges Secret, z. B. `openssl rand -base64 32` |
| `SUPERADMIN_EMAIL` | ✅ | E-Mail des ersten Admins |
| `SUPERADMIN_PASSWORD` | ✅ | Passwort des ersten Admins |

Optionale Variablen (siehe `.env.example`):

- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` – Fallback-URLs
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_API_KEY` – Google Places/Maps
- `MAILGUN_*` – E-Mail-Versand mit Mailgun

### 4. Deploy auslösen

1. **Deploy** starten (oder nach dem ersten Push automatisch).
2. Build: `prisma generate` und `next build` (siehe `vercel.json`).

### 5. Datenbank-Schema (Tabellen)

**Option A – Automatisch per API (schnell):**

- Tabellen fehlen noch: `POST https://dein-projekt.vercel.app/api/setup/migrate` aufrufen.
- Status prüfen: `GET …/api/setup/migrate`.

**Option B – Migrationen (für Produktion empfohlen):**

Lokal (einmalig):

```bash
cp .env.example .env.local
# .env.local mit DATABASE_URL füllen (z. B. von Vercel kopieren)
npx prisma migrate dev --name init
git add prisma/migrations
git commit -m "Add initial migration"
git push
```

Beim nächsten Deploy auf Vercel: Migrationen ggf. in **Build** oder per Skript ausführen (`prisma migrate deploy`), je nachdem wie du es in `vercel.json`/Skripten eingerichtet hast.

### 6. Superadmin & erster Login

- Beim **ersten Request** (z. B. Startseite oder Login-Seite) legt die App automatisch den Superadmin an, wenn `SUPERADMIN_EMAIL` und `SUPERADMIN_PASSWORD` gesetzt sind.
- Einfach **Login** öffnen und mit diesen Zugangsdaten anmelden.

### 7. Nützliche Befehle (lokal)

```bash
npm install
cp .env.example .env.local
# .env.local anpassen

npx prisma generate
npx prisma db push          # Schema an DB anpassen (Dev)
# oder
npx prisma migrate deploy   # Migrationen anwenden (Prod)

npm run dev                 # http://localhost:3000
```

Optional:

```bash
npm run db:studio            # Prisma Studio
npm run db:init             # Superadmin manuell anlegen (nutzt ENV)
npm run db:import-demo      # Demodaten importieren (DATABASE_URL nötig)
```

## Projektstruktur (Auszug)

```
├── app/
│   ├── api/              # API-Routen (Auth, Webhooks, Leads, …)
│   ├── auth/             # Login, Register
│   ├── dashboard/        # Dashboard, Leads, Kampagnen, Einstellungen
│   ├── connector.js/     # Simpalo-Connector-Script (dynamisch)
│   └── layout.tsx
├── components/           # UI-Komponenten
├── lib/                  # Auth, Prisma, API-Clients, Mailgun, …
├── prisma/
│   └── schema.prisma
├── public/               # Statische Dateien, test-connector.html
├── .env.example          # Vorlage für Umgebungsvariablen
└── README.md
```

## Simpalo Connector (Kundenwebseite)

Ein Script wird unter `/connector.js` ausgeliefert (dynamisch, nutzt `NEXT_PUBLIC_API_URL` bzw. `NEXTAUTH_URL`). Auf der Kundenwebseite einbinden:

```html
<script
  src="https://deine-app.vercel.app/connector.js"
  data-webhook-id="DEINE_WEBHOOK_ID"
></script>
```

Webhook-ID erstellst du unter **Einstellungen → Webhooks**; dort gibt es auch einen **Kopieren**-Button für das Script-Tag. Details: [CONNECTOR.md](./CONNECTOR.md).

## Webhooks

- **Eingehende Webhooks:** `POST /api/webhooks/incoming/[webhookId]` – kein Secret nötig, nur URL.
- Verwaltung und Feld-Mapping unter **Einstellungen → Webhooks**.  
Vollständige API-Beschreibung: [WEBHOOKS.md](./WEBHOOKS.md).

## Sicherheit & Open Source

- **Keine API-Keys oder Secrets im Repo.** Alle sensiblen Werte kommen aus Environment Variables (lokal `.env.local`, auf Vercel Project Settings).
- `.env` und `.env.local` sind in `.gitignore`; nur `.env.example` mit Platzhaltern liegt im Repo.
- NEXTAUTH_SECRET und SUPERADMIN-Passwort immer stark und pro Umgebung unterschiedlich wählen.

## Lizenz

[Lizenz nach Wahl eintragen, z. B. MIT]

## Beitragen

1. Repository forken
2. Feature-Branch erstellen (`git checkout -b feature/…`)
3. Änderungen committen und pushen
4. Pull Request öffnen
