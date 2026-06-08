/**
 * Usage routes (Sprint 7).
 *   GET /api/responsible-ai/usage?modelId=...&tenantId=...&range=7d
 * Aggregates calls, tokens and cost over the requested range.
 */
import type { FastifyInstance } from "fastify";
import { getRegistryRepository } from "../registry/repository.js";
import { actorOf, isPlatform } from "../registry/rbac.js";

function rangeToDays(range: string | undefined): number {
  const m = /^(\d+)d$/.exec(range ?? "7d");
  return m ? Math.min(Number(m[1]), 90) : 7;
}

export function registerUsageRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { modelId?: string; tenantId?: string; range?: string } }>(
    "/api/responsible-ai/usage",
    async (request) => {
      const repo = getRegistryRepository();
      const actor = actorOf(request);
      const days = rangeToDays(request.query.range);
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

      const usage = await repo.listUsage();
      let rows = usage.filter((u) => u.date >= cutoff);
      if (request.query.modelId) rows = rows.filter((u) => u.modelId === request.query.modelId);
      // Non-platform admins are pinned to their own tenant.
      const tenantFilter = isPlatform(actor) ? request.query.tenantId : actor.tenantId;
      if (tenantFilter) rows = rows.filter((u) => u.tenantId === tenantFilter);

      const totals = rows.reduce(
        (acc, u) => {
          acc.calls += u.calls;
          acc.tokens += u.tokens;
          acc.costUsd += u.costUsd;
          return acc;
        },
        { calls: 0, tokens: 0, costUsd: 0 },
      );
      totals.costUsd = Number(totals.costUsd.toFixed(2));

      // Daily series for sparkline rendering.
      const byDate = new Map<string, { calls: number; tokens: number; costUsd: number }>();
      for (const u of rows) {
        const e = byDate.get(u.date) ?? { calls: 0, tokens: 0, costUsd: 0 };
        e.calls += u.calls;
        e.tokens += u.tokens;
        e.costUsd += u.costUsd;
        byDate.set(u.date, e);
      }
      const series = [...byDate.entries()]
        .map(([date, v]) => ({ date, ...v, costUsd: Number(v.costUsd.toFixed(2)) }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totals, series, rangeDays: days };
    },
  );
}
