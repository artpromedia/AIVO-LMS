import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

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

/**
 * Security incident register + bridge ownership.
 *
 * `severity` ∈ sev1 | sev2 | sev3 | sev4.
 * `status` ∈ open | investigating | mitigating | resolved | post_mortem.
 */
export const securityIncidents = pgTable(
  "security_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 256 }).notNull(),
    summary: text("summary").notNull().default(""),
    severity: varchar("severity", { length: 8 }).notNull().default("sev3"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    /** Incident commander (owns the bridge). */
    commanderUserId: uuid("commander_user_id"),
    /** May have exposed customer / learner data. */
    customerImpact: boolean("customer_impact").notNull().default(false),
    /** Regulators must be notified (FERPA / state breach laws). */
    regulatorNotificationRequired: boolean("regulator_notification_required")
      .notNull()
      .default(false),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_security_incidents_status").on(table.status),
    index("idx_security_incidents_severity").on(table.severity),
  ],
);

/**
 * Risk register.
 *
 * `category` ∈ security | privacy | availability | operational | third_party.
 * `inherentSeverity` / `residualSeverity` ∈ low | medium | high | critical.
 * `treatment` ∈ accept | mitigate | transfer | avoid.
 */
export const securityRisks = pgTable(
  "security_risks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description").notNull().default(""),
    category: varchar("category", { length: 24 }).notNull().default("security"),
    inherentSeverity: varchar("inherent_severity", { length: 16 }).notNull().default("medium"),
    residualSeverity: varchar("residual_severity", { length: 16 }).notNull().default("medium"),
    treatment: varchar("treatment", { length: 16 }).notNull().default("mitigate"),
    /** Free-form owner role label, e.g. "Platform Security". */
    owner: varchar("owner", { length: 128 }).notNull().default(""),
    open: boolean("open").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_security_risks_category").on(table.category)],
);

/**
 * Third-party vendor register (vendor risk management).
 *
 * `category` ∈ llm_provider | tts_provider | infra | analytics | support |
 *   billing | other.
 * `riskTier` ∈ tier1 | tier2 | tier3.
 */
export const securityVendors = pgTable(
  "security_vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    category: varchar("category", { length: 24 }).notNull().default("other"),
    dataResidency: varchar("data_residency", { length: 64 }).notNull().default(""),
    processesLearnerData: boolean("processes_learner_data").notNull().default(false),
    dpaSigned: boolean("dpa_signed").notNull().default(false),
    riskTier: varchar("risk_tier", { length: 8 }).notNull().default("tier3"),
    approved: boolean("approved").notNull().default(false),
    notes: text("notes"),
    lastReviewedAt: timestamp("last_reviewed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_security_vendors_risk_tier").on(table.riskTier)],
);

/**
 * Vulnerability report register.
 *
 * `severity` ∈ low | medium | high | critical.
 * `status` ∈ open | triaged | fixed | wontfix.
 * `source` ∈ dependency_scan | container_scan | iac_scan | pen_test |
 *   external_report | internal.
 */
export const securityVulnerabilities = pgTable(
  "security_vulnerabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 256 }).notNull(),
    cveId: varchar("cve_id", { length: 64 }),
    severity: varchar("severity", { length: 16 }).notNull().default("medium"),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    source: varchar("source", { length: 24 }).notNull().default("internal"),
    affectedComponent: varchar("affected_component", { length: 256 }).notNull().default(""),
    fixedIn: varchar("fixed_in", { length: 128 }),
    discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_security_vulnerabilities_status").on(table.status),
    index("idx_security_vulnerabilities_severity").on(table.severity),
  ],
);
