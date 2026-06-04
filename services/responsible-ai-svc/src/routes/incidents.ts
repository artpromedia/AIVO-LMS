/**
 * RAI incident routes (Sprint 7).
 *   POST  /api/responsible-ai/incidents        file (platform/district/school)
 *   GET   /api/responsible-ai/incidents        list (scoped)
 *   PATCH /api/responsible-ai/incidents/:id     state transition
 */
import type { FastifyInstance } from "fastify";
import { getStore, newId } from "../registry/store.js";
import type { IncidentSeverity, IncidentState, RaiIncident } from "../registry/types.js";
import { actorOf, canFileIncident, isPlatform, deny } from "../registry/rbac.js";
import { emitRegistryAudit } from "../lib/registry-audit.js";

const STATES: IncidentState[] = ["open", "investigating", "mitigated", "resolved", "closed"];
const SEVERITIES: IncidentSeverity[] = ["sev1", "sev2", "sev3", "sev4"];

export function registerIncidentRoutes(app: FastifyInstance): void {
  const base = "/api/responsible-ai/incidents";

  app.get(base, async (request) => {
    const store = getStore();
    const actor = actorOf(request);
    let incidents = [...store.incidents.values()];
    // Non-platform admins only see incidents for their own tenant (or
    // tenant-agnostic platform incidents they filed).
    if (!isPlatform(actor)) {
      incidents = incidents.filter(
        (i) => i.tenantId === actor.tenantId || i.reportedBy === actor.actorId,
      );
    }
    incidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { incidents };
  });

  app.post<{ Body: Partial<RaiIncident> }>(base, async (request, reply) => {
    const actor = actorOf(request);
    if (!canFileIncident(actor)) return deny(reply);
    const b = request.body ?? {};
    if (!b.title || !b.description) {
      return reply.code(400).send({ error: "title and description are required" });
    }
    const severity = SEVERITIES.includes(b.severity as IncidentSeverity)
      ? (b.severity as IncidentSeverity)
      : "sev3";
    const now = new Date().toISOString();
    const store = getStore();
    const incident: RaiIncident = {
      id: newId("rai-inc"),
      modelId: b.modelId ?? null,
      // Non-platform actors can only file against their own tenant.
      tenantId: isPlatform(actor) ? (b.tenantId ?? null) : (actor.tenantId ?? null),
      title: b.title,
      description: b.description,
      severity,
      state: "open",
      reportedBy: actor.actorId ?? "unknown",
      reportedByRole: actor.role ?? "unknown",
      timeline: [
        { at: now, actor: actor.actorId ?? "unknown", state: "open", note: "Incident filed." },
      ],
      createdAt: now,
      updatedAt: now,
    };
    store.incidents.set(incident.id, incident);
    await emitRegistryAudit(request, "RAI_INCIDENT_CREATED", incident.id, {
      severity,
      modelId: incident.modelId,
    });
    return reply.code(201).send({ incident });
  });

  app.patch<{ Params: { id: string }; Body: { state?: IncidentState; note?: string } }>(
    `${base}/:id`,
    async (request, reply) => {
      const actor = actorOf(request);
      if (!canFileIncident(actor)) return deny(reply);
      const store = getStore();
      const incident = store.incidents.get(request.params.id);
      if (!incident) return reply.code(404).send({ error: "Incident not found" });
      if (
        !isPlatform(actor) &&
        incident.tenantId !== actor.tenantId &&
        incident.reportedBy !== actor.actorId
      ) {
        return deny(reply);
      }
      const b = request.body ?? {};
      const nextState = b.state && STATES.includes(b.state) ? b.state : incident.state;
      const now = new Date().toISOString();
      incident.timeline.push({
        at: now,
        actor: actor.actorId ?? "unknown",
        state: nextState,
        note: b.note ?? `State → ${nextState}`,
      });
      incident.state = nextState;
      incident.updatedAt = now;
      store.incidents.set(incident.id, incident);
      await emitRegistryAudit(request, "RAI_INCIDENT_UPDATED", incident.id, { state: nextState });
      return { incident };
    },
  );
}
