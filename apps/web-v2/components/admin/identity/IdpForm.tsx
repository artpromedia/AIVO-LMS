"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AttributeMappingEditor,
  type AttributeMappingValue,
} from "@/components/admin/identity/AttributeMappingEditor";
import type { IdpConfigRecord, IdpProtocol } from "@/lib/db/idp-store";

const PROTOCOLS: Array<{ value: IdpProtocol; label: string; desc: string }> = [
  { value: "saml", label: "SAML 2.0", desc: "Okta, Microsoft Entra ID, ADFS, Google Workspace." },
  { value: "oidc", label: "OIDC", desc: "Okta, Entra, Auth0, Keycloak, Ping (OpenID Connect)." },
];

function defaultMapping(): AttributeMappingValue {
  return { email: "email", name: "name", role: "roles", roleMap: {}, defaultRole: "TEACHER" };
}

export function IdpForm({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: IdpConfigRecord | null;
}) {
  const router = useRouter();
  const t = useTranslations("admin.identity");
  const [protocol, setProtocol] = useState<IdpProtocol>(initial?.protocol ?? "saml");
  const [idpLabel, setIdpLabel] = useState(initial?.idpLabel ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [metadataUrl, setMetadataUrl] = useState(initial?.metadataUrl ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [emailDomains, setEmailDomains] = useState((initial?.emailDomains ?? []).join(", "));
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [jit, setJit] = useState(initial?.jitProvisioning ?? true);
  const [mapping, setMapping] = useState<AttributeMappingValue>(
    initial?.attributeMapping ?? defaultMapping(),
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const payload = {
      id: initial?.id,
      tenantId,
      protocol,
      idpLabel: idpLabel.trim(),
      issuer: issuer.trim() || null,
      metadataUrl: metadataUrl.trim() || null,
      clientId: protocol === "oidc" ? clientId.trim() || null : null,
      emailDomains: emailDomains
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
      jitProvisioning: jit,
      enabled,
      attributeMapping: mapping,
    };
    startTransition(async () => {
      try {
        const url = initial
          ? `/api/bff/admin/identity/idp/${initial.id}`
          : "/api/bff/admin/identity/idp";
        const res = await fetch(url, {
          method: initial ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) {
          setStatus({ kind: "err", msg: json.error?.userMessage ?? t("save_error") });
          return;
        }
        setStatus({ kind: "ok", msg: t("save_ok") });
        router.refresh();
      } catch {
        setStatus({ kind: "err", msg: t("network_error") });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="text-sm font-medium">{t("protocol")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROTOCOLS.map((p) => (
            <label
              key={p.value}
              className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
                protocol === p.value
                  ? "border-aivo-primary bg-aivo-primary-soft"
                  : "border-aivo-border hover:bg-aivo-surface-2"
              }`}
            >
              <input
                type="radio"
                name="protocol"
                value={p.value}
                checked={protocol === p.value}
                onChange={() => setProtocol(p.value)}
                className="sr-only"
              />
              <span className="block font-semibold">{p.label}</span>
              <span className="mt-1 block text-xs text-aivo-ink-soft">{p.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="idpLabel">{t("idp_label")}</Label>
        <Input
          id="idpLabel"
          value={idpLabel}
          onChange={(e) => setIdpLabel(e.target.value)}
          placeholder={t("idp_label_placeholder")}
          maxLength={120}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="issuer">
          {protocol === "oidc" ? t("oidc_issuer") : t("saml_entry_point")}
        </Label>
        <Input
          id="issuer"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder={
            protocol === "oidc" ? "https://idp.example.com" : "https://idp.example.com/sso"
          }
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="metadataUrl">
          {protocol === "oidc" ? t("oidc_discovery_url") : t("saml_metadata_url")}
        </Label>
        <Input
          id="metadataUrl"
          type="url"
          value={metadataUrl}
          onChange={(e) => setMetadataUrl(e.target.value)}
          placeholder="https://idp.example.com/.well-known/openid-configuration"
          className="mt-1"
        />
      </div>

      {protocol === "oidc" ? (
        <div>
          <Label htmlFor="clientId">{t("oidc_client_id")}</Label>
          <Input
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1"
          />
        </div>
      ) : null}

      <div>
        <Label htmlFor="emailDomains">{t("email_domains")}</Label>
        <Input
          id="emailDomains"
          value={emailDomains}
          onChange={(e) => setEmailDomains(e.target.value)}
          placeholder="district.k12.us, schools.district.org"
          className="mt-1"
        />
        <p className="mt-1 text-xs text-aivo-ink-soft">{t("email_domains_help")}</p>
      </div>

      <AttributeMappingEditor value={mapping} onChange={setMapping} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-md border border-aivo-border p-3 text-sm">
          <input
            type="checkbox"
            checked={jit}
            onChange={(e) => setJit(e.target.checked)}
            className="h-4 w-4 rounded border-aivo-border text-aivo-primary"
          />
          <span>
            <span className="block font-medium">{t("jit_provisioning")}</span>
            <span className="block text-xs text-aivo-ink-soft">{t("jit_provisioning_help")}</span>
          </span>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-aivo-border p-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-aivo-border text-aivo-primary"
          />
          <span>
            <span className="block font-medium">{t("enabled")}</span>
            <span className="block text-xs text-aivo-ink-soft">{t("enabled_help")}</span>
          </span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-3">
        {status?.kind === "ok" ? <p className="text-sm text-aivo-success">{status.msg}</p> : null}
        {status?.kind === "err" ? <p className="text-sm text-aivo-danger">{status.msg}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : initial ? t("save_changes") : t("create_idp")}
        </Button>
      </div>
    </form>
  );
}
