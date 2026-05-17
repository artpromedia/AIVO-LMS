"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import Link from "next/link";

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const invitedEmail = params.get("email") || "";
  const { user, accessToken, loading } = useAuth();

  const [status, setStatus] = useState<
    "checking" | "needs_login" | "needs_signup" | "wrong_email" | "accepting" | "success" | "none" | "error"
  >("checking");
  const [accepted, setAccepted] = useState<{ role: string; learnerId: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (loading) return;

    if (!user || !accessToken) {
      // Send them through the normal sign-in / sign-up flow, then bring
      // them back here to finish accepting. Pre-fill email for both.
      setStatus(invitedEmail ? "needs_login" : "needs_signup");
      return;
    }

    // If we have an `email` query param and it doesn't match the
    // signed-in user, surface a clear error rather than silently
    // accepting on the wrong account.
    if (invitedEmail && user.email && user.email.toLowerCase() !== invitedEmail.toLowerCase()) {
      setStatus("wrong_email");
      return;
    }

    setStatus("accepting");
    fetch("/api/family/collaboration/accept-invite", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data?.accepted) ? data.accepted : [];
        setAccepted(list);
        setStatus(list.length > 0 ? "success" : "none");
      })
      .catch((err: any) => {
        setErrorMsg(err?.message || "Could not accept invitation");
        setStatus("error");
      });
  }, [loading, user, accessToken, invitedEmail]);

  const continueHref =
    user?.role === "CAREGIVER"
      ? "/dashboard/caregiver"
      : user?.role === "TEACHER"
      ? "/dashboard/teacher"
      : user?.role === "THERAPIST"
      ? "/dashboard/therapist"
      : "/dashboard/parent";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--visual-surface-soft))]">
      <div className="w-full max-w-md vi-card p-8 space-y-5">
        <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]">
          <Mail size={28} strokeWidth={2.5} aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold vi-text text-center">Accept your invitation</h1>

        {status === "checking" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--visual-primary))]" />
            <p className="text-sm vi-text-muted">Loading…</p>
          </div>
        )}

        {(status === "needs_login" || status === "needs_signup") && (
          <>
            <p className="text-sm vi-text-muted text-center">
              {invitedEmail ? (
                <>You've been invited to join a learning team for <strong className="vi-text">{invitedEmail}</strong>.</>
              ) : (
                <>You've been invited to join a learning team. Sign in or create your account to continue.</>
              )}
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/accept-invite?email=${encodeURIComponent(invitedEmail)}`)}`}
                className="px-4 py-3 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm text-center"
                style={{ minHeight: 44 }}
              >
                I already have an account
              </Link>
              <Link
                href={`/signup?email=${encodeURIComponent(invitedEmail)}`}
                className="px-4 py-3 rounded-full vi-surface-soft vi-text font-bold text-sm text-center"
                style={{ minHeight: 44 }}
              >
                Create a new account
              </Link>
            </div>
          </>
        )}

        {status === "wrong_email" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--visual-sel)/0.12)]">
              <AlertCircle className="w-5 h-5 text-[hsl(var(--visual-sel))] shrink-0 mt-0.5" />
              <p className="text-sm vi-text">
                You're signed in as <strong>{user?.email}</strong>, but this invitation is for{" "}
                <strong>{invitedEmail}</strong>. Please sign out and sign in with the invited address.
              </p>
            </div>
            <Link
              href="/login"
              className="block px-4 py-3 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm text-center"
              style={{ minHeight: 44 }}
            >
              Sign in with a different account
            </Link>
          </div>
        )}

        {status === "accepting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--visual-primary))]" />
            <p className="text-sm vi-text-muted">Accepting your invitation…</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--visual-science)/0.12)]">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--visual-science))] shrink-0 mt-0.5" />
              <p className="text-sm vi-text">
                You've been added to{" "}
                <strong>{accepted.length}</strong>{" "}
                {accepted.length === 1 ? "learner's team" : "learners' teams"}. Welcome!
              </p>
            </div>
            <button
              onClick={() => router.push(continueHref)}
              className="w-full px-4 py-3 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm"
              style={{ minHeight: 44 }}
            >
              Continue to your dashboard
            </button>
          </div>
        )}

        {status === "none" && (
          <div className="space-y-3">
            <p className="text-sm vi-text-muted text-center">
              No pending invitations were found for your account. If you were expecting one, ask the parent to
              re-send the invite to <strong>{user?.email}</strong>.
            </p>
            <button
              onClick={() => router.push(continueHref)}
              className="w-full px-4 py-3 rounded-full vi-surface-soft vi-text font-bold text-sm"
              style={{ minHeight: 44 }}
            >
              Continue
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--visual-sel)/0.12)]">
              <AlertCircle className="w-5 h-5 text-[hsl(var(--visual-sel))] shrink-0 mt-0.5" />
              <p className="text-sm vi-text">Something went wrong: {errorMsg}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-3 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm"
              style={{ minHeight: 44 }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
