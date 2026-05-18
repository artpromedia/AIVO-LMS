import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SCAN = join(REPO_ROOT, "scripts", "no-demo-prod-scan.mjs");

function runScanIn(cwd: string) {
  const localScan = join(cwd, "scripts", "no-demo-prod-scan.mjs");
  const res = spawnSync(process.execPath, [localScan], {
    cwd,
    env: { ...process.env },
    encoding: "utf8",
  });
  return { status: res.status ?? -1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

describe("scripts/no-demo-prod-scan.mjs", () => {
  let work: string;
  let mobileStage: string;
  let testFixture: string;

  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), "aivo-no-demo-"));
    mkdirSync(join(work, "scripts"), { recursive: true });
    mkdirSync(join(work, "apps/mobile/app/(learner)/stage"), { recursive: true });
    mkdirSync(join(work, "apps/mobile/__tests__"), { recursive: true });

    // Copy the actual scanner into the fake repo so it scans the fake roots.
    const scannerSrc = require("node:fs").readFileSync(SCAN, "utf8");
    writeFileSync(join(work, "scripts", "no-demo-prod-scan.mjs"), scannerSrc);

    mobileStage = join(work, "apps/mobile/app/(learner)/stage/[sessionId].tsx");
    testFixture = join(work, "apps/mobile/__tests__/sample.test.tsx");
  });

  afterAll(() => {
    if (work && existsSync(work)) rmSync(work, { recursive: true, force: true });
  });

  it("fails when mobile stage has active hardcoded QUESTIONS", () => {
    writeFileSync(
      mobileStage,
      `import React from "react";
const QUESTIONS = [{ id: "1", prompt: "What is 2+2?" }];
export default function Stage() { return null; }
`,
    );
    // ensure no test file contains a false positive
    writeFileSync(testFixture, "// test only\n");
    const res = runScanIn(work);
    expect(res.status).not.toBe(0);
    expect(res.stdout).toMatch(/hardcoded-stage-questions/);
  });

  it("passes when demo data is behind __DEV__ guard", () => {
    writeFileSync(
      mobileStage,
      `import React from "react";
// @allow-demo
const QUESTIONS = __DEV__ ? [{ id: "1", prompt: "x" }] : [];
export default function Stage() { return null; }
`,
    );
    const res = runScanIn(work);
    expect(res.status).toBe(0);
  });

  it("ignores files inside tests/ and __tests__/", () => {
    // Restore a clean stage file.
    writeFileSync(
      mobileStage,
      `import { useSession } from "../../../src/api/sessionClient";
export default function Stage() { useSession("x"); return null; }
`,
    );
    // Test file with the forbidden pattern must NOT trigger a failure.
    writeFileSync(testFixture, `const QUESTIONS = [{ id: "1", prompt: "demo" }];\nexport {};\n`);
    const res = runScanIn(work);
    expect(res.status).toBe(0);
  });
});
