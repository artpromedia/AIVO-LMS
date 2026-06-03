/**
 * In-memory status-page store with deterministic seed data.
 *
 * The authoritative schema lives in src/db/migrations/*.sql. Seeds give the
 * public page and admin console demoable content without a database.
 */
import { randomUUID } from "node:crypto";
import type {
  IncidentUpdate,
  Maintenance,
  StatusComponent,
  StatusIncident,
  Subscriber,
} from "./types.js";

export interface StatusPageStore {
  components: Map<string, StatusComponent>;
  incidents: Map<string, StatusIncident>;
  updates: Map<string, IncidentUpdate>;
  maintenances: Map<string, Maintenance>;
  subscribers: Map<string, Subscriber>;
}

export function spId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

function ago(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}
function ahead(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

export function createSeededStatusStore(): StatusPageStore {
  const store: StatusPageStore = {
    components: new Map(),
    incidents: new Map(),
    updates: new Map(),
    maintenances: new Map(),
    subscribers: new Map(),
  };

  const components: StatusComponent[] = [
    {
      id: "comp-api",
      name: "API Gateway",
      description: "Public BFF + API edge",
      group: "Core",
      status: "operational",
      dependsOn: [],
      affectedTenants: [],
      order: 1,
      updatedAt: ago(120),
    },
    {
      id: "comp-identity",
      name: "Identity & SSO",
      description: "Auth, SSO, SCIM",
      group: "Core",
      status: "operational",
      dependsOn: ["comp-api"],
      affectedTenants: [],
      order: 2,
      updatedAt: ago(120),
    },
    {
      id: "comp-tutor",
      name: "AI Tutor",
      description: "Conversational tutoring",
      group: "Learning",
      status: "operational",
      dependsOn: ["comp-api", "comp-identity"],
      affectedTenants: [],
      order: 3,
      updatedAt: ago(30),
    },
    {
      id: "comp-assessment",
      name: "Assessment",
      description: "Baseline + formative assessment",
      group: "Learning",
      status: "operational",
      dependsOn: ["comp-api"],
      affectedTenants: ["tenant-springfield"],
      order: 4,
      updatedAt: ago(30),
    },
    {
      id: "comp-billing",
      name: "Billing",
      description: "Subscriptions & invoicing",
      group: "Platform",
      status: "operational",
      dependsOn: ["comp-api"],
      affectedTenants: [],
      order: 5,
      updatedAt: ago(200),
    },
  ];
  for (const c of components) store.components.set(c.id, c);

  // One resolved historical incident for the public timeline.
  const inc: StatusIncident = {
    id: "inc-seed-1",
    title: "Elevated tutor latency",
    lifecycle: "resolved",
    impact: "minor",
    affectedComponentIds: ["comp-tutor"],
    affectedTenants: [],
    postmortemUrl: "https://status.aivo.example/postmortems/inc-seed-1",
    createdBy: "platform_admin",
    autoCreated: false,
    createdAt: ago(2880),
    updatedAt: ago(2760),
    resolvedAt: ago(2760),
  };
  store.incidents.set(inc.id, inc);
  for (const [i, u] of (
    [
      ["investigating", "We are investigating elevated latency on the AI Tutor."],
      ["identified", "A slow downstream dependency was identified."],
      ["monitoring", "A fix has been deployed; we are monitoring."],
      ["resolved", "The incident is resolved. Postmortem to follow."],
    ] as const
  ).entries()) {
    const update: IncidentUpdate = {
      id: spId("upd"),
      incidentId: inc.id,
      lifecycle: u[0],
      body: u[1],
      author: "platform_admin",
      createdAt: ago(2880 - i * 30),
    };
    store.updates.set(update.id, update);
  }

  store.maintenances.set("mnt-seed-1", {
    id: "mnt-seed-1",
    title: "Database failover drill",
    description: "Routine HA failover test; brief read-only window possible.",
    componentIds: ["comp-billing"],
    state: "scheduled",
    scheduledStart: ahead(1440),
    scheduledEnd: ahead(1500),
    notifyLeadMinutes: 60,
    createdBy: "platform_admin",
    createdAt: ago(60),
  });

  return store;
}

let singleton: StatusPageStore | null = null;
export function getStatusStore(): StatusPageStore {
  if (!singleton) singleton = createSeededStatusStore();
  return singleton;
}
export function resetStatusStore(): StatusPageStore {
  singleton = createSeededStatusStore();
  return singleton;
}

const STATUS_RANK: Record<string, number> = {
  operational: 0,
  under_maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
};

/**
 * Roll a component's effective status up through its dependencies: a
 * component is at least as degraded as its worst dependency.
 */
export function effectiveComponentStatus(
  store: StatusPageStore,
  componentId: string,
  seen = new Set<string>(),
): string {
  const c = store.components.get(componentId);
  if (!c || seen.has(componentId)) return "operational";
  seen.add(componentId);
  let worst = c.status as string;
  for (const dep of c.dependsOn) {
    const depStatus = effectiveComponentStatus(store, dep, seen);
    if ((STATUS_RANK[depStatus] ?? 0) > (STATUS_RANK[worst] ?? 0)) worst = depStatus;
  }
  return worst;
}

export function overallStatus(store: StatusPageStore): string {
  let worst = "operational";
  for (const c of store.components.keys()) {
    const s = effectiveComponentStatus(store, c);
    if ((STATUS_RANK[s] ?? 0) > (STATUS_RANK[worst] ?? 0)) worst = s;
  }
  return worst;
}
