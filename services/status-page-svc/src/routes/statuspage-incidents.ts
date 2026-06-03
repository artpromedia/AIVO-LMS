/**
 * Incident lifecycle management (Sprint 8).
 * Lifecycle: investigating → identified → monitoring → resolved.
 *   GET   /api/statuspage/incidents
 *   GET   /api/statuspage/incidents/:id
 *   POST  /api/statuspage/incidents              (platform only)
 *   PATCH /api/statuspage/incidents/:id          (platform only — lifecycle/postmortem)
 *
 * Creating an incident records an opening update; PATCHing the lifecycle
 * appends an update so the feed always mirrors state transitions.
 */
import type { FastifyInstance } from "fastify";
import { getStatusStore, spId } from "../statuspage/store.js";
import type { IncidentLifecycle, IncidentUpdate, StatusIncident } from "../statuspage/types.js";
import { requirePlatformAdmin } from "../statuspage/rbac.js";
import { emitStatusAudit } from "../statuspage/audit.js";

const LIFECYCLE: IncidentLifecycle[] = ["investigating", "identified", "monitoring", "resolved"];

export function appendUpdate(
  incidentId: string,
  lifecycle: IncidentLifecycle,
  body: string,
  author: string,
): IncidentUpdate {
  const store = getStatusStore();
  const update: IncidentUpdate = {
    id: spId("upd"),
    incidentId,
    lifecycle,
    body,
    author,
    createdAt: new Date().toISOString(),
  };
  store.updates.set(update.id, update);
  return update;
}

export function registerStatusIncidentRoutes(app: FastifyInstance): void {
  const base = "/api/statuspage/incidents";

  app.get<{ Querystring: { active?: string } }>(base, async (request) => {
    const store = getStatusStore();
    let incidents = [...store.incidents.values()];
    if (request.query.active === "true") {
      incidents = incidents.filter((i) => i.lifecycle !== "resolved");
    }
    incidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { incidents, total: incidents.length };
  });

  app.get<{ Params: { id: string } }>(`${base}/:id`, async (request, reply) => {
    const store = getStatusStore();
    const incident = store.incidents.get(request.params.id);
    if (!incident) return reply.code(404).send({ error: "Incident not found" });
    const updates = [...store.updates.values()]
      .filter((u) => u.incidentId === incident.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { incident, updates };
  });

  app.post<{ Body: Partial<StatusIncident> & { message?: string } }>(
    base,
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const b = request.body ?? {};
      if (!b.title) return reply.code(400).send({ error: "title is required" });
      const store = getStatusStore();
      const now = new Date().toISOString();
      const incident: StatusIncident = {
        id: spId("inc"),
        title: b.title,
        lifecycle: "investigating",
        impact: b.impact ?? "minor",
        affectedComponentIds: b.affectedComponentIds ?? [],
        affectedTenants: b.affectedTenants ?? [],
        postmortemUrl: b.postmortemUrl ?? null,
        createdBy: (request as any).actorRole ?? "platform_admin",
        autoCreated: false,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      };
      store.incidents.set(incident.id, incident);
      appendUpdate(
        incident.id,
        "investigating",
        b.message ?? `Investigating: ${incident.title}`,
        incident.createdBy,
      );
      // Flip affected components to a degraded state for the public page.
      for (const cid of incident.affectedComponentIds) {
        const c = store.components.get(cid);
        if (c && c.status === "operational") {
          c.status = incident.impact === "critical" ? "major_outage" : "degraded_performance";
          c.updatedAt = now;
        }
      }
      await emitStatusAudit(request, "STATUS_INCIDENT_DECLARED", incident.id, {
        impact: incident.impact,
        components: incident.affectedComponentIds,
      });
      return reply.code(201).send({ incident });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { lifecycle?: IncidentLifecycle; message?: string; postmortemUrl?: string };
  }>(`${base}/:id`, { preHandler: requirePlatformAdmin() }, async (request, reply) => {
    const store = getStatusStore();
    const incident = store.incidents.get(request.params.id);
    if (!incident) return reply.code(404).send({ error: "Incident not found" });
    const b = request.body ?? {};
    const now = new Date().toISOString();

    if (b.lifecycle && LIFECYCLE.includes(b.lifecycle)) {
      incident.lifecycle = b.lifecycle;
      if (b.lifecycle === "resolved") {
        incident.resolvedAt = now;
        // Restore affected components.
        for (const cid of incident.affectedComponentIds) {
          const c = store.components.get(cid);
          if (c) {
            c.status = "operational";
            c.updatedAt = now;
          }
        }
      }
    }
    if (b.postmortemUrl !== undefined) incident.postmortemUrl = b.postmortemUrl;
    incident.updatedAt = now;
    store.incidents.set(incident.id, incident);

    const update = appendUpdate(
      incident.id,
      incident.lifecycle,
      b.message ?? `Status → ${incident.lifecycle}`,
      (request as any).actorRole ?? "platform_admin",
    );
    await emitStatusAudit(request, "STATUS_INCIDENT_UPDATED", incident.id, {
      lifecycle: incident.lifecycle,
    });
    return { incident, update };
  });
}
