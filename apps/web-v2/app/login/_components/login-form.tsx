"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { AuthInput } from "@aivo/ui/auth";

/**
 * Client form fields for /login. The submit button lives in the parent
 * (server) page so it can drive the `mockSignIn` server action via the
 * `form="login-form"` attribute. The hidden `role` defaults to "parent"
 * — the DemoRolePicker sets a different value when used.
 *
 * All interactive colors flow through `iw-*` Tailwind utilities so the
 * sensory-mode toggle repaints the form without re-wiring.
 */
export function LoginForm({
  id,
  action,
}: {
  readonly id: string;
  readonly action: ((formData: FormData) => Promise<void>) | undefined;
}) {
  const t = useTranslations("auth");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  // Sprint B1 — district SSO discovery. When the email's domain belongs to
  // a district with SSO enabled, surface "Continue with <IdP>" (OIDC
  // preferred server-side). Best-effort: a failed lookup just leaves the
  // password path.
  const [sso, setSso] = React.useState<{
    ssoLoginUrl: string;
    idpLabel: string;
    requireSso: boolean;
  } | null>(null);
  const discoverSeq = React.useRef(0);

  const discover = React.useCallback(async (value: string) => {
    const seq = (discoverSeq.current += 1);
    if (!value.includes("@") || value.endsWith("@")) {
      setSso(null);
      return;
    }
    try {
      const res = await fetch("/api/bff/auth/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const json = await res.json().catch(() => null);
      if (seq !== discoverSeq.current) return; // stale response
      if (json?.ok && json.data?.mode === "sso" && json.data.ssoLoginUrl) {
        setSso({
          ssoLoginUrl: json.data.ssoLoginUrl,
          idpLabel: json.data.idpLabel || "SSO",
          requireSso: Boolean(json.data.requireSso),
        });
      } else {
        setSso(null);
      }
    } catch {
      if (seq === discoverSeq.current) setSso(null);
    }
  }, []);

  return (
    <form id={id} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="role" value="parent" />
      <AuthInput
        id="email"
        name="email"
        label={t("common.email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => void discover(email.trim().toLowerCase())}
        placeholder="you@example.com"
        required
      />
      {sso ? (
        <a
          href={`${sso.ssoLoginUrl}${sso.ssoLoginUrl.includes("?") ? "&" : "?"}returnTo=%2F`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-iw-primary px-4 py-2 text-sm font-semibold text-iw-primary transition hover:bg-iw-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
          data-testid="sso-continue"
        >
          {t("login.continue_with_sso", { idp: sso.idpLabel })}
        </a>
      ) : null}
      {sso?.requireSso ? (
        <p className="text-sm text-iw-ink-muted" role="status">
          {t("login.sso_required_note", { idp: sso.idpLabel })}
        </p>
      ) : null}
      <AuthInput
        id="password"
        name="password"
        label={t("common.password")}
        type={showPw ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        trailing={
          <button
            type="button"
            onClick={() => setShowPw((value) => !value)}
            aria-label={showPw ? t("common.hide_password") : t("common.show_password")}
            aria-pressed={showPw}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-iw-ink-muted hover:bg-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
          >
            {showPw ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        }
      />
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
        >
          {t("login.forgot_password")}
        </Link>
      </div>
    </form>
  );
}
