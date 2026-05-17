import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stepper } from "@/components/ui/stepper";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  patchParentAssessmentSection,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import {
  WIZARD_STEPS,
  validateSection,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";
import type { ParentAssessment } from "@/lib/db/types";

function parseList(raw: string, max = 10): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

async function saveStepAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  const stepNum = Number.parseInt(String(formData.get("step") || "1"), 10);
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const step = WIZARD_STEPS.find((s) => s.id === stepNum);
  if (!step) redirect(`/parent/learners/${learnerId}/assessment?step=1`);

  // Build a per-section answer object from form fields prefixed `<section>.<field>`.
  const failures: string[] = [];
  for (const sectionId of step!.sections) {
    const sectionData: Record<string, unknown> = {};
    switch (sectionId) {
      case "goals":
        sectionData.goals = parseList(String(formData.get("goals.goals") || ""), 8);
        sectionData.timeline = String(formData.get("goals.timeline") || "") || undefined;
        break;
      case "grade_subject":
        sectionData.gradeBand = String(formData.get("grade_subject.gradeBand") || "");
        sectionData.focusSubjects = formData
          .getAll("grade_subject.focusSubjects")
          .map(String);
        break;
      case "reading":
        sectionData.comfort = String(formData.get("reading.comfort") || "");
        sectionData.notes = String(formData.get("reading.notes") || "") || undefined;
        break;
      case "math":
        sectionData.comfort = String(formData.get("math.comfort") || "");
        sectionData.notes = String(formData.get("math.notes") || "") || undefined;
        break;
      case "attention":
        sectionData.focusWindowMinutes = Number.parseInt(
          String(formData.get("attention.focusWindowMinutes") || "10"),
          10,
        );
        sectionData.breakStyle = String(formData.get("attention.breakStyle") || "");
        sectionData.movementHelps = formData.get("attention.movementHelps") === "on";
        break;
      case "communication":
        sectionData.style = String(formData.get("communication.style") || "");
        sectionData.aacUsed = formData.get("communication.aacUsed") === "on";
        sectionData.notes = String(formData.get("communication.notes") || "") || undefined;
        break;
      case "sensory":
        sectionData.sensitivities = formData.getAll("sensory.sensitivities").map(String);
        sectionData.seekingOrAvoiding =
          String(formData.get("sensory.seekingOrAvoiding") || "") || undefined;
        break;
      case "homework":
        sectionData.needsCoaching = formData.get("homework.needsCoaching") === "on";
        sectionData.bestTimeOfDay = String(formData.get("homework.bestTimeOfDay") || "");
        sectionData.typicalSessionMinutes =
          Number.parseInt(String(formData.get("homework.typicalSessionMinutes") || "0"), 10) ||
          undefined;
        break;
      case "frustration":
        sectionData.triggers = parseList(String(formData.get("frustration.triggers") || ""));
        sectionData.calmingStrategies = parseList(
          String(formData.get("frustration.calmingStrategies") || ""),
        );
        break;
      case "motivation":
        sectionData.rewardsThatHelp = parseList(
          String(formData.get("motivation.rewardsThatHelp") || ""),
        );
        sectionData.avoidanceFactors = parseList(
          String(formData.get("motivation.avoidanceFactors") || ""),
        );
        break;
      case "accommodations":
        sectionData.known = parseList(String(formData.get("accommodations.known") || ""), 20);
        sectionData.extendedTime = formData.get("accommodations.extendedTime") === "on";
        sectionData.readAloud = formData.get("accommodations.readAloud") === "on";
        sectionData.speechToText = formData.get("accommodations.speechToText") === "on";
        break;
      case "pace":
        sectionData.preferred = String(formData.get("pace.preferred") || "");
        break;
      case "concerns":
        sectionData.concerns = String(formData.get("concerns.concerns") || "");
        break;
      case "basics": {
        const dob = String(formData.get("basics.dob") || "").trim();
        if (dob) sectionData.dob = dob;
        const pronouns = String(formData.get("basics.pronouns") || "").trim();
        if (pronouns) sectionData.pronouns = pronouns;
        const langs = parseList(String(formData.get("basics.languages") || ""), 5);
        if (langs.length > 0) sectionData.languages = langs;
        break;
      }
      case "strengths": {
        const loves = String(formData.get("strengths.loves") || "").trim();
        if (loves) sectionData.loves = loves;
        const goodAt = parseList(String(formData.get("strengths.goodAt") || ""), 10);
        if (goodAt.length > 0) sectionData.goodAt = goodAt;
        const motivates = String(formData.get("strengths.motivates") || "").trim();
        if (motivates) sectionData.motivates = motivates;
        break;
      }
      case "background": {
        const diagnoses = formData.getAll("background.diagnoses").map(String).filter(Boolean);
        const otherDiag = String(formData.get("background.diagnosesOther") || "").trim();
        if (otherDiag) diagnoses.push(...parseList(otherDiag, 5));
        if (diagnoses.length > 0) sectionData.diagnoses = diagnoses;
        const services = formData.getAll("background.services").map(String).filter(Boolean);
        if (services.length > 0) sectionData.services = services;
        break;
      }
      case "learning_profile": {
        const cm = String(formData.get("learning_profile.communicationMode") || "");
        if (cm) sectionData.communicationMode = cm;
        const di = String(formData.get("learning_profile.deviceInteraction") || "");
        if (di) sectionData.deviceInteraction = di;
        const rm = String(formData.get("learning_profile.responseMethod") || "");
        if (rm) sectionData.responseMethod = rm;
        const asb = String(formData.get("learning_profile.attentionSpanBucket") || "");
        if (asb) sectionData.attentionSpanBucket = asb;
        const bestModes = formData
          .getAll("learning_profile.bestModes")
          .map(String)
          .filter(Boolean);
        if (bestModes.length > 0) sectionData.bestModes = bestModes;
        break;
      }
    }
    const v = validateSection(sectionId, sectionData);
    if (!v.ok) {
      failures.push(sectionId);
      continue;
    }
    patchParentAssessmentSection(learnerId, session.tenantId, sectionId, v.data);
    audit(session, "parent_assessment.section.patch", newRequestId(), {
      learnerId,
      metadata: { section: sectionId, source: "ui" },
    });
  }
  refreshLearnerReadiness(learnerId, session.tenantId);

  if (failures.length > 0) {
    redirect(
      `/parent/learners/${learnerId}/assessment?step=${stepNum}&error=${encodeURIComponent(
        failures.join(","),
      )}`,
    );
  }
  const nextStep = WIZARD_STEPS.find((s) => s.id === stepNum + 1);
  if (nextStep) {
    redirect(`/parent/learners/${learnerId}/assessment?step=${nextStep.id}`);
  }
  redirect(`/parent/learners/${learnerId}/assessment/review`);
}

function sectionAnswers(
  assessment: ParentAssessment,
  section: AssessmentSectionId,
): Record<string, unknown> {
  return (assessment.answers[section] ?? {}) as Record<string, unknown>;
}

function fieldString(
  assessment: ParentAssessment,
  section: AssessmentSectionId,
  field: string,
): string {
  const v = sectionAnswers(assessment, section)[field];
  if (Array.isArray(v)) return v.join("\n");
  if (v === undefined || v === null) return "";
  return String(v);
}

function fieldArray(
  assessment: ParentAssessment,
  section: AssessmentSectionId,
  field: string,
): string[] {
  const v = sectionAnswers(assessment, section)[field];
  return Array.isArray(v) ? (v as string[]) : [];
}

function fieldBool(
  assessment: ParentAssessment,
  section: AssessmentSectionId,
  field: string,
): boolean {
  return Boolean(sectionAnswers(assessment, section)[field]);
}

export default async function AssessmentWizard({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const stepNum = Math.max(
    1,
    Math.min(WIZARD_STEPS.length, Number.parseInt(sp.step || "1", 10) || 1),
  );
  const step = WIZARD_STEPS.find((s) => s.id === stepNum)!;
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);

  const selectClass =
    "h-10 rounded-lg border border-aivo-border bg-aivo-surface px-3 text-sm";

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`Parent assessment for ${learner.displayName}`}
        title={step.label}
        description="Plain-language questions only. No diagnosis required. Your answers autosave as you move forward."
      />
      <Stepper
        steps={WIZARD_STEPS.map((s) => ({ label: s.label }))}
        current={stepNum - 1}
        className="mb-6"
      />
      {sp.error ? (
        <div className="mb-4 rounded-md border border-aivo-danger bg-aivo-danger/5 px-3 py-2 text-sm text-aivo-danger">
          We couldn't save: {sp.error}. Please review the highlighted fields and try again.
        </div>
      ) : null}

      <Card className="max-w-3xl p-6">
        <form action={saveStepAction} className="flex flex-col gap-6">
          <input type="hidden" name="learnerId" value={learner.id} />
          <input type="hidden" name="step" value={stepNum} />

          {step.sections.map((s) => (
            <fieldset key={s} className="rounded-lg border border-aivo-border p-4">
              <legend className="px-2 text-sm font-medium">
                {sectionTitle(s)}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {s === "goals" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="goals.goals">
                        What do you want AIVO to help with? (one per line)
                      </Label>
                      <Textarea
                        id="goals.goals"
                        name="goals.goals"
                        rows={3}
                        defaultValue={fieldString(assessment, "goals", "goals")}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="goals.timeline">Timeline</Label>
                      <select
                        id="goals.timeline"
                        name="goals.timeline"
                        className={selectClass}
                        defaultValue={fieldString(assessment, "goals", "timeline")}
                      >
                        <option value="">Choose…</option>
                        <option value="weeks">In a few weeks</option>
                        <option value="this_term">This term</option>
                        <option value="this_year">This year</option>
                        <option value="long_term">Long term</option>
                      </select>
                    </div>
                  </>
                )}

                {s === "grade_subject" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="grade_subject.gradeBand">Grade band</Label>
                      <select
                        id="grade_subject.gradeBand"
                        name="grade_subject.gradeBand"
                        className={selectClass}
                        required
                        defaultValue={fieldString(assessment, "grade_subject", "gradeBand")}
                      >
                        <option value="">Choose…</option>
                        {["preK", "K", "1-2", "3-5", "6-8", "9-12", "post_secondary"].map(
                          (v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label>Focus subjects</Label>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {["Reading", "Math", "Writing", "Science", "Social", "Life", "Art"].map(
                          (subj) => {
                            const current = fieldArray(
                              assessment,
                              "grade_subject",
                              "focusSubjects",
                            );
                            return (
                              <label key={subj} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  name="grade_subject.focusSubjects"
                                  value={subj}
                                  defaultChecked={current.includes(subj)}
                                  className="h-4 w-4 rounded border-aivo-border"
                                />
                                {subj}
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(s === "reading" || s === "math") && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${s}.comfort`}>Comfort</Label>
                      <select
                        id={`${s}.comfort`}
                        name={`${s}.comfort`}
                        className={selectClass}
                        required
                        defaultValue={fieldString(assessment, s, "comfort")}
                      >
                        <option value="">Choose…</option>
                        <option value="new">Just starting</option>
                        <option value="growing">Growing</option>
                        <option value="confident">Confident</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor={`${s}.notes`}>Notes (optional)</Label>
                      <Textarea
                        id={`${s}.notes`}
                        name={`${s}.notes`}
                        rows={2}
                        defaultValue={fieldString(assessment, s, "notes")}
                      />
                    </div>
                  </>
                )}

                {s === "attention" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="attention.focusWindowMinutes">
                        Typical focus window (minutes)
                      </Label>
                      <Input
                        id="attention.focusWindowMinutes"
                        name="attention.focusWindowMinutes"
                        type="number"
                        min={1}
                        max={120}
                        required
                        defaultValue={fieldString(assessment, "attention", "focusWindowMinutes") || 10}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="attention.breakStyle">Break style</Label>
                      <select
                        id="attention.breakStyle"
                        name="attention.breakStyle"
                        className={selectClass}
                        required
                        defaultValue={fieldString(assessment, "attention", "breakStyle")}
                      >
                        <option value="">Choose…</option>
                        <option value="frequent_short">Frequent short breaks</option>
                        <option value="occasional">Occasional breaks</option>
                        <option value="long_uninterrupted">Long uninterrupted blocks</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="attention.movementHelps"
                        defaultChecked={fieldBool(assessment, "attention", "movementHelps")}
                        className="h-4 w-4 rounded border-aivo-border"
                      />
                      Movement helps with focus
                    </label>
                  </>
                )}

                {s === "communication" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="communication.style">Style</Label>
                      <select
                        id="communication.style"
                        name="communication.style"
                        className={selectClass}
                        required
                        defaultValue={fieldString(assessment, "communication", "style")}
                      >
                        <option value="">Choose…</option>
                        <option value="spoken">Spoken</option>
                        <option value="written">Written</option>
                        <option value="visual">Visual</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="communication.aacUsed"
                        defaultChecked={fieldBool(assessment, "communication", "aacUsed")}
                        className="h-4 w-4 rounded border-aivo-border"
                      />
                      Uses AAC tools
                    </label>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="communication.notes">Notes (optional)</Label>
                      <Textarea
                        id="communication.notes"
                        name="communication.notes"
                        rows={2}
                        defaultValue={fieldString(assessment, "communication", "notes")}
                      />
                    </div>
                  </>
                )}

                {s === "sensory" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label>Sensitivities</Label>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {["sound", "light", "touch", "movement", "smell", "taste"].map((v) => {
                          const cur = fieldArray(assessment, "sensory", "sensitivities");
                          return (
                            <label key={v} className="flex items-center gap-2 text-sm capitalize">
                              <input
                                type="checkbox"
                                name="sensory.sensitivities"
                                value={v}
                                defaultChecked={cur.includes(v)}
                                className="h-4 w-4 rounded border-aivo-border"
                              />
                              {v}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sensory.seekingOrAvoiding">Pattern</Label>
                      <select
                        id="sensory.seekingOrAvoiding"
                        name="sensory.seekingOrAvoiding"
                        className={selectClass}
                        defaultValue={fieldString(assessment, "sensory", "seekingOrAvoiding")}
                      >
                        <option value="">Choose…</option>
                        <option value="seeking">Seeking</option>
                        <option value="avoiding">Avoiding</option>
                        <option value="mixed">Mixed</option>
                        <option value="neutral">Neutral</option>
                      </select>
                    </div>
                  </>
                )}

                {s === "homework" && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="homework.needsCoaching"
                        defaultChecked={fieldBool(assessment, "homework", "needsCoaching")}
                        className="h-4 w-4 rounded border-aivo-border"
                      />
                      Needs coaching to start homework
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="homework.bestTimeOfDay">Best time of day</Label>
                      <select
                        id="homework.bestTimeOfDay"
                        name="homework.bestTimeOfDay"
                        className={selectClass}
                        required
                        defaultValue={fieldString(assessment, "homework", "bestTimeOfDay")}
                      >
                        <option value="">Choose…</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                        <option value="varies">It varies</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="homework.typicalSessionMinutes">
                        Typical session (minutes, optional)
                      </Label>
                      <Input
                        id="homework.typicalSessionMinutes"
                        name="homework.typicalSessionMinutes"
                        type="number"
                        min={0}
                        max={180}
                        defaultValue={fieldString(
                          assessment,
                          "homework",
                          "typicalSessionMinutes",
                        )}
                      />
                    </div>
                  </>
                )}

                {s === "frustration" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="frustration.triggers">Triggers (one per line)</Label>
                      <Textarea
                        id="frustration.triggers"
                        name="frustration.triggers"
                        rows={3}
                        defaultValue={fieldString(assessment, "frustration", "triggers")}
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="frustration.calmingStrategies">
                        Calming strategies (one per line)
                      </Label>
                      <Textarea
                        id="frustration.calmingStrategies"
                        name="frustration.calmingStrategies"
                        rows={3}
                        defaultValue={fieldString(
                          assessment,
                          "frustration",
                          "calmingStrategies",
                        )}
                      />
                    </div>
                  </>
                )}

                {s === "motivation" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="motivation.rewardsThatHelp">
                        Rewards that help (one per line)
                      </Label>
                      <Textarea
                        id="motivation.rewardsThatHelp"
                        name="motivation.rewardsThatHelp"
                        rows={3}
                        defaultValue={fieldString(assessment, "motivation", "rewardsThatHelp")}
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="motivation.avoidanceFactors">
                        Things to avoid (optional, one per line)
                      </Label>
                      <Textarea
                        id="motivation.avoidanceFactors"
                        name="motivation.avoidanceFactors"
                        rows={3}
                        defaultValue={fieldString(assessment, "motivation", "avoidanceFactors")}
                      />
                    </div>
                  </>
                )}

                {s === "accommodations" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="accommodations.known">
                        Known accommodations (one per line)
                      </Label>
                      <Textarea
                        id="accommodations.known"
                        name="accommodations.known"
                        rows={3}
                        defaultValue={fieldString(assessment, "accommodations", "known")}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="accommodations.extendedTime"
                        defaultChecked={fieldBool(assessment, "accommodations", "extendedTime")}
                        className="h-4 w-4 rounded border-aivo-border"
                      />
                      Extended time
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="accommodations.readAloud"
                        defaultChecked={fieldBool(assessment, "accommodations", "readAloud")}
                        className="h-4 w-4 rounded border-aivo-border"
                      />
                      Read-aloud
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="accommodations.speechToText"
                        defaultChecked={fieldBool(assessment, "accommodations", "speechToText")}
                        className="h-4 w-4 rounded border-aivo-border"
                      />
                      Speech-to-text
                    </label>
                  </>
                )}

                {s === "pace" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pace.preferred">Preferred pace</Label>
                    <select
                      id="pace.preferred"
                      name="pace.preferred"
                      className={selectClass}
                      required
                      defaultValue={fieldString(assessment, "pace", "preferred")}
                    >
                      <option value="">Choose…</option>
                      <option value="slow">Slow and steady</option>
                      <option value="steady">Steady</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>
                )}

                {s === "concerns" && (
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <Label htmlFor="concerns.concerns">
                      Anything else you want AIVO to know
                    </Label>
                    <Textarea
                      id="concerns.concerns"
                      name="concerns.concerns"
                      rows={4}
                      required
                      defaultValue={fieldString(assessment, "concerns", "concerns")}
                    />
                  </div>
                )}

                {s === "basics" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="basics.dob">Date of birth (optional)</Label>
                      <Input
                        id="basics.dob"
                        name="basics.dob"
                        type="date"
                        defaultValue={fieldString(assessment, "basics", "dob")}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="basics.pronouns">Pronouns (optional)</Label>
                      <Input
                        id="basics.pronouns"
                        name="basics.pronouns"
                        placeholder="she/her, he/him, they/them"
                        defaultValue={fieldString(assessment, "basics", "pronouns")}
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="basics.languages">
                        Languages spoken at home (comma or new-line separated)
                      </Label>
                      <Input
                        id="basics.languages"
                        name="basics.languages"
                        placeholder="English, Spanish"
                        defaultValue={fieldString(assessment, "basics", "languages")}
                      />
                    </div>
                  </>
                )}

                {s === "strengths" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="strengths.loves">What does your child love?</Label>
                      <Textarea
                        id="strengths.loves"
                        name="strengths.loves"
                        rows={2}
                        placeholder="Dinosaurs, drawing, building with blocks…"
                        defaultValue={fieldString(assessment, "strengths", "loves")}
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="strengths.goodAt">
                        What are they good at? (comma or new-line separated)
                      </Label>
                      <Textarea
                        id="strengths.goodAt"
                        name="strengths.goodAt"
                        rows={2}
                        placeholder="Memorising songs, puzzles, kindness…"
                        defaultValue={fieldString(assessment, "strengths", "goodAt")}
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="strengths.motivates">What motivates them?</Label>
                      <Textarea
                        id="strengths.motivates"
                        name="strengths.motivates"
                        rows={2}
                        placeholder="Earning stickers, praise, choosing the next activity…"
                        defaultValue={fieldString(assessment, "strengths", "motivates")}
                      />
                    </div>
                  </>
                )}

                {s === "background" && (
                  <>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label>Diagnoses (check all that apply — optional)</Label>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {[
                          "ADHD",
                          "Autism",
                          "Dyslexia",
                          "Dyscalculia",
                          "Dysgraphia",
                          "Anxiety",
                          "Speech delay",
                          "Sensory processing",
                          "Down syndrome",
                          "Hearing loss",
                          "Vision impairment",
                          "Other",
                        ].map((v) => {
                          const cur = fieldArray(assessment, "background", "diagnoses");
                          return (
                            <label key={v} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="background.diagnoses"
                                value={v}
                                defaultChecked={cur.includes(v)}
                                className="h-4 w-4 rounded border-aivo-border"
                              />
                              {v}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="background.diagnosesOther">
                        Add another (optional, comma or new-line separated)
                      </Label>
                      <Input
                        id="background.diagnosesOther"
                        name="background.diagnosesOther"
                        placeholder="e.g. Tourette syndrome"
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label>Support services they currently receive</Label>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {[
                          "Speech therapy",
                          "Occupational therapy",
                          "Physical therapy",
                          "ABA",
                          "Counseling",
                          "Resource room",
                          "Tutoring",
                          "None",
                        ].map((v) => {
                          const cur = fieldArray(assessment, "background", "services");
                          return (
                            <label key={v} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="background.services"
                                value={v}
                                defaultChecked={cur.includes(v)}
                                className="h-4 w-4 rounded border-aivo-border"
                              />
                              {v}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {s === "learning_profile" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="learning_profile.communicationMode">
                        Communication mode
                      </Label>
                      <select
                        id="learning_profile.communicationMode"
                        name="learning_profile.communicationMode"
                        className={selectClass}
                        defaultValue={fieldString(
                          assessment,
                          "learning_profile",
                          "communicationMode",
                        )}
                      >
                        <option value="">Choose…</option>
                        <option value="verbal">Verbal</option>
                        <option value="sign">Sign language</option>
                        <option value="aac">AAC device</option>
                        <option value="non_verbal">Non-verbal</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="learning_profile.deviceInteraction">
                        Uses tablet/computer
                      </Label>
                      <select
                        id="learning_profile.deviceInteraction"
                        name="learning_profile.deviceInteraction"
                        className={selectClass}
                        defaultValue={fieldString(
                          assessment,
                          "learning_profile",
                          "deviceInteraction",
                        )}
                      >
                        <option value="">Choose…</option>
                        <option value="independent">Independently</option>
                        <option value="with_prompts">With prompts</option>
                        <option value="hand_over_hand">With hand-over-hand support</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="learning_profile.responseMethod">
                        How they respond
                      </Label>
                      <select
                        id="learning_profile.responseMethod"
                        name="learning_profile.responseMethod"
                        className={selectClass}
                        defaultValue={fieldString(
                          assessment,
                          "learning_profile",
                          "responseMethod",
                        )}
                      >
                        <option value="">Choose…</option>
                        <option value="touch">Touch / tap</option>
                        <option value="voice">Voice</option>
                        <option value="switch">Switch / button</option>
                        <option value="eye_gaze">Eye gaze</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="learning_profile.attentionSpanBucket">
                        Typical attention span
                      </Label>
                      <select
                        id="learning_profile.attentionSpanBucket"
                        name="learning_profile.attentionSpanBucket"
                        className={selectClass}
                        defaultValue={fieldString(
                          assessment,
                          "learning_profile",
                          "attentionSpanBucket",
                        )}
                      >
                        <option value="">Choose…</option>
                        <option value="under_5">Under 5 minutes</option>
                        <option value="5_10">5–10 minutes</option>
                        <option value="10_20">10–20 minutes</option>
                        <option value="20_plus">20+ minutes</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label>Best learning modes (check all that apply)</Label>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                        {[
                          { v: "visual", l: "Visual" },
                          { v: "auditory", l: "Auditory" },
                          { v: "kinesthetic", l: "Hands-on" },
                          { v: "reading_writing", l: "Reading / writing" },
                        ].map(({ v, l }) => {
                          const cur = fieldArray(
                            assessment,
                            "learning_profile",
                            "bestModes",
                          );
                          return (
                            <label key={v} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="learning_profile.bestModes"
                                value={v}
                                defaultChecked={cur.includes(v)}
                                className="h-4 w-4 rounded border-aivo-border"
                              />
                              {l}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {stepNum > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={`/parent/learners/${learner.id}/assessment?step=${stepNum - 1}`}
                  >
                    Back
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/parent/learners/${learner.id}`}>Exit without saving</Link>
                </Button>
              )}
            </div>
            <Button type="submit">
              {stepNum < WIZARD_STEPS.length ? "Save and continue" : "Save and review"}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}

function sectionTitle(s: AssessmentSectionId): string {
  const titles: Record<AssessmentSectionId, string> = {
    basics: "About your child",
    goals: "Learning goals",
    background: "Background & support services",
    strengths: "Strengths & what motivates them",
    grade_subject: "Grade and focus subjects",
    reading: "Reading confidence",
    math: "Math confidence",
    attention: "Attention and focus",
    communication: "Communication style",
    learning_profile: "Learning profile",
    sensory: "Sensory preferences",
    homework: "Homework habits",
    frustration: "Frustration triggers and calming",
    motivation: "Motivation",
    accommodations: "Known accommodations",
    pace: "Preferred pace",
    concerns: "Your concerns",
  };
  return titles[s];
}
