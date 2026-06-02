/**
 * Sprint 1 (Enterprise Identity) — JWT authentication-context claims.
 *
 * Extends issued access tokens with NIST 800-63B-aligned context claims:
 *   - `amr` (Authentication Methods References): which factors were used to
 *     authenticate, e.g. `["pwd"]` for password-only and `["pwd","mfa"]`
 *     after a verified second factor / step-up.
 *   - `acr` (Authentication Context Class Reference): the resulting
 *     assurance level — `"aal1"` (single factor) or `"aal2"` (multi-factor).
 *
 * `signJWT` from `@aivo/security` is generic and signs whatever payload it
 * is given; this module centralises the amr/acr convention so callers don't
 * each re-derive the mapping. Federated-login flows (OIDC RP, SAML ACS) and
 * the step-up exchange route their access tokens through here.
 */
import { signJWT } from "@aivo/security";

/** Authentication Method Reference: password / knowledge factor. */
export const AMR_PWD = "pwd";
/** Authentication Method Reference: a second factor was verified. */
export const AMR_MFA = "mfa";

export type Aal = "aal1" | "aal2";

/**
 * Derive the Authentication Context Class Reference (assurance level) from
 * the set of authentication methods used. Any `mfa` factor lifts the
 * session to AAL2; otherwise it is AAL1.
 */
export function deriveAcr(amr: readonly string[]): Aal {
  return amr.includes(AMR_MFA) ? "aal2" : "aal1";
}

export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  role: string;
  email?: string;
  name?: string | null;
  /** Allow callers to attach additional, flow-specific claims. */
  [k: string]: unknown;
}

export interface AccessTokenOptions {
  /** Authentication methods used. Defaults to `["pwd"]`. */
  amr?: string[];
  /** Override the assurance level. Defaults to {@link deriveAcr}(amr). */
  acr?: Aal;
  /** Token TTL as a jose duration string. Defaults to signJWT's 15m. */
  expiresIn?: string;
}

/**
 * Sign an access token, attaching `amr`/`acr` context claims. Unknown
 * claims on `claims` are preserved verbatim, so this is a drop-in upgrade
 * for raw `signJWT({...})` call sites that want assurance-level metadata
 * without changing their existing payload shape.
 */
export async function signAccessToken(
  claims: AccessTokenClaims,
  opts: AccessTokenOptions = {},
): Promise<string> {
  const amr = opts.amr && opts.amr.length ? Array.from(new Set(opts.amr)) : [AMR_PWD];
  const acr = opts.acr ?? deriveAcr(amr);
  const payload = { ...claims, amr, acr };
  return opts.expiresIn ? signJWT(payload, opts.expiresIn) : signJWT(payload);
}
