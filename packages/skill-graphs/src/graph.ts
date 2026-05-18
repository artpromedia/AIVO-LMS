/**
 * Pure helpers over `SkillGraph`. No I/O, no React — these are the lookup
 * primitives that brain-svc / tutor-svc / curriculum builders use.
 */
import type { GraphIssue, Skill, SkillGraph } from "./types.js";

/**
 * Validate a skill graph: id uniqueness, prerequisite existence, no
 * self-prereq, no cycles. Returns a list of issues; an empty list means
 * the graph is well-formed.
 */
export function validateGraph(graph: SkillGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const seen = new Set<string>();
  const skillsById = new Map<string, Skill>();

  for (const skill of graph.skills) {
    if (seen.has(skill.id)) {
      issues.push({
        code: "duplicate_skill_id",
        skillId: skill.id,
        detail: `Skill id "${skill.id}" appears more than once in graph "${graph.id}".`,
      });
    }
    seen.add(skill.id);
    skillsById.set(skill.id, skill);
  }

  for (const skill of graph.skills) {
    for (const prereqId of skill.prerequisites) {
      if (prereqId === skill.id) {
        issues.push({
          code: "self_prerequisite",
          skillId: skill.id,
          detail: `Skill "${skill.id}" lists itself as a prerequisite.`,
        });
      } else if (!skillsById.has(prereqId)) {
        issues.push({
          code: "missing_prerequisite",
          skillId: skill.id,
          detail: `Skill "${skill.id}" references unknown prerequisite "${prereqId}".`,
        });
      }
    }
  }

  // Cycle detection (white/grey/black DFS).
  const WHITE = 0,
    GREY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const id of skillsById.keys()) color.set(id, WHITE);
  const stack: { id: string; iter: Iterator<string> }[] = [];
  for (const id of skillsById.keys()) {
    if (color.get(id) !== WHITE) continue;
    const root = skillsById.get(id);
    if (!root) continue;
    color.set(id, GREY);
    stack.push({ id, iter: root.prerequisites[Symbol.iterator]() });
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const next = top.iter.next();
      if (next.done) {
        color.set(top.id, BLACK);
        stack.pop();
        continue;
      }
      const childId = next.value;
      const childColor = color.get(childId);
      if (childColor === undefined) continue; // missing prereq, already reported
      if (childColor === GREY) {
        issues.push({
          code: "cycle_detected",
          skillId: childId,
          detail: `Cycle detected involving "${childId}" (reached from "${top.id}").`,
        });
        // Continue but don't recurse into the cycle.
        continue;
      }
      if (childColor === WHITE) {
        const child = skillsById.get(childId);
        if (!child) continue;
        color.set(childId, GREY);
        stack.push({ id: childId, iter: child.prerequisites[Symbol.iterator]() });
      }
    }
  }

  return issues;
}

/** Index a graph by skill id for O(1) lookup. */
export function indexGraph(graph: SkillGraph): Map<string, Skill> {
  const m = new Map<string, Skill>();
  for (const s of graph.skills) m.set(s.id, s);
  return m;
}

/** Look up a skill by id. Throws if not found — callers that may legitimately
 * miss should use `indexGraph(g).get(id)` directly. */
export function getSkill(graph: SkillGraph, skillId: string): Skill {
  const s = graph.skills.find((x) => x.id === skillId);
  if (!s) throw new Error(`Skill "${skillId}" not in graph "${graph.id}"`);
  return s;
}

/** Topologically sort a graph from foundational -> advanced. Throws on a
 * cycle (use `validateGraph` first if you want to soft-handle cycles). */
export function topologicalSort(graph: SkillGraph): Skill[] {
  const idx = indexGraph(graph);
  const indeg = new Map<string, number>();
  for (const s of graph.skills) indeg.set(s.id, 0);
  for (const s of graph.skills) {
    for (const p of s.prerequisites) {
      // Edge p -> s. So s has an incoming edge.
      if (indeg.has(s.id)) indeg.set(s.id, indeg.get(s.id)! + 1);
    }
  }
  const ready: string[] = [];
  for (const [id, d] of indeg) if (d === 0) ready.push(id);
  // Stable order: sort by skill id when picking from the ready set.
  ready.sort();
  const out: Skill[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    const s = idx.get(id)!;
    out.push(s);
    for (const other of graph.skills) {
      if (other.prerequisites.includes(id)) {
        indeg.set(other.id, indeg.get(other.id)! - 1);
        if (indeg.get(other.id) === 0) {
          // Insert in id-sorted order so the output is deterministic.
          let i = 0;
          while (i < ready.length && ready[i] < other.id) i++;
          ready.splice(i, 0, other.id);
        }
      }
    }
  }
  if (out.length !== graph.skills.length) {
    throw new Error(`Cycle in graph "${graph.id}" — call validateGraph() first.`);
  }
  return out;
}

/** Find every skill whose `frameworkRefs` includes the given framework code. */
export function findByFrameworkCode(graph: SkillGraph, framework: string, code: string): Skill[] {
  return graph.skills.filter((s) =>
    s.frameworkRefs.some((r) => r.framework === framework && r.code === code),
  );
}

/** Compute the transitive prerequisite closure of a skill (excluding itself). */
export function prerequisiteClosure(graph: SkillGraph, skillId: string): string[] {
  const idx = indexGraph(graph);
  const out = new Set<string>();
  const stack: string[] = [...(idx.get(skillId)?.prerequisites ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const s = idx.get(id);
    if (s) stack.push(...s.prerequisites);
  }
  return [...out].sort();
}
