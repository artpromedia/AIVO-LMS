import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./registry/index.js";
export { validateParams, prepareRun, executeRun } from "./runners/engine.js";
export { encodeCsv, encodeJson, encodeParquet } from "./runners/formats.js";
export { captureLineage, reportVersion } from "./lineage.js";
export {
  getStore,
  resetStore,
  createStore,
  cacheKeyOf,
  incrementQuota,
  quotaUsage,
  DAILY_QUOTA,
} from "./store.js";
export { resolveCallerScope } from "./scope.js";

const PORT = parseInt(process.env.REPORTS_SVC_PORT || "3018", 10);

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
      console.log(`Reports service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
