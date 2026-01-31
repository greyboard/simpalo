/**
 * Google Places API Utilities
 * 
 * Diese Datei enthält Hilfsfunktionen für die Google Places API Integration.
 */

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
  international_phone_number?: string;
  formatted_phone_number?: string;
  website?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
}

export interface GooglePlaceDetailsResult extends GooglePlaceResult {
  website?: string;
  international_phone_number?: string;
  formatted_phone_number?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }>;
}

/**
 * Sucht nach Orten mit der Google Places Text Search API
 * 
 * @param query - Suchbegriff
 * @param location - Optionale Ortsangabe
 * @param minRating - Optionales Mindestrating
 * @param type - Optionaler Typ-Filter
 * @param maxResults - Maximale Anzahl Ergebnisse (20, 40 oder 60 - Standard: 60)
 * @param apiKey - Optional: Account-spezifischer API Key (falls nicht angegeben, wird NEXT_PUBLIC_GOOGLE_PLACES_API_KEY verwendet)
 */
export async function searchPlaces(
  query: string,
  location?: string,
  minRating?: number,
  type?: string,
  maxResults: number = 60,
  apiKey?: string
): Promise<GooglePlaceResult[]> {
  // Verwende account-spezifischen Key oder Fallback auf Environment Variable
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!key) {
    throw new Error("Google Places API Key ist nicht konfiguriert");
  }

  // Begrenze maxResults auf gültige Werte (max. 60 = 3 Seiten)
  const validMaxResults = Math.min(Math.max(maxResults, 20), 60);
  const pagesToFetch = Math.ceil(validMaxResults / 20);

  // Query bauen: "Suchbegriff in Ort" oder nur "Suchbegriff"
  let searchQuery = query;
  if (location) {
    searchQuery = `${query} in ${location}`;
  }

  // Typ-Filter hinzufügen, wenn angegeben
  if (type) {
    searchQuery = `${searchQuery} ${type}`;
  }

  let allResults: GooglePlaceResult[] = [];
  let nextPageToken: string | undefined;

  try {
    // Rufe mehrere Seiten ab (bis zu 3 Seiten = 60 Ergebnisse)
    for (let page = 0; page < pagesToFetch; page++) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.set("query", searchQuery);
      url.searchParams.set("key", key);
      url.searchParams.set("language", "de");

      // Verwende next_page_token für nachfolgende Seiten
      if (nextPageToken) {
        url.searchParams.set("pagetoken", nextPageToken);
        // Warte 2 Sekunden, bevor next_page_token verwendet wird (Google API Anforderung)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Google Places API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === "REQUEST_DENIED") {
        throw new Error(`Google Places API Error: ${data.error_message || "API Key ungültig"}`);
      }

      if (data.status === "OVER_QUERY_LIMIT") {
        throw new Error("Google Places API: Rate Limit erreicht. Bitte versuche es später erneut.");
      }

      if (data.status === "ZERO_RESULTS") {
        // Wenn keine Ergebnisse auf dieser Seite, beende die Suche
        break;
      }

      if (data.status !== "OK" && data.status !== "OK") {
        throw new Error(`Google Places API Error: ${data.status} - ${data.error_message || "Unbekannter Fehler"}`);
      }

      const pageResults: GooglePlaceResult[] = data.results || [];
      allResults = [...allResults, ...pageResults];

      // Prüfe, ob weitere Seiten verfügbar sind
      nextPageToken = data.next_page_token;
      
      // Wenn kein next_page_token vorhanden ist oder wir genug Ergebnisse haben, beende die Suche
      if (!nextPageToken || allResults.length >= validMaxResults) {
        break;
      }
    }

    // Begrenze auf die gewünschte Anzahl
    allResults = allResults.slice(0, validMaxResults);

    // Rating-Filter anwenden (falls angegeben)
    if (minRating !== undefined) {
      allResults = allResults.filter((place) => place.rating && place.rating >= minRating);
    }

    return allResults;
  } catch (error) {
    console.error("Error searching Google Places:", error);
    throw error;
  }
}

/**
 * Ruft Details eines Ortes über die Place Details API ab
 * Dies liefert zusätzliche Informationen wie Website, Öffnungszeiten, Reviews
 * 
 * @param placeId - Google Place ID
 * @param fields - Optionale Liste von Feldern, die abgerufen werden sollen
 * @param apiKey - Optional: Account-spezifischer API Key (falls nicht angegeben, wird NEXT_PUBLIC_GOOGLE_PLACES_API_KEY verwendet)
 */
export async function getPlaceDetails(
  placeId: string,
  fields: string[] = [
    "name",
    "formatted_address",
    "formatted_phone_number",
    "international_phone_number",
    "website",
    "rating",
    "user_ratings_total",
    "opening_hours",
    "types",
    "geometry",
    "business_status",
  ],
  apiKey?: string
): Promise<GooglePlaceDetailsResult | null> {
  // Verwende account-spezifischen Key oder Fallback auf Environment Variable
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!key) {
    throw new Error("Google Places API Key ist nicht konfiguriert");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "de");
  url.searchParams.set("fields", fields.join(","));

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Places API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === "REQUEST_DENIED") {
      throw new Error(`Google Places API Error: ${data.error_message || "API Key ungültig"}`);
    }

    if (data.status === "OVER_QUERY_LIMIT") {
      throw new Error("Google Places API: Rate Limit erreicht. Bitte versuchen Sie es später erneut.");
    }

    if (data.status !== "OK") {
      throw new Error(`Google Places API Error: ${data.status} - ${data.error_message || "Unbekannter Fehler"}`);
    }

    return data.result as GooglePlaceDetailsResult;
  } catch (error) {
    console.error("Error fetching place details:", error);
    throw error;
  }
}

/**
 * Erkennt, ob ein Lead bereits in der Datenbank existiert (basierend auf googlePlaceId)
 */
export async function checkDuplicateLead(
  placeId: string,
  prisma: any
): Promise<boolean> {
  try {
    const existingLead = await prisma.lead.findUnique({
      where: { googlePlaceId: placeId },
    });
    return !!existingLead;
  } catch (error) {
    console.error("Error checking duplicate lead:", error);
    return false;
  }
}
