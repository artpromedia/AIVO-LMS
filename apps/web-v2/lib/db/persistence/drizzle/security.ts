/**
 * Drizzle-backed SecurityStore — the web_* security / SOC 2 / privacy-matrix
 * tables. Platform-global (no tenant scoping / RLS). Fetches map the JSONB
 * `data` column back to the domain type; the memory store's localeCompare /
 * timestamp sorts + FK filters are applied in app code so the behaviour is
 * byte-for-byte equivalent.
 */
import { eq } from "drizzle-orm";
import {
  webSecurityControls,
  webControlEvidence,
  webRiskRegister,
  webIncidents,
  webIncidentTimeline,
  webVendors,
  webStatePrivacyRequirements,
  webStatePrivacyMappings,
  webVulnerabilityReports,
} from "@aivo/db";
import type {
  Incident,
  IncidentTimelineEvent,
  RiskRegisterEntry,
  SecurityControl,
  SecurityControlEvidence,
  StatePrivacyControlMapping,
  StatePrivacyRequirement,
  Vendor,
  VulnerabilityReport,
} from "@/lib/db/types";
import type { SecurityStore } from "../types";
import { getDb } from "./client";

export const drizzleSecurity: SecurityStore = {
  async listControls(): Promise<SecurityControl[]> {
    const rows = await getDb().select().from(webSecurityControls);
    return rows
      .map((r) => r.data as SecurityControl)
      .sort((a, b) => a.code.localeCompare(b.code));
  },
  async getControl(id) {
    const [row] = await getDb()
      .select()
      .from(webSecurityControls)
      .where(eq(webSecurityControls.id, id))
      .limit(1);
    return row ? (row.data as SecurityControl) : null;
  },
  async upsertControl(control) {
    await getDb()
      .insert(webSecurityControls)
      .values({ id: control.id, data: control })
      .onConflictDoUpdate({ target: webSecurityControls.id, set: { data: control } });
    return control;
  },
  async listEvidenceForControl(controlId): Promise<SecurityControlEvidence[]> {
    const rows = await getDb()
      .select()
      .from(webControlEvidence)
      .where(eq(webControlEvidence.controlId, controlId));
    return rows
      .map((r) => r.data as SecurityControlEvidence)
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  },
  async upsertEvidence(evidence) {
    await getDb()
      .insert(webControlEvidence)
      .values({ id: evidence.id, controlId: evidence.controlId, data: evidence })
      .onConflictDoUpdate({
        target: webControlEvidence.id,
        set: { controlId: evidence.controlId, data: evidence },
      });
    return evidence;
  },

  async listRisks(): Promise<RiskRegisterEntry[]> {
    const rows = await getDb().select().from(webRiskRegister);
    return rows
      .map((r) => r.data as RiskRegisterEntry)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getRisk(id) {
    const [row] = await getDb()
      .select()
      .from(webRiskRegister)
      .where(eq(webRiskRegister.id, id))
      .limit(1);
    return row ? (row.data as RiskRegisterEntry) : null;
  },
  async upsertRisk(risk) {
    await getDb()
      .insert(webRiskRegister)
      .values({ id: risk.id, data: risk })
      .onConflictDoUpdate({ target: webRiskRegister.id, set: { data: risk } });
    return risk;
  },

  async listIncidents(): Promise<Incident[]> {
    const rows = await getDb().select().from(webIncidents);
    return rows
      .map((r) => r.data as Incident)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getIncident(id) {
    const [row] = await getDb().select().from(webIncidents).where(eq(webIncidents.id, id)).limit(1);
    return row ? (row.data as Incident) : null;
  },
  async upsertIncident(incident) {
    await getDb()
      .insert(webIncidents)
      .values({ id: incident.id, data: incident })
      .onConflictDoUpdate({ target: webIncidents.id, set: { data: incident } });
    return incident;
  },
  async listIncidentTimeline(incidentId): Promise<IncidentTimelineEvent[]> {
    const rows = await getDb()
      .select()
      .from(webIncidentTimeline)
      .where(eq(webIncidentTimeline.incidentId, incidentId));
    return rows
      .map((r) => r.data as IncidentTimelineEvent)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  },
  async appendIncidentTimeline(event) {
    await getDb()
      .insert(webIncidentTimeline)
      .values({ id: event.id, incidentId: event.incidentId, data: event })
      .onConflictDoNothing({ target: webIncidentTimeline.id });
    return event;
  },

  async listVendors(): Promise<Vendor[]> {
    const rows = await getDb().select().from(webVendors);
    return rows.map((r) => r.data as Vendor).sort((a, b) => a.name.localeCompare(b.name));
  },
  async getVendor(id) {
    const [row] = await getDb().select().from(webVendors).where(eq(webVendors.id, id)).limit(1);
    return row ? (row.data as Vendor) : null;
  },
  async upsertVendor(vendor) {
    await getDb()
      .insert(webVendors)
      .values({ id: vendor.id, data: vendor })
      .onConflictDoUpdate({ target: webVendors.id, set: { data: vendor } });
    return vendor;
  },

  async listStatePrivacyRequirements(): Promise<StatePrivacyRequirement[]> {
    const rows = await getDb().select().from(webStatePrivacyRequirements);
    return rows
      .map((r) => r.data as StatePrivacyRequirement)
      .sort((a, b) => a.label.localeCompare(b.label));
  },
  async getStatePrivacyRequirement(id) {
    const [row] = await getDb()
      .select()
      .from(webStatePrivacyRequirements)
      .where(eq(webStatePrivacyRequirements.id, id))
      .limit(1);
    return row ? (row.data as StatePrivacyRequirement) : null;
  },
  async listStatePrivacyMappingsFor(requirementId): Promise<StatePrivacyControlMapping[]> {
    const rows = await getDb()
      .select()
      .from(webStatePrivacyMappings)
      .where(eq(webStatePrivacyMappings.requirementId, requirementId));
    return rows.map((r) => r.data as StatePrivacyControlMapping);
  },
  async getStatePrivacyMapping(id) {
    const [row] = await getDb()
      .select()
      .from(webStatePrivacyMappings)
      .where(eq(webStatePrivacyMappings.id, id))
      .limit(1);
    return row ? (row.data as StatePrivacyControlMapping) : null;
  },
  async upsertStatePrivacyMapping(mapping) {
    await getDb()
      .insert(webStatePrivacyMappings)
      .values({ id: mapping.id, requirementId: mapping.requirementId, data: mapping })
      .onConflictDoUpdate({
        target: webStatePrivacyMappings.id,
        set: { requirementId: mapping.requirementId, data: mapping },
      });
    return mapping;
  },

  async listVulnerabilities(): Promise<VulnerabilityReport[]> {
    const rows = await getDb().select().from(webVulnerabilityReports);
    return rows
      .map((r) => r.data as VulnerabilityReport)
      .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  },
  async getVulnerability(id) {
    const [row] = await getDb()
      .select()
      .from(webVulnerabilityReports)
      .where(eq(webVulnerabilityReports.id, id))
      .limit(1);
    return row ? (row.data as VulnerabilityReport) : null;
  },
  async upsertVulnerability(report) {
    await getDb()
      .insert(webVulnerabilityReports)
      .values({ id: report.id, data: report })
      .onConflictDoUpdate({ target: webVulnerabilityReports.id, set: { data: report } });
    return report;
  },
};
