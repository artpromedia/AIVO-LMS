/**
 * Tenant feature flags for web-admin district self-serve gates (Sprint
 * B6) — resolved by identity-svc (kill switch > tenant override > env
 * default, the Sprint B2 resolver) for the SIGNED-IN admin's tenant.
 * Fail-closed: if identity is unreachable the gated surface stays off.
 */
import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

export async function districtEnterpriseModeEnabled(): Promise<boolean> {
  try {
    const jar = await cookies();
    const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
    if (!token) return false;
    const res = await fetch(`${IDENTITY_URL}/api/users/me/flags`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { flags?: { districtEnterpriseMode?: boolean } };
    return json.flags?.districtEnterpriseMode === true;
  } catch {
    return false;
  }
}
