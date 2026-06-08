/**
 * Typed write-through client for `services/family-svc` clinical endpoints
 * (ADR 0015). The canonical IEP goals / therapist session notes / caregiver
 * observations live in family-svc — the same endpoints the mobile app POSTs
 * to (useCreateTherapySession etc.). This client mirrors that contract:
 * "persist or fail loudly" — a non-2xx or unreachable upstream raises
 * `FamilySvcError`, never a fabricated record or silent success.
 *
 * Auth/enablement is shared with lib/bff/family-svc.ts (isFamilySvcEnabled +
 * getFamilyBearer); this module only adds the clinical write-through routes.
 *
 * Server-only: reads the service token + session bearer. Never import from
 * client code.
 */
import { serverEnv } from "@/lib/env";
import { getFamilyBearer, isFamilySvcEnabled } from "@/lib/bff/family-svc";

export class FamilySvcError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
  ) {
    super(message);
    this.name = "FamilySvcError";
  }
}

export interface TherapySessionInput {
  learnerId: string;
  sessionDate: string;
  durationMinutes: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  goalIds: string[];
}

export interface ObservationInput {
  learnerId: string;
  observedAt: string;
  behaviour: string;
  antecedent: string;
  consequence: string;
  durationMinutes: number | null;
  location: string;
  attachmentUrl: string | null;
}

export interface IepGoalInput {
  learnerId: string;
  domain: string;
  goalText: string;
  baseline: string;
  targetCriteria: string;
  measurableCriteria: string;
}

/** Whether the clinical write-through path is live (vs. the dev in-memory store). */
export { isFamilySvcEnabled };

async function post<T>(path: string, body: unknown): Promise<T> {
  const bearer = await getFamilyBearer();
  if (!bearer) {
    throw new FamilySvcError(
      "family-svc bearer unavailable (logged out / mock auth) — clinical " +
        "write-through requires an authenticated session",
      null,
      path,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${serverEnv.FAMILY_SVC_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: bearer,
        ...(serverEnv.FAMILY_SVC_SERVICE_TOKEN
          ? { "x-service-token": serverEnv.FAMILY_SVC_SERVICE_TOKEN }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    throw new FamilySvcError(
      `family-svc unreachable: ${e instanceof Error ? e.message : "network error"}`,
      null,
      path,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    throw new FamilySvcError(
      `family-svc ${res.status} for ${path}${detail ? `: ${detail}` : ""}`,
      res.status,
      path,
    );
  }
  return (await res.json()) as T;
}

export const familySvcClient = {
  createTherapySession<T = { id: string }>(input: TherapySessionInput): Promise<T> {
    return post<T>("/api/family/therapy-sessions", input);
  },
  createObservation<T = { id: string }>(input: ObservationInput): Promise<T> {
    return post<T>("/api/family/observations", input);
  },
  createIepGoal<T = { id: string }>(input: IepGoalInput): Promise<T> {
    return post<T>("/api/family/iep-goals", input);
  },
};
