import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import { enterAsLearner } from "@/lib/learner/active-learner-actions";
import { HandoffPinForm } from "./_components/handoff-pin-form";

/**
 * /parent/learners/[learnerId]/enter
 *
 * The "hand the device to the child" gate. A parent who is already signed in
 * lands here to sign the device in AS the learner (a true session swap, gated
 * by the learner's PIN) — distinct from "parent · learner view", which keeps
 * the parent session. The PIN is verified by identity-svc; on success the
 * `enterAsLearner` action swaps the session and lands on /learner/home.
 */
export default async function EnterAsLearnerPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ learnerId: string }>;
  readonly searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const { error } = await searchParams;
  const t = await getTranslations("parent.handoff");

  const errorMessage =
    error === "locked" ? t("error_locked") : error === "invalid" ? t("error_invalid") : null;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
        <Link
          href={`/parent/learners/${learner.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-iw-text-muted hover:text-iw-text-strong"
        >
          <ArrowLeft className="h-4 w-4" /> {t("back", { name: learner.displayName })}
        </Link>

        <Card className="flex flex-col items-center gap-5 rounded-iw-hero border-0 bg-white p-8 text-center shadow-soft-5">
          <LearnerAvatar name={learner.displayName} size="lg" />
          <div className="flex flex-col gap-2">
            <h1 className="font-iw-display text-2xl font-bold text-iw-text-strong">
              {t("title", { name: learner.displayName })}
            </h1>
            <p className="text-base text-iw-text-muted">{t("body")}</p>
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="w-full rounded-iw-control border border-[var(--aivo-status-warning)] bg-iw-warm-soft px-4 py-2.5 text-sm font-semibold text-[var(--aivo-status-warning)]"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="w-full text-left">
            <HandoffPinForm learnerId={learner.id} action={enterAsLearner} />
          </div>

          <Link
            href={`/onboarding/pin?learnerId=${encodeURIComponent(learner.id)}`}
            className="text-sm font-semibold text-[var(--color-aivo-primary)] hover:underline"
          >
            {t("set_pin_cta")}
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
