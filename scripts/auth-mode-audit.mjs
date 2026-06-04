#!/usr/bin/env node
// auth:audit — verifies that mock auth surfaces are guarded against
// production exposure. Sprint 03 ownership.
//
// What this script enforces:
//
// 1. apps/web-v2/lib/env.ts schema refuses AUTH_MODE=mock when
//    NODE_ENV=production.
// 2. apps/web-v2/lib/auth/mock-session.ts gates session reads on
//    serverEnv.AUTH_MODE === "mock".
// 3. Every BFF route under apps/web-v2/app/api/bff/auth/mock-*/route.ts
//    calls isMockAuthAllowed() before doing any work.
//
// This is a structural scan, not a behavioral test. It exists to fail CI
// the moment someone removes a guard without explicitly updating this
// script.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

function read(rel) {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    errors.push(`missing required file: ${rel}`);
    return null;
  }
  return readFileSync(full, "utf8");
}

const envSrc = read("apps/web-v2/lib/env.ts");
if (envSrc) {
  if (!/authModeSchema\s*=\s*isProd/.test(envSrc)) {
    errors.push(
      "apps/web-v2/lib/env.ts: AUTH_MODE schema must branch on isProd and refuse 'mock' in production.",
    );
  }
  if (!/AUTH_MODE must be one of/.test(envSrc)) {
    errors.push(
      "apps/web-v2/lib/env.ts: AUTH_MODE schema must surface a human-readable refusal message.",
    );
  }
}

const sessionSrc = read("apps/web-v2/lib/auth/mock-session.ts");
if (sessionSrc) {
  if (!/serverEnv\.AUTH_MODE\s*===\s*"mock"/.test(sessionSrc)) {
    errors.push(
      "apps/web-v2/lib/auth/mock-session.ts: must gate on serverEnv.AUTH_MODE === 'mock'.",
    );
  }
  if (!/export function isMockAuthAllowed/.test(sessionSrc)) {
    errors.push(
      "apps/web-v2/lib/auth/mock-session.ts: must export isMockAuthAllowed() for route guards.",
    );
  }
  for (const fn of ["readMockSessionFromCookies", "getMockSession"]) {
    const body = sessionSrc.match(new RegExp(`function ${fn}[^{]*\\{([\\s\\S]*?)\\n\\}`));
    if (!body || !/mockAuthAllowed\(\)/.test(body[1])) {
      errors.push(
        `apps/web-v2/lib/auth/mock-session.ts: ${fn} must call mockAuthAllowed() before reading cookies.`,
      );
    }
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const bffAuthRoot = join(repoRoot, "apps/web-v2/app/api/bff/auth");
const routeFiles = walk(bffAuthRoot).filter((p) => /mock-[^/\\]+[/\\]route\.ts$/.test(p));
if (routeFiles.length === 0) {
  errors.push(
    "apps/web-v2/app/api/bff/auth/mock-*/route.ts: no mock auth routes found (expected at least mock-login).",
  );
}
for (const file of routeFiles) {
  const src = readFileSync(file, "utf8");
  if (!/isMockAuthAllowed\(\)/.test(src)) {
    errors.push(
      `${file.replace(repoRoot + "/", "")}: must call isMockAuthAllowed() before mutating session state.`,
    );
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nauth:audit FAILED with ${errors.length} guard violation(s).`);
  process.exit(1);
}

console.log(
  `auth:audit OK — env guard, session guard, and ${routeFiles.length} mock auth route(s) verified.`,
);
