// Cookie consent. The choice is stored in one first-party cookie that is
// strictly necessary to remember it. Analytics (Google Analytics) may load
// ONLY after the visitor chose "accept".

export const CONSENT_COOKIE = "b2b_consent";
// Bump when the cookie policy changes in a way that needs a new decision:
// everyone is then asked again.
export const CONSENT_VERSION = "v1";
// 180 days (a proposal; to be confirmed with the cookie policy).
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type ConsentChoice = "granted" | "denied";

export function serializeConsent(choice: ConsentChoice): string {
  return `${CONSENT_VERSION}:${choice}`;
}

// Returns null when there is no valid, current decision, so the banner shows.
export function parseConsent(value: string | undefined | null): ConsentChoice | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const [version, choice] = parts;
  if (version !== CONSENT_VERSION) return null;
  return choice === "granted" || choice === "denied" ? choice : null;
}

export function readConsentFromCookieString(cookieString: string): ConsentChoice | null {
  const entry = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!entry) return null;
  try {
    return parseConsent(decodeURIComponent(entry.slice(CONSENT_COOKIE.length + 1)));
  } catch {
    return null;
  }
}

export function shouldLoadAnalytics(choice: ConsentChoice | null, measurementId: string | null): boolean {
  return choice === "granted" && !!measurementId && isValidMeasurementId(measurementId);
}

// Google Analytics 4 ids look like G-ABC123XYZ. Anything else is refused, so
// the value can never carry markup into a script URL.
export function isValidMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]{4,20}$/.test(id);
}

// Names of the cookies Google Analytics sets; removed when consent is withdrawn.
export function isAnalyticsCookieName(name: string): boolean {
  return name === "_ga" || name === "_gid" || name === "_gat" || name.startsWith("_ga_") || name.startsWith("_gat_");
}
