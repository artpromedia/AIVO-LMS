import { ShieldCheck, Sparkles } from "lucide-react";

/**
 * Left-column welcome panel shared by /login and /signup.
 *
 * Mirrors the warm gradient + trust signals from the landing hero so the
 * authentication flow doesn't feel like a different product. Hidden on
 * narrow viewports — on mobile the form takes the full width.
 */
export function WelcomePanel({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden rounded-iw-hero border border-iw-border bg-iw-sensory-brand p-10 shadow-soft-5 lg:flex lg:flex-col lg:justify-between"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.45),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.25),transparent_50%)]" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-iw-primary backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {eyebrow}
        </span>
        <h2 className="mt-6 font-iw-display text-3xl font-bold leading-tight text-iw-ink sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-iw-ink/85">{body}</p>
      </div>

      <div className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-iw-primary backdrop-blur">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        COPPA · FERPA · SOC 2 Compliant
      </div>
    </aside>
  );
}
