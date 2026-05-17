import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/types.js";
export * from "./services/recommendation-policy.js";
export * from "./services/recommendation-generator.js";
export * from "./services/recommendation-effect-handlers.js";
export * from "./services/recommendation-audit.js";
export {
  seedRecommendationForTest,
  getProfileForTest,
  clearRecommendationStoreForTest,
} from "./routes/recommendations.js";

const PORT = parseInt(process.env.RECOMMENDATION_PORT || "3066", 10);

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
      console.log(`Recommendation service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
