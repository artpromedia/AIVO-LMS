/**
 * Zip → district resolver (Sprint A — completion plan).
 *
 * Reads from the NCES-seeded `zip_district` + `districts` tables in
 * `@aivo/db`. Returns the dominant district by default and the full
 * disambiguation list when a zip spans multiple districts (real US
 * zips often do — boundaries don't honor postal codes).
 *
 * The legacy 21-major-district static map in `curriculum-lookup.ts`
 * stays in place as a warm-start cache: if the DB has not been seeded
 * yet (typical in dev / fresh CI) the static map still resolves the
 * top-21 major districts so existing flows don't regress. The DB
 * always wins when populated.
 *
 * Geocoding fallback (Geocodio) only fires when the DB miss-rate
 * justifies it — see `zip-lookup-fallback.ts`. Never called in the
 * hot path of every keystroke.
 */
import { eq, desc, and, ilike } from "drizzle-orm";
import { createDb, ncesDistricts, zipNcesDistrict, type Database } from "@aivo/db";

export interface ResolvedDistrict {
  ncesId: string;
  name: string;
  state: string;
  city?: string | null;
  weight: number;
  dominant: boolean;
}

export interface ZipDistrictResolution {
  zip: string;
  dominant: ResolvedDistrict | null;
  /** All districts that overlap the zip, descending by weight. Length 0 = no match. */
  alternates: ResolvedDistrict[];
  source: "db" | "miss";
}

let _db: Database | null = null;
function getDb(): Database | null {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  _db = createDb(url);
  return _db;
}

export function normalizeZip(input: string | undefined | null): string | null {
  if (!input) return null;
  const clean = String(input).replace(/\D/g, "").slice(0, 5);
  if (clean.length !== 5) return null;
  return clean;
}

/**
 * Resolve a 5-digit US zip to its overlapping districts.
 *
 * On `DATABASE_URL` unset or query error, returns a `miss` so the
 * caller can fall back to the static major-district map. The
 * function never throws.
 */
export async function resolveZipToDistricts(
  rawZip: string,
): Promise<ZipDistrictResolution> {
  const zip = normalizeZip(rawZip);
  if (!zip) {
    return { zip: rawZip, dominant: null, alternates: [], source: "miss" };
  }

  const db = getDb();
  if (!db) {
    return { zip, dominant: null, alternates: [], source: "miss" };
  }

  try {
    const rows = await db
      .select({
        ncesId: zipNcesDistrict.ncesId,
        weight: zipNcesDistrict.weight,
        dominant: zipNcesDistrict.dominant,
        name: ncesDistricts.name,
        state: ncesDistricts.state,
        city: ncesDistricts.city,
      })
      .from(zipNcesDistrict)
      .innerJoin(ncesDistricts, eq(ncesDistricts.ncesId, zipNcesDistrict.ncesId))
      .where(eq(zipNcesDistrict.zip, zip))
      .orderBy(desc(zipNcesDistrict.weight));

    if (rows.length === 0) {
      return { zip, dominant: null, alternates: [], source: "miss" };
    }

    const all: ResolvedDistrict[] = rows.map((r) => ({
      ncesId: r.ncesId,
      name: r.name,
      state: r.state,
      city: r.city,
      weight: r.weight,
      dominant: r.dominant,
    }));
    const dominant = all.find((d) => d.dominant) ?? all[0]!;
    const alternates = all.filter((d) => d.ncesId !== dominant.ncesId);
    return { zip, dominant, alternates, source: "db" };
  } catch {
    // Best-effort: never throw out of the resolver. Static fallback covers it.
    return { zip, dominant: null, alternates: [], source: "miss" };
  }
}

/**
 * Free-text district search across the canonical district table.
 * Used by the "Not your district? Search…" override UI.
 *
 * Matches by case-insensitive substring on `name` and limits results
 * to 25. Empty / too-short queries return [].
 */
export async function searchDistricts(
  query: string,
  state?: string,
): Promise<ResolvedDistrict[]> {
  const q = (query ?? "").trim();
  if (q.length < 2) return [];

  const db = getDb();
  if (!db) return [];

  try {
    const filters = state
      ? and(ilike(ncesDistricts.name, `%${q}%`), eq(ncesDistricts.state, state.toUpperCase()))
      : ilike(ncesDistricts.name, `%${q}%`);
    const rows = await db
      .select({
        ncesId: ncesDistricts.ncesId,
        name: ncesDistricts.name,
        state: ncesDistricts.state,
        city: ncesDistricts.city,
      })
      .from(ncesDistricts)
      .where(filters)
      .limit(25);

    return rows.map((r) => ({
      ncesId: r.ncesId,
      name: r.name,
      state: r.state,
      city: r.city,
      weight: 0,
      dominant: false,
    }));
  } catch {
    return [];
  }
}
