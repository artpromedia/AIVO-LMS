"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Platform {
  id: string;
  issuer: string;
  clientId: string;
  jwksUrl: string;
  authTokenUrl: string;
  authLoginUrl: string;
  label: string | null;
  deployments: Array<{ id: string; deploymentId: string; label: string | null }>;
}

const EMPTY_REGISTER = {
  label: "",
  issuer: "",
  clientId: "",
  jwksUrl: "",
  authTokenUrl: "",
  authLoginUrl: "",
  deploymentId: "",
};

interface EditState {
  label: string;
  jwksUrl: string;
  authTokenUrl: string;
  authLoginUrl: string;
  deploymentId: string;
}

/**
 * Platform-admin surface to register, edit, and delete LTI 1.3 platforms.
 * Talks to /api/bff/admin/lti/platforms (POST/GET) and /[id] (PUT/DELETE),
 * which forwards to integration-svc; the persisted rows drive launch
 * validation and AGS score write-back.
 */
export function LtiPlatformsCard() {
  const t = useTranslations("lti_admin");
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_REGISTER });
  const [pending, startTransition] = React.useTransition();
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [edits, setEdits] = React.useState<Record<string, EditState>>({});
  const [rowBusy, setRowBusy] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/bff/admin/lti/platforms")
      .then((r) => r.json())
      .then((j) => setPlatforms((j?.data?.platforms ?? []) as Platform[]))
      .catch(() => setError(t("errors.load_failed")))
      .finally(() => setLoading(false));
  }, [t]);

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
        setError(j?.error?.message ?? t("errors.register_failed"));
        return;
      }
      setOkMsg(t("ok.registered"));
      setForm({ ...EMPTY_REGISTER });
      load();
    });
  }

  function startEdit(p: Platform) {
    setEdits((m) => ({
      ...m,
      [p.id]: {
        label: p.label ?? "",
        jwksUrl: p.jwksUrl,
        authTokenUrl: p.authTokenUrl,
        authLoginUrl: p.authLoginUrl,
        deploymentId: p.deployments[0]?.deploymentId ?? "",
      },
    }));
  }

  function cancelEdit(id: string) {
    setEdits((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  }

  async function saveEdit(p: Platform) {
    const draft = edits[p.id];
    if (!draft) return;
    setRowBusy(p.id);
    setError(null);
    setOkMsg(null);
    try {
      const body: Record<string, unknown> = {
        jwksUrl: draft.jwksUrl.trim(),
        authTokenUrl: draft.authTokenUrl.trim(),
        authLoginUrl: draft.authLoginUrl.trim(),
        label: draft.label.trim() ? draft.label.trim() : null,
      };
      if (draft.deploymentId.trim()) {
        body.deployments = [{ deploymentId: draft.deploymentId.trim() }];
      }
      const res = await fetch(`/api/bff/admin/lti/platforms/${encodeURIComponent(p.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? t("errors.update_failed"));
        return;
      }
      setOkMsg(t("ok.updated"));
      cancelEdit(p.id);
      load();
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(p: Platform) {
    if (!window.confirm(t("confirm.delete", { issuer: p.issuer }))) return;
    setRowBusy(p.id);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/bff/admin/lti/platforms/${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error?.message ?? t("errors.delete_failed"));
        return;
      }
      setOkMsg(t("ok.deleted"));
      load();
    } finally {
      setRowBusy(null);
    }
  }

  const fields: Array<{ key: keyof typeof form; labelKey: string; placeholderKey: string }> = [
    { key: "label", labelKey: "fields.label", placeholderKey: "placeholders.label" },
    { key: "issuer", labelKey: "fields.issuer", placeholderKey: "placeholders.issuer" },
    { key: "clientId", labelKey: "fields.client_id", placeholderKey: "placeholders.client_id" },
    { key: "jwksUrl", labelKey: "fields.jwks_url", placeholderKey: "placeholders.jwks_url" },
    {
      key: "authTokenUrl",
      labelKey: "fields.auth_token_url",
      placeholderKey: "placeholders.auth_token_url",
    },
    {
      key: "authLoginUrl",
      labelKey: "fields.auth_login_url",
      placeholderKey: "placeholders.auth_login_url",
    },
    {
      key: "deploymentId",
      labelKey: "fields.deployment_id",
      placeholderKey: "placeholders.deployment_id",
    },
  ];

  const editFields: Array<{ k: keyof EditState; key: string }> = [
    { k: "label", key: "fields.label" },
    { k: "jwksUrl", key: "fields.jwks_url" },
    { k: "authTokenUrl", key: "fields.auth_token_url" },
    { k: "authLoginUrl", key: "fields.auth_login_url" },
    { k: "deploymentId", key: "fields.deployment_id" },
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
              <span className="font-medium text-iw-text-strong">{t(f.labelKey)}</span>
              <input
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={t(f.placeholderKey)}
                className="h-11 rounded-iw-control border border-iw-border bg-white px-3 text-sm outline-none focus:border-[var(--aivo-sensory-primary)]"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t("actions.registering") : t("actions.register")}
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
          {t("registered.heading")}
        </h3>
        {loading ? (
          <p className="text-sm text-aivo-ink-soft">{t("registered.loading")}</p>
        ) : platforms.length === 0 ? (
          <p className="text-sm text-aivo-ink-soft">{t("registered.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {platforms.map((p) => {
              const draft = edits[p.id];
              const busy = rowBusy === p.id;
              return (
                <li key={p.id} className="rounded-iw-control border border-iw-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-iw-text-strong">{p.label || p.issuer}</p>
                      <p className="text-xs text-aivo-ink-soft">
                        {p.issuer} · {t("registered.client_id_label")} {p.clientId}
                      </p>
                      {p.deployments.length > 0 ? (
                        <p className="mt-1 text-xs text-aivo-ink-soft">
                          {t("registered.deployments_label")}:{" "}
                          {p.deployments.map((d) => d.deploymentId).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {draft ? (
                        <>
                          <Button type="button" disabled={busy} onClick={() => saveEdit(p)}>
                            {busy ? t("actions.saving") : t("actions.save")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => cancelEdit(p.id)}
                          >
                            {t("actions.cancel")}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" variant="ghost" onClick={() => startEdit(p)}>
                            {t("actions.edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => remove(p)}
                          >
                            {busy ? t("actions.deleting") : t("actions.delete")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {draft ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {editFields.map((f) => (
                        <label key={f.k} className="flex flex-col gap-1 text-xs">
                          <span className="font-medium text-iw-text-strong">{t(f.key)}</span>
                          <input
                            value={draft[f.k]}
                            onChange={(e) =>
                              setEdits((m) => ({
                                ...m,
                                [p.id]: { ...m[p.id]!, [f.k]: e.target.value },
                              }))
                            }
                            className="h-10 rounded-iw-control border border-iw-border bg-white px-3 text-sm outline-none focus:border-[var(--aivo-sensory-primary)]"
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
