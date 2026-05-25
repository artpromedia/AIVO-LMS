/**
 * NCES district + zip→district lookup tables (Sprint A — completion plan).
 *
 * REVISED in 0038: renamed from `districts` / `zip_district` to
 * `nces_districts` / `zip_nces_district` after the first names
 * collided with an existing production `districts` table that uses
 * a different schema (state_code + nces_district_id rather than
 * state + nces_id). The legacy table is intentionally left alone;
 * we publish a parallel NCES-anchored set under distinct names.
 *
 * Sourced from NCES Common Core of Data (CCD) and EDGE geocode. Seeded
 * by `scripts/seed-nces-districts.mjs`. Read-only from the application
 * tier; rows are never mutated at request time.
 *
 * `nces_districts` is keyed by NCES `lea_id` (string, 7 digits) so we
 * can round-trip identity with public federal data and survive
 * cross-year district boundary changes. `zip_nces_district` is a
 * many-to-many: real US zips often span multiple districts;
 * `dominant` flags the highest-coverage match for the cheap default.
 * `weight` is the population-weighted overlap from EDGE
 * (`0.0`..`1.0`), used to rank the disambiguation list when a parent
 * picks from the override.
 */
import { pgTable, varchar, real, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const ncesDistricts = pgTable(
  "nces_districts",
  {
    /** NCES Local Education Agency ID (`lea_id` / `leaid`). 7-digit string. */
    ncesId: varchar("nces_id", { length: 16 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    countyFips: varchar("county_fips", { length: 5 }),
    /** CCD `lea_type`: 1=regular, 2=supervisory, 3=non-op, etc. Kept as string for forward-compat. */
    leaType: varchar("lea_type", { length: 8 }),
    city: varchar("city", { length: 100 }),
    /** Optional convenience for parent-facing rendering. */
    websiteUrl: varchar("website_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_nces_districts_state").on(table.state),
    index("idx_nces_districts_name").on(table.name),
  ],
);

export const zipNcesDistrict = pgTable(
  "zip_nces_district",
  {
    /** 5-digit US zip. Composite PK with `nces_id` (one zip → many districts). */
    zip: varchar("zip", { length: 5 }).notNull(),
    ncesId: varchar("nces_id", { length: 16 })
      .references(() => ncesDistricts.ncesId)
      .notNull(),
    /** EDGE population-weighted overlap (0..1). Higher = more of the zip's population sits in this district. */
    weight: real("weight").notNull().default(0),
    /** True for the single highest-weight district per zip. Cheap default for the auto-fill path. */
    dominant: boolean("dominant").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_zip_nces_district_zip").on(table.zip),
    index("idx_zip_nces_district_dominant").on(table.zip, table.dominant),
  ],
);
