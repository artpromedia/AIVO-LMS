"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, StepperHeader, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import type { AivoIconName } from "@aivo/ui/icon";

interface RoleOption {
  id: "parent" | "teacher" | "schoolAdmin" | "districtAdmin";
  labelKey: string;
  descKey: string;
  icon: AivoIconName;
  next: string;
}

const ROLES: ReadonlyArray<RoleOption> = [
  {
    id: "parent",
    labelKey: "parent_label",
    descKey: "parent_desc",
    icon: "care",
    next: "/onboarding/parent-setup",
  },
  {
    id: "teacher",
    labelKey: "teacher_label",
    descKey: "teacher_desc",
    icon: "classroom",
    next: "/onboarding/invite/school",
  },
  {
    id: "schoolAdmin",
    labelKey: "school_admin_label",
    descKey: "school_admin_desc",
    icon: "rosterSchool",
    next: "/onboarding/invite/school",
  },
  {
    id: "districtAdmin",
    labelKey: "district_admin_label",
    descKey: "district_admin_desc",
    icon: "rosterDistrict",
    next: "/onboarding/invite/district",
  },
];

export default function RoleSelectionPage() {
  const t = useTranslations("onboarding.role");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const STEPS = [
    { label: ts("about_you") },
    { label: ts("role") },
    { label: ts("consent") },
  ] as const;
  const [selected, setSelected] = React.useState<RoleOption["id"] | null>(null);
  const selectedRole = ROLES.find((r) => r.id === selected) ?? null;

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={1} />
        <AuthCard
          icon={<AivoIcon name="aiSparkle" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          reassurance={
            <ReassuranceCard tone="info" title={t("reassure_title")} body={t("reassure_body")} />
          }
          actions={
            <>
              <Link
                href={selectedRole?.next ?? "#"}
                aria-disabled={!selectedRole}
                className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center transition-opacity ${
                  selectedRole
                    ? "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                    : "bg-[var(--aivo-sensory-primary)]/50 pointer-events-none"
                }`}
              >
                {tc("continue")}
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/signup" className="hover:underline">
                  {tc("back")}
                </Link>
              </p>
            </>
          }
        >
          <div className="flex flex-col gap-2.5">
            {ROLES.map((r) => {
              const active = selected === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.id)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 text-left rounded-iw-card border bg-white p-4 transition-all ${
                    active
                      ? "border-[var(--aivo-sensory-primary)] ring-2 ring-[var(--aivo-sensory-primary)]/30"
                      : "border-iw-border hover:border-iw-text-muted"
                  }`}
                >
                  <span
                    className="shrink-0 w-10 h-10 rounded-iw-control bg-[var(--aivo-color-surface-canvas)] flex items-center justify-center text-iw-text-muted"
                    aria-hidden="true"
                  >
                    <AivoIcon name={r.icon} size={20} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-iw-text-strong">
                      {t(r.labelKey)}
                    </span>
                    <span className="block text-xs text-iw-text-muted leading-relaxed mt-0.5">
                      {t(r.descKey)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
