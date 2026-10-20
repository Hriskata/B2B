"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { getDict, type Lang } from "@/i18n";

type PriceMap = Record<string, { formatted: string }>;
type State =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error" }
  | { status: "ready"; prices: PriceMap };

const PricesContext = createContext<State>({ status: "loading" });

// Prices are never part of the page HTML. After the page is shown, this asks
// the private, uncached /api/prices endpoint; a guest gets 401 and no price.
export function PricesProvider({ slugs, children }: { slugs: string[]; children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const key = slugs.join(",");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    for (const slug of key.split(",").filter(Boolean)) query.append("slug", slug);

    fetch(`/api/prices?${query}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401) return setState({ status: "guest" });
        if (!res.ok) return setState({ status: "error" });
        const data = (await res.json()) as { prices: PriceMap };
        setState({ status: "ready", prices: data.prices });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error" });
        }
      });
    return () => controller.abort();
  }, [key]);

  return <PricesContext value={state}>{children}</PricesContext>;
}

export function Price({ slug, lang, className }: { slug: string; lang: Lang; className?: string }) {
  const state = useContext(PricesContext);
  const t = getDict(lang).price;

  if (state.status === "guest") {
    return (
      <p className={className}>
        <Link href="/login" className="underline">
          {t.loginBefore}
        </Link>
        {t.loginAfter}
      </p>
    );
  }
  if (state.status === "error") {
    return <p className={className}>{t.error}</p>;
  }
  const price = state.status === "ready" ? state.prices[slug] : undefined;
  return (
    <p className={className} aria-live="polite">
      {state.status === "loading" ? (
        <span className="text-zinc-500">{t.loading}</span>
      ) : price ? (
        <>
          {t.perUnit} <strong>{price.formatted}</strong>
        </>
      ) : (
        <span className="text-zinc-500">{t.negotiable}</span>
      )}
    </p>
  );
}
