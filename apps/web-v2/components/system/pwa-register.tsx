"use client";

import { useEffect } from "react";

/**
 * Sprint 11 — registers the learner PWA service worker.
 *
 * Production-only on purpose: `next dev` serves a fresh shell on every
 * request, and a stale SW would mask the new bundles. We also skip
 * registration when the page is opened over `http:` (Safari + Chrome
 * both forbid SW registration on insecure origins anyway, but we avoid
 * the noisy console error) and bail out when service workers aren't
 * supported (older browsers, restricted contexts).
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    // Register on load to avoid competing with the first paint.
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // SW registration is a progressive enhancement; failures here
          // are non-fatal and the app should keep working online.
        });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
