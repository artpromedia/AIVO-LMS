/**
 * Server-side helper that fronts `services/identity-svc` learner mutations
 * from the BFF.
 *
 * Browser code MUST NOT import this module — it reads the user's access
 * token. Go through a `/api/bff/...` route handler.
 *
 * Dual-path (ADR 0009): when identity-svc is enabled (`AIVO_USE_IDENTITY_SVC`,
 * falling back to `AIVO_USE_SERVICE_STACK`) AND a real identity-svc access
 * token is present, the onboarding PIN step sets the learner's PIN on
 * identity-svc (hashed learner PIN credentials, the value the mobile
 * `pin-login` flow verifies).
 * Otherwise the caller uses the in-memory PIN store so dev/demo and mock auth
 * keep working.
 */
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@/lib/auth/identity-client";

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Resolve the identity-svc flag: per-service override, else the stack flag. */
export function isIdentitySvcEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return serverEnv.AIVO_USE_IDENTITY_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

/**
 * Read the identity-svc access token from the web-v2 session cookie as a
 * bearer. Returns null in mock mode / logged-out — the signal to use the
 * in-memory store path.
 */
export async function getIdentityBearer(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token && process.env.NODE_ENV === "production") {
    throw new Error("identity-svc access token is required in production");
  }
  return token ? `Bearer ${token}` : null;
}

async function identityFetch<T>(
  path: string,
  init: { method?: string; bearer: string; body?: unknown },
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverEnv.IDENTITY_SVC_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        authorization: init.bearer,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof json.error === "string" ? json.error : `identity-svc ${res.status}`,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Set a learner's PIN via identity-svc
 * (`PUT /api/users/learners/:learnerId`, body `{ pin }`). The parent
 * ownership + role check is enforced by identity-svc. `learnerId` MUST be
 * the canonical identity-svc UUID (the web `lrn_*` id 404s here).
 */
export function setLearnerPinViaIdentity(
  bearer: string,
  learnerId: string,
  pin: string,
): Promise<ServiceResult<{ success: boolean; learnerId: string }>> {
  return identityFetch(`/api/users/learners/${encodeURIComponent(learnerId)}`, {
    method: "PUT",
    bearer,
    body: { pin },
  });
}

/**
 * Cross-platform unification (Task #34): an identity-svc learner row as
 * returned by `GET /api/users/learners`. Only the fields the web BFF
 * reconcile step reads are typed; the row carries more.
 */
export type IdentityLearner = {
  id: string;
  name?: string | null;
  dateOfBirth?: string | null;
  gradeLevel?: string | null;
  parentId?: string | null;
  tenantId?: string | null;
};

/**
 * Provision the canonical learner in identity-svc
 * (`POST /api/users/learners`). This is the system of record the backend
 * microservices + the mobile app key off. Returns the new learner's UUID.
 *
 * The web app keeps its own `lrn_*` profile; the caller stores the returned
 * UUID on that profile via `LearnerStore.setIdentityLink`. identity-svc owns
 * parent ownership, tenant, and licensing-seat enforcement.
 */
export function createLearnerViaIdentity(
  bearer: string,
  input: {
    name: string;
    dateOfBirth?: string;
    gradeLevel?: string;
    diagnoses?: string[];
    zipCode?: string;
    country?: string;
    region?: string;
    preferredLanguage?: string;
  },
): Promise<ServiceResult<{ learner: IdentityLearner }>> {
  return identityFetch(`/api/users/learners`, {
    method: "POST",
    bearer,
    body: input,
  });
}

/**
 * List the learners identity-svc associates with the bearer's parent account
 * (`GET /api/users/learners`). Used by the BFF reconcile step to surface
 * mobile-origin learners in the web app.
 */
export function listLearnersViaIdentity(
  bearer: string,
): Promise<ServiceResult<IdentityLearner[]>> {
  return identityFetch(`/api/users/learners`, { method: "GET", bearer });
}
