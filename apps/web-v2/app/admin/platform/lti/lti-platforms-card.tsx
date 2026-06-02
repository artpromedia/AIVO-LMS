"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface Platform {
  id: string;
  issuer: string;
  clientId: string;
  label: string | null;
  deployments: Array<{ id: string; deploymentId: string; label: string | null }>;
}

const EMPTY = {
  label: "",
  issuer: "",
  clientId: "",
  jwksUrl: "",
  authTokenUrl: "",
  authLoginUrl: "",
  deploymentId: "",
};

/**
 * Platform-admin surface to register LTI 1.3 platforms (an LMS) and list the
 * ones already registered. Talks to /api/bff/admin/lti/platforms, which
 * forwards to integration-svc; the persisted rows drive launch validation and
 * AGS score write-back.
 */
export function LtiPlatformsCard() {
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY });
  const [pending, startTransition] = React.useTransition();
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/bff/admin/lti/platforms")
      .then((r) => r.json())
      .then((j) => setPlatforms((j?.data?.platforms ?? []) as Platform[]))
      .catch(() => setError("Couldn't load registered platforms."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const body = {
        issuer: form.issuer.trim(),
        clientId: form.clientId.trim(),
        jwksUrl: form.jwksUrl.trim(),
        authTokenUrl: form.authTokenUrl.trim(),
        authLoginUrl: form.authLoginUrl.trim(),
        label: form.label.trim() || undefined,
        deployments: form.deploymentId.trim()
          ? [{ deploymentId: form.deploymentId.trim() }]
          : undefined,
      };
      const res = await fetch("/api/bff/admin/lti/platforms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Registration failed.");
        return;
      }
      setOkMsg("Platform registered.");
      setForm({ ...EMPTY });
      load();
    });
  }

  const fields: Array<{ key: keyof typeof form; label: string; placeholder: string }> = [
    { key: "label", label: "Label (optional)", placeholder: "Canvas — District" },
    { key: "issuer", label: "Issuer", placeholder: "https://canvas.instructure.com" },
    { key: "clientId", label: "Client ID", placeholder: "10000000000001" },
    { key: "jwksUrl", label: "JWKS URL", placeholder: "https://…/api/lti/security/jwks" },
    { key: "authTokenUrl", label: "Auth token URL", placeholder: "https://…/login/oauth2/token" },
    {
      key: "authLoginUrl",
      label: "Auth login URL",
      placeholder: "https://…/api/lti/authorize_redirect",
    },
    { key: "deploymentId", label: "Deployment ID (optional)", placeholder: "1:abcdef…" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-iw-text-strong">{f.label}</span>
              <input
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="h-11 rounded-iw-control border border-iw-border bg-white px-3 text-sm outline-none focus:border-[var(--aivo-sensory-primary)]"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Registering…" : "Register platform"}
          </Button>
          {okMsg ? <span className="text-sm text-aivo-success">{okMsg}</span> : null}
          {error ? (
            <span role="alert" className="text-sm text-aivo-danger">
              {error}
            </span>
          ) : null}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-aivo-ink-soft">
          Registered platforms
        </h3>
        {loading ? (
          <p className="text-sm text-aivo-ink-soft">Loading…</p>
        ) : platforms.length === 0 ? (
          <p className="text-sm text-aivo-ink-soft">No platforms registered yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {platforms.map((p) => (
              <li key={p.id} className="rounded-iw-control border border-iw-border p-3 text-sm">
                <p className="font-medium text-iw-text-strong">{p.label || p.issuer}</p>
                <p className="text-xs text-aivo-ink-soft">
                  {p.issuer} · client {p.clientId}
                </p>
                {p.deployments.length > 0 ? (
                  <p className="mt-1 text-xs text-aivo-ink-soft">
                    Deployments: {p.deployments.map((d) => d.deploymentId).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
