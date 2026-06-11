/**
 * Tenant-scoped feature-flag resolution (Sprint B2).
 *
 * Layers, highest wins:
 *   1. KILL switch — `AIVO_KILL_<FLAG_ENV_NAME>` truthy forces the flag
 *      OFF everywhere, instantly, regardless of tenant overrides. The
 *      ops "stop the bleeding" control.
 *   2. Tenant override — per-district boolean stored in
 *      `district_settings.feature_overrides` (the same store identity-svc
 *      already consults for `forceMfa`), loaded through the injected
 *      `loadOverrides` so this package stays storage-agnostic.
 *   3. Environment default — `resolveEnterpriseFlags()` (unchanged
 *      contract, all flags default OFF).
 *
 * Resolution is cached per tenant for `cacheTtlMs` (default 30s) so a BFF
 * request doesn't pay a settings read; `invalidate(tenantId?)` drops the
 * cache after an admin toggle.
 */
import {
  ENTERPRISE_FLAG_ENV_VARS,
  resolveEnterpriseFlags,
  readBooleanFromSource,
  type EnterpriseFeatureFlags,
  type EnterpriseFlagKey,
} from "./enterprise-flags.js";

export type TenantOverrides = Partial<Record<EnterpriseFlagKey, boolean>>;

export interface TenantFlagResolverOptions {
  /** Async per-tenant override loader (storage-agnostic). */
  loadOverrides: (tenantId: string) => Promise<TenantOverrides | null | undefined>;
  /** Env source (tests inject; defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** Override cache TTL; default 30 000 ms. */
  cacheTtlMs?: number;
  /** Clock injection for tests. */
  now?: () => number;
}

export interface TenantFlagResolver {
  resolveForTenant(tenantId: string | null | undefined): Promise<EnterpriseFeatureFlags>;
  invalidate(tenantId?: string): void;
}

export function killSwitchEnvVar(key: EnterpriseFlagKey): string {
  return `AIVO_KILL_${ENTERPRISE_FLAG_ENV_VARS[key].replace(/^AIVO_FEATURE_/, "")}`;
}

export function isValidFlagKey(key: string): key is EnterpriseFlagKey {
  return Object.prototype.hasOwnProperty.call(ENTERPRISE_FLAG_ENV_VARS, key);
}

export function createTenantFlagResolver(options: TenantFlagResolverOptions): TenantFlagResolver {
  const env =
    options.env ??
    ((typeof process !== "undefined" && process?.env
      ? process.env
      : {}) as Record<string, string | undefined>);
  const ttl = options.cacheTtlMs ?? 30_000;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { flags: EnterpriseFeatureFlags; at: number }>();

  function applyLayers(overrides: TenantOverrides | null | undefined): EnterpriseFeatureFlags {
    const defaults = resolveEnterpriseFlags(env);
    const out: EnterpriseFeatureFlags = { ...defaults };
    for (const key of Object.keys(ENTERPRISE_FLAG_ENV_VARS) as EnterpriseFlagKey[]) {
      const override = overrides?.[key];
      if (typeof override === "boolean") out[key] = override;
      // Kill switch wins over everything — including an ON override.
      if (readBooleanFromSource(env, killSwitchEnvVar(key), false)) out[key] = false;
    }
    return out;
  }

  return {
    async resolveForTenant(tenantId) {
      if (!tenantId) return applyLayers(null);
      const hit = cache.get(tenantId);
      if (hit && now() - hit.at < ttl) return hit.flags;
      let overrides: TenantOverrides | null | undefined = null;
      try {
        overrides = await options.loadOverrides(tenantId);
      } catch {
        // Loader failure degrades to env defaults — never to a crash.
        overrides = null;
      }
      const flags = applyLayers(overrides);
      cache.set(tenantId, { flags, at: now() });
      return flags;
    },
    invalidate(tenantId) {
      if (tenantId) cache.delete(tenantId);
      else cache.clear();
    },
  };
}
