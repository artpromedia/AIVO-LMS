"use client";

import { useEffect } from "react";

/**
 * Auto-redirects to the identity-svc SSO login endpoint shortly after the
 * page renders, so a returning federated user is bounced to their IdP
 * without an extra click. A visible CTA is always rendered by the parent as
 * a no-JS / slow-redirect fallback.
 */
export function SsoAutoRedirect({ url, delayMs = 600 }: { url: string; delayMs?: number }) {
  useEffect(() => {
    const id = setTimeout(() => {
      window.location.assign(url);
    }, delayMs);
    return () => clearTimeout(id);
  }, [url, delayMs]);
  return null;
}
