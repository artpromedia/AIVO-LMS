#!/usr/bin/env node
/**
 * GEO llms.txt gate.
 *
 * Fetches the built /llms.txt and asserts:
 *   1. it is non-empty and starts with the site H1;
 *   2. it contains every required section header;
 *   3. every markdown link resolves to HTTP 200 on the running build.
 *
 * Links in llms.txt are absolute (built from NEXT_PUBLIC_SITE_URL). In CI we
 * build + serve with NEXT_PUBLIC_SITE_URL=GEO_BASE_URL so the links point at
 * the local server and this check exercises the real built pages.
 *
 * Usage: GEO_BASE_URL=http://localhost:4000 node scripts/geo/check-llms-txt.mjs
 */

const BASE = (process.env.GEO_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

const REQUIRED_HEADERS = [
  "## Products",
  "## For audiences",
  "## Pricing & trials",
  "## Compliance",
  "## Guides",
];

const errors = [];

const res = await fetch(`${BASE}/llms.txt`, { headers: { "user-agent": "aivo-geo-validator" } });
if (res.status !== 200) {
  console.error(`✗ /llms.txt returned HTTP ${res.status}`);
  process.exit(1);
}
const txt = await res.text();

if (txt.trim().length === 0) errors.push("/llms.txt is empty");
if (!txt.startsWith("# ")) errors.push("/llms.txt does not start with an H1 site name");

for (const header of REQUIRED_HEADERS) {
  if (!txt.includes(header)) errors.push(`missing required section header: ${header}`);
}

// Collect every markdown link target: - [label](url)
const links = [...txt.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
const unique = [...new Set(links)];
if (unique.length === 0) errors.push("no markdown links found in /llms.txt");

// Re-base absolute links onto BASE so we always hit the local server, even if
// the file was built with the production canonical host.
function rebase(url) {
  try {
    const u = new URL(url);
    return `${BASE}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

let checked = 0;
const broken = [];
const CONCURRENCY = 8;
const queue = [...unique];

async function worker() {
  while (queue.length > 0) {
    const link = queue.shift();
    const target = rebase(link);
    if (!target) {
      broken.push(`${link} (unparseable)`);
      continue;
    }
    try {
      const r = await fetch(target, {
        headers: { "user-agent": "aivo-geo-validator" },
        redirect: "manual",
      });
      checked++;
      // 200 OK, or a 3xx redirect to a canonical (e.g. locale) is acceptable.
      if (r.status !== 200 && !(r.status >= 300 && r.status < 400)) {
        broken.push(`${target} → HTTP ${r.status}`);
      }
    } catch (err) {
      broken.push(`${target} → ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (broken.length > 0) {
  errors.push(`${broken.length} broken link(s):\n    - ${broken.join("\n    - ")}`);
}

if (errors.length > 0) {
  console.error("✗ /llms.txt check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `✓ /llms.txt valid: ${REQUIRED_HEADERS.length} section headers, ${checked} links all reachable.`,
);
