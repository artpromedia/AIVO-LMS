/**
 * In-memory SecurityStore — wraps the security/SOC2/privacy Maps. Test-only
 * reference semantics the drizzle adapter must match: controls sort by code;
 * evidence newest-collected first; risks by updatedAt desc; incidents by
 * createdAt desc; timeline by occurredAt asc; requirements by label;
 * vulnerabilities by discoveredAt desc.
 */
import { getStore } from "@/lib/db/store";
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

export const memorySecurity: SecurityStore = {
  async listControls(): Promise<SecurityControl[]> {
    return Array.from(getStore().securityControls.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  },
  async getControl(id) {
    return getStore().securityControls.get(id) ?? null;
  },
  async upsertControl(control) {
    getStore().securityControls.set(control.id, control);
    return control;
  },
  async listEvidenceForControl(controlId): Promise<SecurityControlEvidence[]> {
    return Array.from(getStore().securityControlEvidence.values())
      .filter((e) => e.controlId === controlId)
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  },
  async upsertEvidence(evidence) {
    getStore().securityControlEvidence.set(evidence.id, evidence);
    return evidence;
  },

  async listRisks(): Promise<RiskRegisterEntry[]> {
    return Array.from(getStore().riskRegister.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  },
  async getRisk(id) {
    return getStore().riskRegister.get(id) ?? null;
  },
  async upsertRisk(risk) {
    getStore().riskRegister.set(risk.id, risk);
    return risk;
  },

  async listIncidents(): Promise<Incident[]> {
    return Array.from(getStore().incidents.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
  async getIncident(id) {
    return getStore().incidents.get(id) ?? null;
  },
  async upsertIncident(incident) {
    getStore().incidents.set(incident.id, incident);
    return incident;
  },
  async listIncidentTimeline(incidentId): Promise<IncidentTimelineEvent[]> {
    return Array.from(getStore().incidentTimelineEvents.values())
      .filter((e) => e.incidentId === incidentId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  },
  async appendIncidentTimeline(event) {
    getStore().incidentTimelineEvents.set(event.id, event);
    return event;
  },

  async listVendors(): Promise<Vendor[]> {
    return Array.from(getStore().vendors.values()).sort((a, b) => a.name.localeCompare(b.name));
  },
  async getVendor(id) {
    return getStore().vendors.get(id) ?? null;
  },
  async upsertVendor(vendor) {
    getStore().vendors.set(vendor.id, vendor);
    return vendor;
  },

  async listStatePrivacyRequirements(): Promise<StatePrivacyRequirement[]> {
    return Array.from(getStore().statePrivacyRequirements.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  },
  async getStatePrivacyRequirement(id) {
    return getStore().statePrivacyRequirements.get(id) ?? null;
  },
  async listStatePrivacyMappingsFor(requirementId): Promise<StatePrivacyControlMapping[]> {
    return Array.from(getStore().statePrivacyMappings.values()).filter(
      (m) => m.requirementId === requirementId,
    );
  },
  async getStatePrivacyMapping(id) {
    return getStore().statePrivacyMappings.get(id) ?? null;
  },
  async upsertStatePrivacyMapping(mapping) {
    getStore().statePrivacyMappings.set(mapping.id, mapping);
    return mapping;
  },

  async listVulnerabilities(): Promise<VulnerabilityReport[]> {
    return Array.from(getStore().vulnerabilityReports.values()).sort((a, b) =>
      b.discoveredAt.localeCompare(a.discoveredAt),
    );
  },
  async getVulnerability(id) {
    return getStore().vulnerabilityReports.get(id) ?? null;
  },
  async upsertVulnerability(report) {
    getStore().vulnerabilityReports.set(report.id, report);
    return report;
  },
};
