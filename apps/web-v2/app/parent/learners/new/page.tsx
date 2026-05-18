import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
const GRADE_BANDS = ["preK", "K", "1-2", "3-5", "6-8", "9-12", "post_secondary"];
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
      <PageHeader
        eyebrow="Parent"
        title="Add a learner"
        description="Just the basics now — you can update everything later from learner settings."
      />
      <Card className="max-w-2xl p-6">
        {params.error === "invalid" ? (
          <p className="mb-4 rounded-md border border-aivo-danger bg-aivo-danger/5 px-3 py-2 text-sm text-aivo-danger">
            Please double-check the form — at minimum we need a first name and a valid birth year.
          </p>
        ) : null}
        <form action={addLearnerAction} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required maxLength={80} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preferredName">Preferred name (optional)</Label>
            <Input
              id="preferredName"
              name="preferredName"
              maxLength={80}
              placeholder="Nickname AIVO should use"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthYear">Birth year</Label>
            <Input
              id="birthYear"
              name="birthYear"
              type="number"
              required
              min={1990}
              max={currentYear}
              placeholder={String(currentYear - 7)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pronouns">Pronouns (optional)</Label>
            <Input id="pronouns" name="pronouns" maxLength={40} placeholder="e.g. she/her" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ageRange">Age range</Label>
            <select
              id="ageRange"
              name="ageRange"
              className="h-10 rounded-lg border border-aivo-border bg-aivo-surface px-3 text-sm"
            >
              <option value="">Choose…</option>
              {AGE_RANGES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gradeBand">Grade band</Label>
            <select
              id="gradeBand"
              name="gradeBand"
              className="h-10 rounded-lg border border-aivo-border bg-aivo-surface px-3 text-sm"
            >
              <option value="">Choose…</option>
              {GRADE_BANDS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schoolContext">School context</Label>
            <select
              id="schoolContext"
              name="schoolContext"
              className="h-10 rounded-lg border border-aivo-border bg-aivo-surface px-3 text-sm"
            >
              <option value="">Choose…</option>
              {SCHOOL_CONTEXT.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primaryLanguage">Primary language</Label>
            <Input
              id="primaryLanguage"
              name="primaryLanguage"
              maxLength={60}
              placeholder="English"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="readingComfort">Reading comfort</Label>
            <select
              id="readingComfort"
              name="readingComfort"
              className="h-10 rounded-lg border border-aivo-border bg-aivo-surface px-3 text-sm"
            >
              <option value="">Choose…</option>
              {COMFORTS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mathComfort">Math comfort</Label>
            <select
              id="mathComfort"
              name="mathComfort"
              className="h-10 rounded-lg border border-aivo-border bg-aivo-surface px-3 text-sm"
            >
              <option value="">Choose…</option>
              {COMFORTS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="knownStrengths">
              Known strengths (one per line or comma-separated)
            </Label>
            <Textarea
              id="knownStrengths"
              name="knownStrengths"
              rows={3}
              placeholder="Loves animals, great at puzzles…"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="knownChallenges">Known challenges (optional)</Label>
            <Textarea
              id="knownChallenges"
              name="knownChallenges"
              rows={3}
              placeholder="Easily distracted by sound, reluctant to write…"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <Button type="submit">Add learner</Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}
