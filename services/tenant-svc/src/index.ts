import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/tenant-policy.js";
export * from "./services/roster-importer.js";

const PORT = parseInt(process.env.TENANT_PORT || "3067", 10);

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
      console.log(`Tenant service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
