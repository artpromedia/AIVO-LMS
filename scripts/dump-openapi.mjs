#!/usr/bin/env node
/**
 * Dump OpenAPI specs from each registered Fastify service.
 *
 * For each entry in `SERVICES`:
 *   1. Spawn a child `tsx` process so the service's TypeScript source
 *      can be loaded without a separate build step.
 *   2. The child imports the service's `buildApp()`, calls it, awaits
 *      `app.ready()`, and prints `app.swagger()` to stdout as JSON.
 *   3. We capture stdout and write it to
 *      `packages/api-client/openapi/<svc>.json`.
 *
 * Stub env vars are set so plugins that demand secrets at boot
 * (`@aivo/security`, MFA crypto, JWT keys, postgres URL) succeed
 * without actually opening a DB connection. The `postgres` driver used
 * by `@aivo/db` is lazy — it does not connect until first query — so a
 * placeholder `DATABASE_URL` is safe.
 *
 * To onboard a service in 5.1+: refactor it to export `buildApp()`,
 * register `@fastify/swagger`, then add an entry below. See
 * `packages/api-client/README.md`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "packages/api-client/openapi");

/**
 * Registry of services that expose an in-process `buildApp()` and have
 * `@fastify/swagger` registered. The `out` filename is the value
 * consumers will reference via `@aivo/api-client/<out-stem>`.
 */
const SERVICES = [
  {
    name: "identity-svc",
    out: "identity-svc.json",
    entry: "services/identity-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "learning-svc",
    out: "learning-svc.json",
    entry: "services/learning-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "tutor-svc",
    out: "tutor-svc.json",
    entry: "services/tutor-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "assessment-svc",
    out: "assessment-svc.json",
    entry: "services/assessment-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "billing-svc",
    out: "billing-svc.json",
    entry: "services/billing-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "comms-svc",
    out: "comms-svc.json",
    entry: "services/comms-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "engagement-svc",
    out: "engagement-svc.json",
    entry: "services/engagement-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "family-svc",
    out: "family-svc.json",
    entry: "services/family-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "admin-svc",
    out: "admin-svc.json",
    entry: "services/admin-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "i18n-svc",
    out: "i18n-svc.json",
    entry: "services/i18n-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "research-svc",
    out: "research-svc.json",
    entry: "services/research-svc/src/index.ts",
    exportName: "buildApp",
  },
  {
    name: "status-page-svc",
    out: "status-page-svc.json",
    entry: "services/status-page-svc/src/index.ts",
    exportName: "buildApp",
  },
  // Excluded — not currently HTTP services (no `routes/` dir or
  // dedicated buildApp). These are event consumers / stubs and should
  // be onboarded only if they grow a real HTTP surface:
  //   ai-svc, alerts-proxy-svc, brain-svc, curriculum-svc
];

/** Stub env so `buildApp()` can complete without real infra. */
const STUB_ENV = {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.DATABASE_URL || "postgres://stub:stub@127.0.0.1:5432/stub?sslmode=disable",
  // 32-byte hex key satisfies @aivo/security/mfa-crypto assertions.
  MFA_AT_REST_KEY:
    process.env.MFA_AT_REST_KEY ||
    "0000000000000000000000000000000000000000000000000000000000000000",
  // Force ephemeral JWT key generation rather than reading from disk.
  JWT_PRIVATE_KEY: "",
  JWT_PUBLIC_KEY: "",
  // Don't try to bind to anything.
  PORT: "0",
};

/**
 * Tiny TS shim that imports the service module, calls buildApp, dumps
 * swagger to stdout, then exits. Written to a temp file and run via
 * `tsx` so we get TS source loading + ESM resolution.
 */
function buildShim(absoluteEntry, exportName, outFileAbs) {
  // ESM imports of absolute paths must be `file://` URLs on Windows;
  // otherwise tsx/node rejects the bare `c:\...` specifier with
  // ERR_UNSUPPORTED_ESM_URL_SCHEME.
  const entryUrl = pathToFileURL(absoluteEntry).href;
  return `
import { writeFileSync } from "node:fs";
import { ${exportName} } from ${JSON.stringify(entryUrl)};
(async () => {
  const app = await ${exportName}();
  await app.ready();
  const spec = app.swagger();
  writeFileSync(${JSON.stringify(outFileAbs)}, JSON.stringify(spec, null, 2) + "\\n");
  await app.close();
  process.exit(0);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
`;
}

function dumpOne(svc) {
  return new Promise((resolveP, reject) => {
    const absEntry = resolve(ROOT, svc.entry);
    const outPath = resolve(OUT_DIR, svc.out);
    mkdirSync(dirname(outPath), { recursive: true });
    const shim = buildShim(absEntry, svc.exportName, outPath);

    // Write the shim to a temp .mjs file so we don't have to pass a
    // multi-line script through `-e` (cross-shell escaping nightmare on
    // Windows). Cleaned up after the child exits.
    const shimPath = resolve(
      tmpdir(),
      `aivo-openapi-${svc.name}-${process.pid}-${Date.now()}.mjs`,
    );
    writeFileSync(shimPath, shim);

    // Invoke tsx directly (not via `pnpm exec`) so pnpm's "Unsupported
    // engine" warning doesn't end up in our log stream. On Windows the
    // `.bin/tsx` shim is a shell script with no .exe sibling; Node's
    // `spawn` cannot exec it. Pick the platform-specific entrypoint
    // (`tsx.cmd` on Windows, `tsx` elsewhere) and enable `shell` on
    // Windows so cmd.exe can launch the .cmd wrapper.
    const isWin = process.platform === "win32";
    const tsxBin = resolve(ROOT, isWin ? "node_modules/.bin/tsx.cmd" : "node_modules/.bin/tsx");
    const child = spawn(tsxBin, [shimPath], {
      cwd: ROOT,
      env: { ...process.env, ...STUB_ENV },
      stdio: ["ignore", "inherit", "inherit"],
      shell: isWin,
    });

    const cleanup = () => {
      try {
        rmSync(shimPath, { force: true });
      } catch {
        /* ignore */
      }
    };

    child.on("error", (err) => {
      cleanup();
      reject(err);
    });
    child.on("close", (code) => {
      cleanup();
      if (code !== 0) {
        reject(new Error(`[${svc.name}] dump failed (exit ${code})`));
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`[${svc.name}] wrote ${outPath}`);
      resolveP();
    });
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const svc of SERVICES) {
    // Sequential by design — services share heavy native deps (sharp,
    // argon2) and parallel tsx loads have caused OOM in CI.
    await dumpOne(svc);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exit(1);
});
