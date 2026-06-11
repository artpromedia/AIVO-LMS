/**
 * Tenant-scoped feature flags for web-v2 (Sprint B2).
 *
 * `getTenantFlags()` replaces request-time `resolveEnterpriseFlags()`
 * call sites: the flags a request sees are the CALLER'S TENANT'S flags
 * (kill switch > district override > env default), resolved by
 * identity-svc (`GET /api/users/me/flags`) which owns the override store.
 *
 *  - Mock mode (no identity-svc): env defaults via the original resolver —
 *    dev behavior unchanged.
 *  - No session / identity unreachable: env defaults (fail-open to the
 *    safe OFF-biased defaults; flags never crash a page).
 *  - Identity responses are cached per tenant for 30s in this process via
 *    the shared resolver semantics on the identity side; this module adds
 *    a short local memo keyed by access token to avoid duplicate fetches
 *    within one render burst.
 */
import { cookies } from "next/headers";
import {
  resolveEnterpriseFlags,
  type EnterpriseFeatureFlags,
} from "@aivo/feature-flags";
import { serverEnv } from "@/lib/env";
import { isMockAuthAllowed } from "@/lib/auth/mock-session";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@/lib/auth/identity-client";

const memo = new Map<string, { flags: EnterpriseFeatureFlags; at: number }>();
const MEMO_TTL_MS = 5_000;

export async function getTenantFlags(): Promise<EnterpriseFeatureFlags> {
  if (isMockAuthAllowed()) {
    return resolveEnterpriseFlags(process.env as Record<string, string | undefined>);
  }
  let accessToken: string | undefined;
  try {
    const jar = await cookies();
    accessToken = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  } catch {
    accessToken = undefined; // outside a request scope
  }
  if (!accessToken) {
    return resolveEnterpriseFlags(process.env as Record<string, string | undefined>);
  }
  const hit = memo.get(accessToken);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.flags;
  try {
    const res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/users/me/flags`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { flags?: EnterpriseFeatureFlags };
    const envDefaults = resolveEnterpriseFlags(
      process.env as Record<string, string | undefined>,
    );
    const flags = { ...envDefaults, ...(json.flags ?? {}) };
    memo.set(accessToken, { flags, at: Date.now() });
    return flags;
  } catch {
    return resolveEnterpriseFlags(process.env as Record<string, string | undefined>);
  }
}
