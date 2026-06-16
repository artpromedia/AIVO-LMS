"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { optOutOfNudgesAction } from "./actions";

export function UnsubscribeConfirm({
  kind,
  invite,
  prompt,
  confirmLabel,
  doneLabel,
  errorLabel,
}: {
  kind: string;
  invite: string;
  prompt: string;
  confirmLabel: string;
  doneLabel: string;
  errorLabel: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  if (state === "done") {
    return (
      <p className="rounded-lg bg-iw-success-subtle p-3 text-sm text-iw-success-strong" role="status">
        {doneLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-iw-ink-muted">{prompt}</p>
      {state === "error" ? (
        <p className="text-sm text-iw-error-strong" role="alert">
          {errorLabel}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await optOutOfNudgesAction(kind, invite);
            setState(res.ok ? "done" : "error");
          })
        }
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
