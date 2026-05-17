import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/sis-provider-interface.js";
export * from "./services/clever-adapter.js";
export * from "./services/classlink-adapter.js";
export * from "./services/lti13-launch-validator.js";

const PORT = parseInt(process.env.INTEGRATION_PORT || "3068", 10);

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
      console.log(`Integration service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
