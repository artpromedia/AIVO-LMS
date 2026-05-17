import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const CHECK = resolve(REPO_ROOT, "scripts", "production-readiness-check.mjs");

function runCheck(env: Record<string, string | undefined> = {}) {
  const res = spawnSync(process.execPath, [CHECK], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { status: res.status ?? -1, stdout: res.stdout ?? "" };
}

describe("scripts/production-readiness-check.mjs", () => {
  it("exits 0 in non-production mode even when sub-scanners report blockers", () => {
    // Sub-scanners may legitimately flag missing surface contracts during the
    // sprint sequence. The aggregator must still allow developers to iterate.
    const res = runCheck({ NODE_ENV: "development" });
    expect(res.status).toBe(0);
  });

  it("aggregator script is invokable", () => {
    const res = spawnSync(process.execPath, ["--check", CHECK], { encoding: "utf8" });
    expect(res.status).toBe(0);
  });
});
