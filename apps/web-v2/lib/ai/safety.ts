/**
 * Sprint 27 — Deterministic safety classifier + sanitizer.
 *
 * This file is the single source of truth for the AI safety pipeline:
 *
 *   classify(text, ctx)        → SafetyClassification (categories + decision)
 *   sanitizeHomeworkInput(...) → strips prompt-injection scaffolding + PII
 *   validateTutorResponse(...) → tutor-rule layer (no diagnosis/shame/etc.)
 *   validateLessonPlan(...)    → safety pass over a generated lesson
 *
 * The classifier is **deterministic regex rules** so red-team tests + CI can
 * run without a real LLM. The interface is identical to what a real model
 * provider would expose (text + context in, category scores out), so the
 * real classifier just swaps the body of `classifySignals`.
 */
import type {
  CrisisSignal,
  PromptInjectionSignal,
  SafetyCategory,
  SafetyClassification,
  SafetyDecision,
  SafetyPolicyVersion,
  SafetySeverity,
} from "@/lib/db/types";

// ---------- Patterns ----------

type Pattern = { category: SafetyCategory; weight: number; regex: RegExp; slug: string };

/**
 * Each rule is intentionally narrow to keep false-positives low; the regex is
 * inspectable on /admin/platform/safety/policies. Add new rules here rather
 * than at call sites so policy changes are versioned in one place.
 */
const RULES: Pattern[] = [
  // self-harm / crisis
  {
    category: "self_harm",
    weight: 0.95,
    slug: "self_harm_phrase",
    regex: /\b(kill myself|end my life|want to die|hurt myself|cutting myself|suicid)/i,
  },
  {
    category: "self_harm",
    weight: 0.6,
    slug: "hopelessness",
    regex: /\b(nobody (loves|likes) me|no reason to live|i (hate|wish i wasn't) (alive|here))/i,
  },
  // violence
  {
    category: "violence",
    weight: 0.9,
    slug: "violence_phrase",
    regex: /\b(shoot|stab|attack|beat up|bring a (gun|knife))/i,
  },
  // sexual content
  {
    category: "sexual_content",
    weight: 0.9,
    slug: "sexual_phrase",
    regex: /\b(sex|porn|nude|naked photo|sexual)/i,
  },
  // adult-contact risk
  {
    category: "adult_contact_risk",
    weight: 0.95,
    slug: "secret_adult",
    slugAlt: undefined as never,
    ...({
      regex:
        /\b(meet me (in person|alone)|don'?t tell (your )?(mom|dad|parents|teacher)|our little secret)\b/i,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- regex variant carries shape that doesn't fit the discriminated union; safe cast at definition time
    } as any),
  },
  // bullying
  {
    category: "bullying",
    weight: 0.7,
    slug: "bullying_phrase",
    regex: /\b(everybody hates|you'?re (stupid|dumb|ugly|fat|worthless)|kill yourself)\b/i,
  },
  // hate/harassment (slurs use placeholder)
  {
    category: "hate_or_harassment",
    weight: 0.8,
    slug: "hate_slur",
    regex: /\b(\[slur\]|retard(ed)?|n[\W_]*word)\b/i,
  },
  // medical/legal advice
  {
    category: "medical_or_legal_advice",
    weight: 0.7,
    slug: "medical_advice",
    regex:
      /\b(diagnose|prescribe|you have (autism|adhd|depression)|stop taking your (meds|medication)|sue them)\b/i,
  },
  // prompt injection
  {
    category: "prompt_injection",
    weight: 0.95,
    slug: "ignore_previous",
    regex: /\bignore (all )?(previous|prior|above) (instructions|rules)\b/i,
  },
  {
    category: "prompt_injection",
    weight: 0.9,
    slug: "system_override",
    regex:
      /\b(you are now|act as|pretend to be) (a |an )?(unfiltered|jailbroken|dan|developer mode)/i,
  },
  {
    category: "prompt_injection",
    weight: 0.85,
    slug: "role_takeover",
    regex: /\b(new (system|rules)|forget (everything|your role|instructions))\b/i,
  },
  {
    category: "prompt_injection",
    weight: 0.8,
    slug: "delimiter_injection",
    regex: /<\|?(system|im_start|im_end)\|?>/i,
  },
  // privacy leakage (best-effort)
  {
    category: "privacy_leakage",
    weight: 0.6,
    slug: "phone",
    regex: /\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/,
  },
  {
    category: "privacy_leakage",
    weight: 0.6,
    slug: "email",
    regex: /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,
  },
  { category: "privacy_leakage", weight: 0.8, slug: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  {
    category: "privacy_leakage",
    weight: 0.6,
    slug: "address",
    regex: /\b\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Ln|Dr)\b/,
  },
  // academic cheating — learner asking tutor to just give the answer
  {
    category: "academic_cheating",
    weight: 0.6,
    slug: "give_me_answer",
    regex:
      /\b(just (give|tell) me the answer|do my homework|write (this|my) (essay|paper) for me)\b/i,
  },
  // unsafe external link
  {
    category: "unsafe_external_link",
    weight: 0.7,
    slug: "external_link",
    regex: /\bhttps?:\/\/(?!(aivolearning\.com|localhost|127\.0\.0\.1))[^\s]+/i,
  },
  // diagnostic labeling (tutor output rule)
  {
    category: "diagnostic_labeling",
    weight: 0.8,
    slug: "diagnosis",
    regex: /\b(you (are|have) (autistic|adhd|dyslexic|on the spectrum|bipolar))/i,
  },
];

// Workaround for the spread-construction quirk above:
RULES[4] = {
  category: "adult_contact_risk",
  weight: 0.95,
  slug: "secret_adult",
  regex:
    /\b(meet me (in person|alone)|don'?t tell (your )?(mom|dad|parents|teacher)|our little secret)\b/i,
};

const CRISIS_RULES: { category: CrisisSignal["category"]; regex: RegExp }[] = [
  { category: "self_harm", regex: /\b(kill myself|end my life|want to die|hurt myself|suicid)/i },
  { category: "harm_to_other", regex: /\b(want to (hurt|kill) (him|her|them|someone))/i },
  {
    category: "abuse_disclosure",
    regex:
      /\b((dad|mom|uncle|aunt|brother|sister|teacher) (hits|hurts|touches) me|i('| a)m being (abused|hurt))/i,
  },
];

// ---------- Default policy ----------

export const DEFAULT_SAFETY_POLICY: SafetyPolicyVersion = {
  id: "spv_default_v1",
  version: "1.0",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  ruleset: {
    blockThreshold: 0.85,
    reviewThreshold: 0.5,
    autoReviewCategories: ["self_harm", "adult_contact_risk", "violence"],
    autoBlockCategories: ["prompt_injection", "sexual_content"],
  },
  status: "active",
};

// ---------- Classifier ----------

export type ClassifyContext = {
  subjectKind:
    | "tutor_response"
    | "lesson_plan"
    | "homework_input"
    | "user_message"
    | "uploaded_text";
  policy?: SafetyPolicyVersion;
};

export type ClassifyResult = {
  classification: SafetyClassification;
  injectionSignals: PromptInjectionSignal[];
  crisisSignals: CrisisSignal[];
};

function severityFor(score: number): SafetySeverity {
  if (score >= 0.95) return "critical";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.25) return "low";
  return "info";
}

export function classify(text: string, ctx: ClassifyContext): ClassifyResult {
  const policy = ctx.policy ?? DEFAULT_SAFETY_POLICY;
  const confidences: Partial<Record<SafetyCategory, number>> = {};
  const injectionSignals: PromptInjectionSignal[] = [];
  for (const rule of RULES) {
    const m = rule.regex.exec(text);
    if (!m) continue;
    const prev = confidences[rule.category] ?? 0;
    if (rule.weight > prev) confidences[rule.category] = rule.weight;
    if (rule.category === "prompt_injection") {
      const start = Math.max(0, m.index - 20);
      const end = Math.min(text.length, m.index + m[0].length + 20);
      injectionSignals.push({ pattern: rule.slug, snippet: text.slice(start, end) });
    }
  }

  const crisisSignals: CrisisSignal[] = [];
  for (const cr of CRISIS_RULES) {
    const m = cr.regex.exec(text);
    if (!m) continue;
    crisisSignals.push({
      category: cr.category,
      severity: "high",
      excerpt: text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20),
    });
  }

  const sorted = (Object.entries(confidences) as [SafetyCategory, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const topScore = sorted[0]?.[1] ?? 0;
  const categories = sorted.map(([c]) => c);

  let decision: SafetyDecision = "allow";
  if (categories.some((c) => policy.ruleset.autoBlockCategories.includes(c))) {
    decision = "block";
  } else if (topScore >= policy.ruleset.blockThreshold) {
    decision = "block";
  } else if (
    categories.some((c) => policy.ruleset.autoReviewCategories.includes(c)) ||
    topScore >= policy.ruleset.reviewThreshold
  ) {
    decision = "review";
  }

  return {
    classification: {
      categories,
      confidences,
      severity: severityFor(topScore),
      decision,
      policyVersionId: policy.id,
    },
    injectionSignals,
    crisisSignals,
  };
}

// ---------- Sanitizer ----------

const PII_REDACTIONS: { regex: RegExp; replacement: string }[] = [
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[redacted-ssn]" },
  { regex: /\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, replacement: "[redacted-phone]" },
  { regex: /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi, replacement: "[redacted-email]" },
];

const INJECTION_STRIP: RegExp[] = [
  /ignore (all )?(previous|prior|above) (instructions|rules)\b.*$/gi,
  /<\|?(system|im_start|im_end)\|?>/gi,
  /\b(you are now|act as|pretend to be) (a |an )?(unfiltered|jailbroken|dan|developer mode)[^.]*\.?/gi,
];

export type SanitizeResult = {
  cleaned: string;
  piiRedacted: boolean;
  injectionStripped: boolean;
};

export function sanitizeHomeworkInput(raw: string): SanitizeResult {
  let cleaned = raw;
  let piiRedacted = false;
  let injectionStripped = false;
  // String#replace with a /g regex resets lastIndex internally, and we capture
  // "matched at least once" by comparing before/after rather than calling
  // .test() on a shared global regex (calling test() on /g regexes mutates
  // lastIndex and silently misses matches on the next call).
  for (const { regex, replacement } of PII_REDACTIONS) {
    const next = cleaned.replace(regex, replacement);
    if (next !== cleaned) piiRedacted = true;
    cleaned = next;
  }
  for (const re of INJECTION_STRIP) {
    const next = cleaned.replace(re, "[removed prompt-injection]");
    if (next !== cleaned) injectionStripped = true;
    cleaned = next;
  }
  return { cleaned, piiRedacted, injectionStripped };
}

// ---------- Tutor response rules ----------

export type TutorRuleViolation = {
  rule: string;
  message: string;
};

const TUTOR_RULES: TutorRuleViolation[] = [
  { rule: "no_diagnosis", message: "Tutor must not diagnose the learner." },
  { rule: "no_iep_leak", message: "Tutor must not expose raw IEP content." },
  { rule: "no_shame", message: "Tutor must not shame the learner." },
  { rule: "no_secrecy", message: "Tutor must not encourage secrecy from parents or teachers." },
  { rule: "no_unsafe_instructions", message: "Tutor must not provide unsafe instructions." },
  { rule: "guide_not_answer", message: "Tutor must guide, not just provide final answers." },
];

const TUTOR_RULE_PATTERNS: Record<string, RegExp> = {
  no_diagnosis: /\byou (are|have) (autistic|adhd|dyslexic|on the spectrum|bipolar|depressed)\b/i,
  no_iep_leak: /\b(your iep (says|states)|according to your iep)\b/i,
  no_shame: /\b(you'?re (stupid|dumb|lazy|bad)|you should be ashamed)\b/i,
  no_secrecy: /\b(don'?t tell (your )?(mom|dad|parents|teacher)|keep this (between us|secret))\b/i,
  no_unsafe_instructions:
    /\b(how to (make|build) (a )?(bomb|weapon|drug)|harm yourself|drink bleach)\b/i,
  // guide_not_answer fires when the tutor hands over a finished answer rather
  // than scaffolding. Heuristic: explicit "the answer is X" or "here is the
  // final answer" phrasing in tutor output.
  guide_not_answer:
    /\b(the (final )?answer is\b|here(?:['’]s| is) (the|your) (final )?answer\b|just copy this\b)/i,
};

export function validateTutorResponse(text: string): {
  ok: boolean;
  violations: TutorRuleViolation[];
} {
  const violations: TutorRuleViolation[] = [];
  for (const rule of TUTOR_RULES) {
    const re = TUTOR_RULE_PATTERNS[rule.rule];
    if (re && re.test(text)) violations.push(rule);
  }
  return { ok: violations.length === 0, violations };
}

// ---------- Lesson plan validation ----------

export function validateLessonPlan(
  plan: {
    hookText?: string;
    modelingText?: string;
    guidedPractice?: { prompt?: string; expectedResponse?: string }[];
    checksForUnderstanding?: { prompt?: string }[];
  },
  policy?: SafetyPolicyVersion,
): { ok: boolean; classification: SafetyClassification; violations: string[] } {
  const joined = [
    plan.hookText ?? "",
    plan.modelingText ?? "",
    ...(plan.guidedPractice ?? []).flatMap((g) => [g.prompt ?? "", g.expectedResponse ?? ""]),
    ...(plan.checksForUnderstanding ?? []).map((c) => c.prompt ?? ""),
  ].join("\n");
  const { classification } = classify(joined, { subjectKind: "lesson_plan", policy });
  const tutorCheck = validateTutorResponse(joined);
  return {
    ok: classification.decision === "allow" && tutorCheck.ok,
    classification,
    violations: tutorCheck.violations.map((v) => v.message),
  };
}

// ---------- Blocked-response fallback ----------

export function blockedFallbackFor(subjectKind: ClassifyContext["subjectKind"]): string {
  switch (subjectKind) {
    case "tutor_response":
    case "lesson_plan":
      return "Let's pause this question and talk to a grown-up who can help. I want to keep you safe.";
    case "homework_input":
      return "I can help with school work, but I can't use that part of your message. Try sharing just the homework problem.";
    case "user_message":
      return "I can't respond to that. If something is wrong, please talk to a parent or teacher.";
    case "uploaded_text":
      return "We couldn't safely process that upload. Please ask a grown-up for help.";
    default:
      return "I can't help with that here.";
  }
}
