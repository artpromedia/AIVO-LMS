import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SCAN = join(REPO_ROOT, "scripts", "surface-contract-scan.mjs");

function runScanIn(cwd: string) {
  const localScan = join(cwd, "scripts", "surface-contract-scan.mjs");
  const res = spawnSync(process.execPath, [localScan], { cwd, encoding: "utf8" });
  return { status: res.status ?? -1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

describe("scripts/surface-contract-scan.mjs", () => {
  let work: string;

  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), "aivo-surface-"));
    mkdirSync(join(work, "scripts"), { recursive: true });
    writeFileSync(join(work, "scripts", "surface-contract-scan.mjs"), readFileSync(SCAN, "utf8"));

    mkdirSync(join(work, "services/ai-svc/src/ai_svc/services"), { recursive: true });
    mkdirSync(join(work, "apps/web/src/components/stage"), { recursive: true });
    mkdirSync(join(work, "apps/mobile/app/(learner)/stage"), { recursive: true });
  });

  afterAll(() => {
    if (work && existsSync(work)) rmSync(work, { recursive: true, force: true });
  });

  function writeFixture(opts: {
    baselineWithSurfaces: boolean;
    promptHasProtocol: boolean;
    zoneUsesHost: boolean;
    mobileUsesLoader: boolean;
  }) {
    writeFileSync(
      join(work, "services/ai-svc/src/ai_svc/services/baseline_generator.py"),
      opts.baselineWithSurfaces
        ? `from .baseline_surface_contract import LearnerSurfaceSpec\n` +
            `def build(): return {"surface": {"type": "geometry_workspace"}, "scratchpad": True}\n`
        : `def build(): return {"choices": []}\n`,
    );
    writeFileSync(
      join(work, "services/ai-svc/src/ai_svc/services/prompt_builder.py"),
      opts.promptHasProtocol
        ? `SYSTEM = "## Surface Tool Protocol\\nReturn surfaceCommands."\n`
        : `SYSTEM = "Be helpful."\n`,
    );
    writeFileSync(
      join(work, "apps/web/src/components/stage/SurfaceResponseZone.tsx"),
      opts.zoneUsesHost
        ? `import { SurfaceHost } from "@aivo/learner-surfaces";\nexport function SurfaceResponseZone() { return <SurfaceHost />; }\n`
        : `export function SurfaceResponseZone() { return null; }\n`,
    );
    writeFileSync(
      join(work, "apps/mobile/app/(learner)/stage/[sessionId].tsx"),
      opts.mobileUsesLoader
        ? `import { sessionClient } from "../../../src/api/sessionClient";\nexport default function S() { sessionClient.getSession("x"); return null; }\n`
        : `const QUESTIONS = [{ id: "1", prompt: "x" }];\nexport default function S() { return null; }\n`,
    );
  }

  it("fails if baseline generator lacks surface contract", () => {
    writeFixture({
      baselineWithSurfaces: false,
      promptHasProtocol: true,
      zoneUsesHost: true,
      mobileUsesLoader: true,
    });
    const res = runScanIn(work);
    expect(res.status).not.toBe(0);
    expect(res.stdout).toMatch(/baseline-surface-contract/);
  });

  it("fails if mobile stage has hardcoded QUESTIONS", () => {
    writeFixture({
      baselineWithSurfaces: true,
      promptHasProtocol: true,
      zoneUsesHost: true,
      mobileUsesLoader: false,
    });
    const res = runScanIn(work);
    expect(res.status).not.toBe(0);
    expect(res.stdout).toMatch(/mobile-stage-hardcoded-questions/);
  });

  it("passes when all gates are satisfied", () => {
    writeFixture({
      baselineWithSurfaces: true,
      promptHasProtocol: true,
      zoneUsesHost: true,
      mobileUsesLoader: true,
    });
    const res = runScanIn(work);
    expect(res.status).toBe(0);
  });
});
