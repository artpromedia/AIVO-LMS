import Link from "next/link";
import { useId, type ReactNode } from "react";

type Tone = "purple" | "blue" | "emerald" | "slate";

const TONES: Record<Tone, string> = {
  purple: "from-purple-50 to-white border-purple-100",
  blue: "from-blue-50 to-white border-blue-100",
  emerald: "from-emerald-50 to-white border-emerald-100",
  slate: "from-slate-50 to-white border-slate-200",
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
      className={`mb-14 rounded-2xl border bg-gradient-to-br ${TONES[tone]} p-6 md:p-8`}
      aria-labelledby={headingId}
    >
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
          {eyebrow}
        </p>
      )}
      <h2
        id={headingId}
        className="mt-2 font-heading text-xl md:text-2xl font-bold text-slate-900"
      >
        {title}
      </h2>
      <div className="mt-3 text-slate-700 font-body leading-relaxed">{body}</div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex items-center gap-1 font-semibold text-purple-700 hover:gap-2 transition-all"
        >
          {ctaLabel} <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}
