/**
 * Status-page domain types (Sprint 8).
 *
 * Models a Statuspage/Incident.io-style system: components with
 * dependencies, incidents with a lifecycle and an updates feed, scheduled
 * maintenance windows, and subscribers (email/webhook/RSS). The public
 * summary is computed from components + active incidents + maintenances.
 */

export type ComponentStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";

export interface StatusComponent {
  id: string;
  name: string;
  description: string;
  group: string;
  status: ComponentStatus;
  /** Component ids this component depends on (status rolls up). */
  dependsOn: string[];
  /** Tenants impacted when this component degrades; empty = all. */
  affectedTenants: string[];
  order: number;
  updatedAt: string;
}

export type IncidentLifecycle = "investigating" | "identified" | "monitoring" | "resolved";
export type IncidentImpact = "none" | "minor" | "major" | "critical";

export interface StatusIncident {
  id: string;
  title: string;
  lifecycle: IncidentLifecycle;
  impact: IncidentImpact;
  affectedComponentIds: string[];
  affectedTenants: string[];
  postmortemUrl: string | null;
  createdBy: string;
  /** Set when an alert auto-opened this incident. */
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  lifecycle: IncidentLifecycle;
  body: string;
  author: string;
  createdAt: string;
}

export type MaintenanceState = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface Maintenance {
  id: string;
  title: string;
  description: string;
  componentIds: string[];
  state: MaintenanceState;
  scheduledStart: string;
  scheduledEnd: string;
  /** Minutes before start to notify subscribers. */
  notifyLeadMinutes: number;
  createdBy: string;
  createdAt: string;
}

export type SubscriberChannel = "email" | "webhook" | "rss";

export interface Subscriber {
  id: string;
  channel: SubscriberChannel;
  /** Email address, webhook URL, or "rss" marker. */
  target: string;
  /** Optional component filter; empty = all. */
  componentIds: string[];
  tenantId: string | null;
  createdAt: string;
}
