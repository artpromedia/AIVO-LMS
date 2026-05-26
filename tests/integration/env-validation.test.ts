/**
 * Sprint 12.7 — production env-validation regression tests.
 *
 * Synthesizes a NODE_ENV=production env that contains each known-bad
 * pattern in turn (placeholder strings, blanks, dev defaults) and
 * asserts the production-readiness check flags it. We invoke the
 * script as a subprocess so the test exercises the same entrypoint
 * production-gates.yml does.
 */
import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SCRIPT = resolve(REPO_ROOT, "scripts", "production-readiness-check.mjs");

function run(extraEnv: Record<string, string | undefined>) {
  // Run the script in a clean env with only the keys we want to test.
  // Inherit PATH so node/pnpm resolve, but scrub anything that would
  // otherwise leak the developer's real config in.
  const env: Record<string, string> = {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    NODE_ENV: "production",
  };
  for (const [k, v] of Object.entries(extraEnv)) {
    if (v !== undefined) env[k] = v;
  }
  const r = spawnSync(process.execPath, [SCRIPT, "--strict"], {
    env,
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  return { code: r.status ?? -1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

test("placeholder AUTH_SECRET is rejected in production", () => {
  const r = run({ AUTH_SECRET: "change-me-to-a-random-32-char-secret" });
  assert.notStrictEqual(r.code, 0);
  const out = r.stdout + r.stderr;
  // Either matches placeholder pattern OR fails the min-length / required check.
  assert.ok(/placeholder|AUTH_SECRET/i.test(out), `expected AUTH_SECRET failure, got:\n${out}`);
});

test("dev-session-secret leakage is flagged", () => {
  const r = run({ SESSION_SECRET: "dev-session-secret-please-change-me" });
  assert.notStrictEqual(r.code, 0);
});

test("missing INTERNAL_SERVICE_TOKEN is flagged", () => {
  const r = run({
    AUTH_SECRET: "x".repeat(64),
    COOKIE_SECRET: "x".repeat(64),
  });
  assert.notStrictEqual(r.code, 0);
  assert.ok(/INTERNAL_SERVICE_TOKEN/i.test(r.stdout + r.stderr));
});

test("short AUTH_SECRET (<32) is flagged", () => {
  const r = run({ AUTH_SECRET: "shorty" });
  assert.notStrictEqual(r.code, 0);
});
