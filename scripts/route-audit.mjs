#!/usr/bin/env node
// route:audit — Sprint 08 gate.
//
// Verifies the web role-surface contract in docs/ux/route-matrix.md.
//
// 1. Every consumer role group (parent, learner, teacher) has
//    loading.tsx, error.tsx, not-found.tsx. Admin routes live in the
//    standalone apps/web-admin host and are checked separately below.
// 2. The learner home declares exactly one element marked with
//    data-primary-cta — "Today's Mission" is the single primary CTA.
// 3. No page.tsx under app/{role}/** ships literal placeholder copy
//    ("Coming soon", "TBD", "Lorem ipsum") in JSX text.
// 4. Every role-grouped page.tsx imports requirePageRole OR a role
//    helper that calls it. Sign-in surfaces may use `requireAnonymous`
//    instead, which redirects already-authenticated visitors away while
//    allowing logged-out users to render the form.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const WEB_V2_ROLE_GROUPS = ["parent", "learner", "teacher"];
const REQUIRED_STATE_FILES = ["loading.tsx", "error.tsx", "not-found.tsx"];
const REQUIRED_ADMIN_APP_FILES = [
  "apps/web-admin/app/layout.tsx",
  "apps/web-admin/app/loading.tsx",
  "apps/web-admin/app/error.tsx",
  "apps/web-admin/app/not-found.tsx",
  "apps/web-admin/app/page.tsx",
  "apps/web-admin/app/platform/page.tsx",
];

const errors = [];

// 1. State file coverage per role group.
for (const role of WEB_V2_ROLE_GROUPS) {
  for (const file of REQUIRED_STATE_FILES) {
    const rel = `apps/web-v2/app/${role}/${file}`;
    if (!existsSync(join(repoRoot, rel))) {
      errors.push(`missing role state file: ${rel}`);
    }
  }
}

for (const rel of REQUIRED_ADMIN_APP_FILES) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing standalone admin app file: ${rel}`);
  }
}

const adminPlatformPage = join(repoRoot, "apps/web-admin/app/platform/page.tsx");
if (existsSync(adminPlatformPage)) {
  const src = readFileSync(adminPlatformPage, "utf8");
  if (!/requirePlatformPage|requireAdminPage|requirePageRole|requireSession/.test(src)) {
    errors.push(
      "apps/web-admin/app/platform/page.tsx: must require an admin session before rendering.",
    );
  }
}

// 2. Learner home has exactly one primary CTA marker.
const learnerHome = join(repoRoot, "apps/web-v2/app/learner/home/page.tsx");
if (!existsSync(learnerHome)) {
  errors.push("apps/web-v2/app/learner/home/page.tsx missing.");
} else {
  const src = readFileSync(learnerHome, "utf8");
  const matches = [...src.matchAll(/data-primary-cta(?:=["{][^"}]*["}])?/g)];
  if (matches.length === 0) {
    errors.push(
      "learner/home/page.tsx: must declare exactly one element with `data-primary-cta` (Today's Mission); none found.",
    );
  } else if (matches.length > 1) {
    errors.push(
      `learner/home/page.tsx: must declare exactly ONE element with data-primary-cta; found ${matches.length}.`,
    );
  }
}

// 3. Placeholder copy scan across role-grouped page.tsx.
const PLACEHOLDER_RE = /(Coming soon|TBD|Lorem ipsum|coming-soon)/i;
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

for (const role of WEB_V2_ROLE_GROUPS) {
  const roleDir = join(repoRoot, "apps/web-v2/app", role);
  if (!existsSync(roleDir)) continue;
  const pages = walk(roleDir).filter((p) => p.replaceAll("\\", "/").endsWith("/page.tsx"));
  for (const p of pages) {
    const src = readFileSync(p, "utf8");
    // Strip imports + comments to reduce false positives. We're looking
    // for JSX text, not type names or imported symbols.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/^import [^;]+;$/gm, "");
    if (PLACEHOLDER_RE.test(stripped)) {
      errors.push(
        `${p.replace(repoRoot + "/", "")}: contains placeholder copy ("Coming soon" / "TBD" / "Lorem ipsum"). Replace with a real empty state or remove.`,
      );
    }
  }
}

// 4. Every role-grouped page.tsx requires a session/role check. We
// look for requirePageRole at the call site OR a layout.tsx in the
// same role group that calls it. We accept either pattern.
for (const role of WEB_V2_ROLE_GROUPS) {
  const roleDir = join(repoRoot, "apps/web-v2/app", role);
  if (!existsSync(roleDir)) continue;

  const layoutFiles = walk(roleDir).filter((p) =>
    p.replaceAll("\\", "/").endsWith("/layout.tsx"),
  );
  const layoutCoversRole = layoutFiles.some((p) =>
    /requirePageRole|requireSession|requireAnonymous/.test(readFileSync(p, "utf8")),
  );

  const pages = walk(roleDir).filter((p) => p.replaceAll("\\", "/").endsWith("/page.tsx"));
  for (const p of pages) {
    const src = readFileSync(p, "utf8");
    const callsGuard =
      /requirePageRole|requireSession|requireAnonymous\b/.test(src) || layoutCoversRole;
    if (!callsGuard) {
      errors.push(
        `${p.replace(repoRoot + "/", "")}: must call requirePageRole or be covered by a role-group layout that does.`,
      );
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nroute:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `route:audit OK — ${WEB_V2_ROLE_GROUPS.length} consumer role group(s) verified plus standalone admin app coverage.`,
);
