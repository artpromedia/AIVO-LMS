/**
 * DAPE (Adapted Physical Education) goal detection.
 *
 * Detection-only helpers, intentionally separate from the activity library
 * in family-svc so they can be imported from any service that needs to
 * decide whether a learner is on the DAPE track (tutor-svc, ai-svc-ts
 * adapters, etc.) without dragging in the curated movement catalog.
 */

export type DapeCategory =
  | "locomotor"
  | "object_control"
  | "balance"
  | "midline_crossing"
  | "heavy_work"
  | "vestibular"
  | "fine_motor"
  | "handwriting_prep";

export const DAPE_CATEGORY_LABELS: Record<DapeCategory, string> = {
  locomotor: "Locomotor skills",
  object_control: "Object control",
  balance: "Balance",
  midline_crossing: "Midline crossing",
  heavy_work: "Heavy work / proprioceptive",
  vestibular: "Vestibular regulation",
  fine_motor: "Fine motor",
  handwriting_prep: "Handwriting prep",
};

const KEYWORD_MAP: Array<[RegExp, DapeCategory]> = [
  [/\b(walk|run|jump|hop|gallop|skip|locomotor|gait|motor\s*planning)\b/i, "locomotor"],
  [/\b(catch|throw|kick|strike|object\s*control|ball)\b/i, "object_control"],
  [/\b(balance|stand|posture|stability)\b/i, "balance"],
  [/\b(midline|cross|bilateral|crossing\s*midline)\b/i, "midline_crossing"],
  [/\b(heavy\s*work|proprioceptive|push|pull|carry|deep\s*pressure)\b/i, "heavy_work"],
  [/\b(vestibular|spin|rock|swing|sensory\s*regulat)\b/i, "vestibular"],
  [/\b(fine\s*motor|pinch|grasp|finger|manipulat)\b/i, "fine_motor"],
  [/\b(handwriting|letter\s*formation|pencil|writing\s*legib)\b/i, "handwriting_prep"],
];

const SUB_DOMAIN_MAP: Record<string, DapeCategory> = {
  locomotor: "locomotor",
  object_control: "object_control",
  balance: "balance",
  midline_crossing: "midline_crossing",
  heavy_work: "heavy_work",
  vestibular: "vestibular",
  fine_motor: "fine_motor",
  handwriting_prep: "handwriting_prep",
  motor_planning: "locomotor",
  adapted_pe: "locomotor",
};

// Bare "motor" / "coordination" are excluded so goals like "visual-motor
// integration for reading" don't get pulled into DAPE. "motor planning"
// is included because it is a core DAPE skill area.
const MOTOR_HINT = /\b(gross\s*motor|fine\s*motor|adapted\s*pe|adapted\s*physical|\bdape\b|locomotor|object\s*control|midline\s*crossing|motor\s*planning|handwriting\s*(?:legib|formation)|pencil\s*grip|bilateral\s*coordination|gait\s*training|balance\s*(?:training|skills)|vestibular\s*regulation|proprioceptive\s*input|heavy\s*work)\b/i;

const DAPE_DOMAINS = new Set(["motor", "gross_motor", "fine_motor", "dape", "adapted_pe", "physical"]);

// Roots where we explicitly do NOT want a text match to flip the goal into
// DAPE — the goal is scoped elsewhere and the language overlaps coincidentally.
const NON_DAPE_DOMAINS = new Set([
  "math", "ela", "speech", "behavior", "social", "life_skills", "executive_function",
]);

const DAPE_SERVICE_TYPES = /\b(adapted\s*physical|adapted\s*pe|\bdape\b|adaptive\s*physical)\b/i;

export function splitDomain(domain?: string | null): { root: string; sub: string | null } {
  const raw = (domain || "").toLowerCase();
  const idx = raw.indexOf(":");
  if (idx === -1) return { root: raw, sub: null };
  return { root: raw.slice(0, idx), sub: raw.slice(idx + 1) };
}

export function isDapeGoal(goal: { domain?: string | null; goalText?: string | null }): boolean {
  const { root, sub } = splitDomain(goal.domain);
  if (DAPE_DOMAINS.has(root)) return true;
  if (sub && SUB_DOMAIN_MAP[sub]) return true;
  if (NON_DAPE_DOMAINS.has(root)) return false;
  return MOTOR_HINT.test(goal.goalText || "");
}

export function categoriseDapeGoal(goalText: string, domain?: string | null): DapeCategory[] {
  const matches = new Set<DapeCategory>();
  const { sub } = splitDomain(domain);
  if (sub && SUB_DOMAIN_MAP[sub]) matches.add(SUB_DOMAIN_MAP[sub]);
  for (const [regex, cat] of KEYWORD_MAP) {
    if (regex.test(goalText)) matches.add(cat);
  }
  if (matches.size === 0) matches.add("locomotor");
  return Array.from(matches);
}

/** Detect a DAPE service line by `serviceType` text. */
export function isDapeService(service: { serviceType?: string | null }): boolean {
  return DAPE_SERVICE_TYPES.test(service.serviceType || "");
}

export interface DapeProfileSummary {
  active: boolean;
  /** Why we think the learner is on DAPE: explicit IEP service, motor goal(s), both, or none. */
  source: "service" | "goal" | "service+goal" | "none";
  /** Distinct DAPE category ids present on the learner's goals, ordered by goal count desc. */
  categories: { id: DapeCategory; label: string; goalCount: number; sampleGoal?: string }[];
  /** Total motor goals (sum across categories; some goals match >1). */
  totalMotorGoals: number;
}

/**
 * Combine IEP services and goals into a single per-learner DAPE summary.
 * Pure / DB-free: callers query the rows and pass them in. Output is
 * shaped for direct injection into `brain_context.dape_profile` and
 * for rendering on the parent / therapist motor dashboard.
 */
export function buildDapeProfileSummary(
  goals: ReadonlyArray<{ id?: string; domain?: string | null; goalText?: string | null }>,
  services: ReadonlyArray<{ serviceType?: string | null }> = [],
): DapeProfileSummary {
  const motor = goals.filter(isDapeGoal);
  const hasService = services.some(isDapeService);

  if (motor.length === 0 && !hasService) {
    return { active: false, source: "none", categories: [], totalMotorGoals: 0 };
  }

  const counts = new Map<DapeCategory, { goalCount: number; sampleGoal?: string }>();
  for (const g of motor) {
    for (const cat of categoriseDapeGoal(g.goalText || "", g.domain)) {
      const slot = counts.get(cat) || { goalCount: 0, sampleGoal: undefined };
      slot.goalCount += 1;
      if (!slot.sampleGoal && g.goalText) slot.sampleGoal = g.goalText;
      counts.set(cat, slot);
    }
  }

  const categories = Array.from(counts.entries())
    .sort((a, b) => b[1].goalCount - a[1].goalCount)
    .map(([id, v]) => ({
      id,
      label: DAPE_CATEGORY_LABELS[id],
      goalCount: v.goalCount,
      sampleGoal: v.sampleGoal,
    }));

  const source: DapeProfileSummary["source"] = hasService && motor.length > 0
    ? "service+goal"
    : hasService
      ? "service"
      : "goal";

  return {
    active: true,
    source,
    categories,
    totalMotorGoals: motor.length,
  };
}
