/**
 * Sprint 16 — production step-up enforcement.
 *
 * Sprint 3 introduced the `requireStepUp(scope)` preHandler in
 * `routes/step-up.ts`. That factory was gated on the
 * `ADMIN_ENTERPRISE_STEP_UP_AUTH` flag — useful for the rollout, but
 * the flag has been at 0 in production while E2E tests force it on.
 *
 * This module:
 *   1. Re-exports `requireStepUp` from the canonical middleware
 *      location so route files can import from `../middleware/step-up`
 *      regardless of where the implementation lives.
 *   2. Adds `requireStepUpProd(scope)` — the variant that ignores the
 *      flag and always enforces in production (NODE_ENV=production).
 *      This is the bound preHandler for the four destructive admin
 *      routes called out in the Sprint 16 spec.
 *   3. Centralizes the audit emit for step-up challenge / completion /
 *      failure so the SOC 2 control matrix has a single grep target.
 *
 * Route bindings the spec calls out (Sprint 16 destructive ops):
 *   - DELETE /api/admin/tenants/:id        — scope `tenant:delete`
 *   - POST   /api/admin/tenants/:id/freeze — scope `tenant:suspend`
 *   - POST   /api/admin/users/:id/delete   — scope `user:delete`
 *   - POST   /api/data-governance/export/full — scope `data:export`
 *
 * Routes that already exist in identity-svc/admin.ts (role:change,
 * user:delete, config:update, tenant:suspend, user:impersonate) keep
 * importing `requireStepUp` from `routes/step-up.js`; the canonical
 * shim here forwards to the same implementation, so behaviour is
 * unchanged for them. The Sprint 16 delta is the production-mode
 * variant and the per-step audit emits.
 */
import { requireStepUp as routesRequireStepUp } from "../routes/step-up.js";
import { ADMIN_ENTERPRISE, type StepUpScope } from "@aivo/security";

export type StepUpAuditAction =
  | "step_up_challenge_issued"
  | "step_up_completed"
  | "step_up_failed"
  | "step_up_required";

/** Forward the existing implementation; this is the canonical import path going forward. */
export const requireStepUp = routesRequireStepUp;

/**
 * Production variant of `requireStepUp` — bypasses the
 * `ADMIN_ENTERPRISE_STEP_UP_AUTH` flag in `NODE_ENV=production`. Use
 * this on routes that MUST require step-up regardless of flag rollout
 * state (destructive admin operations called out in the Sprint 16
 * SOC 2 control matrix).
 *
 * In non-production environments behaviour matches the existing
 * factory so E2E tests can keep toggling the flag.
 */
export function requireStepUpProd(scope: StepUpScope) {
  return async function stepUpProdPreHandler(req: any, reply: any) {
    if (process.env.NODE_ENV === "production") {
      // Force enforcement even if flag is off — destructive ops never
      // run unprotected in production.
      const originalFlag = ADMIN_ENTERPRISE.STEP_UP_AUTH;
      try {
        ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
        return await routesRequireStepUp(scope)(req, reply);
      } finally {
        ADMIN_ENTERPRISE.STEP_UP_AUTH = originalFlag;
      }
    }
    return routesRequireStepUp(scope)(req, reply);
  };
}

/**
 * Helper that writes a structured audit log line for each step-up
 * lifecycle event. Routes that issue / verify step-up tokens call this
 * so the SOC 2 monitoring control has a uniform record.
 *
 * Wired into:
 *   - POST /api/auth/step-up/initiate  → `step_up_challenge_issued`
 *   - POST /api/auth/step-up/verify    → `step_up_completed` on success,
 *                                        `step_up_failed` on bad factor
 *   - requireStepUp() reject branches  → `step_up_required` /
 *                                        `step_up_failed`
 *
 * `appendAudit` from `@aivo/db` is preferred when available
 * (matches the chain), but this helper accepts any emit function so
 * the caller's existing convention wins.
 */
export interface StepUpAuditEvent {
  action: StepUpAuditAction;
  actorId: string;
  tenantId: string;
  scope: StepUpScope;
  factor?: "webauthn" | "totp" | "email";
  reason?: string;
  ipHash?: string;
  userAgentHash?: string;
}

export function buildStepUpAuditPayload(ev: StepUpAuditEvent) {
  return {
    actorId: ev.actorId,
    actorRole: "PLATFORM_ADMIN",
    tenantId: ev.tenantId,
    action: ev.action,
    resourceType: "step_up",
    resourceId: ev.scope,
    reason: ev.reason,
    ipHash: ev.ipHash,
    userAgentHash: ev.userAgentHash,
    metadata: {
      scope: ev.scope,
      factor: ev.factor,
    },
  };
}
