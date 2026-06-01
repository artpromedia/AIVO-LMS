/**
 * Phase 3 — selectable persistence for recommendation records.
 *
 * The route handlers previously read/wrote a module-local `Map`, and the
 * candidate generator never persisted anything — so accept/amend/decline
 * only ever worked against test-seeded data and any record vanished on
 * restart. This interface lets the routes use Postgres
 * (`DrizzleRecommendationStore`) in production while keeping the in-memory
 * implementation for dev/tests. `DrizzleRecommendationStore` already
 * satisfies this shape structurally.
 *
 * NOTE: `ProfileStore` holds the *scratch* BrainProfile that
 * applyRecommendation() mutates to compute an effect + before/after
 * snapshot. The authoritative learner brain profile lives in brain-svc;
 * persisting/sourcing it across services is a separate integration (tracked
 * in docs/PLATFORM_GAP_ANALYSIS.md §9). Snapshots ARE persisted via
 * `recordSnapshot` when a Postgres store is wired.
 */
import type { BrainProfile } from "./recommendation-effect-handlers.js";
import type { BrainSnapshot, ProfileRecommendation } from "./types.js";

export interface RecommendationStore {
  create(rec: ProfileRecommendation): Promise<ProfileRecommendation>;
  get(id: string): Promise<ProfileRecommendation | undefined>;
  update(
    id: string,
    patch: Partial<ProfileRecommendation>,
  ): Promise<ProfileRecommendation | undefined>;
  listByLearner(learnerId: string): Promise<ProfileRecommendation[]>;
  recordSnapshot(snapshot: BrainSnapshot, recommendationId: string): Promise<void>;
}

export class InMemoryRecommendationStore implements RecommendationStore {
  private readonly recs = new Map<string, ProfileRecommendation>();

  async create(rec: ProfileRecommendation): Promise<ProfileRecommendation> {
    this.recs.set(rec.id, rec);
    return rec;
  }

  async get(id: string): Promise<ProfileRecommendation | undefined> {
    return this.recs.get(id);
  }

  async update(
    id: string,
    patch: Partial<ProfileRecommendation>,
  ): Promise<ProfileRecommendation | undefined> {
    const existing = this.recs.get(id);
    if (!existing) return undefined;
    Object.assign(existing, patch);
    return existing;
  }

  async listByLearner(learnerId: string): Promise<ProfileRecommendation[]> {
    return [...this.recs.values()].filter((r) => r.learnerId === learnerId);
  }

  async recordSnapshot(): Promise<void> {
    // No-op in memory — snapshots are only durably recorded by the
    // Postgres store.
  }

  // Synchronous helpers for the test seed/clear surface.
  seed(rec: ProfileRecommendation): void {
    this.recs.set(rec.id, rec);
  }

  clear(): void {
    this.recs.clear();
  }
}

/** In-process accumulator for the scratch BrainProfile (see file header). */
export class ProfileStore {
  private readonly profiles = new Map<string, BrainProfile>();

  ensure(learnerId: string): BrainProfile {
    if (!this.profiles.has(learnerId)) this.profiles.set(learnerId, {});
    return this.profiles.get(learnerId)!;
  }

  clear(): void {
    this.profiles.clear();
  }
}
