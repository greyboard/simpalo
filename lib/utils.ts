import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parst eine formatierte Adresse und extrahiert Stadt, PLZ, Bundesland
 * Unterstützt deutsche Adressformate: "Straße, PLZ Stadt, Bundesland"
 * und internationale Formate: "Street, City, State ZIP, Country"
 */
export function parseAddress(formattedAddress: string): {
  city: string;
  zipCode: string;
  state: string;
} {
  if (!formattedAddress) {
    return { city: "", zipCode: "", state: "" };
  }

  const parts = formattedAddress.split(",").map((p) => p.trim());
  
  // Typisches deutsches Format: "Straße, PLZ Stadt, Bundesland, Land"
  // oder "Straße, PLZ Stadt, Land"
  if (parts.length >= 2) {
    // Zweiter Teil sollte PLZ und Stadt enthalten
    const cityPart = parts[parts.length - 2] || "";
    
    // PLZ extrahieren (5-stellige Zahl in Deutschland)
    const zipMatch = cityPart.match(/\b(\d{5})\b/);
    const zipCode = zipMatch ? zipMatch[1] : "";
    
    // Stadt extrahieren (alles nach der PLZ)
    const city = zipMatch
      ? cityPart.replace(zipMatch[0], "").trim()
      : cityPart;
    
    // Bundesland (letzter Teil, wenn es nicht "Deutschland" oder "Germany" ist)
    const lastPart = parts[parts.length - 1] || "";
    const state = 
      lastPart.toLowerCase() === "deutschland" ||
      lastPart.toLowerCase() === "germany" ||
      lastPart.match(/^\d+$/) // Wenn letzter Teil eine PLZ ist
        ? parts.length > 3 ? parts[parts.length - 3] : ""
        : lastPart;

    return {
      city: city || "",
      zipCode: zipCode || "",
      state: state || "",
    };
  }

  // Fallback: Versuche PLZ und Stadt aus dem gesamten String zu extrahieren
  const zipMatch = formattedAddress.match(/\b(\d{5})\b/);
  return {
    city: zipMatch ? formattedAddress.replace(zipMatch[0], "").trim() : "",
    zipCode: zipMatch ? zipMatch[1] : "",
    state: "",
  };
}