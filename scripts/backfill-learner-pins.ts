/**
 * One-shot: apply migration 0117 (learner_pin_credentials) and backfill any
 * existing plaintext users.pin into it as an Argon2id hash, so dropping the
 * legacy column (0118) never locks an existing learner out.
 *
 * Uses the SAME argon2id parameters as services/identity-svc setLearnerPin, so
 * the backfilled hash verifies against the learner's current PIN.
 *
 * Idempotent: ON CONFLICT DO NOTHING — a learner already migrated is skipped.
 * Reads DATABASE_URL. Run via the esbuild-bundle + ConfigMap-Job pattern.
 */
import argon2 from "argon2";
import { createDb, closeDb } from "@aivo/db";
import { sql } from "drizzle-orm";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const db = createDb(url);

  // 1) Ensure the table exists (0117 — additive, idempotent).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "learner_pin_credentials" (
      "learner_user_id" uuid PRIMARY KEY REFERENCES "users"("id"),
      "pin_hash" text NOT NULL,
      "pin_set_at" timestamp DEFAULT now() NOT NULL,
      "failed_attempts" integer DEFAULT 0 NOT NULL,
      "failed_last_at" timestamp,
      "locked_until" timestamp,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "learner_pin_credentials_locked_until_idx" ON "learner_pin_credentials" ("locked_until")`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "learner_pin_credentials_updated_at_idx" ON "learner_pin_credentials" ("updated_at")`,
  );

  // 2) Only backfill if the legacy column still exists.
  const colRows = (await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'pin'
  `)) as unknown as { rows?: unknown[] } | unknown[];
  const colPresent = (Array.isArray(colRows) ? colRows : (colRows.rows ?? [])).length > 0;
  if (!colPresent) {
    console.log("users.pin already dropped — nothing to backfill.");
    await closeDb(db);
    process.exit(0);
  }

  // 3) Backfill each learner with a plaintext PIN.
  const learnerRows = (await db.execute(sql`
    SELECT id, pin FROM users
    WHERE role = 'LEARNER' AND pin IS NOT NULL AND pin <> ''
  `)) as unknown as { rows?: Array<{ id: string; pin: string }> } | Array<{ id: string; pin: string }>;
  const rows = Array.isArray(learnerRows) ? learnerRows : (learnerRows.rows ?? []);
  console.log(`learners with a plaintext PIN: ${rows.length}`);

  let migrated = 0;
  for (const r of rows) {
    const pin = String(r.pin);
    if (!/^\d{4,6}$/.test(pin)) {
      console.log(`  skip ${r.id}: PIN not 4–6 digits`);
      continue;
    }
    const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
    const res = (await db.execute(sql`
      INSERT INTO learner_pin_credentials (learner_user_id, pin_hash)
      VALUES (${r.id}, ${pinHash})
      ON CONFLICT (learner_user_id) DO NOTHING
    `)) as unknown as { count?: number };
    const inserted = typeof res?.count === "number" ? res.count : 1;
    if (inserted > 0) migrated++;
  }
  console.log(`backfilled ${migrated} learner PIN(s) into learner_pin_credentials.`);

  // 4) Verify counts.
  const credCount = (await db.execute(sql`
    SELECT count(*)::int AS c FROM learner_pin_credentials
  `)) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
  const c = Number((Array.isArray(credCount) ? credCount : (credCount.rows ?? []))[0]?.c ?? 0);
  console.log(`learner_pin_credentials total rows: ${c}`);

  await closeDb(db);
  console.log("DONE — safe to drop users.pin (0118).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
