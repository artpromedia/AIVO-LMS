"use client";
import * as React from "react";
import Link from "next/link";
import { AuthShell, AuthCard, StepperHeader, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import type { AivoIconName } from "@aivo/ui/icon";

interface RoleOption {
  id: "parent" | "teacher" | "schoolAdmin" | "districtAdmin";
  label: string;
  description: string;
  icon: AivoIconName;
  next: string;
}

const ROLES: ReadonlyArray<RoleOption> = [
  {
    id: "parent",
    label: "A parent or caregiver",
    description: "Set up AIVO for one or more children at home.",
    icon: "care",
    next: "/onboarding/parent-setup",
  },
  {
    id: "teacher",
    label: "A teacher",
    description: "Join a school that already uses AIVO, or start a class.",
    icon: "classroom",
    next: "/onboarding/invite/school",
  },
  {
    id: "schoolAdmin",
    label: "A school administrator",
    description: "Manage staff, classes, and compliance for a school.",
    icon: "rosterSchool",
    next: "/onboarding/invite/school",
  },
  {
    id: "districtAdmin",
    label: "A district administrator",
    description: "Oversee multiple schools, billing, and reporting.",
    icon: "rosterDistrict",
    next: "/onboarding/invite/district",
  },
];

const STEPS = [
  { label: "About you" },
  { label: "Role" },
  { label: "Consent" },
] as const;

export default function RoleSelectionPage() {
  const [selected, setSelected] = React.useState<RoleOption["id"] | null>(null);
  const selectedRole = ROLES.find((r) => r.id === selected) ?? null;

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={1} />
        <AuthCard
          icon={<AivoIcon name="aiSparkle" size={32} />}
          eyebrow="Choose your role"
          title="Who are you setting up AIVO for?"
          subtitle="We'll customize the next steps. You can add other roles later — many adults are both a parent and a teacher."
          reassurance={
            <ReassuranceCard
              tone="info"
              title="Children don't pick a role."
              body="A parent or teacher adds a learner. The learner sees a kid-friendly view with their schoolwork — never this page."
            />
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
                Continue
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/signup" className="hover:underline">
                  Back
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
                      {r.label}
                    </span>
                    <span className="block text-xs text-iw-text-muted leading-relaxed mt-0.5">
                      {r.description}
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
