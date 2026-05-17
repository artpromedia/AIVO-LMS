/**
 * Sprint 30: Parent · Sensory profile.
 * Shows the learner's response (hyper / neutral / hypo) across five sensory
 * modalities. Mirrors the legacy sensory page; data is parent-curated and
 * feeds the lesson generator's accessibility supports.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye, Ear, Hand, Compass, Dumbbell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getLearner,
  getLearnerSensoryProfile,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import type { SensoryModality, SensoryResponse } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type ModalityDef = {
  key: SensoryModality;
  label: string;
  icon: LucideIcon;
  question: string;
  hyper: string;
  hypo: string;
};

const MODALITIES: ModalityDef[] = [
  {
    key: "visual",
    label: "Visual",
    icon: Eye,
    question: "How does your child respond to lights, colors, and visual patterns?",
    hyper: "Bothered by bright lights, avoids visually busy spaces.",
    hypo: "Seeks visual stimulation, fixates on lights or spinning objects.",
  },
  {
    key: "auditory",
    label: "Auditory",
    icon: Ear,
    question: "How does your child respond to sounds and noise?",
    hyper: "Covers ears in loud rooms, startles easily at unexpected sounds.",
    hypo: "Speaks loudly, seeks loud music, may seem to ignore voices.",
  },
  {
    key: "tactile",
    label: "Tactile",
    icon: Hand,
    question: "How does your child respond to touch and textures?",
    hyper: "Avoids messy textures, tags in clothing, light touch.",
    hypo: "Seeks deep pressure, hugs tightly, bumps into things on purpose.",
  },
  {
    key: "vestibular",
    label: "Vestibular (balance)",
    icon: Compass,
    question: "How does your child respond to movement and balance challenges?",
    hyper: "Avoids swings, escalators, motion; gets dizzy easily.",
    hypo: "Loves spinning, climbing, swinging upside down.",
  },
  {
    key: "proprioception",
    label: "Proprioception (body)",
    icon: Dumbbell,
    question: "How aware is your child of their body in space?",
    hyper: "Light touch is uncomfortable; clumsy in tight spaces.",
    hypo: "Crashes into furniture, leans heavily, chews on items.",
  },
];

const RESPONSE_TONE: Record<SensoryResponse, "success" | "neutral" | "warning" | "danger"> = {
  hyper: "warning",
  neutral: "success",
  hypo: "warning",
  unknown: "neutral",
};

const RESPONSE_LABEL: Record<SensoryResponse, string> = {
  hyper: "Hyper-sensitive",
  neutral: "Typical",
  hypo: "Hypo-sensitive",
  unknown: "Not set",
};

export default async function ParentSensoryPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const profile = getLearnerSensoryProfile(learnerId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title="Sensory profile"
        description="How your learner responds to sensory input. Lessons are adapted in real time to match this profile."
      />

      <SectionHeader title="Modalities" />
      <div className="grid gap-4 lg:grid-cols-2">
        {MODALITIES.map((m) => {
          const Icon = m.icon;
          const response: SensoryResponse =
            profile?.modalities[m.key] ?? "unknown";
          const tone = RESPONSE_TONE[response];
          return (
            <Card key={m.key} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aivo-accent/10 text-aivo-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{m.label}</p>
                    <Badge tone={tone}>{RESPONSE_LABEL[response]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-aivo-ink-soft">{m.question}</p>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-md bg-aivo-surface-soft p-2">
                      <dt className="font-medium text-aivo-ink">Hyper-sensitive</dt>
                      <dd className="text-aivo-ink-soft">{m.hyper}</dd>
                    </div>
                    <div className="rounded-md bg-aivo-surface-soft p-2">
                      <dt className="font-medium text-aivo-ink">Hypo-sensitive</dt>
                      <dd className="text-aivo-ink-soft">{m.hypo}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <SectionHeader title="Notes" />
      <Card className="p-[var(--aivo-density-card-pad)]">
        {profile?.notes ? (
          <p className="text-sm">{profile.notes}</p>
        ) : (
          <p className="text-sm text-aivo-ink-soft">
            No notes yet. Use{" "}
            <Link
              href={`/parent/learners/${learner.id}/settings`}
              className="text-aivo-accent underline underline-offset-4"
            >
              learner settings
            </Link>{" "}
            to update sensory preferences.
          </p>
        )}
        {profile ? (
          <p className="mt-3 text-xs text-aivo-ink-soft">
            Last updated {new Date(profile.updatedAt).toLocaleDateString()}.
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
