#!/usr/bin/env tsx
/**
 * Deploy smoke test for alerts-proxy-svc (#174).
 *
 * Runs against a freshly-rolled pod. Hits /api/alerts/health and fails the
 * rollout (exit 1) if Slack, PagerDuty, or Opsgenie are missing from the
 * `channels` array.
 *
 * Usage:
 *   tsx scripts/smoke-test.ts --target https://alerts-proxy.internal
 *
 * Env:
 *   SMOKE_TARGET_URL  (alternative to --target)
 *   SMOKE_TIMEOUT_MS  per-attempt fetch timeout (default 5000)
 *   SMOKE_RETRIES     number of attempts (default 5, 1s spacing)
 *   SMOKE_REQUIRED    comma-separated overrides for required channels
 */
const REQUIRED_DEFAULT = ["slack", "pagerduty", "opsgenie"];

interface HealthResponse {
  status: string;
  channels?: string[];
  missingRequired?: string[];
  productionReady?: boolean;
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const target = (arg("target") ?? process.env.SMOKE_TARGET_URL ?? "").replace(/\/$/, "");
  if (!target) {
    console.error("smoke-test: --target or SMOKE_TARGET_URL is required");
    process.exit(2);
  }
  const timeoutMs = parseInt(process.env.SMOKE_TIMEOUT_MS || "5000", 10);
  const retries = parseInt(process.env.SMOKE_RETRIES || "5", 10);
  const required = (process.env.SMOKE_REQUIRED || REQUIRED_DEFAULT.join(","))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const url = `${target}/api/alerts/health`;
  let body: HealthResponse | null = null;
  let lastErr: string | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
      } else {
        body = (await res.json()) as HealthResponse;
        break;
      }
    } catch (err: any) {
      lastErr = err?.message ?? String(err);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 1000));
  }

  if (!body) {
    console.error(`smoke-test: ${url} did not return a valid health response: ${lastErr}`);
    process.exit(1);
  }

  const channels = (body.channels || []).map((c) => c.toLowerCase());
  const missing = required.filter((r) => !channels.includes(r));

  if (missing.length > 0) {
    console.error(
      `smoke-test FAIL: alerts-proxy is missing required channels: ${missing.join(", ")}. Got: [${channels.join(", ")}]`,
    );
    process.exit(1);
  }
  console.log(`smoke-test OK: alerts-proxy has all required channels: [${channels.join(", ")}]`);
}

main().catch((err) => {
  console.error("smoke-test crashed:", err);
  process.exit(1);
});
