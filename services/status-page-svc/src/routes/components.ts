/**
 * Component & dependency CRUD (Sprint 8). Platform-admin only for writes.
 *   GET    /api/statuspage/components
 *   POST   /api/statuspage/components
 *   PATCH  /api/statuspage/components/:id
 *   DELETE /api/statuspage/components/:id
 */
import type { FastifyInstance } from "fastify";
import { getStatusStore, spId, effectiveComponentStatus } from "../statuspage/store.js";
import type { StatusComponent } from "../statuspage/types.js";
import { requirePlatformAdmin } from "../statuspage/rbac.js";
import { emitStatusAudit } from "../statuspage/audit.js";

export function registerComponentRoutes(app: FastifyInstance): void {
  const base = "/api/statuspage/components";

  app.get(base, async () => {
    const store = getStatusStore();
    const components = [...store.components.values()]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c, effectiveStatus: effectiveComponentStatus(store, c.id) }));
    return { components };
  });

  app.post<{ Body: Partial<StatusComponent> }>(
    base,
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const b = request.body ?? {};
      if (!b.name) return reply.code(400).send({ error: "name is required" });
      const store = getStatusStore();
      const component: StatusComponent = {
        id: spId("comp"),
        name: b.name,
        description: b.description ?? "",
        group: b.group ?? "General",
        status: b.status ?? "operational",
        dependsOn: b.dependsOn ?? [],
        affectedTenants: b.affectedTenants ?? [],
        order: b.order ?? store.components.size + 1,
        updatedAt: new Date().toISOString(),
      };
      store.components.set(component.id, component);
      await emitStatusAudit(request, "STATUS_COMPONENT_CHANGED", component.id, { op: "create" });
      return reply.code(201).send({ component });
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<StatusComponent> }>(
    `${base}/:id`,
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const store = getStatusStore();
      const existing = store.components.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: "Component not found" });
      const b = request.body ?? {};
      const updated: StatusComponent = {
        ...existing,
        name: b.name ?? existing.name,
        description: b.description ?? existing.description,
        group: b.group ?? existing.group,
        status: b.status ?? existing.status,
        dependsOn: b.dependsOn ?? existing.dependsOn,
        affectedTenants: b.affectedTenants ?? existing.affectedTenants,
        order: b.order ?? existing.order,
        updatedAt: new Date().toISOString(),
      };
      store.components.set(updated.id, updated);
      await emitStatusAudit(request, "STATUS_COMPONENT_CHANGED", updated.id, {
        op: "update",
        status: updated.status,
      });
      return { component: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    `${base}/:id`,
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const store = getStatusStore();
      if (!store.components.delete(request.params.id)) {
        return reply.code(404).send({ error: "Component not found" });
      }
      await emitStatusAudit(request, "STATUS_COMPONENT_CHANGED", request.params.id, {
        op: "delete",
      });
      return { removed: true };
    },
  );
}
