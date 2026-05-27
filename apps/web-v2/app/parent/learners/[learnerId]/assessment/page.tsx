import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  AssessmentProgress,
  QuestionCard,
  PillCardGroup,
  ScaleField,
  SoftTextField,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  ASSESSMENT_GHOST_CLASS,
  ReassuranceCard,
} from "@aivo/ui";
import { AISuggestionsToolbar } from "@/components/forms/ai-suggestions-toolbar";
import type { FieldType, SuggestionContext } from "@/lib/ai/suggestions";
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

/* ----- helpers -------------------------------------------------------------- */

function parseList(raw: string, max = 10): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
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
  if (Array.isArray(v)) return v.join(", ");
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

function fieldNumber(
  assessment: ParentAssessment,
  section: AssessmentSectionId,
  field: string,
): number | undefined {
  const v = sectionAnswers(assessment, section)[field];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v) return Number(v) || undefined;
  return undefined;
}

/* ----- server action -------------------------------------------------------- */

async function saveStepAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  const stepNum = Number.parseInt(String(formData.get("step") || "1"), 10);
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const step = WIZARD_STEPS.find((s) => s.id === stepNum);
  if (!step) redirect(`/parent/learners/${learnerId}/assessment?step=1`);

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
        sectionData.focusSubjects = formData.getAll("grade_subject.focusSubjects").map(String);
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
      case "accommodations": {
        const known = parseList(String(formData.get("accommodations.known") || ""), 20);
        sectionData.known = known;
        sectionData.extendedTime = formData.get("accommodations.extendedTime") === "on";
        sectionData.readAloud = formData.get("accommodations.readAloud") === "on";
        sectionData.speechToText = formData.get("accommodations.speechToText") === "on";
        break;
      }
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
  await refreshLearnerReadiness(learnerId, session.tenantId);

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

/* ----- option lists --------------------------------------------------------- */

const GRADE_OPTIONS = [
  { value: "preK", label: "Pre-K", description: "Before kindergarten" },
  { value: "K", label: "Kindergarten" },
  { value: "1-2", label: "Grades 1–2", description: "Early elementary" },
  { value: "3-5", label: "Grades 3–5", description: "Upper elementary" },
  { value: "6-8", label: "Grades 6–8", description: "Middle school" },
  { value: "9-12", label: "Grades 9–12", description: "High school" },
  { value: "post_secondary", label: "Post-secondary", description: "After high school" },
];

const SUBJECT_OPTIONS = [
  { value: "math", label: "Math" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "science", label: "Science" },
  { value: "social_studies", label: "Social studies" },
  { value: "coding", label: "Coding / AI literacy" },
  { value: "social_skills", label: "Social skills" },
];

const COMFORT_SCALE = [
  {
    value: "new",
    label: "Just starting",
    description: "Brand new to the topic. We'll start gently.",
  },
  {
    value: "growing",
    label: "Building",
    description: "Recognises basics, still practising consistency.",
  },
  {
    value: "confident",
    label: "On grade",
    description: "Comfortable at age-typical work most days.",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Wants more challenge than the typical grade gives.",
  },
];

const BREAK_STYLE = [
  { value: "frequent_short", label: "Frequent short breaks", description: "Every 5–10 minutes works best." },
  { value: "occasional", label: "Occasional breaks", description: "Every 15–25 minutes." },
  { value: "long_uninterrupted", label: "Long stretches", description: "Can focus 30+ minutes once warmed up." },
];

const COMMUNICATION_STYLE = [
  { value: "spoken", label: "Spoken", description: "Talks through ideas out loud." },
  { value: "written", label: "Written", description: "Prefers writing or typing." },
  { value: "visual", label: "Visual", description: "Pictures, drawings, gestures." },
  { value: "mixed", label: "Mixed", description: "Switches depending on the moment." },
];

const PACE_OPTIONS = [
  { value: "slow", label: "Slower", description: "Lots of time to think, repeat as needed." },
  { value: "steady", label: "Steady", description: "A predictable, even rhythm." },
  { value: "fast", label: "Faster", description: "Likes momentum, more in one sitting." },
];

const SENSORY_OPTIONS = [
  { value: "sound", label: "Sound" },
  { value: "light", label: "Light" },
  { value: "touch", label: "Touch" },
  { value: "movement", label: "Movement" },
  { value: "smell", label: "Smell" },
  { value: "taste", label: "Taste" },
];

const SENSORY_PROFILE = [
  { value: "seeking", label: "Seeking", description: "Wants more sensory input." },
  { value: "avoiding", label: "Avoiding", description: "Prefers less input." },
  { value: "mixed", label: "A mix", description: "Depends on the day." },
  { value: "neutral", label: "Not noticeable", description: "Sensory hasn't been a factor." },
];

const TIME_OF_DAY = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "varies", label: "Varies", description: "We adjust day to day." },
];

const GOAL_TIMELINE = [
  { value: "weeks", label: "Next few weeks" },
  { value: "this_term", label: "This term" },
  { value: "this_year", label: "This year" },
  { value: "long_term", label: "Long term" },
];

const DIAGNOSES_OPTIONS = [
  { value: "adhd", label: "ADHD" },
  { value: "autism", label: "Autism spectrum" },
  { value: "dyslexia", label: "Dyslexia" },
  { value: "dyscalculia", label: "Dyscalculia" },
  { value: "dysgraphia", label: "Dysgraphia" },
  { value: "anxiety", label: "Anxiety" },
  { value: "speech_language", label: "Speech / language" },
  { value: "sensory", label: "Sensory processing" },
  { value: "twice_exceptional", label: "Twice-exceptional" },
];

const SERVICES_OPTIONS = [
  { value: "speech", label: "Speech therapy" },
  { value: "occupational", label: "Occupational therapy" },
  { value: "physical", label: "Physical therapy" },
  { value: "counseling", label: "Counseling" },
  { value: "aba", label: "ABA" },
  { value: "tutor", label: "Tutoring" },
  { value: "rti", label: "RTI / MTSS" },
];

const COMM_MODE = [
  { value: "verbal", label: "Verbal" },
  { value: "sign", label: "Sign" },
  { value: "aac", label: "AAC" },
  { value: "non_verbal", label: "Non-verbal" },
];

const DEVICE_INTERACTION = [
  { value: "independent", label: "Independent" },
  { value: "with_prompts", label: "With prompts" },
  { value: "hand_over_hand", label: "Hand over hand" },
];

const RESPONSE_METHOD = [
  { value: "touch", label: "Touch" },
  { value: "voice", label: "Voice" },
  { value: "switch", label: "Switch" },
  { value: "eye_gaze", label: "Eye gaze" },
];

const BEST_MODES = [
  { value: "visual", label: "Visual" },
  { value: "auditory", label: "Auditory" },
  { value: "kinesthetic", label: "Hands-on" },
  { value: "reading_writing", label: "Reading / writing" },
];

const ATTENTION_BUCKET = [
  { value: "under_5", label: "Under 5 min" },
  { value: "5_10", label: "5–10 min" },
  { value: "10_20", label: "10–20 min" },
  { value: "20_plus", label: "20+ min" },
];

const ERROR_MESSAGES: Record<string, string> = {
  basics: "Please double-check the dates and pronouns.",
  background: "Please review the background fields.",
  strengths: "Please review the strengths fields.",
  frustration: "Please review the challenges fields.",
  grade_subject: "Pick a grade band and at least one subject to continue.",
  attention: "Please choose how breaks work best.",
  pace: "Please choose a pace.",
  communication: "Please choose a communication style.",
  learning_profile: "Please review the learning profile fields.",
  reading: "Please pick a reading comfort level.",
  math: "Please pick a math comfort level.",
  sensory: "Please review the sensory fields.",
  accommodations: "Please review the supports fields.",
  homework: "Please choose a best time of day.",
  goals: "Please share at least one learning goal.",
  motivation: "Please review the motivation fields.",
  concerns: "Please review the concerns field.",
};

/* ----- screen renderer ------------------------------------------------------ */

function ReassuranceColumn({ stepNum }: { stepNum: number }) {
  const cards: Array<React.ReactElement> = [
    <ReassuranceCard
      key="privacy"
      tone="privacy"
      title="Private by default"
      body="Your answers are kept on your account. We never show your raw assessment to your learner."
      icon={
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      }
    />,
    <ReassuranceCard
      key="purpose"
      tone="info"
      title={stepNum === 1 ? "Why we ask this" : "What this changes"}
      body={
        stepNum <= 3
          ? "These answers shape how AIVO greets and paces your learner — never how it judges them."
          : stepNum <= 7
            ? "Your picks feed the baseline check directly, so lessons land at the right level from day one."
            : "Together with the optional IEP, these supports stay applied across lessons, homework, and the tutor."
      }
    />,
  ];
  if (stepNum >= 9) {
    cards.push(
      <ReassuranceCard
        key="safety"
        tone="safety"
        title="No diagnosis required"
        body="Pick what feels right. AIVO doesn't need a formal label — only what helps day to day."
      />,
    );
  }
  return <>{cards}</>;
}

function aiBlock(
  name: string,
  fieldType: FieldType,
  ctx: SuggestionContext,
  separator: "newline" | "comma" = "newline",
) {
  return (
    <AISuggestionsToolbar
      targetId={name}
      fieldType={fieldType}
      context={ctx}
      separator={separator}
    />
  );
}

function renderSection(
  sectionId: AssessmentSectionId,
  assessment: ParentAssessment,
  aiContext: SuggestionContext,
): React.ReactElement {
  switch (sectionId) {
    case "basics":
      return (
        <div className="grid gap-4 sm:grid-cols-2" key={sectionId}>
          <SoftTextField
            name="basics.dob"
            type="date"
            label="Date of birth"
            helper="Optional. Helps AIVO align early lessons with grade and age."
            defaultValue={fieldString(assessment, "basics", "dob")}
          />
          <SoftTextField
            name="basics.pronouns"
            label="Pronouns"
            helper="Optional. We'll honour these everywhere."
            placeholder="she / her, he / him, they / them…"
            defaultValue={fieldString(assessment, "basics", "pronouns")}
            maxLength={40}
          />
          <SoftTextField
            className="sm:col-span-2"
            name="basics.languages"
            label="Languages at home"
            helper="Optional. Separate with commas. Up to 5."
            placeholder="English, Spanish"
            defaultValue={fieldString(assessment, "basics", "languages")}
          />
        </div>
      );
    case "background":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="multi"
            name="background.diagnoses"
            legend="Any diagnoses we should know about?"
            helper="Optional. Pick all that apply — leave blank if you'd rather not say."
            columns={3}
            options={DIAGNOSES_OPTIONS}
            defaultValues={fieldArray(assessment, "background", "diagnoses")}
          />
          <SoftTextField
            name="background.diagnosesOther"
            label="Anything else to add"
            helper="Optional. Separate with commas."
            placeholder="e.g. APD, mild hearing loss"
          />
          <PillCardGroup
            mode="multi"
            name="background.services"
            legend="Support services your child receives"
            helper="Optional. AIVO won't replace these — it works alongside them."
            columns={3}
            options={SERVICES_OPTIONS}
            defaultValues={fieldArray(assessment, "background", "services")}
          />
        </div>
      );
    case "strengths":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="strengths.loves"
              multiline
              label="What does your child love to talk about or do?"
              helper="A passion, a hobby, a favourite show. AIVO weaves these into examples."
              placeholder="Dinosaurs. Building with LEGO. Cooking with grandma."
              defaultValue={fieldString(assessment, "strengths", "loves")}
              maxLength={500}
            />
            {aiBlock("strengths.loves", "learner_loves", aiContext, "comma")}
          </div>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="strengths.goodAt"
              label="Things your child is good at"
              helper="Comma-separated. Up to 10."
              placeholder="Memorising lyrics, building, drawing, kindness"
              defaultValue={fieldString(assessment, "strengths", "goodAt")}
            />
            {aiBlock("strengths.goodAt", "good_at", aiContext, "comma")}
          </div>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="strengths.motivates"
              multiline
              label="What lights them up when learning?"
              helper="A goal, a topic, a reward, a person they want to impress."
              placeholder="Beating their own time. Showing dad. Cool space facts."
              defaultValue={fieldString(assessment, "strengths", "motivates")}
              maxLength={500}
            />
            {aiBlock("strengths.motivates", "learner_motivates", aiContext, "comma")}
          </div>
        </div>
      );
    case "frustration":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="frustration.triggers"
              multiline
              label="What tends to make learning hard or frustrating?"
              helper="One per line. AIVO will gently route around these in early sessions."
              placeholder="Long reading passages.\nTimers.\nLoud rooms."
              defaultValue={fieldString(assessment, "frustration", "triggers")}
            />
            {aiBlock("frustration.triggers", "frustration_triggers", aiContext)}
          </div>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="frustration.calmingStrategies"
              multiline
              label="What helps your child reset?"
              helper="One per line. AIVO can suggest these inside a session."
              placeholder="A short walk.\nWater + 2 minutes off screen.\nNoise-cancelling headphones."
              defaultValue={fieldString(assessment, "frustration", "calmingStrategies")}
            />
            {aiBlock("frustration.calmingStrategies", "calming_strategies", aiContext)}
          </div>
        </div>
      );
    case "grade_subject":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="single"
            required
            name="grade_subject.gradeBand"
            legend="Grade band"
            columns={3}
            options={GRADE_OPTIONS}
            defaultValue={fieldString(assessment, "grade_subject", "gradeBand")}
          />
          <PillCardGroup
            mode="multi"
            required
            name="grade_subject.focusSubjects"
            legend="Subjects to focus on first"
            helper="Pick one or more. You can change this later."
            columns={3}
            options={SUBJECT_OPTIONS}
            defaultValues={fieldArray(assessment, "grade_subject", "focusSubjects")}
          />
        </div>
      );
    case "attention":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="single"
            required
            name="attention.breakStyle"
            legend="Break style that works best"
            options={BREAK_STYLE}
            defaultValue={fieldString(assessment, "attention", "breakStyle")}
          />
          <SoftTextField
            name="attention.focusWindowMinutes"
            type="number"
            label="Typical focus window (minutes)"
            helper="A rough guess is fine. AIVO will fine-tune by watching how sessions go."
            placeholder="10"
            defaultValue={
              fieldNumber(assessment, "attention", "focusWindowMinutes")?.toString() ?? ""
            }
            min={1}
            max={120}
          />
          <label className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-white p-3 cursor-pointer">
            <input
              type="checkbox"
              name="attention.movementHelps"
              defaultChecked={fieldBool(assessment, "attention", "movementHelps")}
              className="mt-0.5 h-5 w-5 rounded-[6px] accent-[var(--aivo-sensory-primary)]"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-iw-text-strong">
                Movement helps my child focus
              </span>
              <span className="block text-xs text-iw-text-muted mt-0.5">
                AIVO can suggest stretch / walk breaks between question blocks.
              </span>
            </span>
          </label>
        </div>
      );
    case "pace":
      return (
        <PillCardGroup
          key={sectionId}
          mode="single"
          required
          name="pace.preferred"
          legend="Preferred pace"
          options={PACE_OPTIONS}
          defaultValue={fieldString(assessment, "pace", "preferred")}
        />
      );
    case "communication":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="single"
            required
            name="communication.style"
            legend="How does your child usually share thinking?"
            options={COMMUNICATION_STYLE}
            defaultValue={fieldString(assessment, "communication", "style")}
          />
          <label className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-white p-3 cursor-pointer">
            <input
              type="checkbox"
              name="communication.aacUsed"
              defaultChecked={fieldBool(assessment, "communication", "aacUsed")}
              className="mt-0.5 h-5 w-5 rounded-[6px] accent-[var(--aivo-sensory-primary)]"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-iw-text-strong">
                My child uses an AAC device or app
              </span>
              <span className="block text-xs text-iw-text-muted mt-0.5">
                AIVO will switch to AAC-friendly response patterns.
              </span>
            </span>
          </label>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="communication.notes"
              multiline
              label="Anything else about communication?"
              helper="Optional. e.g. echolalia patterns, processing time, picture supports."
              defaultValue={fieldString(assessment, "communication", "notes")}
              maxLength={500}
            />
            {aiBlock("communication.notes", "communication_notes", aiContext)}
          </div>
        </div>
      );
    case "learning_profile":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="single"
            name="learning_profile.communicationMode"
            legend="Primary communication mode"
            columns={2}
            options={COMM_MODE}
            defaultValue={fieldString(assessment, "learning_profile", "communicationMode")}
          />
          <PillCardGroup
            mode="single"
            name="learning_profile.deviceInteraction"
            legend="How does your child use the device?"
            columns={3}
            options={DEVICE_INTERACTION}
            defaultValue={fieldString(assessment, "learning_profile", "deviceInteraction")}
          />
          <PillCardGroup
            mode="single"
            name="learning_profile.responseMethod"
            legend="Preferred response method"
            columns={2}
            options={RESPONSE_METHOD}
            defaultValue={fieldString(assessment, "learning_profile", "responseMethod")}
          />
          <PillCardGroup
            mode="single"
            name="learning_profile.attentionSpanBucket"
            legend="Typical attention span"
            columns={2}
            options={ATTENTION_BUCKET}
            defaultValue={fieldString(assessment, "learning_profile", "attentionSpanBucket")}
          />
          <PillCardGroup
            mode="multi"
            name="learning_profile.bestModes"
            legend="Modes that land best"
            columns={2}
            options={BEST_MODES}
            defaultValues={fieldArray(assessment, "learning_profile", "bestModes")}
          />
        </div>
      );
    case "reading":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <ScaleField
            required
            name="reading.comfort"
            legend="How does reading feel right now?"
            options={COMFORT_SCALE}
            defaultValue={fieldString(assessment, "reading", "comfort")}
          />
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="reading.notes"
              multiline
              label="Anything else AIVO should know about reading?"
              helper="Optional. Decoding, sight words, comprehension, fluency, audio supports."
              defaultValue={fieldString(assessment, "reading", "notes")}
              maxLength={500}
            />
            {aiBlock("reading.notes", "reading_notes", aiContext)}
          </div>
        </div>
      );
    case "math":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <ScaleField
            required
            name="math.comfort"
            legend="How does math feel right now?"
            options={COMFORT_SCALE}
            defaultValue={fieldString(assessment, "math", "comfort")}
          />
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="math.notes"
              multiline
              label="Anything else AIVO should know about math?"
              helper="Optional. Facts fluency, word problems, anxiety, visual supports."
              defaultValue={fieldString(assessment, "math", "notes")}
              maxLength={500}
            />
            {aiBlock("math.notes", "math_notes", aiContext)}
          </div>
        </div>
      );
    case "sensory":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="multi"
            name="sensory.sensitivities"
            legend="Sensory sensitivities"
            helper="Pick all that apply. AIVO uses these to set calm-mode defaults."
            columns={3}
            options={SENSORY_OPTIONS}
            defaultValues={fieldArray(assessment, "sensory", "sensitivities")}
          />
          <PillCardGroup
            mode="single"
            name="sensory.seekingOrAvoiding"
            legend="Overall sensory profile"
            columns={2}
            options={SENSORY_PROFILE}
            defaultValue={fieldString(assessment, "sensory", "seekingOrAvoiding")}
          />
        </div>
      );
    case "accommodations":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="accommodations.known"
              multiline
              label="Known accommodations (one per line)"
              helper="If you have an IEP, you can upload it next — but a quick list here helps too."
              placeholder="Extended time on tests.\nFrequent movement breaks.\nQuiet testing environment."
              defaultValue={fieldString(assessment, "accommodations", "known")}
              maxLength={2000}
            />
            {aiBlock("accommodations.known", "accommodations", aiContext)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["extendedTime", "Extended time"],
                ["readAloud", "Read-aloud"],
                ["speechToText", "Speech to text"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-start gap-2 rounded-iw-card border border-iw-border bg-white p-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  name={`accommodations.${key}`}
                  defaultChecked={fieldBool(assessment, "accommodations", key)}
                  className="mt-0.5 h-5 w-5 rounded-[6px] accent-[var(--aivo-sensory-primary)]"
                />
                <span className="text-sm font-semibold text-iw-text-strong">{label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    case "homework":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <PillCardGroup
            mode="single"
            required
            name="homework.bestTimeOfDay"
            legend="Best time of day for learning"
            columns={2}
            options={TIME_OF_DAY}
            defaultValue={fieldString(assessment, "homework", "bestTimeOfDay")}
          />
          <SoftTextField
            name="homework.typicalSessionMinutes"
            type="number"
            label="Typical session length (minutes)"
            helper="Optional. We'll respect this when shaping sessions."
            placeholder="20"
            defaultValue={
              fieldNumber(assessment, "homework", "typicalSessionMinutes")?.toString() ?? ""
            }
            min={1}
            max={180}
          />
          <label className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-white p-3 cursor-pointer">
            <input
              type="checkbox"
              name="homework.needsCoaching"
              defaultChecked={fieldBool(assessment, "homework", "needsCoaching")}
              className="mt-0.5 h-5 w-5 rounded-[6px] accent-[var(--aivo-sensory-primary)]"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-iw-text-strong">
                My child needs help getting started with homework
              </span>
              <span className="block text-xs text-iw-text-muted mt-0.5">
                AIVO will offer scaffolded start-up nudges.
              </span>
            </span>
          </label>
        </div>
      );
    case "goals":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="goals.goals"
              multiline
              required
              label="What would you like AIVO to help with?"
              helper="One per line. Up to 8."
              placeholder="Read for 15 minutes without quitting.\nFeel confident with multiplication.\nWrite a short story."
              defaultValue={fieldString(assessment, "goals", "goals")}
            />
            {aiBlock("goals.goals", "goals", aiContext)}
          </div>
          <PillCardGroup
            mode="single"
            name="goals.timeline"
            legend="When are you hoping to see progress?"
            columns={2}
            options={GOAL_TIMELINE}
            defaultValue={fieldString(assessment, "goals", "timeline")}
          />
        </div>
      );
    case "motivation":
      return (
        <div className="flex flex-col gap-5" key={sectionId}>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="motivation.rewardsThatHelp"
              multiline
              label="Rewards or motivators that help"
              helper="One per line. AIVO can lean on these — sparingly."
              defaultValue={fieldString(assessment, "motivation", "rewardsThatHelp")}
            />
            {aiBlock("motivation.rewardsThatHelp", "rewards_that_help", aiContext)}
          </div>
          <div className="flex flex-col gap-2">
            <SoftTextField
              name="motivation.avoidanceFactors"
              multiline
              label="Things that make your child shut down"
              helper="Optional. One per line."
              defaultValue={fieldString(assessment, "motivation", "avoidanceFactors")}
            />
            {aiBlock("motivation.avoidanceFactors", "avoidance_factors", aiContext)}
          </div>
        </div>
      );
    case "concerns":
      return (
        <div className="flex flex-col gap-2" key={sectionId}>
          <SoftTextField
            name="concerns.concerns"
            multiline
            label="Tell us anything else AIVO should know"
            helper="Optional. Up to 2000 characters."
            placeholder="Worried about confidence with reading. Recently moved schools. Big test in spring."
            defaultValue={fieldString(assessment, "concerns", "concerns")}
            maxLength={2000}
          />
          {aiBlock("concerns.concerns", "concerns", aiContext)}
        </div>
      );
  }
}

/* ----- page ---------------------------------------------------------------- */

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
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);

  // Brand-new assessment: send the parent to the calm intro screen first.
  const hasAnyAnswers = Object.values(assessment.answers ?? {}).some(
    (v) => v && Object.keys(v).length > 0,
  );
  if (!hasAnyAnswers && !sp.step) {
    redirect(`/parent/learners/${learnerId}/assessment/intro`);
  }

  const stepNum = Math.max(
    1,
    Math.min(WIZARD_STEPS.length, Number.parseInt(sp.step || "1", 10) || 1),
  );
  const step = WIZARD_STEPS.find((s) => s.id === stepNum)!;
  const isLast = stepNum === WIZARD_STEPS.length;

  const errorSections = sp.error ? sp.error.split(",") : [];
  const errorMessage = errorSections
    .map((s) => ERROR_MESSAGES[s])
    .filter(Boolean)
    .join(" ");

  return (
    <AssessmentShell
      eyebrow={`Parent assessment for ${learner.displayName}`}
      progress={
        <AssessmentProgress
          total={WIZARD_STEPS.length}
          current={stepNum - 1}
          label={step.label}
          hint={
            isLast
              ? "Almost done — one more screen to go."
              : `About ${Math.max(1, WIZARD_STEPS.length - stepNum)} minute${
                  WIZARD_STEPS.length - stepNum === 1 ? "" : "s"
                } left.`
          }
        />
      }
      saveIndicator={
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Answers autosave as you move forward
        </span>
      }
      reassurance={<ReassuranceColumn stepNum={stepNum} />}
    >
      <form action={saveStepAction}>
        <input type="hidden" name="learnerId" value={learner.id} />
        <input type="hidden" name="step" value={stepNum} />
        <QuestionCard
          eyebrow={step.label}
          title={step.longLabel}
          helper={step.helper}
          tag={isLast ? "Final step" : undefined}
          error={errorMessage || undefined}
          actions={
            <AssessmentFooter
              back={
                stepNum > 1 ? (
                  <Link
                    href={`/parent/learners/${learner.id}/assessment?step=${stepNum - 1}`}
                    className={ASSESSMENT_BACK_CLASS}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 12H5" />
                      <path d="m12 19-7-7 7-7" />
                    </svg>
                    Back
                  </Link>
                ) : (
                  <Link
                    href={`/parent/learners/${learner.id}/assessment/intro`}
                    className={ASSESSMENT_BACK_CLASS}
                  >
                    Back to intro
                  </Link>
                )
              }
              saveExit={
                <Link
                  href={`/parent/learners/${learner.id}`}
                  className={ASSESSMENT_GHOST_CLASS}
                >
                  Save & exit
                </Link>
              }
              primaryLabel={isLast ? "Review answers" : "Save & continue"}
            />
          }
        >
          <div className="flex flex-col gap-6">
            {step.sections.map((s) =>
              renderSection(s, assessment, {
                ageRange: learner.ageRange,
                gradeBand: learner.gradeBand,
              }),
            )}
          </div>
        </QuestionCard>
      </form>
    </AssessmentShell>
  );
}
