import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /connector.js
 * 
 * Liefert das Simpalo Connector Script mit automatisch generierter Webhook-URL.
 * Die Webhook-URL wird basierend auf NEXT_PUBLIC_API_URL oder NEXTAUTH_URL aus ENV-Variablen generiert.
 * 
 * Verwendung:
 * <script src="https://simpalo.de/connector.js" data-webhook-id="YOUR_WEBHOOK_ID"></script>
 */
export async function GET(request: NextRequest) {
  try {
    // Bestimme die API-URL aus ENV-Variablen (für Kunden-Installationen)
    // NEXT_PUBLIC_API_URL hat Priorität (falls explizit gesetzt)
    // Ansonsten verwende NEXTAUTH_URL als Base-URL
    let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    
    if (!apiBaseUrl) {
      // Falls keine explizite API-URL, generiere aus NEXTAUTH_URL
      const baseUrl = 
        process.env.NEXTAUTH_URL || 
        process.env.NEXT_PUBLIC_APP_URL ||
        `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      apiBaseUrl = baseUrl.replace(/\/$/, '') + '/api';
    } else {
      // Entferne trailing slash falls vorhanden
      apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    }

    // Generiere das Script mit dynamischer Webhook-URL-Generierung
    const script = `(function() {
  'use strict';

  // Finde das Script-Tag mit data-webhook-id Attribut
  const currentScript = document.currentScript || 
    document.querySelector('script[data-webhook-id]');
  
  if (!currentScript) {
    console.warn('[Simpalo Connector] Script-Tag mit data-webhook-id Attribut nicht gefunden');
    return;
  }

  const webhookId = currentScript.getAttribute('data-webhook-id');
  
  if (!webhookId) {
    console.warn('[Simpalo Connector] data-webhook-id Attribut ist leer');
    return;
  }

  // Generiere Webhook-URL automatisch basierend auf API-URL aus ENV
  const apiBaseUrl = '${apiBaseUrl}';
  const webhookUrl = apiBaseUrl + '/webhooks/incoming/' + webhookId;

  console.log('[Simpalo Connector] Initialisiert mit Webhook:', webhookUrl);

  // LocalStorage Keys mit Präfix
  const STORAGE_PREFIX = 'smp_';
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  /**
   * Extrahiert UTM-Parameter aus der aktuellen URL
   */
  function extractUtmFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {};
    
    UTM_KEYS.forEach(key => {
      const value = urlParams.get(key);
      if (value) {
        utmParams[key] = value;
        // Speichere im LocalStorage (überschreibt nur wenn neuer Wert vorhanden)
        try {
          localStorage.setItem(STORAGE_PREFIX + key, value);
        } catch (e) {
          console.warn('[Simpalo Connector] Fehler beim Speichern in LocalStorage:', e);
        }
      }
    });
    
    return utmParams;
  }

  /**
   * Lädt UTM-Parameter aus LocalStorage
   */
  function loadUtmFromStorage() {
    const utmParams = {};
    
    UTM_KEYS.forEach(key => {
      try {
        const value = localStorage.getItem(STORAGE_PREFIX + key);
        if (value) {
          utmParams[key] = value;
        }
      } catch (e) {
        console.warn('[Simpalo Connector] Fehler beim Lesen aus LocalStorage:', e);
      }
    });
    
    return utmParams;
  }

  /**
   * Sammelt alle Formulardaten
   */
  function collectFormData(form) {
    const formData = new FormData(form);
    const data = {};
    
    // Konvertiere FormData zu Objekt
    for (const [key, value] of formData.entries()) {
      // Wenn mehrere Werte für denselben Key existieren, erstelle Array
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }
    
    return data;
  }

  /**
   * Sendet Daten an Webhook
   */
  async function sendToWebhook(payload) {
    try {
      // Verwende no-cors Mode, damit es auch von anderen Domains funktioniert
      const response = await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Wichtig: no-cors für Cross-Origin Requests
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      // Bei no-cors können wir die Response nicht lesen, aber das ist ok
      console.log('[Simpalo Connector] Daten an Webhook gesendet');
      return true;
    } catch (error) {
      console.error('[Simpalo Connector] Fehler beim Senden an Webhook:', error);
      return false;
    }
  }

  /**
   * Event-Handler für Formular-Submits
   */
  function handleFormSubmit(event) {
    const form = event.target;
    
    // Prüfe, ob es wirklich ein Formular ist
    if (form.tagName !== 'FORM') {
      return;
    }

    // Verhindere das Standard-Submit
    event.preventDefault();
    event.stopPropagation();

    console.log('[Simpalo Connector] Formular-Submit abgefangen:', form);

    // Sammle Formulardaten
    const formData = collectFormData(form);
    
    // Lade UTM-Parameter (zuerst aus URL, dann aus Storage)
    const urlUtm = extractUtmFromUrl();
    const storageUtm = loadUtmFromStorage();
    
    // Kombiniere UTM-Parameter (URL hat Priorität)
    const utmParams = { ...storageUtm, ...urlUtm };

    // Erstelle Payload
    const payload = {
      formData: formData,
      utm: utmParams,
      url: window.location.href,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      language: navigator.language,
    };

    console.log('[Simpalo Connector] Payload:', payload);

    // Entferne unseren Event-Listener, um Endlosschleife zu vermeiden
    form.removeEventListener('submit', handleFormSubmit, true);
    
    // Sende an Webhook (non-blocking, aber warte kurz für bessere UX)
    sendToWebhook(payload)
      .then(() => {
        console.log('[Simpalo Connector] Webhook erfolgreich aufgerufen');
      })
      .catch((error) => {
        console.error('[Simpalo Connector] Fehler beim Webhook-Aufruf:', error);
      });
    
    // Führe das originale Formular-Submit aus (sofort, nicht-blocking)
    // Das Formular wird normal abgesendet, auch wenn der Webhook noch läuft
    setTimeout(() => {
      form.submit();
    }, 0);
  }

  // Extrahiere UTM-Parameter beim ersten Laden
  extractUtmFromUrl();

  // Füge Event-Listener für alle Formulare hinzu (Capturing Phase)
  document.addEventListener('submit', handleFormSubmit, true);

  console.log('[Simpalo Connector] Event-Listener registriert');
})();`;

    return new NextResponse(script, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600", // Cache für 1 Stunde
      },
    });
  } catch (error) {
    console.error("Error generating connector script:", error);
    return new NextResponse(
      "// Error generating connector script",
      {
        status: 500,
        headers: {
          "Content-Type": "text/javascript",
        },
      }
    );
  }
}
