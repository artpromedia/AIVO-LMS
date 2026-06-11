"use client";

/**
 * Sprint B1 — district SSO entry on the admin login form. Watches the email
 * field (the form is a server component, so this listens at the DOM level),
 * asks the discovery proxy, and renders "Continue with <IdP>" when the
 * domain is SSO-managed. Best-effort: failures leave password login as-is.
 */
import { useEffect, useState } from "react";

export function SsoHint() {
  const [sso, setSso] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      '#admin-login-form input[name="email"]',
    );
    if (!input) return;
    let seq = 0;
    const onBlur = async () => {
      const email = input.value.trim().toLowerCase();
      const mySeq = ++seq;
      if (!email.includes("@")) {
        setSso(null);
        return;
      }
      try {
        const res = await fetch("/api/auth-discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const json = (await res.json()) as {
          mode?: string;
          ssoLoginUrl?: string;
          idpLabel?: string;
        };
        if (mySeq !== seq) return;
        if (json.mode === "sso" && json.ssoLoginUrl) {
          setSso({ url: json.ssoLoginUrl, label: json.idpLabel || "SSO" });
        } else {
          setSso(null);
        }
      } catch {
        if (mySeq === seq) setSso(null);
      }
    };
    input.addEventListener("blur", onBlur);
    return () => input.removeEventListener("blur", onBlur);
  }, []);

  if (!sso) return null;
  return (
    <a
      href={`${sso.url}${sso.url.includes("?") ? "&" : "?"}returnTo=%2F`}
      className="admin-button-secondary mt-4 block w-full text-center"
      data-testid="admin-sso-continue"
    >
      Continue with {sso.label}
    </a>
  );
}
