import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Banner } from "@/components/ui/banner";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { createLearner } from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { createLearnerSchema } from "@/lib/validators/learner";

function asStringArray(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function addLearnerAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");

  const raw = {
    firstName: String(formData.get("firstName") || "").trim(),
    preferredName: String(formData.get("preferredName") || "").trim() || null,
    birthYear: Number.parseInt(String(formData.get("birthYear") || ""), 10),
    pronouns: String(formData.get("pronouns") || "").trim() || null,
    ageRange: (String(formData.get("ageRange") || "") || null) as never,
    gradeBand: (String(formData.get("gradeBand") || "") || null) as never,
    schoolContext: (String(formData.get("schoolContext") || "") || null) as never,
    primaryLanguage: String(formData.get("primaryLanguage") || "").trim() || null,
    readingComfort: (String(formData.get("readingComfort") || "") || null) as never,
    mathComfort: (String(formData.get("mathComfort") || "") || null) as never,
    knownStrengths: asStringArray(String(formData.get("knownStrengths") || "")),
    knownChallenges: asStringArray(String(formData.get("knownChallenges") || "")),
  };
  const parsed = createLearnerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/parent/learners/new?error=invalid");
  }
  const learner = createLearner({
    tenantId: session.tenantId,
    parentUserId: session.userId,
    data: parsed.data,
  });
  audit(session, "learner.create", newRequestId(), {
    learnerId: learner.id,
    metadata: { source: "ui" },
  });
  redirect(`/parent/learners/${learner.id}`);
}

const AGE_RANGES = ["3-5", "5-7", "7-9", "9-11", "11-13", "13-15", "15-18"];
const GRADE_BANDS: { value: string; label: string }[] = [
  { value: "preK", label: "Pre-K" },
  { value: "K", label: "Kindergarten" },
  { value: "1-2", label: "Grades 1–2" },
  { value: "3-5", label: "Grades 3–5" },
  { value: "6-8", label: "Grades 6–8" },
  { value: "9-12", label: "Grades 9–12" },
  { value: "post_secondary", label: "Post-secondary" },
];
const SCHOOL_CONTEXT: { value: string; label: string }[] = [
  { value: "in_school", label: "In school" },
  { value: "homeschool", label: "Homeschool" },
  { value: "hybrid", label: "Hybrid" },
  { value: "not_in_school", label: "Not in school" },
];
const COMFORTS: { value: string; label: string }[] = [
  { value: "new", label: "Just starting" },
  { value: "growing", label: "Growing" },
  { value: "confident", label: "Confident" },
  { value: "advanced", label: "Advanced" },
];

/**
 * /parent/learners/new — Add a learner.
 *
 * Redesigned in the parent-surface visual-quality pass. The page used
 * to render 12 visually-identical pill-shaped inputs in a flat 2-column
 * grid. The new layout groups fields into three semantic sections so
 * parents can scan the form by intent, and the redesigned `Input` /
 * `Textarea` / `Select` primitives carry consistent radius and tone.
 *
 * Sections:
 *   1. About your learner      — identity (firstName, preferredName,
 *                                birthYear, pronouns)
 *   2. School & language       — context (ageRange, gradeBand,
 *                                schoolContext, primaryLanguage)
 *   3. Strengths & support     — open-ended (comforts, strengths,
 *                                challenges)
 *
 * Required vs. optional is now visually distinct via the `Label`
 * primitive's `required` and `optional` props, not by typing
 * "(optional)" into the label string at the same visual weight as the
 * field name.
 */
export default async function NewLearnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const params = await searchParams;
  const currentYear = new Date().getFullYear();

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          title="Add a learner"
          description="Just the basics now — you can update everything later from learner settings."
        />

        {params.error === "invalid" && (
          <Banner
            tone="danger"
            title="A few details still need fixing."
            description="At minimum we need a first name and a valid birth year. Scroll up to see which fields are required."
          />
        )}

        <form action={addLearnerAction} className="flex flex-col gap-6">
          {/* Section 1 — About your learner. */}
          <Card className="flex flex-col gap-5 p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-iw-ink">About your learner</h2>
              <p className="text-sm text-iw-ink-muted">
                The name AIVO will use and a few identity basics.
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName" required>
                  First name
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  maxLength={80}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="preferredName" optional>
                  Preferred name
                </Label>
                <Input
                  id="preferredName"
                  name="preferredName"
                  maxLength={80}
                  placeholder="Nickname AIVO should use"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="birthYear" required>
                  Birth year
                </Label>
                <Input
                  id="birthYear"
                  name="birthYear"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1990}
                  max={currentYear}
                  placeholder={String(currentYear - 7)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pronouns" optional>
                  Pronouns
                </Label>
                <Input id="pronouns" name="pronouns" maxLength={40} placeholder="e.g. she/her" />
              </div>
            </div>
          </Card>

          {/* Section 2 — School & language. */}
          <Card className="flex flex-col gap-5 p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-iw-ink">School &amp; language</h2>
              <p className="text-sm text-iw-ink-muted">
                Helps AIVO match grade-level pacing and reading materials.
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ageRange" optional>
                  Age range
                </Label>
                <select
                  id="ageRange"
                  name="ageRange"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">Choose…</option>
                  {AGE_RANGES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gradeBand" optional>
                  Grade band
                </Label>
                <select
                  id="gradeBand"
                  name="gradeBand"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">Choose…</option>
                  {GRADE_BANDS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="schoolContext" optional>
                  School context
                </Label>
                <select
                  id="schoolContext"
                  name="schoolContext"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">Choose…</option>
                  {SCHOOL_CONTEXT.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="primaryLanguage" optional>
                  Primary language
                </Label>
                <Input
                  id="primaryLanguage"
                  name="primaryLanguage"
                  maxLength={60}
                  placeholder="English"
                />
              </div>
            </div>
          </Card>

          {/* Section 3 — Strengths & support. */}
          <Card className="flex flex-col gap-5 p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-iw-ink">Strengths &amp; support</h2>
              <p className="text-sm text-iw-ink-muted">
                Anything you share here helps AIVO calibrate from day one. All optional.
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="readingComfort" optional>
                  Reading comfort
                </Label>
                <select
                  id="readingComfort"
                  name="readingComfort"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">Choose…</option>
                  {COMFORTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mathComfort" optional>
                  Math comfort
                </Label>
                <select
                  id="mathComfort"
                  name="mathComfort"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">Choose…</option>
                  {COMFORTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="knownStrengths" optional>
                  Known strengths
                </Label>
                <Textarea
                  id="knownStrengths"
                  name="knownStrengths"
                  rows={3}
                  placeholder="Loves animals · great at puzzles · remembers song lyrics"
                />
                <p className="text-xs text-iw-ink-muted">
                  One per line, or separate with commas. Up to 20 entries.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="knownChallenges" optional>
                  Known challenges
                </Label>
                <Textarea
                  id="knownChallenges"
                  name="knownChallenges"
                  rows={3}
                  placeholder="Easily distracted by sound · reluctant to write"
                />
              </div>
            </div>
          </Card>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button asChild variant="ghost" size="md">
              <a href="/parent/learners">Cancel</a>
            </Button>
            <Button type="submit" variant="default" size="lg">
              Add learner
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
