import type { FastifyInstance } from "fastify";
import { validateLtiLaunch, type LtiLaunchPayload } from "../services/lti13-launch-validator.js";

export function registerLtiRoutes(app: FastifyInstance): void {
  app.post<{
    Body: { payload: LtiLaunchPayload; productionMode?: boolean; trustedIssuers?: string[] };
  }>("/api/lti/validate", async (request, reply) => {
    if (!request.body?.payload) {
      return reply.code(400).send({ error: "payload is required" });
    }
    const result = validateLtiLaunch(request.body.payload, {
      productionMode: request.body.productionMode,
      trustedIssuers: request.body.trustedIssuers
        ? new Set(request.body.trustedIssuers)
        : undefined,
    });
    return result;
  });
}
