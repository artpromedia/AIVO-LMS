#!/usr/bin/env node
/**
 * EAS Build pre-install hook.
 *
 * Strips the `prepare` (tsc) script from every workspace package other than
 * the ones that the mobile app actually depends on. Those compile steps would
 * otherwise fail on EAS because their dev dependencies / cross-package types
 * are not part of the mobile build closure.
 *
 * The mobile app only needs: @aivo/aac-bridge, @aivo/brand, @aivo/mobile-ui.
 */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const packagesDir = path.join(repoRoot, "packages");
const keep = new Set(["aac-bridge", "brand", "mobile-ui"]);

if (!fs.existsSync(packagesDir)) {
  console.log("[eas-pre-install] no packages directory found, skipping");
  process.exit(0);
}

for (const name of fs.readdirSync(packagesDir)) {
  if (keep.has(name)) continue;
  const pkgPath = path.join(packagesDir, name, "package.json");
  if (!fs.existsSync(pkgPath)) continue;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.scripts && pkg.scripts.prepare) {
      delete pkg.scripts.prepare;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      console.log(`[eas-pre-install] stripped prepare script from packages/${name}`);
    }
  } catch (err) {
    console.warn(`[eas-pre-install] failed to patch packages/${name}:`, err.message);
  }
}

console.log("[eas-pre-install] done");
