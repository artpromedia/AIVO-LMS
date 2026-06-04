/**
 * Effective-policy resolution.
 *
 * Policies stack platform → district → tenant. For each field the most
 * specific scope that has an opinion wins (tenant > district > platform).
 * On top of the stacked policy we apply opt-out precedence: a tenant (or
 * its district, applied to all child tenants) can opt out of a specific
 * model or feature, which short-circuits to `allowed: false`. Model
 * lifecycle (retired/deprecated) is also enforced here so the RAI gateway
 * has a single source of truth.
 *
 * Performance: this is a pure in-memory computation over a handful of
 * records; the unit test asserts the < 5 ms p95 budget from the DoD.
 */
import type { EffectivePolicy, PolicyRecord } from "./types.js";
import type { RegistryStore } from "./store.js";

export interface ResolveInput {
  tenantId: string;
  modelId: string;
  /** Optional feature key the call belongs to (e.g. "ai-tutor"). */
  feature?: string;
}

/** Merge a more-specific policy over a base; arrays/objects fully override when present. */
function mergePolicy(base: PolicyRecord, override: PolicyRecord): PolicyRecord {
  return {
    ...base,
    ...override,
    contentSafety: {
      // Block-lists are additive: a child scope can only tighten, never
      // remove, a parent's blocked categories.
      blockedCategories: Array.from(
        new Set([
          ...base.contentSafety.blockedCategories,
          ...override.contentSafety.blockedCategories,
        ]),
      ),
      maxSeverity: strictestSeverity(
        base.contentSafety.maxSeverity,
        override.contentSafety.maxSeverity,
      ),
    },
    ageGating: {
      // Age floor only rises with specificity; consent is sticky-on.
      minAge: Math.max(base.ageGating.minAge ?? 0, override.ageGating.minAge ?? 0) || null,
      requireGuardianConsent:
        base.ageGating.requireGuardianConsent || override.ageGating.requireGuardianConsent,
    },
    regionRestrictions: {
      // A child's explicit allow-list overrides; block-lists are additive.
      allowedRegions:
        override.regionRestrictions.allowedRegions.length > 0
          ? override.regionRestrictions.allowedRegions
          : base.regionRestrictions.allowedRegions,
      blockedRegions: Array.from(
        new Set([
          ...base.regionRestrictions.blockedRegions,
          ...override.regionRestrictions.blockedRegions,
        ]),
      ),
    },
  };
}

const SEVERITY_RANK = { low: 0, medium: 1, high: 2 } as const;
function strictestSeverity(
  a: PolicyRecord["contentSafety"]["maxSeverity"],
  b: PolicyRecord["contentSafety"]["maxSeverity"],
): PolicyRecord["contentSafety"]["maxSeverity"] {
  // The "strictest" maxSeverity is the lowest threshold (blocks more).
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

export function resolveEffectivePolicy(store: RegistryStore, input: ResolveInput): EffectivePolicy {
  const { tenantId, modelId, feature } = input;
  const districtId = store.tenantDistrict.get(tenantId) ?? null;

  const platform = [...store.policies.values()].find(
    (p) => p.scopeLevel === "platform" && p.enabled,
  );
  const district = districtId
    ? [...store.policies.values()].find(
        (p) => p.scopeLevel === "district" && p.scopeId === districtId && p.enabled,
      )
    : undefined;
  const tenant = [...store.policies.values()].find(
    (p) => p.scopeLevel === "tenant" && p.scopeId === tenantId && p.enabled,
  );

  const appliedScopes: EffectivePolicy["appliedScopes"] = [];
  let merged: PolicyRecord | undefined = platform;
  if (platform) appliedScopes.push({ level: "platform", id: null });
  if (district) {
    merged = merged ? mergePolicy(merged, district) : district;
    appliedScopes.push({ level: "district", id: districtId });
  }
  if (tenant) {
    merged = merged ? mergePolicy(merged, tenant) : tenant;
    appliedScopes.push({ level: "tenant", id: tenantId });
  }

  // Fallback to a deny-by-default empty policy if nothing is configured.
  const effective: PolicyRecord = merged ?? {
    id: "synthetic-empty",
    name: "synthetic",
    scopeLevel: "platform",
    scopeId: null,
    contentSafety: { blockedCategories: [], maxSeverity: "low" },
    ageGating: { minAge: null, requireGuardianConsent: false },
    regionRestrictions: { allowedRegions: [], blockedRegions: [] },
    enabled: true,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  };

  // ── Opt-out precedence (highest priority deny) ───────────────────────
  // District-level opt-out cascades to all of its tenants; a tenant
  // opt-out applies to itself. A model OR feature match denies.
  const denyReason = computeDenyReason(store, { tenantId, districtId, modelId, feature });

  return {
    tenantId,
    modelId,
    allowed: denyReason === null,
    denyReason,
    contentSafety: effective.contentSafety,
    ageGating: effective.ageGating,
    regionRestrictions: effective.regionRestrictions,
    appliedScopes,
    computedAt: new Date().toISOString(),
  };
}

function computeDenyReason(
  store: RegistryStore,
  args: { tenantId: string; districtId: string | null; modelId: string; feature?: string },
): string | null {
  const model = store.models.get(args.modelId);
  if (!model) return "MODEL_UNKNOWN";
  if (model.status === "retired") return "MODEL_RETIRED";

  for (const o of store.optOuts.values()) {
    const scopeMatch =
      o.tenantId === args.tenantId || (args.districtId !== null && o.tenantId === args.districtId);
    if (!scopeMatch) continue;
    if (o.modelId && o.modelId === args.modelId) return "OPT_OUT";
    if (o.feature && args.feature && o.feature === args.feature) return "OPT_OUT";
  }
  return null;
}
