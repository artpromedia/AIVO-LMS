"use server";

/**
 * Onboarding learner-creation action (AddLearner.dc.html).
 *
 * Persists a real learner via the same store path as /parent/learners/new
 * (`createLearner`), then returns a `created` state carrying the new learner id
 * so the page can show the calm "added!" interstitial and route into the
 * assessment (the design's next step) — replacing the old straight redirect.
 *
 * The onboarding form is intentionally lighter than the full
 * /parent/learners/new form, so we derive `birthYear` from the chosen grade
 * band (a representative mid-band age) to satisfy the validator. Parents refine
 * exact details later from the learner profile.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createLearner } from "@/lib/db/repos";
import { createLearnerSchema } from "@/lib/validators/learner";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

type GradeBand = "preK" | "K" | "1-2" | "3-5" | "6-8" | "9-12" | "post_secondary";

// Maps the onboarding grade-band picker (button values) onto the validator's
// gradeBand enum plus a representative age used to derive a birth year. Keep
// keys in sync with GRADES in page.tsx.
const GRADE_MAP: Record<string, { gradeBand: GradeBand; age: number }> = {
  "Pre-K (3-4)": { gradeBand: "preK", age: 4 },
  "K-2 (5-7)": { gradeBand: "K", age: 6 },
  "3-5 (8-10)": { gradeBand: "3-5", age: 9 },
  "6-8 (11-13)": { gradeBand: "6-8", age: 12 },
  "9-12 (14-18)": { gradeBand: "9-12", age: 16 },
};

export type AddLearnerState =
  | { status: "idle" }
  | { status: "error"; error: "first_name" | "seat_limit" }
  | { status: "created"; learnerId: string; firstName: string };

export async function createOnboardingLearnerAction(
  _prev: AddLearnerState,
  formData: FormData,
): Promise<AddLearnerState> {
  const session = await getSession();
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
    // Fall back to an age-8 default when no band was chosen; the parent can
    // correct it on the learner profile.
    birthYear: currentYear - (mapped ? mapped.age : 8),
    gradeBand: mapped ? mapped.gradeBand : null,
  };

  const parsed = createLearnerSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", error: "first_name" };
  }

  // District pilot seat cap (Sprint 3): refuse over-cap before creating.
  const { getTenantSeatAvailability } = await import("@/lib/db/seat-availability");
  const seats = await getTenantSeatAvailability(session.tenantId);
  if (!seats.allowed) {
    return { status: "error", error: "seat_limit" };
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

  return {
    status: "created",
    learnerId: learner.id,
    firstName: parsed.data.firstName ?? firstName,
  };
}
