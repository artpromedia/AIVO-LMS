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
import { useTranslations } from "next-intl";

const STEPS = [
  { label: "about_you" },
  { label: "role" },
  { label: "family" },
  { label: "consent" },
] as const;

const GRADE_BANDS = [
  "Pre-K (3-4)",
  "K-2 (5-7)",
  "3-5 (8-10)",
  "6-8 (11-13)",
  "9-12 (14-18)",
];

export default function NewLearnerPage() {
  const t = useTranslations("onboarding.learner_new");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const [firstName, setFirstName] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [hasIep, setHasIep] = React.useState<"yes" | "no" | "unsure" | null>(null);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader
          steps={STEPS.map((s) => ({ label: ts(s.label) }))}
          current={2}
        />
        <AuthCard
          icon={<AivoIcon name="care" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          reassurance={
            <ReassuranceCard
              tone="privacy"
              title={t("reassure_title")}
              body={t("reassure_body")}
              link={{ href: "/onboarding/privacy", label: t("reassure_link") }}
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/consent"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                {t("continue")}
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/parent-setup" className="hover:underline">
                  {tc("back")}
                </Link>
              </p>
            </>
          }
        >
          <AuthInput
            id="learner-first"
            label={t("first_name_label")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t("first_name_placeholder")}
            autoComplete="off"
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="grade"
              className="text-sm font-medium text-iw-text-strong"
            >
              {t("grade_band_label")}
            </label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="h-12 px-3 rounded-iw-control bg-white border border-iw-border text-base text-iw-text-strong focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20 outline-none"
            >
              <option value="" disabled>
                {t("grade_band_placeholder")}
              </option>
              {GRADE_BANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <p className="text-xs text-iw-text-muted">
              {t("grade_band_help")}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-iw-text-strong">
              {t("iep_legend")}
            </legend>
            <p className="text-xs text-iw-text-muted">
              {t("iep_help")}
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
                >
                  {t(`iep_${v}`)}
                </Button>
              ))}
            </div>
          </fieldset>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
