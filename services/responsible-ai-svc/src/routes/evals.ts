/**
 * Evaluation routes (Sprint 7).
 *   GET  /api/responsible-ai/evals?modelId=...        list runs
 *   POST /api/responsible-ai/evals/:modelId/run       kick harness (platform only)
 *   GET  /api/responsible-ai/evals/:runId             run results w/ per-metric breakdown
 */
import type { FastifyInstance } from "fastify";
import { getRegistryRepository } from "../registry/repository.js";
import type { EvalHarness } from "../registry/types.js";
import { runEvalHarness } from "../registry/eval-harness.js";
import { actorOf, canRunEvals, deny } from "../registry/rbac.js";
import { emitRegistryAudit } from "../lib/registry-audit.js";

const VALID_HARNESSES: EvalHarness[] = [
  "safety-suite",
  "accuracy-suite",
  "bias-suite",
  "full-suite",
];

export function registerEvalRoutes(app: FastifyInstance): void {
  const base = "/api/responsible-ai/evals";

  app.get<{ Querystring: { modelId?: string } }>(base, async (request) => {
    const repo = getRegistryRepository();
    const runs = await repo.listEvalRuns(request.query.modelId);
    runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    // Summary view omits per-case detail.
    return { runs: runs.map(({ cases, ...rest }) => ({ ...rest, caseCount: cases.length })) };
  });

  app.post<{ Params: { modelId: string }; Body: { harness?: EvalHarness } }>(
    `${base}/:modelId/run`,
    async (request, reply) => {
      const actor = actorOf(request);
      if (!canRunEvals(actor)) return deny(reply);
      const repo = getRegistryRepository();
      const model = await repo.getModel(request.params.modelId);
      if (!model) return reply.code(404).send({ error: "Model not found" });
      const harness = request.body?.harness ?? "full-suite";
      if (!VALID_HARNESSES.includes(harness)) {
        return reply
          .code(400)
          .send({ error: `harness must be one of ${VALID_HARNESSES.join(", ")}` });
      }
      const run = runEvalHarness(model.id, harness, actor.actorId ?? "platform_admin");
      await repo.upsertEvalRun(run);
      await emitRegistryAudit(request, "RAI_EVAL_RUN", run.id, {
        modelId: model.id,
        harness,
        status: run.status,
      });
      return reply.code(201).send({ run });
    },
  );

  app.get<{ Params: { runId: string } }>(`${base}/:runId`, async (request, reply) => {
    const repo = getRegistryRepository();
    const run = await repo.getEvalRun(request.params.runId);
    if (!run) return reply.code(404).send({ error: "Run not found" });
    return { run };
  });
}
