#!/usr/bin/env node
/**
 * GEO structured-data gate.
 *
 * Fetches a fixed list of representative marketing URLs from a running build,
 * extracts every <script type="application/ld+json"> block, and asserts:
 *   1. the page returns HTTP 200;
 *   2. each JSON-LD block is valid JSON with @context + @type;
 *   3. the page emits the structured-data types that page TYPE must carry;
 *   4. citable entities (Article/BlogPosting/HowTo) carry the attribution
 *      fields generative engines need (headline/name, author, datePublished).
 *
 * Exits non-zero on any invalid or missing required JSON-LD so CI blocks merge.
 *
 * Usage: GEO_BASE_URL=http://localhost:4000 node scripts/geo/validate-structured-data.mjs
 */

const BASE = (process.env.GEO_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

/**
 * Representative pages and the JSON-LD @types each must emit. One per page
 * type the GEO sprints touched: home, an audience page, a blog post, a
 * procedural guide, and pricing.
 */
const EXPECTATIONS = [
  { path: "/", required: ["Organization", "WebSite", "SoftwareApplication"] },
  { path: "/for-parents", required: ["BreadcrumbList", "FAQPage"] },
  { path: "/blog/what-is-personalized-learning", required: ["BlogPosting", "BreadcrumbList"] },
  { path: "/guides/school-buying-checklist-ai-learning", required: ["HowTo", "BreadcrumbList"] },
  { path: "/pricing", required: ["BreadcrumbList"] },
];

/** Entity types that must carry attribution fields when present. */
const CITABLE = new Set(["Article", "BlogPosting", "NewsArticle", "HowTo"]);

const errors = [];
const ok = [];

function typesOf(node) {
  const t = node && node["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t.map(String) : [String(t)];
}

/** Flatten @graph containers so types in a graph count toward the page. */
function flatten(node, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) flatten(n, out);
  } else if (node && typeof node === "object") {
    if (Array.isArray(node["@graph"])) {
      for (const n of node["@graph"]) flatten(n, out);
    } else {
      out.push(node);
    }
  }
  return out;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

async function validatePage({ path, required }) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { headers: { "user-agent": "aivo-geo-validator" } });
  } catch (err) {
    errors.push(`${path}: request failed — ${err.message}`);
    return;
  }
  if (res.status !== 200) {
    errors.push(`${path}: expected HTTP 200, got ${res.status}`);
    return;
  }

  const html = await res.text();
  const raw = extractJsonLd(html);
  if (raw.length === 0) {
    errors.push(`${path}: no JSON-LD <script> blocks found`);
    return;
  }

  const nodes = [];
  for (const block of raw) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch (err) {
      errors.push(`${path}: invalid JSON-LD (${err.message})`);
      continue;
    }
    flatten(parsed, nodes);
  }

  const present = new Set();
  for (const node of nodes) {
    if (!node["@context"]) {
      errors.push(`${path}: a JSON-LD block is missing @context`);
    }
    const types = typesOf(node);
    if (types.length === 0) {
      errors.push(`${path}: a JSON-LD block is missing @type`);
    }
    for (const t of types) present.add(t);

    // Citable entities must carry attribution fields.
    if (types.some((t) => CITABLE.has(t))) {
      const name = node.headline || node.name;
      if (!name) errors.push(`${path}: ${types.join("/")} is missing headline/name`);
      if (!node.author || !node.author.name) {
        errors.push(`${path}: ${types.join("/")} is missing a non-null author`);
      }
      if (!node.datePublished) {
        errors.push(`${path}: ${types.join("/")} is missing datePublished`);
      }
    }
  }

  const missing = required.filter((t) => !present.has(t));
  if (missing.length > 0) {
    errors.push(
      `${path}: missing required JSON-LD type(s): ${missing.join(", ")} (found: ${[...present].join(", ") || "none"})`,
    );
  } else {
    ok.push(`${path}: ✓ ${required.join(", ")}`);
  }
}

console.log(`GEO structured-data validation against ${BASE}\n`);
for (const exp of EXPECTATIONS) {
  // Sequential keeps the next start server unstressed and output ordered.
  await validatePage(exp);
}

for (const line of ok) console.log(`  ${line}`);

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} structured-data problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `\n✓ All ${EXPECTATIONS.length} representative pages emit valid required structured data.`,
);
