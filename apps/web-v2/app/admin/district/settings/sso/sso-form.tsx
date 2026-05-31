"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TenantSSOConfig } from "@/lib/db/types";

const MODES: Array<{ value: TenantSSOConfig["mode"]; label: string; desc: string }> = [
  { value: "off", label: "Off", desc: "Username + password only." },
  { value: "saml", label: "SAML 2.0", desc: "Okta, Azure AD, ADFS, Google Workspace SAML." },
  { value: "oidc", label: "OIDC", desc: "Auth0, Cognito, Keycloak, etc." },
];

export function SSOForm({ initial }: { initial: TenantSSOConfig }) {
  const router = useRouter();
  const t = useTranslations("admin.district_settings_sso");
  const [mode, setMode] = useState<TenantSSOConfig["mode"]>(initial.mode);
  const [idpName, setIdpName] = useState(initial.idpName ?? "");
  const [metadataUrl, setMetadataUrl] = useState(initial.metadataUrl ?? "");
  const [scimEnabled, setScimEnabled] = useState(initial.scimEnabled);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "ok"; msg: string } | { kind: "err"; msg: string } | null
  >(null);

  function submit(e: React.FormEvent, rotateScim = false) {
    e.preventDefault();
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/district/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sso: {
              mode,
              idpName: idpName.trim() || null,
              metadataUrl: metadataUrl.trim() || null,
              scimEnabled,
              rotateScim,
            },
          }),
        });
        const json = await res.json();
        if (!json.ok) {
          setStatus({
            kind: "err",
            msg: json.error?.userMessage ?? "Could not save changes.",
          });
          return;
        }
        setStatus({
          kind: "ok",
          msg: rotateScim ? "SCIM token rotated and SSO saved." : "SSO configuration saved.",
        });
        router.refresh();
      } catch {
        setStatus({ kind: "err", msg: "Network error — please try again." });
      }
    });
  }

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-5">
      <div>
        <p className="text-sm font-medium">{t("sign_in_mode")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
                mode === m.value
                  ? "border-aivo-primary bg-aivo-primary-soft"
                  : "border-aivo-border hover:bg-aivo-surface-2"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="sr-only"
              />
              <span className="block font-semibold">{m.label}</span>
              <span className="mt-1 block text-xs text-aivo-ink-soft">{m.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="idpName">{t("idp_name_label")}</Label>
        <Input
          id="idpName"
          value={idpName}
          onChange={(e) => setIdpName(e.target.value)}
          placeholder={t("idp_name_placeholder")}
          maxLength={120}
          className="mt-1"
          disabled={mode === "off"}
        />
      </div>

      <div>
        <Label htmlFor="metadataUrl">
          {mode === "oidc" ? "Discovery URL" : "SAML metadata URL"}
        </Label>
        <Input
          id="metadataUrl"
          type="url"
          value={metadataUrl}
          onChange={(e) => setMetadataUrl(e.target.value)}
          placeholder="https://idp.example.org/.well-known/openid-configuration"
          className="mt-1"
          disabled={mode === "off"}
        />
      </div>

      <div className="rounded-md border border-aivo-border bg-aivo-surface-2 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{t("scim_provisioning")}</p>
            <p className="text-xs text-aivo-ink-soft">
              Allow your IdP to create, update, and deactivate users in this district automatically.
              Requires a SAML or OIDC mode.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scimEnabled}
              onChange={(e) => setScimEnabled(e.target.checked)}
              disabled={mode === "off"}
              className="h-4 w-4 rounded border-aivo-border text-aivo-primary"
            />
            {t("enable_scim")}
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-aivo-ink-soft">
            {t("scim_rotate_warning")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => submit(e as unknown as React.FormEvent, true)}
            disabled={pending || !scimEnabled}
          >
            {t("rotate_scim_token")}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {status?.kind === "ok" ? <p className="text-sm text-aivo-success">{status.msg}</p> : null}
        {status?.kind === "err" ? <p className="text-sm text-aivo-danger">{status.msg}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save SSO configuration"}
        </Button>
      </div>
    </form>
  );
}
