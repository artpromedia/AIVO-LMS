import Link from "next/link";
import { useId, type ReactNode } from "react";

type Tone = "purple" | "blue" | "emerald" | "slate";

const TONES: Record<Tone, string> = {
  purple: "from-iw-purple-50 to-white border-iw-purple-100",
  blue: "from-iw-teal-50 to-white border-iw-teal-100",
  emerald: "from-iw-success-subtle to-white border-iw-success",
  slate: "from-iw-raised to-white border-iw-border",
};

export function CalloutCard({
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
  tone = "purple",
}: {
  eyebrow?: string;
  title: string;
  body: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  tone?: Tone;
}) {
  const headingId = useId();
  return (
    <section
      className={`mb-14 rounded-iw-card border bg-gradient-to-br ${TONES[tone]} p-6 md:p-8`}
      aria-labelledby={headingId}
    >
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-wider text-iw-primary">{eyebrow}</p>
      )}
      <h2 id={headingId} className="mt-2 font-heading text-xl md:text-2xl font-bold text-iw-ink">
        {title}
      </h2>
      <div className="mt-3 text-iw-ink font-body leading-relaxed">{body}</div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex items-center gap-1 font-semibold text-iw-primary hover:gap-2 transition-all"
        >
          {ctaLabel} <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}
