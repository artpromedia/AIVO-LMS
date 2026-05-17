#!/usr/bin/env node
// marketing:audit — Sprint 10 gate.
//
// Verifies the marketing site is production-ready:
//
// 1. Every public route the contract promises has a page.tsx.
// 2. Every locale in src/i18n/config.ts::locales has a JSON file.
// 3. Layout metadata, openGraph, twitter, alternates exist.
// 4. sitemap.ts and robots.ts exist.
// 5. The lead-form API routes (contact, newsletter) exist.
// 6. No page ships placeholder copy ("Coming soon", "TBD",
//    "Lorem ipsum", "[REPLACE]").

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

// --- 1. Required routes -------------------------------------------------

const REQUIRED_ROUTES = [
  "", // root /
  "about",
  "accessibility",
  "blog",
  "compare",
  "contact",
  "cookie-policy",
  "coppa-compliance",
  "demo",
  "features",
  "ferpa-compliance",
  "for-districts",
  "for-homeschool",
  "for-parents",
  "for-schools",
  "for-special-education",
  "for-teachers",
  "guides",
  "levels",
  "pricing",
  "privacy-policy",
  "resources",
  "security",
  "subjects",
  "subprocessors",
  "terms-of-service",
  "thank-you",
  "trust",
  "tutors",
  "waitlist",
];

for (const route of REQUIRED_ROUTES) {
  const rel = route
    ? `apps/marketing/src/app/${route}/page.tsx`
    : `apps/marketing/src/app/page.tsx`;
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing marketing route: ${rel}`);
  }
}

// --- 2. Locale coverage ------------------------------------------------

const configPath = join(repoRoot, "apps/marketing/src/i18n/config.ts");
const messagesDir = join(repoRoot, "apps/marketing/src/i18n/messages");
if (!existsSync(configPath)) {
  errors.push("apps/marketing/src/i18n/config.ts missing.");
} else {
  const src = readFileSync(configPath, "utf8");
  const m = src.match(/export const locales\s*=\s*\[([\s\S]*?)\]/);
  if (!m) {
    errors.push("i18n/config.ts: locales array not found.");
  } else {
    const locales = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (locales.length === 0) errors.push("i18n/config.ts: locales is empty.");
    for (const locale of locales) {
      const file = join(messagesDir, `${locale}.json`);
      if (!existsSync(file)) {
        errors.push(`missing locale message file: ${file.replace(repoRoot + "/", "")}`);
      }
    }
  }
}

// --- 3. Layout metadata -------------------------------------------------

const layoutPath = join(repoRoot, "apps/marketing/src/app/layout.tsx");
if (!existsSync(layoutPath)) {
  errors.push("apps/marketing/src/app/layout.tsx missing.");
} else {
  const src = readFileSync(layoutPath, "utf8");
  for (const required of [
    "metadata",
    "metadataBase",
    "openGraph",
    "twitter",
    "alternates",
  ]) {
    const re = new RegExp(`${required}\\s*:`);
    if (!re.test(src)) {
      errors.push(`layout.tsx: metadata.${required} not declared.`);
    }
  }
}

// --- 4. Sitemap + robots -----------------------------------------------

for (const file of ["sitemap.ts", "robots.ts"]) {
  const rel = `apps/marketing/src/app/${file}`;
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing ${rel}`);
  }
}

// --- 5. Lead form API routes -------------------------------------------

for (const ep of [
  "apps/marketing/src/app/api/contact/route.ts",
  "apps/marketing/src/app/api/newsletter/route.ts",
]) {
  if (!existsSync(join(repoRoot, ep))) {
    errors.push(`missing lead API: ${ep}`);
  }
}

// --- 6. Placeholder copy scan ------------------------------------------

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

const PLACEHOLDER_RE = /(Coming soon|TBD\b|Lorem ipsum|\[REPLACE\])/i;
const marketingPages = walk(join(repoRoot, "apps/marketing/src/app")).filter(
  (p) => p.endsWith("/page.tsx") || p.endsWith("/layout.tsx"),
);
for (const p of marketingPages) {
  const src = readFileSync(p, "utf8");
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/^import [^;]+;$/gm, "");
  if (PLACEHOLDER_RE.test(stripped)) {
    errors.push(
      `${p.replace(repoRoot + "/", "")}: placeholder copy ("Coming soon" / "TBD" / "Lorem ipsum" / "[REPLACE]"). Replace with real content.`,
    );
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nmarketing:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `marketing:audit OK — ${REQUIRED_ROUTES.length} required route(s), locale coverage, layout metadata, sitemap+robots, lead APIs verified.`,
);
