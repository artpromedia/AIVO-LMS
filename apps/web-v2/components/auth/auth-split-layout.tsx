import * as React from "react";
import { Heart, ShieldCheck } from "lucide-react";
import { CloudMascot, type CloudMascotVariant } from "./cloud-mascot";

/**
 * AuthSplitLayout — the full-bleed two-column shell every auth screen in the
 * redesign lives inside. Left column holds the form card (centered, dominant
 * on every breakpoint); the right column is the cloud-mascot illustration
 * panel, which appears from the `md` breakpoint up (tablets + desktop) and is
 * hidden on phones where the form takes the full width.
 *
 * All chrome flows through the iw-* sensory tokens.
 */
export function AuthSplitLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className="grid min-h-screen w-full bg-iw-bg md:grid-cols-[1.05fr_0.95fr]"
    >
      <div className="flex items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-iw-accent-soft md:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.55),transparent_55%),radial-gradient(circle_at_30%_85%,rgba(124,108,246,0.18),transparent_55%)]" />
        <div className="relative flex h-full flex-col items-center justify-center gap-8 px-10 py-14 text-center">
          {panel}
        </div>
      </aside>
    </main>
  );
}

/**
 * AuthSidePanel — the mascot + headline + body (+ optional trailing card)
 * content for the right column. The mascot sits inside a soft halo.
 */
export function AuthSidePanel({
  variant = "wave",
  title,
  accent,
  body,
  children,
}: {
  variant?: CloudMascotVariant;
  title: React.ReactNode;
  accent?: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="relative flex items-center justify-center">
        <div className="absolute h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.22),transparent_70%)]" />
        <CloudMascot variant={variant} size={236} className="relative aivo-cloud-breathe" />
      </div>
      <div className="max-w-sm">
        <h2 className="font-iw-display text-2xl font-bold leading-snug text-iw-ink sm:text-3xl">
          {title}
          {accent ? <span className="text-iw-primary"> {accent}</span> : null}
        </h2>
        {body ? <p className="mt-4 text-base leading-relaxed text-iw-ink/80">{body}</p> : null}
      </div>
      {children}
    </>
  );
}

/**
 * AuthTrustCard — the small "trusted by school districts" reassurance card
 * shown beneath the side-panel copy on several screens.
 */
export function AuthTrustCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-sm items-start gap-3 rounded-iw-card border border-iw-border bg-white/70 px-4 py-3 text-left text-xs leading-relaxed text-iw-ink-muted backdrop-blur">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-iw-accent" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/**
 * MascotEncouragementCard — a compact horizontal mascot + encouragement card.
 * On phones and portrait tablets the full side panel is hidden, so the
 * kid-facing screens (learner profile picker, set-PIN) render this inline
 * instead — the warm "you can do it" reassurance the desktop panel carries,
 * shaped to fit under the form. Decorative mascot; meaning is in the text.
 */
export function MascotEncouragementCard({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-iw-card border border-iw-border bg-iw-accent-soft/40 px-4 py-3 text-left",
        className ?? "",
      ].join(" ")}
    >
      <CloudMascot variant="wave" size={56} className="shrink-0 aivo-cloud-breathe" />
      <div className="min-w-0 flex-1">
        <p className="font-iw-display text-sm font-bold text-iw-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-iw-ink-muted">{body}</p>
      </div>
      <Heart className="h-4 w-4 shrink-0 text-iw-primary" aria-hidden="true" />
    </div>
  );
}

/**
 * AuthSecureFooter — the lock-icon "Secure sign-in powered by AIVO" footer
 * under every card.
 */
export function AuthSecureFooter({
  lead,
  sub,
}: {
  lead: string;
  sub: string;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-1 text-center text-xs text-iw-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <LockGlyph />
        {lead}
      </span>
      <span>{sub}</span>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" opacity="0.85" />
      <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
