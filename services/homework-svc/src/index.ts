import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/homework-step-engine.js";
export * from "./services/homework-profile-adapter.js";
export * from "./services/focus-monitor.js";
export * from "./services/self-regulation-recommender.js";
export * from "./services/homework-ocr.js";

const PORT = parseInt(process.env.HOMEWORK_PORT || "3065", 10);

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
      console.log(`Homework service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
