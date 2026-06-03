/**
 * In-memory SLO + observed-events store for alerts-proxy-svc (Sprint 8).
 * Authoritative schema in src/db/migrations/*.sql. Seeded for demo/tests.
 */
import { randomUUID } from "node:crypto";
import type { SloDefinition } from "./slo-math.js";

export interface ObservedWindow {
  service: string;
  tenantId: string | null;
  goodEvents: number;
  badEvents: number;
}

export interface SloStore {
  slos: Map<string, SloDefinition>;
  /** keyed by `${service}|${tenantId ?? ""}` */
  observed: Map<string, ObservedWindow>;
}

export function sloId(): string {
  return `slo_${randomUUID().slice(0, 12)}`;
}

function obsKey(service: string, tenantId: string | null): string {
  return `${service}|${tenantId ?? ""}`;
}

export function createSeededSloStore(): SloStore {
  const store: SloStore = { slos: new Map(), observed: new Map() };
  const now = new Date().toISOString();

  const slos: SloDefinition[] = [
    {
      id: "slo-api-availability",
      service: "api-gateway",
      tenantId: null,
      name: "API availability",
      target: 0.999,
      windowDays: 30,
      indicatorQuery: 'sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "slo-tutor-latency",
      service: "tutor-svc",
      tenantId: null,
      name: "Tutor latency < 2s",
      target: 0.99,
      windowDays: 30,
      indicatorQuery: 'sum(rate(http_request_duration_seconds_bucket{le="2"}[5m])) / sum(rate(http_request_duration_seconds_count[5m]))',
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const s of slos) store.slos.set(s.id, s);

  // Observed windows: api healthy, tutor lightly burning, one tenant worse.
  const observed: ObservedWindow[] = [
    { service: "api-gateway", tenantId: null, goodEvents: 9_998_000, badEvents: 2_000 },
    { service: "tutor-svc", tenantId: null, goodEvents: 990_000, badEvents: 10_000 },
    { service: "tutor-svc", tenantId: "tenant-springfield", goodEvents: 49_000, badEvents: 1_000 },
  ];
  for (const o of observed) store.observed.set(obsKey(o.service, o.tenantId), o);

  return store;
}

let singleton: SloStore | null = null;
export function getSloStore(): SloStore {
  if (!singleton) singleton = createSeededSloStore();
  return singleton;
}
export function resetSloStore(): SloStore {
  singleton = createSeededSloStore();
  return singleton;
}

export function observedFor(
  store: SloStore,
  service: string,
  tenantId: string | null,
): ObservedWindow {
  return (
    store.observed.get(obsKey(service, tenantId)) ?? {
      service,
      tenantId,
      goodEvents: 0,
      badEvents: 0,
    }
  );
}
