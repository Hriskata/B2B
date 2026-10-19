import { describe, expect, it } from "vitest";
import {
  CONSENT_COOKIE,
  isAnalyticsCookieName,
  isValidMeasurementId,
  parseConsent,
  readConsentFromCookieString,
  serializeConsent,
  shouldLoadAnalytics,
} from "./consent";

describe("consent cookie", () => {
  it("round-trips both choices", () => {
    expect(parseConsent(serializeConsent("granted"))).toBe("granted");
    expect(parseConsent(serializeConsent("denied"))).toBe("denied");
  });

  it.each([undefined, null, "", "granted", "v0:granted", "v1:maybe", "v1:", "v1:granted:extra:x"])(
    "treats %j as 'no decision' (the banner shows again)",
    (value) => {
      expect(parseConsent(value as string | null | undefined)).toBeNull();
    },
  );

  it("reads the choice from a cookie header string", () => {
    expect(readConsentFromCookieString(`a=1; ${CONSENT_COOKIE}=v1%3Agranted; b=2`)).toBe("granted");
    expect(readConsentFromCookieString(`${CONSENT_COOKIE}=v1:denied`)).toBe("denied");
    expect(readConsentFromCookieString("a=1; b=2")).toBeNull();
    expect(readConsentFromCookieString(`${CONSENT_COOKIE}=%E0%A4%A`)).toBeNull();
  });

  it("does not mistake a similarly named cookie for the consent cookie", () => {
    expect(readConsentFromCookieString(`x${CONSENT_COOKIE}=v1:granted`)).toBeNull();
  });
});

describe("shouldLoadAnalytics", () => {
  const id = "G-ABC123XYZ9";

  it("loads only after 'granted' and with a valid id", () => {
    expect(shouldLoadAnalytics("granted", id)).toBe(true);
  });

  it("never loads without a decision, after a refusal, or without an id", () => {
    expect(shouldLoadAnalytics(null, id)).toBe(false);
    expect(shouldLoadAnalytics("denied", id)).toBe(false);
    expect(shouldLoadAnalytics("granted", null)).toBe(false);
    expect(shouldLoadAnalytics("granted", "")).toBe(false);
  });

  it("refuses ids that could carry markup or another script", () => {
    for (const bad of ["G-ABC\"><script>", "UA-123456-1", "g-abc123xyz9", "G-AB", "G-ABC 123", "https://evil.example/x.js"]) {
      expect(isValidMeasurementId(bad)).toBe(false);
      expect(shouldLoadAnalytics("granted", bad)).toBe(false);
    }
  });
});

describe("isAnalyticsCookieName", () => {
  it("matches Google Analytics cookies only", () => {
    for (const name of ["_ga", "_gid", "_gat", "_ga_ABC123", "_gat_gtag_G_X"]) {
      expect(isAnalyticsCookieName(name)).toBe(true);
    }
    for (const name of ["b2b_session", "b2b_consent", "gaming", "__Host-b2b_session", "_gaffe"]) {
      expect(isAnalyticsCookieName(name)).toBe(false);
    }
  });
});
