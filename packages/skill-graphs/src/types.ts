/**
 * Skill-graph schema (§5 Content infrastructure, v2.1).
 *
 * A skill graph is a directed acyclic graph (DAG) of curriculum skills,
 * each anchored to one or more standards-framework codes (e.g. CCSS-Math,
 * NGSS, WIDA). Edges encode prerequisites: an edge `A -> B` means a learner
 * is expected to have mastered A before encountering B.
 *
 * This replaces brain-svc's LLM-synthesized-on-demand curriculum graph with
 * a static, versionable, auditable artifact.
 */

/** Standards-frameworks we anchor to. Extend as new domains come online. */
export type FrameworkId =
  | "CCSS-Math"
  | "CCSS-ELA"
  | "NGSS"
  | "NGSS-Engineering"
  | "WIDA-ELD"
  | "ISTE"
  | "C3"
  | "NCSS"
  | "NCGE"
  | "CSTA"
  | "CASEL"
  | "ASHA"
  | "NCAS"
  | "SHAPE"
  | "ACTFL"
  | "CEC-LS";

/** A reference to a single code in an external standards framework. */
export interface FrameworkRef {
  framework: FrameworkId;
  /** The framework's own code (e.g. "K.CC.A.1", "K-PS2-1"). */
  code: string;
  /** Optional human-readable label for that code. */
  label?: string;
}

/** Coarse subject buckets used by the tutor router. */
export type Subject =
  | "math"
  | "ela"
  | "writing"
  | "science"
  | "social_studies"
  | "geography"
  | "coding"
  | "speech"
  | "sel"
  | "life_skills"
  | "executive_function"
  | "music"
  | "pe_health"
  | "world_languages"
  | "stem_engineering"
  | "creative_arts";

/** Grade-band targeting. We use the U.S. K–12 convention; "PRE_K" and
 * "ADULT" exist for transition / SPED workflows. */
export type GradeBand =
  | "PRE_K"
  | "K"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "ADULT";

/** A single skill node in the graph. */
export interface Skill {
  /** Stable, human-readable id; e.g. "ccss-math.K.CC.A.1". */
  id: string;
  /** Short title used in tutor narration ("Count to 10"). */
  title: string;
  /** One-sentence learner-facing description ("I can count from 1 to 10"). */
  description: string;
  subject: Subject;
  /** Grade band where the skill is typically introduced. */
  gradeBand: GradeBand;
  /** Standards-framework codes this skill aligns to. May be empty for
   * scaffolding skills that exist only as pedagogical bridges. */
  frameworkRefs: FrameworkRef[];
  /** IDs of skills that must be mastered first. May be empty for entry-
   * point ("foundational") skills. */
  prerequisites: string[];
}

/** A complete skill graph for a (subject, gradeBand) slice. */
export interface SkillGraph {
  /** Stable id, e.g. "ccss-math-k". */
  id: string;
  /** Display title. */
  title: string;
  /** Schema version of this artifact — bump on incompatible changes. */
  version: string;
  /** Source-of-truth provenance, e.g. "CCSS Math 2010, Kindergarten domain". */
  source: string;
  framework: FrameworkId;
  subject: Subject;
  gradeBand: GradeBand;
  skills: Skill[];
}

/** Issues surfaced by `validateGraph()`. */
export interface GraphIssue {
  code: "duplicate_skill_id" | "missing_prerequisite" | "self_prerequisite" | "cycle_detected";
  skillId?: string;
  detail: string;
}
