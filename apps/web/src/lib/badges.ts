/**
 * Per-learner badge persistence. Used by the Discovery `Finale` to remember
 * which domain badges a learner has unlocked across sessions, so re-running
 * the adventure doesn't reset their celebratory wall.
 *
 * Stored as a JSON-encoded `string[]` of badge IDs at
 * `aivo:badges:{learnerId}`.
 */

const KEY = (learnerId: string) => `aivo:badges:${learnerId}`;

export interface UnlockedBadge {
  id: string;
  unlockedAt: number; // Date.now() when first added
}

interface StoredBadge {
  id: unknown;
  unlockedAt: unknown;
}

export function loadBadges(learnerId: string | null | undefined): UnlockedBadge[] {
  if (!learnerId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(learnerId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((b): b is StoredBadge => !!b && typeof b === "object" && "id" in b)
      .map((b) => ({
        id: String(b.id),
        unlockedAt: typeof b.unlockedAt === "number" ? b.unlockedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

/**
 * Merge `incoming` badge IDs into the persisted set for `learnerId`.
 * Returns the merged list (existing first, in unlock order, then any new
 * badges in the order they were passed). Newly added IDs get `unlockedAt`
 * set to now; existing entries keep their original timestamp.
 */
export function unlockBadges(
  learnerId: string | null | undefined,
  incoming: string[],
): UnlockedBadge[] {
  if (!learnerId || typeof window === "undefined") return [];
  const existing = loadBadges(learnerId);
  const seen = new Set(existing.map((b) => b.id));
  const merged = [...existing];
  const now = Date.now();
  for (const id of incoming) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push({ id, unlockedAt: now });
  }
  try {
    window.localStorage.setItem(KEY(learnerId), JSON.stringify(merged));
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  return merged;
}

export function clearBadges(learnerId: string | null | undefined): void {
  if (!learnerId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(learnerId));
  } catch {
    /* ignore */
  }
}
