#!/usr/bin/env node
/**
 * Seed `districts` + `zip_district` from NCES public data (Sprint A).
 *
 * Two modes:
 *   1. Real NCES seed
 *      $ NCES_CCD_CSV=/abs/path/ccd_lea_2023.csv \
 *        NCES_ZIP_CROSSWALK_CSV=/abs/path/zip-to-lea-2023.csv \
 *        node scripts/seed-nces-districts.mjs
 *      Pulls one row per district from the CCD LEA directory and one
 *      row per (zip, lea_id) pair from the zip→LEA crosswalk you
 *      supply. NCES does not publish a single canonical zip→LEA file;
 *      sources are usually built by joining the HUD USPS ZIP-County
 *      crosswalk with the EDGE Geocoded LEA county_fips, or by
 *      consuming the SDID shapefile overlaid with USPS ZIPs. We accept
 *      either output here.
 *
 *   2. Fixture seed (default — no env vars set)
 *      $ node scripts/seed-nces-districts.mjs
 *      Loads scripts/data/nces-fixture.json which carries the top-20
 *      US districts + ~25 zip mappings. Lets dev and CI verify the
 *      zip→district auto-lookup without any network or large data
 *      files.
 *
 * Both modes are idempotent: ON CONFLICT DO UPDATE / DO NOTHING.
 *
 * DATABASE_URL is required.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function die(msg) {
  console.error(`[seed-nces] ${msg}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) die("DATABASE_URL is required");

const ccdCsv = process.env.NCES_CCD_CSV;
const zipCsv = process.env.NCES_ZIP_CROSSWALK_CSV;
const useFixture = !ccdCsv && !zipCsv;

const sql = postgres(url, { max: 4 });

function parseCsv(content) {
  // Minimal CSV parser: assumes RFC4180 with comma delimiter, double
  // quoting, no embedded newlines in fields. NCES CCD files satisfy
  // this. Avoid a dependency for a one-shot seed script.
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const splitLine = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const header = splitLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const row = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
  return { header, rows };
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return null;
}

async function seedFromFixture() {
  const fixturePath = path.resolve(__dirname, "data", "nces-fixture.json");
  if (!fs.existsSync(fixturePath)) {
    die(`fixture not found: ${fixturePath}`);
  }
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  return {
    districts: fixture.districts,
    zips: fixture.zipDistrict,
  };
}

async function seedFromCsvs() {
  if (!ccdCsv || !zipCsv) {
    die("Both NCES_CCD_CSV and NCES_ZIP_CROSSWALK_CSV must be set for real seed");
  }
  const ccd = parseCsv(fs.readFileSync(ccdCsv, "utf8"));
  const zip = parseCsv(fs.readFileSync(zipCsv, "utf8"));

  const districts = ccd.rows
    .map((r) => ({
      ncesId: pick(r, ["LEAID", "leaid", "lea_id", "LEA_ID"]),
      name: pick(r, ["LEA_NAME", "lea_name", "NAME", "name"]),
      state: pick(r, ["MSTATE", "STABBR", "state", "ST"]),
      countyFips: pick(r, ["CONUM", "CountyFIPS", "county_fips"]),
      leaType: pick(r, ["LEA_TYPE", "lea_type", "TYPE"]),
      city: pick(r, ["LCITY", "city", "City"]),
    }))
    .filter((d) => d.ncesId && d.name && d.state);

  const zips = zip.rows
    .map((r) => ({
      zip: pick(r, ["ZIP", "zip", "zipcode", "Zip"])?.padStart(5, "0"),
      ncesId: pick(r, ["LEAID", "leaid", "lea_id", "LEA_ID"]),
      weight: Number(pick(r, ["WEIGHT", "weight", "OVERLAP", "overlap"]) ?? 1),
      dominant:
        String(pick(r, ["DOMINANT", "dominant", "PRIMARY"]) ?? "").toLowerCase() ===
          "true" ||
        Number(pick(r, ["WEIGHT", "weight", "OVERLAP", "overlap"]) ?? 1) >= 0.5,
    }))
    .filter((z) => z.zip && /^\d{5}$/.test(z.zip) && z.ncesId);

  return { districts, zips };
}

async function main() {
  console.log(`[seed-nces] mode=${useFixture ? "fixture" : "csv"}`);

  const { districts, zips } = useFixture
    ? await seedFromFixture()
    : await seedFromCsvs();

  console.log(
    `[seed-nces] loaded ${districts.length} districts, ${zips.length} zip mappings`,
  );

  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < districts.length; i += BATCH) {
    const chunk = districts.slice(i, i + BATCH);
    await sql`
      INSERT INTO districts (nces_id, name, state, county_fips, lea_type, city)
      SELECT * FROM ${sql(
        chunk.map((d) => [
          d.ncesId,
          d.name,
          d.state,
          d.countyFips ?? null,
          d.leaType ?? null,
          d.city ?? null,
        ]),
      )}
      ON CONFLICT (nces_id) DO UPDATE SET
        name = EXCLUDED.name,
        state = EXCLUDED.state,
        county_fips = EXCLUDED.county_fips,
        lea_type = EXCLUDED.lea_type,
        city = EXCLUDED.city,
        updated_at = now()
    `;
    inserted += chunk.length;
  }
  console.log(`[seed-nces] districts upserted: ${inserted}`);

  inserted = 0;
  for (let i = 0; i < zips.length; i += BATCH) {
    const chunk = zips.slice(i, i + BATCH);
    await sql`
      INSERT INTO zip_district (zip, nces_id, weight, dominant)
      SELECT * FROM ${sql(
        chunk.map((z) => [z.zip, z.ncesId, z.weight, z.dominant]),
      )}
      ON CONFLICT (zip, nces_id) DO UPDATE SET
        weight = EXCLUDED.weight,
        dominant = EXCLUDED.dominant
    `;
    inserted += chunk.length;
  }
  console.log(`[seed-nces] zip mappings upserted: ${inserted}`);

  await sql.end({ timeout: 5 });
  console.log(`[seed-nces] done`);
}

main().catch(async (err) => {
  console.error("[seed-nces] failed:", err);
  try {
    await sql.end({ timeout: 5 });
  } catch {}
  process.exit(1);
});
