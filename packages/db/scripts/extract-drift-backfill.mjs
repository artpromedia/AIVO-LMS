#!/usr/bin/env node
/**
 * One-off: extract just the 28 drifted tables from the drizzle-kit
 * generated 0046_backfill_pgtable_drift.sql (which is a full schema
 * diff against an ancient 0002 snapshot and therefore contains 142
 * CREATE TABLE statements for tables that were already created by
 * hand-written migrations 0003-0061).
 *
 * Output: a minimal backfill migration with IF NOT EXISTS guards so
 * it is safe to apply to both fresh CI databases and the production
 * database where these 28 tables already exist (created via db:push
 * before anyone noticed the drift).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const drizzleDir = resolve(here, "..", "drizzle");
const SRC = resolve(drizzleDir, "0046_backfill_pgtable_drift.sql");
const OUT = resolve(drizzleDir, "0062_backfill_pgtable_drift.sql");

const TARGET_TABLES = new Set([
  "audit_events_v2",
  "audit_anchors",
  "dpa_acceptances",
  "deletion_requests",
  "data_export_jobs",
  "enterprise_audit_events",
  "enterprise_sis_connections",
  "enterprise_sis_import_jobs",
  "enterprise_lti_tools",
  "enterprise_lti_launches",
  "impersonation_sessions",
  "aac_vocabulary",
  "lti_platforms",
  "lti_deployments",
  "lti_contexts",
  "lti_resource_links",
  "lti_ags_lineitems",
  "oidc_signing_keys",
  "problem_sessions",
  "problem_session_events",
  "problem_session_surface_snapshots",
  "problem_session_attempts",
  "enterprise_districts",
  "enterprise_schools",
  "enterprise_classes",
  "class_enrollments",
  "teacher_assignments",
  "district_admin_assignments",
]);

const raw = readFileSync(SRC, "utf8");
const blocks = raw
  .split("--> statement-breakpoint")
  .map((b) => b.trim())
  .filter(Boolean);

const kept = [];
for (const block of blocks) {
  // CREATE TABLE "name" (
  const ct = block.match(/^CREATE TABLE "([^"]+)"/);
  if (ct) {
    if (TARGET_TABLES.has(ct[1])) {
      kept.push(block.replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "'));
    }
    continue;
  }
  // CREATE [UNIQUE] INDEX "idx" ON "tablename" (...)
  const ci = block.match(/^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([^"]+)"/);
  if (ci) {
    if (TARGET_TABLES.has(ci[1])) {
      kept.push(
        block
          .replace(/^CREATE UNIQUE INDEX "/, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
          .replace(/^CREATE INDEX "/, 'CREATE INDEX IF NOT EXISTS "'),
      );
    }
    continue;
  }
  // ALTER TABLE "name" ADD CONSTRAINT ... FOREIGN KEY ...
  const at = block.match(/^ALTER TABLE "([^"]+)"/);
  if (at) {
    if (TARGET_TABLES.has(at[1])) {
      // Wrap FK adds in a DO block so re-runs do not fail on existing
      // constraints (pg has no IF NOT EXISTS on ADD CONSTRAINT).
      const cname = block.match(/ADD CONSTRAINT "([^"]+)"/);
      if (cname) {
        const guarded = `DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${cname[1]}') THEN\n    ${block.replace(/\n/g, "\n    ")};\n  END IF;\nEND $$`;
        kept.push(guarded);
      } else {
        kept.push(block);
      }
    }
    continue;
  }
  // Skip everything else (CREATE TYPE for already-existing enums, etc.)
}

const header = `-- Backfill migration for 28 tables added to packages/db/src/schema/
-- via 'drizzle-kit push' in dev but never authored as migrations.
-- All statements are IF NOT EXISTS-guarded so this is safe to apply
-- to production where these tables were created out-of-band as well
-- as to fresh CI databases where they do not yet exist.
--
-- Tracks: scripts/check-schema-drift.ts CI gate (Task #182).

`;

writeFileSync(OUT, header + kept.join(";\n\n--> statement-breakpoint\n") + ";\n");
console.log(`Wrote ${OUT} with ${kept.length} statements for ${TARGET_TABLES.size} tables.`);
