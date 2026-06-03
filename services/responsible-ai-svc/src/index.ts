import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export { evaluateAll } from "./routes/evaluate.js";
export * from "./services/types.js";
export * from "./services/prompt-injection-detector.js";
export * from "./services/profile-adherence-evaluator.js";
export * from "./services/homework-integrity-evaluator.js";
export * from "./services/age-appropriateness-evaluator.js";
export * from "./services/surface-requirement-evaluator.js";
export * from "./services/escalation-policy.js";
// Responsible AI Console (Sprint 7).
export * from "./registry/types.js";
export { resolveEffectivePolicy } from "./registry/policy-resolution.js";
export { runEvalHarness } from "./registry/eval-harness.js";
export { createSeededStore, getStore, resetStore } from "./registry/store.js";
export { createRaiGateway } from "./lib/rai-gateway.js";
export type { RaiGateway, RaiGatewayOptions, RaiDecision } from "./lib/rai-gateway.js";

const PORT = parseInt(process.env.RESPONSIBLE_AI_PORT || "3071", 10);

const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  buildApp()
    .then((app) => app.listen({ port: PORT, host: "0.0.0.0" }))
    .then(() => {
      console.log(`Responsible AI service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
