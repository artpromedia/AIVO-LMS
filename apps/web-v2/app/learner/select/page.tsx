/**
 * Sprint 12: Learner selection — design #1 "Choose your profile".
 *
 * A parent hands the device to a child: the child picks their avatar and enters
 * their PIN. This is the PIN-gated session hand-off (`enterAsLearner`), not the
 * parent "view-as" path — selecting a profile and entering the right PIN swaps
 * the session to the learner. Authorization + PIN verification live in the
 * server action.
 *
 * Single-child parents are still bounced straight through the view-as auto
 * route (no profile grid to choose from).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listLearnersForParent } from "@/lib/db/repos";
import { enterAsLearner } from "@/lib/learner/active-learner-actions";
import { LearnerProfilePicker } from "./_components/learner-profile-picker";

export default async function LearnerSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("learner.select");
  const tShell = await getTranslations("auth.shell");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const params = await searchParams;

  // Single learner → auto-select and proceed. Cookies can only be mutated in
  // a Server Action or Route Handler in Next.js 15, so we bounce through the
  // `/learner/select/auto` route handler which sets the cookie and redirects.
  if (learners.length === 1) {
    redirect(`/learner/select/auto?learnerId=${encodeURIComponent(learners[0].id)}`);
  }

  const panel = (
    <AuthSidePanel variant="wave" title={t("panel_title")} body={t("panel_body")}>
      <AuthTrustCard>{tShell("trust_support")}</AuthTrustCard>
    </AuthSidePanel>
  );

  return (
    <AuthSplitLayout panel={panel}>
      <div className="mb-8 flex justify-center">
        <AivoBrandMark sublabel={tShell("wordmark_family")} />
      </div>

      {params.error && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          {params.error === "forbidden"
            ? t("forbidden")
            : params.error === "locked"
              ? t("error_locked")
              : t("error_pin")}
        </Card>
      )}

      {learners.length === 0 ? (
        <div className="rounded-iw-card border border-iw-border bg-white p-6 text-center">
          <p className="font-iw-display text-lg font-semibold text-iw-ink">{t("no_learners")}</p>
          <p className="mt-2 text-sm text-iw-ink-muted">{t("no_learners_desc")}</p>
          <Button asChild className="mt-5">
            <Link href="/parent/learners/new">{t("add_learner")}</Link>
          </Button>
        </div>
      ) : (
        <LearnerProfilePicker learners={learners} action={enterAsLearner} />
      )}

      <AuthSecureFooter lead={tShell("secure_signin")} sub={tShell("encrypted")} />
    </AuthSplitLayout>
  );
}
