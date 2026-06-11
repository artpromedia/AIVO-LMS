/**
 * District SSO configuration (Sprint B1) — the standalone admin console
 * finally exposes the identity-svc SSO config the backend has had all
 * along: SAML status + the OIDC relying-party section (Okta / Entra /
 * Google), with a LIVE "Test connection" dry-run against the issuer's
 * discovery document. Secrets are write-only: the GET returns *Set
 * markers, never envelopes (identity-svc redacts).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requirePageRole } from "@aivo/admin-auth";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { actionError } from "@/lib/action-errors";

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

async function bearer(): Promise<string> {
  const jar = await cookies();
  return jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value ?? "";
}

interface SsoView {
  enabled?: boolean;
  idpLabel?: string;
  emailDomains?: string[];
  requireSso?: boolean;
  idpCertSet?: boolean;
  oidc?: {
    enabled?: boolean;
    idpLabel?: string;
    issuer?: string;
    discoveryUrl?: string;
    clientId?: string;
    clientSecretSet?: boolean;
    emailDomains?: string[];
    roleClaim?: string;
    defaultRole?: string;
  };
}

async function readConfig(): Promise<SsoView> {
  const res = await fetch(`${IDENTITY_URL}/api/district/sso`, {
    headers: { authorization: `Bearer ${await bearer()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`identity-svc sso read failed (${res.status})`);
  const json = (await res.json()) as { config?: SsoView };
  return json.config ?? {};
}

async function saveOidcAction(formData: FormData) {
  "use server";
  const payload = {
    oidc: {
      enabled: formData.get("enabled") === "on",
      idpLabel: String(formData.get("idpLabel") || "").trim() || undefined,
      issuer: String(formData.get("issuer") || "").trim(),
      discoveryUrl: String(formData.get("discoveryUrl") || "").trim() || undefined,
      clientId: String(formData.get("clientId") || "").trim(),
      clientSecret: String(formData.get("clientSecret") || "").trim() || undefined,
      roleClaim: String(formData.get("roleClaim") || "").trim() || undefined,
      defaultRole: String(formData.get("defaultRole") || "").trim() || undefined,
      emailDomains: String(formData.get("emailDomains") || "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    },
  };
  try {
    const res = await fetch(`${IDENTITY_URL}/api/district/sso`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await bearer()}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw Object.assign(new Error(body.error ?? "SSO update failed"), { status: res.status });
    }
  } catch (error) {
    redirect(
      `/district/sso-config?error=${encodeURIComponent(actionError(error, "SSO update failed."))}`,
    );
  }
  revalidatePath("/district/sso-config");
  redirect("/district/sso-config?notice=saved");
}

async function testConnectionAction(formData: FormData) {
  "use server";
  const issuer = String(formData.get("issuer") || "").trim();
  const discoveryUrl = String(formData.get("discoveryUrl") || "").trim() || undefined;
  let outcome: string;
  try {
    const res = await fetch(`${IDENTITY_URL}/api/district/sso/oidc/test`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await bearer()}`,
      },
      body: JSON.stringify({ issuer, discoveryUrl }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    outcome = res.ok
      ? `ok:${String(json.authorizationEndpoint ?? "")}`
      : `fail:${String(json.error ?? res.status)}`;
  } catch (error) {
    outcome = `fail:${actionError(error, "Discovery request failed.")}`;
  }
  redirect(`/district/sso-config?test=${encodeURIComponent(outcome)}`);
}

export default async function DistrictSsoConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; test?: string }>;
}) {
  await requirePageRole(["district_admin"]);
  const params = await searchParams;
  const config = await readConfig();
  const oidc = config.oidc ?? {};
  const test = params.test;

  return (
    <AdminPageFrame
      eyebrow="District administration"
      title="Single sign-on"
      description="Connect your identity provider. OIDC (Okta, Microsoft Entra, Google Workspace) is preferred; SAML remains supported."
    >
      {params.notice === "saved" ? (
        <p className="admin-notice mt-6" role="status">
          SSO configuration saved.
        </p>
      ) : null}
      {params.error ? (
        <p className="admin-error mt-6" role="alert">
          {params.error}
        </p>
      ) : null}
      {test ? (
        <p className={`mt-6 ${test.startsWith("ok:") ? "admin-notice" : "admin-error"}`} role="status">
          {test.startsWith("ok:")
            ? `Discovery succeeded — authorization endpoint: ${test.slice(3)}`
            : `Discovery failed — ${test.slice(5)}`}
        </p>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-6">
          <h2 className="admin-h2">OpenID Connect</h2>
          <p className="mt-1 text-sm text-slate-600">
            Authorization-code + PKCE. Sign-in stays on your IdP; AIVO provisions district staff
            roles only — platform roles can never be minted through SSO.
          </p>
          <form action={saveOidcAction} className="mt-6 grid gap-4">
            <label className="block text-sm font-semibold">
              <span className="flex items-center gap-2">
                <input type="checkbox" name="enabled" defaultChecked={!!oidc.enabled} /> Enabled
              </span>
            </label>
            <label className="block text-sm font-semibold">
              Issuer URL
              <input
                className="admin-input mt-2"
                name="issuer"
                defaultValue={oidc.issuer ?? ""}
                placeholder="https://your-org.okta.com"
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Discovery URL (optional override)
              <input
                className="admin-input mt-2"
                name="discoveryUrl"
                defaultValue={oidc.discoveryUrl ?? ""}
                placeholder="https://…/.well-known/openid-configuration"
              />
            </label>
            <label className="block text-sm font-semibold">
              Client ID
              <input
                className="admin-input mt-2"
                name="clientId"
                defaultValue={oidc.clientId ?? ""}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Client secret{" "}
              {oidc.clientSecretSet ? (
                <span className="font-normal text-slate-500">
                  (stored — paste a new value to replace)
                </span>
              ) : null}
              <input
                className="admin-input mt-2"
                name="clientSecret"
                type="password"
                autoComplete="off"
                placeholder={oidc.clientSecretSet ? "••••••••" : ""}
              />
            </label>
            <label className="block text-sm font-semibold">
              Button label
              <input
                className="admin-input mt-2"
                name="idpLabel"
                defaultValue={oidc.idpLabel ?? ""}
                placeholder="Okta"
              />
            </label>
            <label className="block text-sm font-semibold">
              Email domains (comma-separated)
              <input
                className="admin-input mt-2"
                name="emailDomains"
                defaultValue={(oidc.emailDomains ?? []).join(", ")}
                placeholder="yourdistrict.org"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Role claim
                <input
                  className="admin-input mt-2"
                  name="roleClaim"
                  defaultValue={oidc.roleClaim ?? ""}
                  placeholder="groups"
                />
              </label>
              <label className="block text-sm font-semibold">
                Default role
                <select className="admin-input mt-2" name="defaultRole" defaultValue={oidc.defaultRole ?? "TEACHER"}>
                  <option value="TEACHER">Teacher</option>
                  <option value="CAREGIVER">Caregiver</option>
                  <option value="THERAPIST">Therapist</option>
                  <option value="DISTRICT_ADMIN">District admin</option>
                </select>
              </label>
            </div>
            <div className="flex gap-3">
              <button className="admin-button" type="submit">
                Save OIDC settings
              </button>
              <button className="admin-button-secondary" formAction={testConnectionAction} type="submit">
                Test connection
              </button>
            </div>
          </form>
        </AdminCard>

        <AdminCard className="p-6">
          <h2 className="admin-h2">SAML 2.0</h2>
          <p className="mt-1 text-sm text-slate-600">
            {config.enabled
              ? `Enabled (${config.idpLabel || "SSO"}) for: ${(config.emailDomains ?? []).join(", ") || "no domains set"}. Certificate ${config.idpCertSet ? "stored" : "missing"}.`
              : "Not enabled. SAML setup (metadata exchange, certificates) is managed with your AIVO implementation contact; OIDC above is self-serve."}
          </p>
          <p className="mt-4 text-sm text-slate-600">
            Redirect URI for your IdP app registration:{" "}
            <code className="font-mono text-xs">/api/sso/oidc/&lt;your-tenant-id&gt;/callback</code>{" "}
            on the AIVO origin — see the runbook in docs/auth/oidc-rp-runbook.md.
          </p>
        </AdminCard>
      </section>
    </AdminPageFrame>
  );
}
