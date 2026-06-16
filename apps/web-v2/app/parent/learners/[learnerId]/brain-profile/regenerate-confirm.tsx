"use client";

/**
 * Sprint C-05 (EDIT-2) — the Regenerate confirm step.
 *
 * Regenerating rebuilds the profile from the parent's current answers and
 * clears any review-screen corrections they staged but haven't approved. That
 * is destructive to in-progress work, so it must never fire on a single click
 * the way it did at HEAD (where it also silently dropped the parent back on a
 * read-only page). This wraps the existing `regenerateAction` server action in
 * a confirm dialog that states plainly what will happen; only the dialog's
 * confirm button submits.
 *
 * The trigger and the confirm button are native; the dialog reveal is the only
 * animation and Radix disables it under `prefers-reduced-motion`. The form
 * lives inside the dialog so the server action is reached by a normal submit
 * (no client-only state in the critical path).
 */
import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RegenerateConfirm({
  learnerId,
  regenerateAction,
  triggerLabel,
  title,
  body,
  confirmLabel,
  cancelLabel,
}: {
  learnerId: string;
  regenerateAction: (formData: FormData) => void | Promise<void>;
  triggerLabel: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-iw-ink">{title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-iw-ink-muted">{body}</DialogDescription>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {cancelLabel}
            </Button>
          </DialogClose>
          <form action={regenerateAction}>
            <input type="hidden" name="learnerId" value={learnerId} />
            <Button type="submit" variant="danger">
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" /> {confirmLabel}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
