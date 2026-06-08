/**
 * Web-owned security / SOC 2 / privacy-matrix persistence tables (Sprint 4).
 *
 * Compliance artifacts that must survive restarts and be auditable: SOC 2
 * controls + evidence, the risk register, incident records + their timelines,
 * the vendor inventory, the state-privacy-law matrix (requirements +
 * control mappings), and vulnerability reports.
 *
 * These are PLATFORM-GLOBAL (no tenant_id — one security posture for the whole
 * platform), so — like web_policy_versions / web_subprocessors — they are NOT
 * RLS-protected (migration 0083). Conventions match web-domain.ts: TEXT ids,
 * the full object in a `data` JSONB column, and predicate columns only for the
 * foreign-key filters the stores actually use (control_id, incident_id,
 * requirement_id); every sort is applied in app code for byte-for-byte parity.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webSecurityControls = pgTable("web_security_controls", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webControlEvidence = pgTable(
  "web_control_evidence",
  {
    id: text("id").primaryKey(),
    controlId: text("control_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_control_evidence_control_idx").on(t.controlId) }),
);

export const webRiskRegister = pgTable("web_risk_register", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webIncidents = pgTable("web_incidents", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webIncidentTimeline = pgTable(
  "web_incident_timeline",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_incident_timeline_incident_idx").on(t.incidentId) }),
);

export const webVendors = pgTable("web_vendors", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webStatePrivacyRequirements = pgTable("web_state_privacy_requirements", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webStatePrivacyMappings = pgTable(
  "web_state_privacy_mappings",
  {
    id: text("id").primaryKey(),
    requirementId: text("requirement_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_state_privacy_mappings_req_idx").on(t.requirementId) }),
);

export const webVulnerabilityReports = pgTable("web_vulnerability_reports", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});
