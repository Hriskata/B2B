"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getDict, localePath, type Lang } from "@/i18n";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  isAnalyticsCookieName,
  readConsentFromCookieString,
  serializeConsent,
  shouldLoadAnalytics,
  type ConsentChoice,
} from "@/lib/consent";

const OPEN_EVENT = "b2b:open-cookie-settings";
const SCRIPT_ID = "ga-script";

declare global {
  interface Window {
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

function storeChoice(choice: ConsentChoice) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(choice))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

// Best effort: removes the Google Analytics cookies on this host and on its
// parent domains (they are usually set on the registrable domain).
function removeAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter(isAnalyticsCookieName);
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => `.${parts.slice(i).join(".")}`)];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

function loadAnalytics(id: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  window[`ga-disable-${id}`] = false;
  window.dataLayer = window.dataLayer ?? [];
  // gtag() must push the `arguments` object itself, as Google's snippet does.
  function pushArguments() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  }
  const gtag = pushArguments as (...args: unknown[]) => void;
  gtag("js", new Date());
  gtag("config", id);
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

function unloadAnalytics(id: string | null) {
  document.getElementById(SCRIPT_ID)?.remove();
  if (id) window[`ga-disable-${id}`] = true;
  removeAnalyticsCookies();
}

// Banner + loader. Analytics starts only after "accept" (or a stored accept)
// and stops when the choice changes to "refuse".
export function ConsentManager({
  measurementId,
  lang,
}: {
  measurementId: string | null;
  lang: Lang;
}) {
  const t = getDict(lang).consent;
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Read the cookie after mount, so server and client HTML match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readConsentFromCookieString(document.cookie));
    setReady(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (shouldLoadAnalytics(choice, measurementId))
      loadAnalytics(measurementId!);
    else unloadAnalytics(measurementId);
  }, [ready, choice, measurementId]);

  const decide = useCallback((next: ConsentChoice) => {
    storeChoice(next);
    setChoice(next);
    setOpen(false);
  }, []);

  if (!ready || (choice !== null && !open)) return null;

  return (
    <div
      role="region"
      aria-label={t.region}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-section p-4"
    >
      <div className="mx-auto flex max-w-[1120px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {t.text}{" "}
          <Link href={localePath(lang, "/cookies")} className="underline">
            {t.policy}
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="btn btn-secondary"
          >
            {t.refuse}
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="btn btn-secondary"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

// Footer link that lets the visitor change the decision at any time.
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="text-secondary transition-colors hover:text-ember-300"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
    >
      {label}
    </button>
  );
}
