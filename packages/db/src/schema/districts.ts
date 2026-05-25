/**
 * District + zip→district lookup tables (Sprint A — completion plan).
 *
 * Sourced from NCES Common Core of Data (CCD) and EDGE geocode. Seeded
 * by `scripts/seed-nces-districts.mjs`. Read-only from the application
 * tier; rows are never mutated at request time.
 *
 * `districts` is keyed by NCES `lea_id` (string, 7 digits) so we can
 * round-trip identity with public federal data and survive cross-year
 * district boundary changes. `zip_district` is a many-to-many: real US
 * zips often span multiple districts; `dominant` flags the
 * highest-coverage match for the cheap default. `weight` is the
 * population-weighted overlap from EDGE (`0.0`..`1.0`), used to rank
 * the disambiguation list when a parent picks from the override.
 */
import { pgTable, varchar, real, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const districts = pgTable(
  "districts",
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
    index("idx_districts_state").on(table.state),
    index("idx_districts_name").on(table.name),
  ],
);

export const zipDistrict = pgTable(
  "zip_district",
  {
    /** 5-digit US zip. Composite PK with `nces_id` (one zip → many districts). */
    zip: varchar("zip", { length: 5 }).notNull(),
    ncesId: varchar("nces_id", { length: 16 })
      .references(() => districts.ncesId)
      .notNull(),
    /** EDGE population-weighted overlap (0..1). Higher = more of the zip's population sits in this district. */
    weight: real("weight").notNull().default(0),
    /** True for the single highest-weight district per zip. Cheap default for the auto-fill path. */
    dominant: boolean("dominant").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_zip_district_zip").on(table.zip),
    index("idx_zip_district_dominant").on(table.zip, table.dominant),
  ],
);
