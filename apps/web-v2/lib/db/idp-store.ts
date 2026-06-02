/**
 * Per-tenant Identity Provider (IdP) configuration registry.
 *
 * Backs the platform-admin Identity catalog (`/admin/platform/identity`) and
 * the district read view. Like every other web-v2 dataset (see
 * `team-invites.ts`, `user-roles-store.ts`) this is an in-memory singleton
 * standing in for the real `identity-svc` `idp_configs` / `scim_tokens`
 * tables until the BFF is wired to proxy to the service. The record shape
 * intentionally mirrors `services/identity-svc` (`@aivo/sso` `StoredSsoConfig`
 * + the OIDC RP config added in ADR 0030) so the swap is mechanical.
 *
 * SCIM bearer tokens are NEVER stored in plaintext — only a non-secret
 * preview (last 4 chars) and issue metadata are retained, matching the
 * "hashed at rest" requirement. The full token is returned exactly once,
 * at issuance.
 */
import type { ID, ISODate } from "@/lib/db/types";

export type IdpProtocol = "saml" | "oidc";

export type AttributeMapping = {
  /** Claim/attribute carrying the user's email. */
  email: string;
  /** Claim/attribute carrying the display name. */
  name: string;
  /** Claim/attribute carrying the role/group. */
  role: string;
  /** Map from IdP role/group values to AIVO roles. */
  roleMap: Record<string, string>;
  /** AIVO role assigned when no role value maps. */
  defaultRole: string;
};

export type ScimTokenPreview = {
  id: ID;
  label: string;
  /** Last 4 characters of the issued token (non-secret). */
  last4: string;
  createdAt: ISODate;
  createdBy: ID | null;
  revokedAt: ISODate | null;
};

export type IdpConfigRecord = {
  id: ID;
  tenantId: ID;
  enabled: boolean;
  protocol: IdpProtocol;
  /** Friendly label ("Continue with Okta"). */
  idpLabel: string;
  /** SAML: IdP entry point. OIDC: issuer. */
  issuer: string | null;
  /** SAML metadata URL or OIDC discovery URL. */
  metadataUrl: string | null;
  /** OIDC only — public client id. */
  clientId: string | null;
  /** Email domains owned by this tenant (drives discovery). */
  emailDomains: string[];
  /** Just-in-time provisioning toggle. */
  jitProvisioning: boolean;
  attributeMapping: AttributeMapping;
  scimEnabled: boolean;
  scimTokens: ScimTokenPreview[];
  createdAt: ISODate;
  updatedAt: ISODate;
  updatedBy: ID | null;
};

type Tables = { idpConfigs: IdpConfigRecord[] };

declare global {
  // Module-scoped singleton, sibling to globalThis.__aivoStore.
  var __aivoIdpConfigs: Tables | undefined;
}

function tables(): Tables {
  if (!globalThis.__aivoIdpConfigs) {
    globalThis.__aivoIdpConfigs = { idpConfigs: [] };
  }
  return globalThis.__aivoIdpConfigs;
}

function nowIso(): ISODate {
  return new Date().toISOString();
}

function newId(prefix: string): ID {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultAttributeMapping(): AttributeMapping {
  return {
    email: "email",
    name: "name",
    role: "roles",
    roleMap: {},
    defaultRole: "TEACHER",
  };
}

export function listIdpConfigs(tenantId?: ID): IdpConfigRecord[] {
  const all = tables().idpConfigs;
  const rows = tenantId ? all.filter((c) => c.tenantId === tenantId) : all;
  return rows.slice().sort((a, b) => a.tenantId.localeCompare(b.tenantId));
}

export function getIdpConfig(id: ID): IdpConfigRecord | null {
  return tables().idpConfigs.find((c) => c.id === id) ?? null;
}

export function getIdpConfigByTenant(tenantId: ID): IdpConfigRecord | null {
  return tables().idpConfigs.find((c) => c.tenantId === tenantId) ?? null;
}

export type UpsertIdpInput = {
  id?: ID;
  tenantId: ID;
  enabled?: boolean;
  protocol: IdpProtocol;
  idpLabel: string;
  issuer?: string | null;
  metadataUrl?: string | null;
  clientId?: string | null;
  emailDomains?: string[];
  jitProvisioning?: boolean;
  attributeMapping?: Partial<AttributeMapping>;
  scimEnabled?: boolean;
  actorId?: ID | null;
};

export function upsertIdpConfig(input: UpsertIdpInput): IdpConfigRecord {
  const t = tables();
  const existing = input.id
    ? t.idpConfigs.find((c) => c.id === input.id)
    : t.idpConfigs.find((c) => c.tenantId === input.tenantId);

  const mapping: AttributeMapping = {
    ...defaultAttributeMapping(),
    ...(existing?.attributeMapping ?? {}),
    ...(input.attributeMapping ?? {}),
  };

  if (existing) {
    const next: IdpConfigRecord = {
      ...existing,
      enabled: input.enabled ?? existing.enabled,
      protocol: input.protocol,
      idpLabel: input.idpLabel,
      issuer: input.issuer ?? existing.issuer,
      metadataUrl: input.metadataUrl ?? existing.metadataUrl,
      clientId: input.clientId ?? existing.clientId,
      emailDomains: input.emailDomains ?? existing.emailDomains,
      jitProvisioning: input.jitProvisioning ?? existing.jitProvisioning,
      attributeMapping: mapping,
      scimEnabled: input.scimEnabled ?? existing.scimEnabled,
      updatedAt: nowIso(),
      updatedBy: input.actorId ?? existing.updatedBy,
    };
    const idx = t.idpConfigs.findIndex((c) => c.id === existing.id);
    t.idpConfigs[idx] = next;
    return next;
  }

  const record: IdpConfigRecord = {
    id: newId("idp"),
    tenantId: input.tenantId,
    enabled: input.enabled ?? false,
    protocol: input.protocol,
    idpLabel: input.idpLabel,
    issuer: input.issuer ?? null,
    metadataUrl: input.metadataUrl ?? null,
    clientId: input.clientId ?? null,
    emailDomains: input.emailDomains ?? [],
    jitProvisioning: input.jitProvisioning ?? true,
    attributeMapping: mapping,
    scimEnabled: input.scimEnabled ?? false,
    scimTokens: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: input.actorId ?? null,
  };
  t.idpConfigs.push(record);
  return record;
}

export function deleteIdpConfig(id: ID): boolean {
  const t = tables();
  const idx = t.idpConfigs.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  t.idpConfigs.splice(idx, 1);
  return true;
}

/** Generate a SCIM bearer token. Returns the FULL token once; only a preview is stored. */
export function issueScimToken(
  idpId: ID,
  label: string,
  actorId: ID | null,
): { token: string; preview: ScimTokenPreview } | null {
  const cfg = getIdpConfig(idpId);
  if (!cfg) return null;
  // 32-byte url-safe token; the caller surfaces it once and never again.
  const raw = Array.from({ length: 43 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".charAt(
      Math.floor(Math.random() * 64),
    ),
  ).join("");
  const token = `scim_${raw}`;
  const preview: ScimTokenPreview = {
    id: newId("scimtok"),
    label: label.trim() || "SCIM token",
    last4: token.slice(-4),
    createdAt: nowIso(),
    createdBy: actorId,
    revokedAt: null,
  };
  cfg.scimTokens.push(preview);
  cfg.scimEnabled = true;
  cfg.updatedAt = nowIso();
  return { token, preview };
}

export function revokeScimToken(idpId: ID, tokenId: ID): boolean {
  const cfg = getIdpConfig(idpId);
  if (!cfg) return false;
  const tok = cfg.scimTokens.find((s) => s.id === tokenId);
  if (!tok || tok.revokedAt) return false;
  tok.revokedAt = nowIso();
  cfg.updatedAt = nowIso();
  return true;
}

/** Active (non-revoked) token previews for a config. */
export function listActiveScimTokens(idpId: ID): ScimTokenPreview[] {
  const cfg = getIdpConfig(idpId);
  if (!cfg) return [];
  return cfg.scimTokens.filter((s) => !s.revokedAt);
}

/** Test/dev helper — wipes the store so tests start clean. */
export function _resetIdpStore(): void {
  globalThis.__aivoIdpConfigs = { idpConfigs: [] };
}
