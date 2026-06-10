/**
 * Prerequisite-aware next-skill selection (adaptive-learning E2E Sprint 3).
 *
 * Replaces "lowest-scoring skill below 0.65" with a real frontier walk over
 * the skill graph: a skill is UNLOCKED when every prerequisite is mastered
 * (score >= MASTERY_THRESHOLD), and the recommendation order is
 *
 *   1. DAG depth (longest prerequisite chain) — foundations before dependents,
 *   2. grade-band proximity to the learner's delivery level, ascending toward
 *      the enrolled grade band (when a placement is known),
 *   3. lowest current score,
 *   4. skill id (stable, deterministic tiebreak).
 *
 * Pure module: no I/O, no store access. Graph hygiene is delegated to
 * @aivo/skill-graphs `validateGraph` — malformed edges (unknown/self
 * prerequisites, duplicates) are dropped with an issue report rather than
 * crashing, and members of a prerequisite cycle are quarantined to the END
 * of the frontier (never silently dropped: a content-authoring bug must not
 * make skills unreachable for a learner).
 */
import { validateGraph, type GraphIssue, type SkillGraph } from "@aivo/skill-graphs";
import { gradeBandIndex, normalizeGradeBand, type GradeBand } from "@aivo/scoring";
import type { Skill, SkillMastery } from "@/lib/db/types";

/** A prerequisite counts as satisfied at this mastery score. */
export const MASTERY_THRESHOLD = 0.65;

export interface SelectNextSkillsInput {
  skills: Skill[];
  skillMasteries: SkillMastery[];
  /** Canonical band content is delivered at (θ-derived), when known. */
  deliveryLevel?: string | null;
  /** Enrolled grade band, when known. */
  gradeBand?: string | null;
}

export interface LockedSkill {
  skillId: string;
  /** Prerequisites below MASTERY_THRESHOLD that block this skill. */
  missingPrerequisites: string[];
}

export interface SelectNextSkillsResult {
  /** Unlocked, not-yet-mastered skill ids in recommended order. */
  frontier: string[];
  /** Skills gated behind unmastered prerequisites. */
  locked: LockedSkill[];
  /** Skills already at/above MASTERY_THRESHOLD. */
  mastered: string[];
  /** Graph hygiene problems found (malformed edges, cycles). */
  issues: GraphIssue[];
}

/**
 * Midpoint band index of a web skill's gradeBand, which may be a single
 * band ("K", "3") or a range ("K-1", "3-5"). Null when unparseable.
 */
function bandMidpointIndex(gradeBand: string | null | undefined): number | null {
  if (!gradeBand) return null;
  const parts = String(gradeBand)
    .split("-")
    .map((p) => normalizeGradeBand(p.trim()))
    .filter((b): b is GradeBand => b !== null);
  if (parts.length === 0) return null;
  const indices = parts.map(gradeBandIndex);
  return (Math.min(...indices) + Math.max(...indices)) / 2;
}

/**
 * Distance-based ordering key for tiebreak (2): skills at or just above the
 * learner's delivery level come first; everything is still reachable, just
 * later. Without a known placement every skill scores 0 (no-op tiebreak).
 */
function bandProximity(
  skill: Skill,
  deliveryIdx: number | null,
  gradeIdx: number | null,
): number {
  const mid = bandMidpointIndex(skill.gradeBand);
  if (mid === null || deliveryIdx === null) return 0;
  // Ascend from delivery level toward the enrolled grade: bands below the
  // delivery level are review (small penalty per band), bands above it are
  // future work (larger penalty per band, and beyond the enrolled grade the
  // penalty keeps growing).
  if (mid >= deliveryIdx) {
    const ceiling = gradeIdx ?? Number.POSITIVE_INFINITY;
    const overGrade = Math.max(0, mid - ceiling);
    return (mid - deliveryIdx) * 2 + overGrade * 4;
  }
  return deliveryIdx - mid;
}

/** Adapt web skills into the @aivo/skill-graphs shape for validation. */
function toSkillGraph(skills: Skill[]): SkillGraph {
  return {
    id: "web-skills",
    version: "runtime",
    framework: { framework: "CCSS-Math", code: "runtime" },
    skills: skills.map((s) => ({
      id: s.id,
      title: s.name,
      description: s.name,
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [],
      prerequisites: [...s.prerequisites],
    })),
  } as unknown as SkillGraph;
}

export function selectNextSkills(input: SelectNextSkillsInput): SelectNextSkillsResult {
  const skills = input.skills;
  const skillIds = new Set(skills.map((s) => s.id));
  const scoreById = new Map(input.skillMasteries.map((m) => [m.skillId, m.score]));

  const issues = validateGraph(toSkillGraph(skills));

  // Sanitized prerequisite edges: drop unknown ids and self-references
  // (already reported via `issues`); cycles are handled separately below.
  const prereqsById = new Map<string, string[]>();
  for (const s of skills) {
    prereqsById.set(
      s.id,
      s.prerequisites.filter((p) => p !== s.id && skillIds.has(p)),
    );
  }

  // Full cycle membership: validateGraph reports one node per back-edge, but
  // EVERY node on a cycle must be quarantined (a node that can reach itself
  // through prerequisite edges). Subject graphs are small, so a DFS per
  // flagged component is fine.
  const cycleMembers = new Set<string>();
  if (issues.some((i) => i.code === "cycle_detected")) {
    const reachesSelf = (start: string): boolean => {
      const seen = new Set<string>();
      const stack = [...(prereqsById.get(start) ?? [])];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (cur === start) return true;
        if (seen.has(cur)) continue;
        seen.add(cur);
        stack.push(...(prereqsById.get(cur) ?? []));
      }
      return false;
    };
    for (const s of skills) {
      if (reachesSelf(s.id)) cycleMembers.add(s.id);
    }
  }

  // DAG depth via memoized longest-chain walk. Cycle members get depth 0 —
  // they are quarantined to the frontier tail regardless.
  const depthById = new Map<string, number>();
  const computeDepth = (id: string, trail: Set<string>): number => {
    const known = depthById.get(id);
    if (known !== undefined) return known;
    if (trail.has(id) || cycleMembers.has(id)) {
      depthById.set(id, 0);
      return 0;
    }
    trail.add(id);
    const prereqs = prereqsById.get(id) ?? [];
    const depth =
      prereqs.length === 0 ? 0 : 1 + Math.max(...prereqs.map((p) => computeDepth(p, trail)));
    trail.delete(id);
    depthById.set(id, depth);
    return depth;
  };
  for (const s of skills) computeDepth(s.id, new Set());

  const deliveryIdx = (() => {
    const band = normalizeGradeBand(input.deliveryLevel);
    return band ? gradeBandIndex(band) : null;
  })();
  const gradeIdx = (() => {
    const band = normalizeGradeBand(input.gradeBand);
    return band ? gradeBandIndex(band) : null;
  })();

  const mastered: string[] = [];
  const locked: LockedSkill[] = [];
  const unlocked: Skill[] = [];

  for (const s of skills) {
    const score = scoreById.get(s.id) ?? 0;
    if (score >= MASTERY_THRESHOLD) {
      mastered.push(s.id);
      continue;
    }
    const missing = (prereqsById.get(s.id) ?? []).filter(
      (p) => (scoreById.get(p) ?? 0) < MASTERY_THRESHOLD,
    );
    if (missing.length > 0 && !cycleMembers.has(s.id)) {
      locked.push({ skillId: s.id, missingPrerequisites: missing });
      continue;
    }
    unlocked.push(s);
  }

  const sortKey = (s: Skill): [number, number, number, number, string] => [
    cycleMembers.has(s.id) ? 1 : 0, // quarantine cycle members last
    depthById.get(s.id) ?? 0,
    bandProximity(s, deliveryIdx, gradeIdx),
    scoreById.get(s.id) ?? 0,
    s.id,
  ];
  unlocked.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    }
    return 0;
  });

  return { frontier: unlocked.map((s) => s.id), locked, mastered, issues };
}
