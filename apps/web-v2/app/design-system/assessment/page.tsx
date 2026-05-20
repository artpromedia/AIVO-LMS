/**
 * /design-system/assessment — visual showcase of the sprint 5 parent
 * assessment + IEP upload primitives.
 *
 * Renders every state contract so reviewers and engineers can diff
 * each component without spinning up a learner record. Mirrors the
 * 7-state contract used everywhere else (default / hover / focus /
 * disabled / loading / error / empty).
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  AssessmentShell,
  AssessmentProgress,
  QuestionCard,
  PillCardGroup,
  ScaleField,
  SoftTextField,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  UploadDropZone,
  UploadFileCard,
  ExtractedSupportRow,
  SubmittedHero,
  BaselinePendingCard,
  ReassuranceCard,
} from "@aivo/ui";

export const metadata: Metadata = {
  title: "AIVO Design System · Assessment",
  description: "Showcase of @aivo/ui/assessment primitives (sprint 5).",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
      {children}
    </h2>
  );
}

export default function AssessmentDesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] iw-safe-top">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">
        <header className="flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Design system · sprint 5</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-iw-text-strong">
            Assessment & IEP primitives
          </h1>
          <p className="text-iw-text-muted max-w-2xl leading-relaxed">
            Calm, soft-glass building blocks for the parent assessment and IEP
            upload flow. Every primitive ships with default / hover / focus /
            disabled / loading / error / empty states.
          </p>
          <nav className="flex flex-wrap gap-2 mt-2">
            <Link
              href="/design-system"
              className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
            >
              ← Core primitives
            </Link>
            <Link
              href="/design-system/shell"
              className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
            >
              Shell primitives →
            </Link>
          </nav>
        </header>

        {/* ---------------- Progress ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>AssessmentProgress</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-iw-card-lg border border-iw-border bg-white p-4">
              <AssessmentProgress
                total={11}
                current={0}
                label="Background"
                hint="About 6 minutes left."
              />
            </div>
            <div className="rounded-iw-card-lg border border-iw-border bg-white p-4">
              <AssessmentProgress
                total={11}
                current={5}
                label="Communication"
                hint="Halfway there."
              />
            </div>
            <div className="rounded-iw-card-lg border border-iw-border bg-white p-4">
              <AssessmentProgress
                total={11}
                current={10}
                label="Concerns"
                hint="Almost done."
              />
            </div>
          </div>
        </section>

        {/* ---------------- Pills + Scale ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>PillCardGroup · ScaleField · SoftTextField</SectionLabel>
          <div className="rounded-iw-card-lg border border-iw-border bg-white p-6 flex flex-col gap-6">
            <PillCardGroup
              mode="single"
              name="demo.grade"
              legend="Single-select pill cards"
              helper="Used wherever the parent picks one option from a short list."
              columns={3}
              options={[
                { value: "k", label: "Kindergarten" },
                { value: "1-2", label: "Grades 1–2", description: "Early elementary" },
                { value: "3-5", label: "Grades 3–5", description: "Upper elementary" },
              ]}
              defaultValue="1-2"
            />
            <PillCardGroup
              mode="multi"
              name="demo.subjects"
              legend="Multi-select pill cards"
              helper="Same component, native-checkbox semantics."
              columns={3}
              options={[
                { value: "math", label: "Math" },
                { value: "reading", label: "Reading" },
                { value: "science", label: "Science" },
              ]}
              defaultValues={["math", "reading"]}
            />
            <ScaleField
              name="demo.scale"
              legend="Confidence scale"
              helper="Four-step comfort/confidence scale used for reading and math."
              options={[
                { value: "early", label: "Just starting" },
                { value: "building", label: "Building" },
                { value: "on_grade", label: "On grade" },
                { value: "advanced", label: "Advanced" },
              ]}
              defaultValue="building"
            />
            <SoftTextField
              name="demo.text"
              label="Calm text field"
              helper="Used for short-form answers (date of birth, pronouns, etc.)."
              placeholder="she / her"
              maxLength={40}
            />
            <SoftTextField
              name="demo.textarea"
              multiline
              label="Calm textarea"
              helper="Auto-grows. Used for triggers, calming strategies, concerns."
              placeholder="Loud rooms. Surprise transitions. Word problems."
              maxLength={500}
            />
            <SoftTextField
              name="demo.error"
              label="Error state"
              error="Please share at least one focus area."
              defaultValue=""
            />
          </div>
        </section>

        {/* ---------------- QuestionCard variants ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>QuestionCard</SectionLabel>
          <div className="grid gap-6 lg:grid-cols-2">
            <QuestionCard
              eyebrow="Strengths"
              title="What does your child love and do well?"
              helper="Strengths weave familiar topics into early lessons."
              actions={
                <AssessmentFooter
                  back={
                    <Link href="#" className={ASSESSMENT_BACK_CLASS}>
                      Back
                    </Link>
                  }
                  primaryLabel="Save & continue"
                />
              }
            >
              <p className="text-sm text-iw-text-muted">Default question card.</p>
            </QuestionCard>
            <QuestionCard
              eyebrow="Concerns"
              title="Anything else AIVO should know?"
              tag="Final step"
              error="Please review the highlighted fields before continuing."
              actions={
                <AssessmentFooter
                  back={
                    <Link href="#" className={ASSESSMENT_BACK_CLASS}>
                      Back
                    </Link>
                  }
                  primaryLabel="Review answers"
                />
              }
            >
              <p className="text-sm text-iw-text-muted">Error state + final-step tag.</p>
            </QuestionCard>
          </div>
        </section>

        {/* ---------------- Upload states ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>UploadDropZone · UploadFileCard</SectionLabel>
          <div className="rounded-iw-card-lg border border-iw-border bg-white p-6 flex flex-col gap-4">
            <UploadDropZone
              name="demo.upload"
              label="Drop zone — idle state"
              helper="Accepts PDF, Word, or photos."
              accept="application/pdf,image/*"
              maxBytes={10 * 1024 * 1024}
              enableCameraCapture
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <UploadFileCard
              fileName="emma-iep-2025.pdf"
              bytes={482000}
              kind="PDF"
              status="queued"
            />
            <UploadFileCard
              fileName="emma-iep-2025.pdf"
              bytes={482000}
              kind="PDF"
              status="uploading"
              progress={62}
            />
            <UploadFileCard
              fileName="emma-iep-2025.pdf"
              bytes={482000}
              kind="PDF"
              status="extracting"
            />
            <UploadFileCard
              fileName="emma-iep-2025.pdf"
              bytes={482000}
              kind="PDF"
              status="parsed"
              uploadedAt="May 12, 2026"
            />
            <UploadFileCard
              fileName="iep-scan.heic"
              bytes={1200000}
              kind="Photo"
              status="error"
              errorMessage="We couldn't read this file. Try a clearer photo or a PDF."
            />
          </div>
        </section>

        {/* ---------------- ExtractedSupportRow ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>ExtractedSupportRow</SectionLabel>
          <div className="rounded-iw-card-lg border border-iw-border bg-white p-6 flex flex-col gap-2.5">
            <ExtractedSupportRow
              name="demo.supports"
              value="extended-time"
              label="Extended time on assignments and assessments"
              provenance="Extracted from IEP · page 3"
              confidence="high"
              defaultChecked
            />
            <ExtractedSupportRow
              name="demo.supports"
              value="read-aloud"
              label="Read-aloud support for text-heavy material"
              provenance="Extracted from IEP · page 4"
              confidence="high"
              defaultChecked
            />
            <ExtractedSupportRow
              name="demo.supports"
              value="movement-breaks"
              label="Movement and stretch breaks during focus blocks"
              provenance="Inferred from IEP + parent assessment"
              confidence="medium"
              defaultChecked
            />
            <ExtractedSupportRow
              name="demo.supports"
              value="quiet-env"
              label="Quiet testing environment"
              provenance="Extracted from IEP · page 5"
              confidence="low"
            />
            <ExtractedSupportRow
              name="demo.supports"
              value="aac"
              label="AAC-compatible interaction modes"
              provenance="Required by IEP"
              confidence="high"
              required
              defaultChecked
            />
          </div>
        </section>

        {/* ---------------- Hero + pending ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>SubmittedHero · BaselinePendingCard</SectionLabel>
          <SubmittedHero
            eyebrow="Submitted on May 20, 2026"
            title="Thanks — AIVO is set up for Emma"
            body="We'll generate the baseline check using your answers plus the supports you confirmed from the IEP."
            next={[
              { label: "We'll build a custom baseline check tuned to your learner." },
              { label: "We'll apply 4 supports from the IEP to every lesson." },
              { label: "You'll see a calm progress report as your learner moves through." },
            ]}
          />
          <BaselinePendingCard
            learnerName="Emma"
            inputs={["Parent assessment", "IEP supports · 4", "Grade band 3-5"]}
            estimate="Usually under 2 minutes."
          />
          <BaselinePendingCard
            learnerName="Emma"
            progress={62}
            inputs={["Parent assessment", "IEP supports · 4"]}
            title="Personalising lessons"
            body="We're applying your sensory and pacing preferences."
          />
        </section>

        {/* ---------------- Reassurance ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>ReassuranceCard (3 tones)</SectionLabel>
          <div className="grid gap-3 lg:grid-cols-3">
            <ReassuranceCard
              tone="info"
              title="Why we ask this"
              body="Your answers shape how AIVO greets and paces your learner — never how it judges them."
            />
            <ReassuranceCard
              tone="privacy"
              title="Private to you"
              body="Stored on your account. Never shown to your learner."
            />
            <ReassuranceCard
              tone="safety"
              title="Learner-safe by default"
              body="Your child only sees a calm, supportive summary."
            />
          </div>
        </section>

        {/* ---------------- Shell preview ---------------- */}
        <section className="flex flex-col gap-4">
          <SectionLabel>AssessmentShell composition</SectionLabel>
          <div className="rounded-iw-card-lg border border-iw-border overflow-hidden">
            <AssessmentShell
              eyebrow="Parent assessment for Emma"
              progress={
                <AssessmentProgress
                  total={11}
                  current={3}
                  label="Subjects"
                  hint="About 7 minutes left."
                />
              }
              reassurance={
                <ReassuranceCard
                  tone="info"
                  title="What this changes"
                  body="Your picks feed the baseline check directly."
                />
              }
              saveIndicator="Autosaving as you go"
            >
              <QuestionCard
                eyebrow="Subjects"
                title="Grade level and subject focus"
                helper="Pick the grade band your child is working in, plus the subjects you'd like AIVO to focus on first."
                actions={
                  <AssessmentFooter
                    back={
                      <Link href="#" className={ASSESSMENT_BACK_CLASS}>
                        Back
                      </Link>
                    }
                    primaryLabel="Save & continue"
                  />
                }
              >
                <PillCardGroup
                  mode="single"
                  name="demo.grade.shell"
                  legend="Grade band"
                  columns={3}
                  options={[
                    { value: "k", label: "Kindergarten" },
                    { value: "1-2", label: "Grades 1–2" },
                    { value: "3-5", label: "Grades 3–5" },
                  ]}
                  defaultValue="3-5"
                />
              </QuestionCard>
            </AssessmentShell>
          </div>
        </section>
      </div>
    </main>
  );
}
