/**
 * Sprint 12.7 — shared composable health helper.
 *
 * Services pass in the checks that matter for them; if any check fails,
 * the composed `Health` returns status 503 with a JSON breakdown so
 * load balancers can drain the bad replica without taking the whole
 * fleet down.
 *
 * Each check returns `{ ok, latencyMs, error? }`. We never throw — a
 * thrown DB error becomes `{ ok:false, error:"…" }`.
 *
 * Usage:
 *   import { composeHealth } from "@aivo/observability/health-check";
 *
 *   app.get("/health", async (_req, reply) => {
 *     const result = await composeHealth({
 *       db: () => pingDb(db),
 *       downstream: {
 *         postmark: () => pingHttp("https://api.postmarkapp.com/server"),
 *       },
 *     });
 *     reply.code(result.status === "healthy" ? 200 : 503).send(result);
 *   });
 *
 * `pingDb` works with either a drizzle instance (it dynamically loads
 * drizzle-orm's `sql` tag) or any object exposing `execute(sqlString)`.
 */

export interface HealthCheckOutcome {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export type HealthCheckFn = () => Promise<boolean | HealthCheckOutcome>;

export interface ComposeHealthInput {
  service?: string;
  db?: HealthCheckFn;
  redis?: HealthCheckFn;
  downstream?: Record<string, HealthCheckFn>;
}

export interface ComposedHealth {
  status: "healthy" | "degraded";
  service?: string;
  timestamp: string;
  checks: Record<string, HealthCheckOutcome>;
}

async function runOne(fn: HealthCheckFn): Promise<HealthCheckOutcome> {
  const started = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - started;
    if (typeof result === "boolean") return { ok: result, latencyMs };
    return { ...result, latencyMs: result.latencyMs ?? latencyMs };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err?.message ?? String(err),
    };
  }
}

export async function composeHealth(input: ComposeHealthInput): Promise<ComposedHealth> {
  const checks: Record<string, HealthCheckOutcome> = {};
  if (input.db) checks.db = await runOne(input.db);
  if (input.redis) checks.redis = await runOne(input.redis);
  for (const [name, fn] of Object.entries(input.downstream ?? {})) {
    checks[name] = await runOne(fn);
  }
  const ok = Object.values(checks).every((c) => c.ok);
  return {
    status: ok ? "healthy" : "degraded",
    service: input.service,
    timestamp: new Date().toISOString(),
    checks,
  };
}

/** Convenience HTTP probe — uses fetch with a 2s timeout. */
export async function pingHttp(
  url: string,
  options: { method?: string; timeoutMs?: number } = {},
): Promise<HealthCheckOutcome> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 2000;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: options.method ?? "HEAD", signal: ctrl.signal });
    clearTimeout(id);
    return { ok: res.ok || res.status < 500, latencyMs: Date.now() - started };
  } catch (err: any) {
    clearTimeout(id);
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Convenience DB probe — runs `SELECT 1`.
 *
 * Accepts either a drizzle instance (we dynamically import drizzle-orm's
 * `sql` tag so this package stays framework-agnostic) or any object that
 * exposes `execute(rawSqlString)`. The plain-string fallback is used if
 * drizzle-orm is not resolvable from the caller's module graph.
 */
export async function pingDb(db: {
  execute: (q: any) => Promise<any>;
}): Promise<HealthCheckOutcome> {
  const started = Date.now();
  try {
    let query: any = "SELECT 1";
    try {
      // Dynamic import keeps drizzle-orm an optional runtime peer (no
      // build-time dep on this package). Using a variable for the
      // specifier prevents TypeScript from resolving the module.
      const specifier = "drizzle-orm";
      const mod: any = await import(/* @vite-ignore */ specifier);
      if (typeof mod?.sql === "function") {
        query = mod.sql`SELECT 1`;
      }
    } catch {
      // drizzle-orm not available — fall back to raw string
    }
    await db.execute(query);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err?.message ?? String(err),
    };
  }
}
