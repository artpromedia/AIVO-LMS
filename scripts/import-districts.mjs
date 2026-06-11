#!/usr/bin/env node
/**
 * Wave D (G3) — top-district directory fetcher.
 *
 * Pulls the NCES Common Core of Data district directory (via the Urban
 * Institute Education Data API, which republishes NCES CCD verbatim:
 * https://educationdata.urban.org/documentation/school-districts.html),
 * selects the top-N regular districts by enrollment, and vendors a compact
 * deterministic slice into
 * `packages/content-pack/data/sources/nces/top-districts.json`.
 *
 * The vendored file — NOT the network — is the input the deterministic
 * importer (`services/curriculum-svc/scripts/import_ccss.py`) folds into
 * the catalogue, so CI never depends on this fetcher. Re-run it to refresh
 * the slice (new CCD year, bigger N), review the diff, and commit.
 *
 * Usage:
 *   node scripts/import-districts.mjs            # year 2022, top 100
 *   node scripts/import-districts.mjs --year 2022 --top 100
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const OUT_PATH = join(
  repoRoot,
  "packages/content-pack/data/sources/nces/top-districts.json",
);

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const YEAR = argValue("year", "2022");
const TOP_N = Number(argValue("top", "100"));

// 50 states + DC (FIPS). Territories are excluded from the top-N slice.
const STATE_FIPS = [
  1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44,
  45, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56,
];

/** Stable id: state postal + slugified name (mirrors the seed districts). */
function districtId(state, name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${state.toLowerCase()}-${slug}`;
}

async function fetchState(fips) {
  const url = `https://educationdata.urban.org/api/v1/school-districts/ccd/directory/${YEAR}/?fips=${fips}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`fips ${fips}: HTTP ${res.status}`);
  const data = await res.json();
  if (data.next) {
    // The per-state directory fits one page today; fail loudly if that
    // changes rather than silently dropping districts.
    throw new Error(`fips ${fips}: unexpected pagination (next=${data.next})`);
  }
  return data.results ?? [];
}

const all = [];
for (const fips of STATE_FIPS) {
  const rows = await fetchState(fips);
  for (const r of rows) {
    // agency_type 1 = regular local school district (CCD vocabulary);
    // skip charter umbrellas, state agencies, service agencies, etc.
    if (Number(r.agency_type) !== 1) continue;
    if (!Number.isFinite(r.enrollment) || r.enrollment <= 0) continue;
    const zip = String(r.zip_location || r.zip_mailing || "").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) continue;
    all.push({
      leaid: String(r.leaid),
      name: String(r.lea_name).trim(),
      state: String(r.state_location || r.state_mailing || "").trim(),
      city: String(r.city_location || "").trim(),
      zip,
      enrollment: Number(r.enrollment),
    });
  }
  process.stderr.write(`fips ${fips}: ${rows.length} rows\n`);
}

all.sort((a, b) => b.enrollment - a.enrollment || a.leaid.localeCompare(b.leaid));
const top = all.slice(0, TOP_N).map((d) => ({
  id: districtId(d.state, d.name),
  leaid: d.leaid,
  name: d.name,
  state: d.state,
  city: d.city,
  zipCodes: [d.zip],
  enrollment: d.enrollment,
}));

const out = {
  source:
    `NCES Common Core of Data LEA directory ${YEAR} (via Urban Institute ` +
    "Education Data API, educationdata.urban.org) — top districts by enrollment, " +
    "regular local school districts (agency_type=1) only.",
  year: YEAR,
  fetchedWith: "scripts/import-districts.mjs",
  districts: top,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + "\n");
console.log(`✓ wrote ${OUT_PATH} — ${top.length} districts (of ${all.length} candidates).`);
