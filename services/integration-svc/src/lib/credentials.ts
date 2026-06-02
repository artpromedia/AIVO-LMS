/**
 * Sprint 2 — SIS credential envelope encryption (KMS-backed at rest).
 *
 * SIS connector secrets (OneRoster client_secret, Clever token, ClassLink
 * client_secret) are encrypted with `@aivo/security` before they touch
 * `sis_configs`. That module wraps an AES-256-GCM envelope whose data key is
 * sourced from KMS / the secrets manager in production (and a local key in
 * dev), producing `v1:iv:tag:ct` envelopes. Plaintext secrets never persist
 * and are redacted from logs — only a non-secret hint (provider + masked id)
 * is stored alongside.
 */
import { encryptSecret, decryptSecret } from "@aivo/security";

export interface SisCredentials {
  /** OneRoster / ClassLink OAuth2 client id. */
  clientId?: string;
  /** OneRoster / ClassLink OAuth2 client secret. */
  clientSecret?: string;
  /** OAuth2 token endpoint. */
  tokenUrl?: string;
  /** Clever district bearer token. */
  cleverToken?: string;
}

/** What we persist: every secret field as an encrypted envelope + a hint. */
export interface StoredSisCredentials {
  clientId?: string;
  tokenUrl?: string;
  clientSecretEnvelope?: string;
  cleverTokenEnvelope?: string;
  /** Non-secret, log-safe summary, e.g. "client_id ····a1b2". */
  hint: string;
}

function mask(value: string | undefined): string {
  if (!value) return "n/a";
  const tail = value.slice(-4);
  return `····${tail}`;
}

export function encryptSisCredentials(creds: SisCredentials): StoredSisCredentials {
  const out: StoredSisCredentials = { hint: "" };
  if (creds.clientId) out.clientId = creds.clientId; // id is not secret
  if (creds.tokenUrl) out.tokenUrl = creds.tokenUrl;
  if (creds.clientSecret) out.clientSecretEnvelope = encryptSecret(creds.clientSecret);
  if (creds.cleverToken) out.cleverTokenEnvelope = encryptSecret(creds.cleverToken);
  out.hint = creds.clientId
    ? `client_id ${mask(creds.clientId)}`
    : creds.cleverToken
      ? `clever token ${mask(creds.cleverToken)}`
      : "configured";
  return out;
}

export function decryptSisCredentials(stored: StoredSisCredentials): SisCredentials {
  const out: SisCredentials = {};
  if (stored.clientId) out.clientId = stored.clientId;
  if (stored.tokenUrl) out.tokenUrl = stored.tokenUrl;
  if (stored.clientSecretEnvelope) out.clientSecret = decryptSecret(stored.clientSecretEnvelope);
  if (stored.cleverTokenEnvelope) out.cleverToken = decryptSecret(stored.cleverTokenEnvelope);
  return out;
}

/** Redact secrets from any object before logging. */
export function redactCredentials<T extends Record<string, unknown>>(obj: T): T {
  const SECRET_KEYS = /secret|token|password|client_secret|clientsecret/i;
  const clone: Record<string, unknown> = Array.isArray(obj) ? [...(obj as unknown[])] as never : { ...obj };
  for (const k of Object.keys(clone)) {
    if (SECRET_KEYS.test(k)) clone[k] = "[REDACTED]";
    else if (clone[k] && typeof clone[k] === "object") {
      clone[k] = redactCredentials(clone[k] as Record<string, unknown>);
    }
  }
  return clone as T;
}
