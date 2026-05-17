import { buildApp } from "./server.js";

export { buildApp } from "./server.js";
export * from "./services/provider-interface.js";
export * from "./services/rule-based-recognizer.js";
export * from "./services/expression-parser.js";
export * from "./services/geometry-work-analyzer.js";
export * from "./services/stroke-feature-extractor.js";

const PORT = parseInt(process.env.MATH_RECOGNIZER_PORT || "3062", 10);

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
      console.log(`Math recognizer service listening on port ${PORT}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
