import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
import { ZipDistrictField } from "@/components/forms/zip-district-field";
import { AISuggestionsToolbar } from "@/components/forms/ai-suggestions-toolbar";

function asStringArray(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function addLearnerAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
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
    zipCode: String(formData.get("zipCode") || "").trim() || null,
    districtId: String(formData.get("districtId") || "").trim() || null,
    districtName: String(formData.get("districtName") || "").trim() || null,
  };
  const parsed = createLearnerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/parent/learners/new?error=invalid");
  }
  // District pilot seat cap (Sprint 3): refuse over-cap before creating.
  const { getTenantSeatAvailability } = await import("@/lib/db/seat-availability");
  const seats = await getTenantSeatAvailability(session.tenantId);
  if (!seats.allowed) {
    redirect("/parent/learners/new?error=seat_limit");
  }
  const learner = await createLearner({
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
const GRADE_BANDS: { value: string; labelKey: string }[] = [
  { value: "preK", labelKey: "grade_preK" },
  { value: "K", labelKey: "grade_K" },
  { value: "1-2", labelKey: "grade_1_2" },
  { value: "3-5", labelKey: "grade_3_5" },
  { value: "6-8", labelKey: "grade_6_8" },
  { value: "9-12", labelKey: "grade_9_12" },
  { value: "post_secondary", labelKey: "grade_post_secondary" },
];
const SCHOOL_CONTEXT: { value: string; labelKey: string }[] = [
  { value: "in_school", labelKey: "school_in_school" },
  { value: "homeschool", labelKey: "school_homeschool" },
  { value: "hybrid", labelKey: "school_hybrid" },
  { value: "not_in_school", labelKey: "school_not_in_school" },
];
const COMFORTS: { value: string; labelKey: string }[] = [
  { value: "new", labelKey: "comfort_new" },
  { value: "growing", labelKey: "comfort_growing" },
  { value: "confident", labelKey: "comfort_confident" },
  { value: "advanced", labelKey: "comfort_advanced" },
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
  const t = await getTranslations("parent.add_learner");

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title={t("title")} description={t("description")} />

        {params.error === "invalid" && (
          <Banner
            tone="danger"
            title={t("error_invalid_title")}
            description={t("error_invalid_description")}
          />
        )}

        <form action={addLearnerAction} className="flex flex-col gap-6">
          {/* Section 1 — About your learner. */}
          <Card className="flex flex-col gap-5 p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-iw-ink">{t("section_about_title")}</h2>
              <p className="text-sm text-iw-ink-muted">{t("section_about_description")}</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName" required>
                  {t("first_name")}
                </Label>
                <Input id="firstName" name="firstName" required maxLength={80} autoComplete="off" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="preferredName" optional>
                  {t("preferred_name")}
                </Label>
                <Input
                  id="preferredName"
                  name="preferredName"
                  maxLength={80}
                  placeholder={t("preferred_name_placeholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="birthYear" required>
                  {t("birth_year")}
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
                  {t("pronouns")}
                </Label>
                <Input
                  id="pronouns"
                  name="pronouns"
                  maxLength={40}
                  placeholder={t("pronouns_placeholder")}
                />
              </div>
            </div>
          </Card>

          {/* Section 2 — School & language. */}
          <Card className="flex flex-col gap-5 p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-iw-ink">{t("section_school_title")}</h2>
              <p className="text-sm text-iw-ink-muted">{t("section_school_description")}</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                {/* Sprint A6 — the age range drives the COPPA consent
                    regime (recordAgeGate); collection is now REQUIRED.
                    Server stays fail-closed (missing ⇒ under-13). */}
                <Label htmlFor="ageRange">{t("age_range")}</Label>
                <select
                  id="ageRange"
                  name="ageRange"
                  required
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">{t("choose")}</option>
                  {AGE_RANGES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gradeBand" optional>
                  {t("grade_band")}
                </Label>
                <select
                  id="gradeBand"
                  name="gradeBand"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">{t("choose")}</option>
                  {GRADE_BANDS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {t(v.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="schoolContext" optional>
                  {t("school_context")}
                </Label>
                <select
                  id="schoolContext"
                  name="schoolContext"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">{t("choose")}</option>
                  {SCHOOL_CONTEXT.map((v) => (
                    <option key={v.value} value={v.value}>
                      {t(v.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="primaryLanguage" optional>
                  {t("primary_language")}
                </Label>
                <Input
                  id="primaryLanguage"
                  name="primaryLanguage"
                  maxLength={60}
                  placeholder={t("primary_language_placeholder")}
                />
              </div>
              <div className="sm:col-span-2">
                <ZipDistrictField />
              </div>
            </div>
          </Card>

          {/* Section 3 — Strengths & support. */}
          <Card className="flex flex-col gap-5 p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-iw-ink">
                {t("section_strengths_title")}
              </h2>
              <p className="text-sm text-iw-ink-muted">{t("section_strengths_description")}</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="readingComfort" optional>
                  {t("reading_comfort")}
                </Label>
                <select
                  id="readingComfort"
                  name="readingComfort"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">{t("choose")}</option>
                  {COMFORTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {t(v.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mathComfort" optional>
                  {t("math_comfort")}
                </Label>
                <select
                  id="mathComfort"
                  name="mathComfort"
                  defaultValue=""
                  className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
                >
                  <option value="">{t("choose")}</option>
                  {COMFORTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {t(v.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="knownStrengths" optional>
                  {t("known_strengths")}
                </Label>
                <Textarea
                  id="knownStrengths"
                  name="knownStrengths"
                  rows={3}
                  placeholder={t("known_strengths_placeholder")}
                />
                <AISuggestionsToolbar targetId="knownStrengths" fieldType="learner_strengths" />
                <p className="text-xs text-iw-ink-muted">{t("known_strengths_help")}</p>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="knownChallenges" optional>
                  {t("known_challenges")}
                </Label>
                <Textarea
                  id="knownChallenges"
                  name="knownChallenges"
                  rows={3}
                  placeholder={t("known_challenges_placeholder")}
                />
                <AISuggestionsToolbar targetId="knownChallenges" fieldType="learner_challenges" />
              </div>
            </div>
          </Card>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button asChild variant="ghost" size="md">
              <a href="/parent/learners">{t("cancel")}</a>
            </Button>
            <Button type="submit" variant="default" size="lg">
              {t("submit")}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
