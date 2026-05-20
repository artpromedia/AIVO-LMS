"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  AuthInput,
  ReassuranceCard,
  StepperHeader,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";

const STEPS = [
  { label: "About you" },
  { label: "Role" },
  { label: "Family" },
  { label: "Consent" },
] as const;

const GRADE_BANDS = [
  "Pre-K (3-4)",
  "K-2 (5-7)",
  "3-5 (8-10)",
  "6-8 (11-13)",
  "9-12 (14-18)",
];

export default function NewLearnerPage() {
  const [firstName, setFirstName] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [hasIep, setHasIep] = React.useState<"yes" | "no" | "unsure" | null>(null);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={2} />
        <AuthCard
          icon={<AivoIcon name="care" size={32} />}
          eyebrow="Add a learner"
          title="Tell us about your child."
          subtitle="Use only what you'd say out loud — first name is fine. You can add more learners later from your home screen."
          reassurance={
            <ReassuranceCard
              tone="privacy"
              title="We collect the minimum needed."
              body="No surname, no date of birth, no address required here. You'll see exactly what teachers and AI use on the consent step."
              link={{ href: "/onboarding/privacy", label: "What we use" }}
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/consent"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                Continue to consent
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/parent-setup" className="hover:underline">
                  Back
                </Link>
              </p>
            </>
          }
        >
          <AuthInput
            id="learner-first"
            label="Learner first name (or nickname)"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Emma"
            autoComplete="off"
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="grade"
              className="text-sm font-medium text-iw-text-strong"
            >
              Grade band
            </label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="h-12 px-3 rounded-iw-control bg-white border border-iw-border text-base text-iw-text-strong focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20 outline-none"
            >
              <option value="" disabled>
                Pick a band
              </option>
              {GRADE_BANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <p className="text-xs text-iw-text-muted">
              We use a band, not a birthday. You can change it any time.
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-iw-text-strong">
              Does your child have an IEP or 504 plan?
            </legend>
            <p className="text-xs text-iw-text-muted">
              You can upload it on the next steps — only with your explicit
              consent. Skip if you'd rather decide later.
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(["yes", "no", "unsure"] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={hasIep === v ? "default" : "outline"}
                  aria-pressed={hasIep === v}
                  onClick={() => setHasIep(v)}
                  className="capitalize"
                >
                  {v === "unsure" ? "Not sure yet" : v}
                </Button>
              ))}
            </div>
          </fieldset>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
