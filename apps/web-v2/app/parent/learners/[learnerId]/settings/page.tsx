import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AISuggestionsToolbar } from "@/components/forms/ai-suggestions-toolbar";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { deleteLearner, getLearner, parentCanAccessLearner, updateLearner } from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { patchLearnerSchema } from "@/lib/validators/learner";

function asStringArray(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function saveAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }

  const accessibilityDefaults = {
    reducedMotion: formData.get("a_reducedMotion") === "on",
    highContrast: formData.get("a_highContrast") === "on",
    largeText: formData.get("a_largeText") === "on",
    audioFirst: formData.get("a_audioFirst") === "on",
    captionsAlwaysOn: formData.get("a_captionsAlwaysOn") === "on",
  };

  const raw = {
    firstName: String(formData.get("firstName") || "").trim(),
    preferredName: String(formData.get("preferredName") || "").trim() || null,
    pronouns: String(formData.get("pronouns") || "").trim() || null,
    primaryLanguage: String(formData.get("primaryLanguage") || "").trim() || null,
    knownStrengths: asStringArray(String(formData.get("knownStrengths") || "")),
    knownChallenges: asStringArray(String(formData.get("knownChallenges") || "")),
    accessibilityDefaults,
  };
  const parsed = patchLearnerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/parent/learners/${learnerId}/settings?error=invalid`);
  }
  updateLearner(learnerId, session.tenantId, parsed.data);
  audit(session, "learner.update", newRequestId(), {
    learnerId,
    metadata: { source: "ui", fields: Object.keys(parsed.data) },
  });
  redirect(`/parent/learners/${learnerId}`);
}

async function deleteAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const confirm = String(formData.get("confirm") || "");
  if (confirm !== "DELETE") {
    redirect(`/parent/learners/${learnerId}/settings?error=confirm`);
  }
  deleteLearner(learnerId, session.tenantId);
  audit(session, "learner.delete", newRequestId(), { learnerId, metadata: { source: "ui" } });
  redirect("/parent/learners");
}

export default async function LearnerSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learner settings"
        title={learner.displayName}
        description="Update name, language, supports, and accessibility defaults."
      />
      {sp.error === "invalid" ? (
        <div className="mb-4 rounded-md border border-aivo-danger bg-aivo-danger/5 px-3 py-2 text-sm text-aivo-danger">
          Some details look off. Please review and try again.
        </div>
      ) : null}
      {sp.error === "confirm" ? (
        <div className="mb-4 rounded-md border border-aivo-danger bg-aivo-danger/5 px-3 py-2 text-sm text-aivo-danger">
          Type DELETE in the confirm box to remove this learner.
        </div>
      ) : null}

      <Card className="max-w-2xl p-6">
        <form action={saveAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="learnerId" value={learner.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={learner.firstName}
              required
              maxLength={80}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preferredName">Preferred name</Label>
            <Input
              id="preferredName"
              name="preferredName"
              defaultValue={learner.preferredName ?? ""}
              maxLength={80}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pronouns">Pronouns</Label>
            <Input
              id="pronouns"
              name="pronouns"
              defaultValue={learner.pronouns ?? ""}
              maxLength={40}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primaryLanguage">Primary language</Label>
            <Input
              id="primaryLanguage"
              name="primaryLanguage"
              defaultValue={learner.primaryLanguage ?? ""}
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="knownStrengths">Strengths</Label>
            <Textarea
              id="knownStrengths"
              name="knownStrengths"
              rows={3}
              defaultValue={learner.knownStrengths.join("\n")}
            />
            <AISuggestionsToolbar
              targetId="knownStrengths"
              fieldType="learner_strengths"
              context={{ ageRange: learner.ageRange, gradeBand: learner.gradeBand }}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="knownChallenges">Challenges</Label>
            <Textarea
              id="knownChallenges"
              name="knownChallenges"
              rows={3}
              defaultValue={learner.knownChallenges.join("\n")}
            />
            <AISuggestionsToolbar
              targetId="knownChallenges"
              fieldType="learner_challenges"
              context={{ ageRange: learner.ageRange, gradeBand: learner.gradeBand }}
            />
          </div>
          <fieldset className="sm:col-span-2 rounded-lg border border-aivo-border p-4">
            <legend className="px-2 text-sm font-medium">Accessibility defaults</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["a_reducedMotion", "reducedMotion", "Reduced motion"],
                  ["a_highContrast", "highContrast", "High contrast"],
                  ["a_largeText", "largeText", "Large text"],
                  ["a_audioFirst", "audioFirst", "Audio-first"],
                  ["a_captionsAlwaysOn", "captionsAlwaysOn", "Captions always on"],
                ] as const
              ).map(([name, key, label]) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={learner.accessibilityDefaults[key]}
                    className="h-4 w-4 rounded border-aivo-border"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <SectionHeader
        title="Danger zone"
        description="Removing a learner deletes their profile and assessment data."
      />
      <Card className="max-w-2xl border-aivo-danger/40 p-6">
        <form action={deleteAction} className="flex flex-col gap-3">
          <input type="hidden" name="learnerId" value={learner.id} />
          <Label htmlFor="confirm">Type DELETE to confirm</Label>
          <Input id="confirm" name="confirm" placeholder="DELETE" />
          <div className="flex justify-end">
            <Button type="submit" variant="danger">
              Remove learner
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}
