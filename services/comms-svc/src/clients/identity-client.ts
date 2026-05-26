/**
 * Thin client for identity-svc. We only need a couple of cross-service
 * lookups for the messaging visibility policy:
 *
 *   - userExists / fetchUser → role, tenant, status
 *   - lookupUserByPhone     → STOP-keyword opt-out webhook handler
 *
 * Keep this surface small. If you need a richer identity-svc surface,
 * promote to a shared @aivo/identity-client workspace package instead of
 * fattening this file.
 */
export interface IdentityUser {
  id: string;
  tenantId: string;
  role: string; // 'parent' | 'teacher' | 'learner' | 'caregiver' | 'therapist' | 'admin' | ...
  status?: string;
  email?: string;
  phone?: string;
}

export interface IdentityClient {
  fetchUser(userId: string): Promise<IdentityUser | null>;
  lookupUserByPhone(phoneE164: string): Promise<IdentityUser | null>;
}

export function createIdentityClient(opts?: {
  baseUrl?: string;
  internalKey?: string;
  fetchImpl?: typeof fetch;
}): IdentityClient {
  const baseUrl = opts?.baseUrl ?? process.env.IDENTITY_SVC_URL ?? "http://localhost:3001";
  const internalKey =
    opts?.internalKey ??
    process.env.INTERNAL_SERVICE_KEY ??
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
  const fetchImpl = opts?.fetchImpl ?? fetch;

  const headers = (): Record<string, string> => ({
    "content-type": "application/json",
    "x-internal-key": internalKey,
  });

  return {
    async fetchUser(userId) {
      try {
        const res = await fetchImpl(
          `${baseUrl}/api/identity/internal/users/${encodeURIComponent(userId)}`,
          { headers: headers() },
        );
        if (!res.ok) return null;
        return (await res.json()) as IdentityUser;
      } catch {
        return null;
      }
    },
    async lookupUserByPhone(phoneE164) {
      try {
        const res = await fetchImpl(
          `${baseUrl}/api/identity/internal/users/by-phone/${encodeURIComponent(phoneE164)}`,
          { headers: headers() },
        );
        if (!res.ok) return null;
        return (await res.json()) as IdentityUser;
      } catch {
        return null;
      }
    },
  };
}
