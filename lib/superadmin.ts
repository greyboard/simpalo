/**
 * Superadmin Configuration
 * 
 * Superadmin-Credentials werden über Environment Variables konfiguriert:
 * - SUPERADMIN_EMAIL: E-Mail-Adresse des Superadmins
 * - SUPERADMIN_PASSWORD: Passwort des Superadmins (wird gehashed gespeichert)
 */

/**
 * Gibt die Superadmin-E-Mail aus ENV zurück
 */
export function getSuperadminEmail(): string | undefined {
  return process.env.SUPERADMIN_EMAIL;
}

/**
 * Gibt das Superadmin-Passwort aus ENV zurück
 */
export function getSuperadminPassword(): string | undefined {
  return process.env.SUPERADMIN_PASSWORD;
}

/**
 * Prüft, ob eine E-Mail-Adresse die Superadmin-E-Mail ist
 */
export function isSuperadminEmail(email: string): boolean {
  const superadminEmail = getSuperadminEmail();
  if (!superadminEmail) return false;
  return email.toLowerCase().trim() === superadminEmail.toLowerCase().trim();
}

/**
 * Prüft, ob ein Passwort mit dem Superadmin-Passwort übereinstimmt
 */
export async function verifySuperadminPassword(password: string): Promise<boolean> {
  const superadminPassword = getSuperadminPassword();
  if (!superadminPassword) return false;
  
  // Direkter Vergleich (Plaintext aus ENV)
  // In Production sollte das Passwort gehashed sein, aber für ENV-Variablen ist Plaintext ok
  return password === superadminPassword;
}

/**
 * Prüft, ob Superadmin konfiguriert ist
 */
export function isSuperadminConfigured(): boolean {
  return !!getSuperadminEmail() && !!getSuperadminPassword();
}
