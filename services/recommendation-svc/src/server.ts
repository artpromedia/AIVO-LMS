import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { registerRecommendationRoutes, defaultStore } from "./routes/recommendations.js";
import { registerCandidateRoutes } from "./routes/candidates.js";
import { DrizzleRecommendationStore } from "./services/drizzle-recommendation-store.js";
import { ProfileStore, type RecommendationStore } from "./services/recommendation-store.js";
import { createObservationConsumer } from "./services/observation-consumer.js";
import { getRealtimeBus } from "./realtime/bus.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
  /** Inject a store (tests). Defaults to Postgres when DATABASE_URL is set,
   *  else the in-memory default shared by the route modules. */
  store?: RecommendationStore;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "recommendation-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "recommendation-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "recommendation-svc" });
  }

  // Persistence: use Postgres when DATABASE_URL is set so recommendation
  // records survive restarts and are shared across replicas. The in-memory
  // default (shared by both route modules) is dev/test-only and refused in
  // production.
  const databaseUrl = process.env.DATABASE_URL;
  if (!options.store && !databaseUrl && process.env.NODE_ENV === "production") {
    throw new Error(
      "recommendation-svc: DATABASE_URL must be set in production. The in-memory " +
        "store is development-only (recommendations are lost on restart and not " +
        "shared across replicas).",
    );
  }
  const db = databaseUrl ? createDb(databaseUrl) : undefined;
  const store: RecommendationStore | undefined =
    options.store ?? (db ? new DrizzleRecommendationStore(db) : undefined);

  if (store) {
    const profiles = new ProfileStore();
    // The db handle enables durable effect writes (learners / brain_states /
    // learner_profiles) when a recommendation is approved.
    registerRecommendationRoutes(app, { store, profiles, db });
    registerCandidateRoutes(app, { store });
  } else {
    // Shared in-memory default (also used by the test seed/clear helpers).
    registerRecommendationRoutes(app);
    registerCandidateRoutes(app);
  }

  // Caregiver feedback loop (Sprint 5, G1/G2): consume
  // `caregiver.observation.created` from the realtime bus, derive
  // parent-approval recommendations, and persist them into the same store
  // the routes serve. Never applies effects — parent approval is required.
  const effectiveStore: RecommendationStore = store ?? defaultStore;
  const consumer = createObservationConsumer({
    onRecommendations: async (_learnerId, recommendations) => {
      for (const rec of recommendations) {
        try {
          await effectiveStore.create(rec);
        } catch (err) {
          app.log.warn({ err }, "failed to persist observation-derived recommendation");
        }
      }
    },
  });
  const bus = await getRealtimeBus();
  const unsubscribe = await consumer.start(bus);
  app.addHook("onClose", async () => {
    await unsubscribe();
  });

  return app;
}
