import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/science-reasoning-analyzer.js";
export * from "./services/classification-analyzer.js";
export * from "./services/sequence-analyzer.js";

const PORT = parseInt(process.env.SCIENCE_SOLVER_PORT || "3063", 10);

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
      console.log(`Science solver service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
