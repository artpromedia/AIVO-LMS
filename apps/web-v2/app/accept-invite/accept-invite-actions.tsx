"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { acceptInvitesAction } from "./actions";

type Props = {
  pendingCount: number;
  continueHref: string;
  email: string;
};

export function AcceptInviteActions({ pendingCount, continueHref, email }: Props) {
  const t = useTranslations("accept_invite.actions");
  const router = useRouter();
  const [accepted, setAccepted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitesAction();
      if (result.ok) {
        setAccepted(result.count);
      } else {
        setError(result.error);
      }
    });
  };

  if (accepted !== null) {
    if (accepted === 0) {
      return (
        <div className="space-y-3">
          <p className="text-center text-sm text-aivo-ink-soft">
            {t("no_pending_for")} <strong>{email}</strong>. If you were
            expecting one, ask the parent to re-send it to that address.
          </p>
          <Button className="w-full" onClick={() => router.push(continueHref)}>
            {t("continue")}
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-sm">
            {t("added_to")} <strong>{accepted}</strong>{" "}
            {accepted === 1 ? "learner's team" : "learners' teams"}. Welcome!
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push(continueHref)}>
          {t("continue_to_dashboard")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-aivo-ink-soft">
        {t("signed_in_as")} <strong className="text-aivo-ink">{email}</strong>.{" "}
        {pendingCount > 0
          ? `You have ${pendingCount} pending invitation${pendingCount === 1 ? "" : "s"}.`
          : "We'll check for any invitations waiting on this address."}
      </p>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}
      <Button className="w-full" onClick={handleAccept} disabled={pending}>
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("accepting")}
          </span>
        ) : (
          "Accept invitations"
        )}
      </Button>
    </div>
  );
}
