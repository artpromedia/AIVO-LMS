"use server";

/**
 * Onboarding learner-creation action.
 *
 * The onboarding "add your first learner" step used to be a dead `<Link>`
 * to /onboarding/consent that discarded everything the parent typed. This
 * action persists a real learner via the same store path as
 * /parent/learners/new (`createLearner`), then drops the parent onto the
 * real learner detail page so the funnel terminates in actual data.
 *
 * The onboarding form is intentionally lighter than the full
 * /parent/learners/new form, so we derive `birthYear` from the chosen
 * grade band (a representative mid-band age) to satisfy the validator.
 * Parents can refine the exact details later from the learner profile.
 */
import { redirect } from "next/navigation";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { createLearner } from "@/lib/db/repos";
import { createLearnerSchema } from "@/lib/validators/learner";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

type GradeBand = "preK" | "K" | "1-2" | "3-5" | "6-8" | "9-12" | "post_secondary";

// Maps the onboarding grade-band picker (display strings) onto the
// validator's gradeBand enum plus a representative age used to derive a
// birth year. Keep keys in sync with GRADE_BANDS in the page.
const GRADE_MAP: Record<string, { gradeBand: GradeBand; age: number }> = {
  "Pre-K (3-4)": { gradeBand: "preK", age: 4 },
  "K-2 (5-7)": { gradeBand: "K", age: 6 },
  "3-5 (8-10)": { gradeBand: "3-5", age: 9 },
  "6-8 (11-13)": { gradeBand: "6-8", age: 12 },
  "9-12 (14-18)": { gradeBand: "9-12", age: 16 },
};

export async function createOnboardingLearnerAction(formData: FormData): Promise<void> {
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") {
    redirect("/login");
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const gradeRaw = String(formData.get("grade") ?? "");
  const hasIep = String(formData.get("hasIep") ?? "");
  const mapped = GRADE_MAP[gradeRaw];
  const currentYear = new Date().getFullYear();

  const raw = {
    firstName,
    // Fall back to an age-8 default when no band was chosen; the parent
    // can correct it on the learner profile.
    birthYear: currentYear - (mapped ? mapped.age : 8),
    gradeBand: mapped ? mapped.gradeBand : null,
  };

  const parsed = createLearnerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/onboarding/learner/new?error=invalid");
  }

  const learner = await createLearner({
    tenantId: session.tenantId,
    parentUserId: session.userId,
    data: parsed.data,
  });

  audit(session, "learner.create", newRequestId(), {
    learnerId: learner.id,
    metadata: { source: "onboarding", iepStatus: hasIep || "unspecified" },
  });

  redirect(`/parent/learners/${learner.id}`);
}
