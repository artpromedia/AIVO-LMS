#!/usr/bin/env node
/**
 * Drives .maestro/store-screens.yaml across the store resolution matrix
 * and files the captures into store-assets/screenshots/<platform>/<size>/
 * exactly as store-assets/screenshots/README.md requires (Sprint A5).
 *
 * Host requirements (NOT met in CI containers — run on a workstation):
 *   - maestro CLI on PATH
 *   - iOS: macOS with the named simulators created (xcrun simctl list)
 *   - Android: a running emulator/device (adb devices)
 *   - A staging build of the app installed (eas build --profile staging)
 *   - MAESTRO_DEMO_EMAIL / MAESTRO_DEMO_PASSWORD for the 5-role demo user
 *
 * Usage:
 *   node scripts/capture-store-screenshots.mjs ios:6.7
 *   node scripts/capture-store-screenshots.mjs android:phone
 *   node scripts/capture-store-screenshots.mjs all
 */
import { execSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(mobileRoot, "store-assets", "screenshots");

/** Store matrix → simulator/emulator targets (README-required sets). */
const TARGETS = {
  "ios:6.7": { platform: "ios", device: "iPhone 16 Pro Max", out: "ios/6.7" },
  "ios:6.5": { platform: "ios", device: "iPhone 15 Plus", out: "ios/6.5" },
  "ios:5.5": { platform: "ios", device: "iPhone 8 Plus", out: "ios/5.5" },
  "android:phone": { platform: "android", device: null, out: "android/phone" },
  "android:tablet": { platform: "android", device: null, out: "android/tablet" },
};

const requested = process.argv[2];
if (!requested || (!TARGETS[requested] && requested !== "all")) {
  console.error(`usage: capture-store-screenshots.mjs <${Object.keys(TARGETS).join("|")}|all>`);
  process.exit(2);
}
for (const key of ["MAESTRO_DEMO_EMAIL", "MAESTRO_DEMO_PASSWORD"]) {
  if (!process.env[key]) {
    console.error(`${key} must be set (5-role staging demo account).`);
    process.exit(2);
  }
}
try {
  execSync("maestro --version", { stdio: "pipe" });
} catch {
  console.error("maestro CLI not found on PATH — install https://maestro.mobile.dev");
  process.exit(2);
}

const keys = requested === "all" ? Object.keys(TARGETS) : [requested];
for (const key of keys) {
  const target = TARGETS[key];
  const captureDir = mkdtempSync(join(tmpdir(), "aivo-shots-"));
  console.log(`\n── ${key} → ${target.out} ──`);
  const args = [
    "test",
    join(mobileRoot, ".maestro", "store-screens.yaml"),
    `--debug-output=${captureDir}`,
  ];
  if (target.platform === "ios" && target.device) {
    args.push(`--device=${target.device}`);
  }
  const env = {
    ...process.env,
    MAESTRO_APP_ID: process.env.MAESTRO_APP_ID ?? "com.artpromedia.aivo",
  };
  const run = spawnSync("maestro", args, { stdio: "inherit", env, cwd: mobileRoot });
  if (run.status !== 0) {
    console.error(`maestro run failed for ${key}; captures NOT updated.`);
    process.exit(run.status ?? 1);
  }
  const outDir = join(outRoot, target.out);
  mkdirSync(outDir, { recursive: true });
  let copied = 0;
  for (const file of readdirSync(captureDir)) {
    if (/^0[1-7]-.*\.png$/.test(file)) {
      cpSync(join(captureDir, file), join(outDir, file));
      copied += 1;
    }
  }
  if (copied !== 7) {
    console.error(`expected 7 captures for ${key}, found ${copied} — check the flow output.`);
    process.exit(1);
  }
  console.log(`filed 7 screenshots into ${outDir}`);
}
console.log("\nAll requested sets captured. Review, then commit store-assets/screenshots.");
if (!existsSync(join(outRoot, "ios/6.7"))) process.exitCode = 0;
