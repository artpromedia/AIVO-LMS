/**
 * Caregiver-observation consumer (Sprint 5, G1/G2).
 *
 * Subscribes to the `caregiver.observation.created` event on the realtime
 * bus (NATS, or in-process in single-process dev/CI). It keeps a short
 * rolling per-learner window of observations, runs them through the
 * observation-signal-transformer + recommendation generator, and emits any
 * NEW PENDING parent-approval recommendations (deduped per learner+type).
 *
 * This is the consumer end of the loop family-svc publishes into; recommendations
 * are never applied here — they require parent approval downstream.
 */
import { EVENTS, type CaregiverObservationCreatedPayload } from "@aivo/events";
import {
  transformObservationsToSignals,
  type CaregiverObservationInput,
} from "./observation-signal-transformer.js";
import { generateRecommendations } from "./recommendation-generator.js";
import type { ProfileRecommendation } from "./types.js";
import type { RealtimeBus, Unsubscribe } from "../realtime/bus.js";

interface WindowEntry {
  observedAtMs: number;
  obs: CaregiverObservationInput;
}

export interface ObservationConsumerOptions {
  /** How long an observation stays in the corroboration window. Default 14 days. */
  windowMs?: number;
  /** Max observations retained per learner. Default 50. */
  maxPerLearner?: number;
  /** Called with newly-generated PENDING recommendations for a learner. */
  onRecommendations: (
    learnerId: string,
    recommendations: ProfileRecommendation[],
  ) => void | Promise<void>;
}

export interface ObservationConsumer {
  /** Handle one observation event (exposed for tests). */
  handle(payload: unknown): Promise<void>;
  /** Subscribe to the bus; returns an unsubscribe handle. */
  start(bus: RealtimeBus): Promise<Unsubscribe>;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function createObservationConsumer(opts: ObservationConsumerOptions): ObservationConsumer {
  const windowMs = opts.windowMs ?? 14 * DAY_MS;
  const maxPerLearner = opts.maxPerLearner ?? 50;
  const windows = new Map<string, WindowEntry[]>();
  const emittedTypes = new Map<string, Set<string>>();

  async function handle(payload: unknown): Promise<void> {
    const ev = payload as CaregiverObservationCreatedPayload | null;
    if (!ev || typeof ev.learnerId !== "string" || !ev.contributorRole) return;

    const nowMs = Date.parse(ev.observedAt) || Date.now();
    const window = (windows.get(ev.learnerId) ?? []).filter(
      (e) => nowMs - e.observedAtMs <= windowMs,
    );
    window.push({
      observedAtMs: nowMs,
      obs: {
        contributorRole: ev.contributorRole,
        category: ev.category,
        notes: ev.notes ?? "",
        observedAt: ev.observedAt,
      },
    });
    if (window.length > maxPerLearner) window.splice(0, window.length - maxPerLearner);
    windows.set(ev.learnerId, window);

    const signals = transformObservationsToSignals({
      caregiverObservations: window.map((e) => e.obs),
    });
    if (signals.length === 0) return;

    const recommendations = generateRecommendations({
      learnerId: ev.learnerId,
      signals,
      currentProfile: {},
    });

    const already = emittedTypes.get(ev.learnerId) ?? new Set<string>();
    const fresh = recommendations.filter((r) => !already.has(r.type));
    if (fresh.length === 0) return;
    for (const r of fresh) already.add(r.type);
    emittedTypes.set(ev.learnerId, already);

    await opts.onRecommendations(ev.learnerId, fresh);
  }

  async function start(bus: RealtimeBus): Promise<Unsubscribe> {
    return bus.subscribe(EVENTS.CAREGIVER_OBSERVATION_CREATED, (p) => {
      void handle(p);
    });
  }

  return { handle, start };
}
