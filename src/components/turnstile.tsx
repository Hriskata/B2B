"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: { sitekey: string; language?: string },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Cloudflare Turnstile widget. It adds a hidden "cf-turnstile-response"
// field to the surrounding form, which the Server Action verifies.
// Tokens are single use, so `resetKey` (the form nonce) resets the widget
// after every submit.
export function Turnstile({
  siteKey,
  resetKey,
}: {
  siteKey: string;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    function mount() {
      if (container.current && window.turnstile && !widgetId.current) {
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          language: "bg",
        });
      }
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    if (window.turnstile) {
      mount();
    } else {
      timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer);
          mount();
        }
      }, 100);
    }
    return () => {
      clearInterval(timer);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = undefined;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (widgetId.current && window.turnstile)
      window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={container} />
    </>
  );
}
