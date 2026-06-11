import Image from "next/image";
import { TrendingUp } from "lucide-react";

/**
 * Landing-hero illustration. Mirrors apps/marketing: a softly rounded
 * photo of a learner-at-laptop with a floating "Focus Duration" stat card
 * overlapping the bottom-left corner.
 *
 * The numeric efficacy figure is intentionally omitted here — it mirrors
 * the citation-guarded rendering in apps/marketing/src/app/page.tsx, where
 * the value is only shown once a documented source is on file in
 * apps/marketing/src/content/claims.ts. Until then, both surfaces show the
 * qualitative fallback so the same unsourced claim cannot appear in the
 * rendered HTML of either app.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-iw-hero shadow-soft-5 ring-1 ring-iw-border">
        <Image
          src="/images/hero/girl-laptop.png"
          alt="A focused young learner using AIVO on her laptop at home"
          fill
          priority
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-cover"
        />
      </div>

      <div className="absolute -bottom-6 -left-4 max-w-[260px] rounded-iw-card border border-iw-border bg-iw-raised p-4 shadow-soft-5 sm:-left-8 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-iw-ink-muted">Focus Duration</p>
            <p className="text-sm font-semibold leading-snug text-iw-primary">
              Students show meaningful gains in focus
            </p>
            <p className="mt-1 text-[11px] text-iw-ink-muted">Average increase week 1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
