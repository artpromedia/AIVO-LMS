import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Security posture: SOC 2 / Trust Services control register and the evidence
 * collected against each control. Owned by admin-svc and surfaced in the
 * platform admin console (web-admin). Replaces the in-memory store that the
 * legacy web-v2 admin used.
 *
 * `criterion` ∈ security | availability | processing_integrity |
 *   confidentiality | privacy (TSC categories).
 * `status` ∈ implemented | partial | not_started | not_applicable.
 *
 * Validation is enforced at the application layer (admin-svc), matching the
 * varchar+app-validation convention used elsewhere (e.g. dsar_requests).
 */
export const securityControls = pgTable(
  "security_controls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Short code, e.g. "CC6.1" (Common Criteria) or "AIVO-AC-01". */
    code: varchar("code", { length: 64 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description").notNull().default(""),
    criterion: varchar("criterion", { length: 32 }).notNull().default("security"),
    /** Free-form owner role label, e.g. "Platform Security". */
    owner: varchar("owner", { length: 128 }).notNull().default(""),
    status: varchar("status", { length: 24 }).notNull().default("not_started"),
    lastReviewedAt: timestamp("last_reviewed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_security_controls_criterion").on(table.criterion),
    index("idx_security_controls_status").on(table.status),
  ],
);

export const securityControlEvidence = pgTable(
  "security_control_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    controlId: uuid("control_id")
      .notNull()
      .references(() => securityControls.id, { onDelete: "cascade" }),
    /** policy | log | config | screenshot | report | runbook | ticket */
    kind: varchar("kind", { length: 24 }).notNull(),
    summary: text("summary").notNull().default(""),
    /** External URL or repo path; null when the evidence is verbal. */
    uri: text("uri"),
    collectedByUserId: uuid("collected_by_user_id"),
    collectedAt: timestamp("collected_at").defaultNow().notNull(),
  },
  (table) => [index("idx_security_control_evidence_control").on(table.controlId)],
);
