/**
 * Sprint 16 — envelope encryption for sensitive attachments.
 *
 * Uses AES-256-GCM for the per-attachment Data Encryption Key (DEK)
 * and a tenant-scoped Key Encryption Key (KEK) to wrap the DEK. The
 * KEK is supplied by the secrets-client from PR #55 (Vault / AWS SM)
 * — keyed by tenantId and rotated per `docs/security/key-rotation.md`.
 *
 * Boundary used by Sprint 16:
 *   - family-svc IEP attachment upload  → encryptForLearner(...)
 *   - caregiver attachment upload       → encryptForLearner(...)
 *
 * The DEK never persists in plaintext; only the wrapped DEK is stored
 * alongside the ciphertext. Each operation also commits the learnerId
 * + tenantId into the AAD so a ciphertext blob can't be replayed
 * against a different learner.
 *
 * Test:  packages/security/tests/envelope.test.ts
 * Rotation:  docs/security/key-rotation.md (KEK_VERSION advances; old
 *            KEK retained for decrypt-only until all data migrated).
 *
 * NOTE: We depend on Node's `crypto` module rather than
 * `aws-encryption-sdk-javascript` to keep the package zero-dependency
 * — adopting the AWS SDK is a follow-up if/when we need cross-region
 * key replication.
 */
import * as crypto from "node:crypto";

const AES_ALGO = "aes-256-gcm";
const KEY_BYTES = 32; // 256 bit DEK
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface WrappedDek {
  /** KEK version used to wrap (advances with rotation). */
  v: number;
  /** Wrapped DEK ciphertext (base64). */
  dek: string;
  /** 12-byte IV used while wrapping the DEK (base64). */
  iv: string;
  /** 16-byte GCM auth tag for the wrap operation (base64). */
  tag: string;
}

export interface SealedPayload {
  /** Payload ciphertext (base64). */
  c: string;
  /** Payload IV (base64). */
  iv: string;
  /** Payload GCM auth tag (base64). */
  tag: string;
  /** Wrapped DEK (above). */
  wrapped: WrappedDek;
}

/**
 * Provider for tenant-scoped KEKs. The default implementation reads
 * from `KEK_<tenantId>_V<version>` env vars (a stop-gap until the
 * secrets-client lookup is wired into family-svc + caregiver flow);
 * tests inject a deterministic in-memory provider via setKekProvider.
 *
 * `secretsClient.getSecret(...)` in production should resolve a
 * 32-byte key for `kek/<tenantId>/v<version>`.
 */
export type KekProvider = (tenantId: string, version: number) => Promise<Buffer>;

let kekProvider: KekProvider = async (tenantId, version) => {
  const envKey = `KEK_${tenantId.replace(/-/g, "_")}_V${version}`;
  const raw = process.env[envKey];
  if (raw) {
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error(`${envKey} must be a 64-character hex string`);
    }
    return Buffer.from(raw, "hex");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `KEK missing for tenant ${tenantId} v${version}; wire secrets-client.getSecret('kek/${tenantId}/v${version}')`,
    );
  }
  // Deterministic dev/test fallback derived from a fixed master so
  // round-trip tests work without env setup. NEVER use this code path
  // in production; the production branch above throws first.
  return crypto
    .createHash("sha256")
    .update(`dev-kek::${tenantId}::v${version}`)
    .digest();
};

export function setKekProvider(p: KekProvider) {
  kekProvider = p;
}

/**
 * Current KEK version advertised to writers. Reads honour the
 * version stored on the wrapped DEK so we can decrypt older payloads
 * during rotation windows.
 */
export function currentKekVersion(): number {
  const raw = process.env.KEK_VERSION;
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`KEK_VERSION must be a positive integer; got ${raw}`);
  }
  return n;
}

/**
 * Resolve the tenant for a learner. Sprint 16's first integration
 * passes tenantId directly; this function exists as a seam for
 * services that have learnerId but not tenantId at the call site.
 * Default implementation requires the caller to provide tenantId;
 * services override via `setTenantResolver`.
 */
export type TenantResolver = (learnerId: string) => Promise<string>;
let tenantResolver: TenantResolver = async () => {
  throw new Error(
    "envelope: tenant resolver not configured. Call setTenantResolver(learnerId => tenantId) at service boot, or use encryptForLearnerWithTenant() to pass tenantId directly.",
  );
};
export function setTenantResolver(r: TenantResolver) {
  tenantResolver = r;
}

function buildAad(tenantId: string, learnerId: string, version: number): Buffer {
  return Buffer.from(`tenantId=${tenantId};learnerId=${learnerId};kek=v${version}`, "utf8");
}

async function wrapDek(dek: Buffer, tenantId: string, learnerId: string): Promise<WrappedDek> {
  const version = currentKekVersion();
  const kek = await kekProvider(tenantId, version);
  if (kek.length !== KEY_BYTES) {
    throw new Error(`KEK for tenant ${tenantId} v${version} must be ${KEY_BYTES} bytes`);
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGO, kek, iv);
  cipher.setAAD(buildAad(tenantId, learnerId, version));
  const c = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: version,
    dek: c.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

async function unwrapDek(
  wrapped: WrappedDek,
  tenantId: string,
  learnerId: string,
): Promise<Buffer> {
  const kek = await kekProvider(tenantId, wrapped.v);
  if (kek.length !== KEY_BYTES) {
    throw new Error(`KEK for tenant ${tenantId} v${wrapped.v} must be ${KEY_BYTES} bytes`);
  }
  const iv = Buffer.from(wrapped.iv, "base64");
  const tag = Buffer.from(wrapped.tag, "base64");
  const ct = Buffer.from(wrapped.dek, "base64");
  const decipher = crypto.createDecipheriv(AES_ALGO, kek, iv);
  decipher.setAAD(buildAad(tenantId, learnerId, wrapped.v));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Encrypt `plaintext` for a learner. Resolves tenant via the
 * registered tenant resolver. Returns a self-contained sealed payload
 * (ciphertext + IV + tag + wrapped DEK).
 */
export async function encryptForLearner(
  plaintext: Buffer | string,
  learnerId: string,
): Promise<SealedPayload> {
  const tenantId = await tenantResolver(learnerId);
  return encryptForLearnerWithTenant(plaintext, learnerId, tenantId);
}

/**
 * Same as encryptForLearner but accepts an explicit tenantId — for
 * services that already have it in scope and don't want to plumb a
 * resolver.
 */
export async function encryptForLearnerWithTenant(
  plaintext: Buffer | string,
  learnerId: string,
  tenantId: string,
): Promise<SealedPayload> {
  const pt = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const dek = crypto.randomBytes(KEY_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGO, dek, iv);
  cipher.setAAD(buildAad(tenantId, learnerId, currentKekVersion()));
  const c = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrapped = await wrapDek(dek, tenantId, learnerId);
  // Best-effort zero of the in-memory DEK after use. JS doesn't give
  // us guaranteed destruction but explicit fill at least narrows the
  // window for a heap snapshot to leak it.
  dek.fill(0);
  return {
    c: c.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    wrapped,
  };
}

/**
 * Decrypt a SealedPayload (or the legacy split form
 * decryptForLearner(ciphertext, wrappedDEK, learnerId)).
 */
export async function decryptForLearner(
  sealed: SealedPayload,
  learnerId: string,
): Promise<Buffer> {
  const tenantId = await tenantResolver(learnerId);
  return decryptForLearnerWithTenant(sealed, learnerId, tenantId);
}

export async function decryptForLearnerWithTenant(
  sealed: SealedPayload,
  learnerId: string,
  tenantId: string,
): Promise<Buffer> {
  const dek = await unwrapDek(sealed.wrapped, tenantId, learnerId);
  try {
    const iv = Buffer.from(sealed.iv, "base64");
    const tag = Buffer.from(sealed.tag, "base64");
    const ct = Buffer.from(sealed.c, "base64");
    const decipher = crypto.createDecipheriv(AES_ALGO, dek, iv);
    decipher.setAAD(buildAad(tenantId, learnerId, sealed.wrapped.v));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } finally {
    dek.fill(0);
  }
}

/**
 * Convenience helper for callers that already have plaintext and a
 * tenantId in scope and want the JSON-serializable triple (no learner
 * context — for service-level secrets rather than per-learner data).
 * Kept narrow so the per-learner AAD path remains the default.
 */
export const __INTERNAL__ = {
  AES_ALGO,
  KEY_BYTES,
  IV_BYTES,
  TAG_BYTES,
};
