"use client";

/**
 * Dialog-backed "Preview" pill on the parent baseline page. Replaces the
 * previous static `Badge` so each of the six tutor cards has an actionable
 * preview that shows the tutor avatar, scene, and greeting copy without
 * having to start the baseline run.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ChapterPreviewTutor = {
  id: string;
  name: string;
  landmark: string;
  subtitle: string;
  emoji: string;
  color: string;
  scene: string;
  greeting: string;
};

export function ChapterPreviewButton({
  tutor,
  label,
}: Readonly<{
  tutor: ChapterPreviewTutor;
  label: string;
}>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`${label}: ${tutor.name}'s ${tutor.landmark}`}
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: `${tutor.color}1A`, color: tutor.color }}
            aria-hidden
          >
            {tutor.emoji}
          </div>
          <div className="min-w-0">
            <DialogTitle className="font-display text-base font-semibold">
              {tutor.name}&apos;s {tutor.landmark}
            </DialogTitle>
            <DialogDescription className="text-xs text-iw-ink-muted">
              {tutor.subtitle}
            </DialogDescription>
          </div>
        </div>
        <p className="mt-4 text-sm text-iw-ink-muted">{tutor.scene}</p>
        <figure className="mt-4 rounded-iw-card border border-iw-border bg-iw-raised p-3">
          <blockquote className="text-sm italic text-iw-ink">
            &ldquo;{tutor.greeting}&rdquo;
          </blockquote>
          <figcaption className="mt-1 text-xs text-iw-ink-muted">— {tutor.name}</figcaption>
        </figure>
      </DialogContent>
    </Dialog>
  );
}
