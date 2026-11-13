import { cookies } from "next/headers";
import { CONSENT_COOKIE, isValidMeasurementId, parseConsent } from "@/lib/consent";
import type { Lang } from "@/i18n";
import { ConsentManager } from "./consent-manager";

// Reads the (optional) Google Analytics id at request time, so it comes from
// the runtime environment and is not baked into the build. Without an id the
// banner still works but nothing is ever loaded.
// The stored choice is read here too, so the banner is part of the first HTML
// (it used to appear only after the JavaScript ran, about 3 s later on a
// phone, and was then the largest paint of the page).
export async function Analytics({ lang }: { lang: Lang }) {
  const jar = await cookies();
  const raw = process.env.GA_MEASUREMENT_ID?.trim();
  return (
    <ConsentManager
      measurementId={raw && isValidMeasurementId(raw) ? raw : null}
      initialChoice={parseConsent(jar.get(CONSENT_COOKIE)?.value)}
      lang={lang}
    />
  );
}
