/**
 * Accept-invite landing page.
 *
 * Mirrors the legacy `/accept-invite` flow from aivo-ai-learning: visitors
 * arriving from an invite email land here. If unauthenticated, we hand off
 * to `/login` (and signup) preserving an `?email=` hint. If authenticated,
 * we accept every PENDING invite addressed to the session email, then offer
 * a "continue" button that routes to the role-appropriate home page.
 *
 * Server-component for the gating; client island for accept + continue
 * buttons because they call server actions and update local state.
 */
import Link from "next/link";
import { Suspense } from "react";
import { Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/types";
import { identityInvitePreview } from "@/lib/auth/identity-client";
import { listPendingInvitesForEmail } from "@/lib/db/team-invites";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInviteActions } from "./accept-invite-actions";
import { StaffAcceptForm } from "./staff-accept-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ email?: string; token?: string }>;

export default async function AcceptInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("accept_invite.page");
  const params = await searchParams;
  const inviteToken = (params.token ?? "").trim();

  // Staff invite branch (district/school-admin/teacher): the invitee does
  // NOT have an account yet — the email link carries a one-time token. We
  // preview it server-side and render a "set your password" form that
  // creates the account on submit. This path is independent of any existing
  // session (the learner care-team flow below assumes the user is signed in).
  if (inviteToken) {
    const preview = await identityInvitePreview(inviteToken);
    if (!preview.ok) {
      return (
        <Shell heading={t("accept_heading")}>
          <Card className="border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-aivo-ink">{preview.error}</p>
          </Card>
          <Link href="https://admin.aivolearning.com/login" className="block w-full">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </Shell>
      );
    }
    return (
      <Shell heading="Accept your invitation">
        <StaffAcceptForm
          token={inviteToken}
          email={preview.invite.email}
          name={preview.invite.name}
          role={preview.invite.role}
          schoolName={preview.invite.schoolName}
          districtName={preview.invite.districtName}
        />
      </Shell>
    );
  }

  const invitedEmail = (params.email ?? "").trim().toLowerCase();
  const session = await getSession();

  // Unauthenticated → bounce to login with a return URL.
  if (!session) {
    const redirect = `/accept-invite${
      invitedEmail ? `?email=${encodeURIComponent(invitedEmail)}` : ""
    }`;
    return (
      <Shell heading={t("accept_heading")}>
        <p className="text-center text-sm text-aivo-ink-soft">
          {invitedEmail ? (
            <>
              You&apos;ve been invited to join a learning team for{" "}
              <strong className="text-aivo-ink">{invitedEmail}</strong>.
            </>
          ) : (
            <>{t("invited_to_join")}</>
          )}
        </p>
        <div className="flex flex-col gap-3">
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="block w-full">
            <Button className="w-full">I already have an account</Button>
          </Link>
          <Link
            href={`/signup?redirect=${encodeURIComponent(redirect)}${
              invitedEmail ? `&email=${encodeURIComponent(invitedEmail)}` : ""
            }`}
            className="block w-full"
          >
            <Button variant="outline" className="w-full">
              {t("create_account")}
            </Button>
          </Link>
        </div>
      </Shell>
    );
  }

  // Wrong-email check: surface a clear error rather than silently accepting.
  if (invitedEmail && session.email.toLowerCase() !== invitedEmail) {
    return (
      <Shell heading={t("accept_heading")}>
        <Card className="border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-aivo-ink">
            {t("signed_in_as")} <strong>{session.email}</strong>, but this invitation is for{" "}
            <strong>{invitedEmail}</strong>. Sign out and sign in with the invited address.
          </p>
        </Card>
        <Link href="/login" className="block w-full">
          <Button className="w-full">{t("sign_in_different")}</Button>
        </Link>
      </Shell>
    );
  }

  const pending = await listPendingInvitesForEmail(session.email, session.tenantId);
  const continueHref = ROLE_HOME[session.role] ?? "/parent/home";

  return (
    <Shell heading={t("accept_heading")}>
      <Suspense fallback={null}>
        <AcceptInviteActions
          pendingCount={pending.length}
          continueHref={continueHref}
          email={session.email}
        />
      </Suspense>
    </Shell>
  );
}

function Shell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aivo-surface-soft p-6">
      <Card className="w-full max-w-md space-y-5 p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-aivo-accent/10 text-aivo-accent">
          <Mail className="h-7 w-7" />
        </div>
        <h1 className="text-center text-2xl font-bold">{heading}</h1>
        {children}
      </Card>
    </div>
  );
}
