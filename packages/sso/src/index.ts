/**
 * @aivo/sso — Tenant-aware SAML 2.0 SSO support.
 *
 * Wraps `@node-saml/node-saml` so identity-svc can:
 *   1. Build a SAML strategy per tenant from `district_settings.sso_config`.
 *   2. Encrypt sensitive fields (IdP cert, SP private key) at rest using
 *      MFA_ENCRYPTION_KEY (re-uses the existing AES-GCM helpers in
 *      `@aivo/security`).
 *   3. Map IdP attributes (name, email, role) to AIVO user fields.
 *
 * Find-or-provision logic lives in identity-svc, not here.
 */

import { SAML, type SamlConfig } from "@node-saml/node-saml";
import { encryptSecret, decryptSecret } from "@aivo/security";

/**
 * Stored shape of `district_settings.sso_config`. All sensitive fields
 * (IdP signing certificate, SP private key) are stored as encrypted
 * envelopes (`v1:iv:tag:ct`) — call `decryptSsoConfig` before use.
 */
export interface StoredSsoConfig {
  enabled: boolean;
  /** Friendly IdP label shown on the login page ("Continue with Okta"). */
  idpLabel?: string;
  /** Email domains owned by this district. Drives `/api/auth/discover`. */
  emailDomains?: string[];
  /** When true, password login is rejected for matched email domains. */
  requireSso?: boolean;
  /** SAML 2.0 SSO entry point (IdP redirect URL). */
  entryPoint?: string;
  /** SAML logout endpoint (IdP). */
  logoutUrl?: string;
  /** EntityID we present as. Defaults to `aivo:sp:<tenantSlug>`. */
  issuer?: string;
  /** IdP signing certificate (PEM). Encrypted envelope at rest. */
  idpCertEnvelope?: string;
  /** Optional SP private key for signing AuthnRequests (PEM). Encrypted envelope. */
  spPrivateKeyEnvelope?: string;
  /** SAML name identifier format. */
  identifierFormat?: string;
  /** Attribute name carrying the user's email. Default: standard Email. */
  emailAttribute?: string;
  /** Attribute name carrying the user's full name. */
  nameAttribute?: string;
  /** Attribute name carrying the user's role. */
  roleAttribute?: string;
  /** Mapping from IdP role values to AIVO roles. */
  roleMap?: Record<string, string>;
  /** Default AIVO role for users without a mapped role attribute. */
  defaultRole?: string;
}

export interface DecryptedSsoConfig extends Omit<StoredSsoConfig, "idpCertEnvelope" | "spPrivateKeyEnvelope"> {
  idpCert?: string;
  spPrivateKey?: string;
}

/** Encrypt sensitive fields before persistence. Idempotent — re-encrypts. */
export function encryptSsoConfig(input: DecryptedSsoConfig): StoredSsoConfig {
  const { idpCert, spPrivateKey, ...rest } = input;
  const out: StoredSsoConfig = { ...rest };
  if (idpCert) out.idpCertEnvelope = encryptSecret(idpCert);
  if (spPrivateKey) out.spPrivateKeyEnvelope = encryptSecret(spPrivateKey);
  return out;
}

export function decryptSsoConfig(stored: StoredSsoConfig): DecryptedSsoConfig {
  const { idpCertEnvelope, spPrivateKeyEnvelope, ...rest } = stored;
  const out: DecryptedSsoConfig = { ...rest };
  if (idpCertEnvelope) out.idpCert = decryptSecret(idpCertEnvelope);
  if (spPrivateKeyEnvelope) out.spPrivateKey = decryptSecret(spPrivateKeyEnvelope);
  return out;
}

export interface BuildSamlOptions {
  /** Public URL of identity-svc (for ACS/SLO callbacks). */
  publicBaseUrl: string;
  tenantSlug: string;
  config: DecryptedSsoConfig;
}

export function buildSaml(opts: BuildSamlOptions): SAML {
  const { publicBaseUrl, tenantSlug, config } = opts;
  if (!config.entryPoint) throw new Error("SAML entryPoint missing");
  if (!config.idpCert) throw new Error("SAML idpCert missing");

  const samlConfig: SamlConfig = {
    entryPoint: config.entryPoint,
    issuer: config.issuer || `aivo:sp:${tenantSlug}`,
    callbackUrl: `${publicBaseUrl}/api/sso/saml/${encodeURIComponent(tenantSlug)}/acs`,
    logoutUrl: config.logoutUrl,
    logoutCallbackUrl: `${publicBaseUrl}/api/sso/saml/${encodeURIComponent(tenantSlug)}/slo`,
    idpCert: config.idpCert,
    privateKey: config.spPrivateKey,
    identifierFormat: config.identifierFormat
      || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
  };

  return new SAML(samlConfig);
}

/**
 * Pull the SAML attribute that carries the user's email. Tries explicit
 * `emailAttribute` mapping first, then standard SAML email attribute names.
 */
export function extractEmail(profile: Record<string, any>, config: DecryptedSsoConfig): string | null {
  const candidates = [
    config.emailAttribute,
    "email",
    "Email",
    "mail",
    "emailAddress",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  ].filter(Boolean) as string[];
  for (const k of candidates) {
    const v = profile[k] ?? profile.attributes?.[k];
    if (typeof v === "string" && v.includes("@")) return v.toLowerCase().trim();
    if (Array.isArray(v) && typeof v[0] === "string") return v[0].toLowerCase().trim();
  }
  if (typeof profile.nameID === "string" && profile.nameID.includes("@")) {
    return profile.nameID.toLowerCase().trim();
  }
  return null;
}

export function extractName(profile: Record<string, any>, config: DecryptedSsoConfig): string {
  const candidates = [
    config.nameAttribute,
    "displayName",
    "name",
    "cn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  ].filter(Boolean) as string[];
  for (const k of candidates) {
    const v = profile[k] ?? profile.attributes?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string") return String(v[0]).trim();
  }
  // Fall back to first/last
  const first = profile.firstName || profile.givenName || profile.attributes?.firstName;
  const last = profile.lastName || profile.surname || profile.attributes?.lastName;
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return "";
}

/**
 * Map a raw IdP role value to an AIVO role using the tenant's `roleMap`.
 * Returns the configured `defaultRole` (or "DISTRICT_ADMIN") when nothing
 * matches.
 */
export function mapRole(profile: Record<string, any>, config: DecryptedSsoConfig): string {
  const def = config.defaultRole || "DISTRICT_ADMIN";
  const attrName = config.roleAttribute;
  if (!attrName) return def;
  const raw = profile[attrName] ?? profile.attributes?.[attrName];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return def;
  const mapped = config.roleMap?.[String(v)];
  return mapped || def;
}

/** IdP preset metadata used by the self-service settings UI. */
export const IDP_PRESETS: Record<string, Partial<StoredSsoConfig>> = {
  azure: {
    idpLabel: "Microsoft Entra ID",
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    emailAttribute: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    nameAttribute: "http://schemas.microsoft.com/identity/claims/displayname",
    roleAttribute: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  },
  google: {
    idpLabel: "Google Workspace",
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    emailAttribute: "email",
    nameAttribute: "name",
  },
  okta: {
    idpLabel: "Okta",
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    emailAttribute: "email",
    nameAttribute: "displayName",
    roleAttribute: "groups",
  },
  onelogin: {
    idpLabel: "OneLogin",
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    emailAttribute: "User.email",
    nameAttribute: "User.FirstName",
    roleAttribute: "memberOf",
  },
  custom: {
    idpLabel: "SSO",
  },
};

export type { SAML };
