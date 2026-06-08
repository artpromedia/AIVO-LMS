/**
 * Drizzle-backed CollaborationStore — collaborator insights + accepted
 * members, over the web_collaborator_* tables (0072). Mirrors the memory
 * store: newest-first insights, accepted-only members, tenant scoping.
 *
 * web_collaborator_* carry RLS tenant_isolation policies (0072) keyed on
 * the GUC app.current_tenant, so every statement runs inside
 * withTenantContext (Sprint 1) — passthrough in memory mode, a tenant-
 * scoped transaction in postgres.
 */
import { and, desc, eq } from "drizzle-orm";
import { webCollaboratorInsights, webCollaboratorMembers } from "@aivo/db";
import type { CollaboratorInsight, CollaboratorMember } from "@/lib/db/types";
import type { CollaborationStore } from "../types";
import { getDb, withTenantContext } from "./client";

export const drizzleCollaboration: CollaborationStore = {
  async addInsight(insight: CollaboratorInsight) {
    return withTenantContext(insight.tenantId, async () => {
      await getDb()
        .insert(webCollaboratorInsights)
        .values({
          id: insight.id,
          learnerId: insight.learnerId,
          tenantId: insight.tenantId,
          data: insight,
        })
        .onConflictDoUpdate({
          target: webCollaboratorInsights.id,
          set: { learnerId: insight.learnerId, tenantId: insight.tenantId, data: insight },
        });
      return insight;
    });
  },

  async listInsightsForLearner(learnerId, tenantId) {
    return withTenantContext(tenantId, async () => {
      const rows = await getDb()
        .select()
        .from(webCollaboratorInsights)
        .where(
          and(
            eq(webCollaboratorInsights.learnerId, learnerId),
            eq(webCollaboratorInsights.tenantId, tenantId),
          ),
        );
      const insights = rows.map((r) => r.data as CollaboratorInsight);
      return insights.sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      );
    });
  },

  async upsertMember(member: CollaboratorMember) {
    return withTenantContext(member.tenantId, async () => {
      await getDb()
        .insert(webCollaboratorMembers)
        .values({
          id: member.id,
          learnerId: member.learnerId,
          tenantId: member.tenantId,
          data: member,
        })
        .onConflictDoUpdate({
          target: webCollaboratorMembers.id,
          set: { learnerId: member.learnerId, tenantId: member.tenantId, data: member },
        });
      return member;
    });
  },

  async listAcceptedMembers(learnerId, tenantId) {
    return withTenantContext(tenantId, async () => {
      const rows = await getDb()
        .select()
        .from(webCollaboratorMembers)
        .where(
          and(
            eq(webCollaboratorMembers.learnerId, learnerId),
            eq(webCollaboratorMembers.tenantId, tenantId),
          ),
        )
        .orderBy(desc(webCollaboratorMembers.id));
      return rows
        .map((r) => r.data as CollaboratorMember)
        .filter((m) => m.status === "accepted");
    });
  },
};
