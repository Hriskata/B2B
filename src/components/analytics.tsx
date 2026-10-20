import { connection } from "next/server";
import { isValidMeasurementId } from "@/lib/consent";
import type { Lang } from "@/i18n";
import { ConsentManager } from "./consent-manager";

// Reads the (optional) Google Analytics id at request time, so it comes from
// the runtime environment and is not baked into the build. Without an id the
// banner still works but nothing is ever loaded.
export async function Analytics({ lang }: { lang: Lang }) {
  await connection();
  const raw = process.env.GA_MEASUREMENT_ID?.trim();
  return (
    <ConsentManager
      measurementId={raw && isValidMeasurementId(raw) ? raw : null}
      lang={lang}
    />
  );
}
