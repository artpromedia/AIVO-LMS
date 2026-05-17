import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/export-builder.js";
export * from "./services/deletion-workflow.js";
export * from "./services/dpa-store.js";
export * from "./services/retention-policy.js";

const PORT = parseInt(process.env.DATA_GOVERNANCE_PORT || "3070", 10);

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
      console.log(`Data governance service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
