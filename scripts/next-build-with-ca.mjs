#!/usr/bin/env node
/**
 * Wrapper around `next build` that makes the build robust to environments
 * behind a MITM TLS proxy (sandbox, corporate CI, replit, etc.).
 *
 * Symptom this fixes: `Error: self-signed certificate in certificate chain`
 * during `Generating static pages` — Next.js fetches Google Fonts at build
 * time, and Node's bundled Mozilla CA list doesn't include the proxy's CA,
 * but `/etc/ssl/certs/` (the OS trust store) does.
 *
 * Strategy:
 *   1. If `/etc/ssl/certs/ca-certificates.crt` exists, point Node at it via
 *      `NODE_EXTRA_CA_CERTS` so its TLS validation accepts OS-trusted certs.
 *   2. Add `--use-openssl-ca` to `NODE_OPTIONS` so Node uses the OS trust
 *      store directly (helpful when the proxy CA is in `/etc/ssl/certs/` but
 *      not concatenated into a single bundle).
 *   3. Preserve any existing `NODE_OPTIONS` / `NODE_EXTRA_CA_CERTS` the user
 *      has already set.
 *   4. Spawn `next build` with the merged env. Exit code is forwarded so CI
 *      sees the real result.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const env = { ...process.env };

const OS_BUNDLE = "/etc/ssl/certs/ca-certificates.crt";
if (!env.NODE_EXTRA_CA_CERTS && existsSync(OS_BUNDLE)) {
  env.NODE_EXTRA_CA_CERTS = OS_BUNDLE;
}

const opts = (env.NODE_OPTIONS ?? "").split(/\s+/).filter(Boolean);
if (!opts.includes("--use-openssl-ca")) opts.push("--use-openssl-ca");
env.NODE_OPTIONS = opts.join(" ");

const args = process.argv.slice(2);
// `shell: true` lets Windows resolve the `next.cmd` shim from node_modules/.bin
// without us hard-coding an extension; it's a no-op on POSIX.
const child = spawn("next", ["build", ...args], { env, stdio: "inherit", shell: true });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
