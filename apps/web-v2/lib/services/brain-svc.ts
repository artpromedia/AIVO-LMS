/**
 * Brain-svc client. Per ADR 0009 this is the single entry point web-v2
 * uses to talk to `services/brain-svc`. Each method has two paths:
 *
 *   1. Service path — used when AIVO_USE_BRAIN_SVC=true (or the global
 *      AIVO_USE_SERVICE_STACK=true with no per-service override).
 *      Calls the production service via `callService`.
 *   2. Local path  — falls back to the in-memory implementation in
 *      `lib/db/repos.ts`. Selected by default so the dev / demo
 *      workflow stays self-contained.
 *
 * The two paths return the same shape, so callers don't branch on
 * which one ran. Service-side failures on read paths fall back to the
 * local implementation (lenient mode); failures on write paths
 * propagate (strict mode). See ADR 0009 for the policy.
 */
import { serverEnv } from "@/lib/env";
import { callService } from "./client";
import {
  approveBrainClone as approveBrainCloneLocal,
  cloneBrainFromBaseline as cloneBrainFromBaselineLocal,
  getBrainProfile as getBrainProfileLocal,
} from "@/lib/db/repos";
import type { LearnerBrainProfile } from "@/lib/db/types";
import { logger } from "@/lib/observability/logger";

function brainSvcEnabled(): boolean {
  if (serverEnv.AIVO_USE_BRAIN_SVC !== undefined) return serverEnv.AIVO_USE_BRAIN_SVC;
  return serverEnv.AIVO_USE_SERVICE_STACK;
}

export interface BrainSvcContext {
  requestId?: string;
}

/**
 * Read the current brain profile for a learner. Service path is
 * lenient: a service-side failure logs `service_call.degraded` and
 * falls back to the in-memory repo so dashboards keep loading.
 */
export async function getBrainProfile(
  learnerId: string,
  tenantId: string,
  ctx: BrainSvcContext = {},
): Promise<LearnerBrainProfile | null> {
  if (!brainSvcEnabled()) return await getBrainProfileLocal(learnerId, tenantId);
  const result = await callService<{ profile: LearnerBrainProfile | null }>({
    service: "brain-svc",
    baseUrl: serverEnv.BRAIN_SVC_URL,
    url: `/api/brain/profile/${encodeURIComponent(learnerId)}`,
    headers: { "x-tenant-id": tenantId },
    serviceToken: serverEnv.BRAIN_SVC_SERVICE_TOKEN,
    requestId: ctx.requestId,
    retries: 1,
  });
  if (result.ok) return result.data.profile;
  logger.warn({
    event: "service_call.degraded",
    service: "brain-svc",
    operation: "getBrainProfile",
    reason: result.reason,
  });
  return await getBrainProfileLocal(learnerId, tenantId);
}

/**
 * Clone the brain profile from the latest completed baseline. Write
 * path — strict mode: a service-side failure propagates as a result
 * envelope so the caller can decide how to surface it.
 */
export async function cloneBrainFromBaseline(
  learnerId: string,
  tenantId: string,
  ctx: BrainSvcContext = {},
): Promise<
  | { ok: true; profile: LearnerBrainProfile }
  | { ok: false; reason: "no_baseline" | "service_unavailable"; message?: string }
> {
  if (!brainSvcEnabled()) {
    const profile = await cloneBrainFromBaselineLocal(learnerId, tenantId);
    if (!profile) return { ok: false, reason: "no_baseline" };
    return { ok: true, profile };
  }
  const result = await callService<{ profile: LearnerBrainProfile }>({
    service: "brain-svc",
    baseUrl: serverEnv.BRAIN_SVC_URL,
    url: `/api/brain/clone`,
    body: { learnerId, tenantId },
    headers: { "x-tenant-id": tenantId },
    serviceToken: serverEnv.BRAIN_SVC_SERVICE_TOKEN,
    requestId: ctx.requestId,
    retries: 0,
  });
  if (result.ok) return { ok: true, profile: result.data.profile };
  return { ok: false, reason: "service_unavailable", message: result.message };
}

/**
 * Approve a cloned brain profile (or mark amended). Write path —
 * strict mode.
 */
export async function approveBrainClone(
  learnerId: string,
  tenantId: string,
  options: { amended?: boolean } = {},
  ctx: BrainSvcContext = {},
): Promise<
  | { ok: true; profile: LearnerBrainProfile }
  | { ok: false; reason: "not_found" | "pre_clone" | "service_unavailable"; message?: string }
> {
  if (!brainSvcEnabled()) {
    const profile = await approveBrainCloneLocal(learnerId, tenantId, options);
    if (!profile) return { ok: false, reason: "not_found" };
    return { ok: true, profile };
  }
  const result = await callService<{ profile: LearnerBrainProfile }>({
    service: "brain-svc",
    baseUrl: serverEnv.BRAIN_SVC_URL,
    url: `/api/brain/approve`,
    body: { learnerId, tenantId, amended: options.amended ?? false },
    headers: { "x-tenant-id": tenantId },
    serviceToken: serverEnv.BRAIN_SVC_SERVICE_TOKEN,
    requestId: ctx.requestId,
    retries: 0,
  });
  if (result.ok) return { ok: true, profile: result.data.profile };
  return { ok: false, reason: "service_unavailable", message: result.message };
}
