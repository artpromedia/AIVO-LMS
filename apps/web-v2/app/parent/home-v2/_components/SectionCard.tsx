import Link from "next/link";
import { AivoIcon, type AivoIconName } from "@aivo/ui/icon";

/**
 * Parent home-v2 / SectionCard
 *
 * Larger-than-FloatingMetricCard composition surface for the
 * dashboard's secondary blocks (readiness, assessment status,
 * IEP-upload status, consent checklist, today's actions,
 * notifications, billing, school connection).
 *
 * Visual contract is intentionally calm: white surface, 24px
 * radius, very soft drop-shadow, optional iconed header, and an
 * optional CTA in the footer with a real href.
 */
export interface SectionCardProps {
  title: React.ReactNode;
  iconName?: AivoIconName;
  subtitle?: React.ReactNode;
  /** Optional pill rendered next to the title (e.g. "Action needed"). */
  badge?: React.ReactNode;
  badgeTone?: "neutral" | "info" | "success" | "warning";
  children: React.ReactNode;
  cta?: { href: string; label: React.ReactNode };
  className?: string;
}

const BADGE_TONE: Record<NonNullable<SectionCardProps["badgeTone"]>, string> = {
  neutral: "bg-iw-card text-iw-text-muted border border-iw-border",
  info: "bg-[var(--aivo-aivoTeal-100)] text-[var(--aivo-aivoTeal-700)]",
  success:
    "bg-[var(--aivo-domain-completion-complete-subtle)] text-[var(--aivo-domain-completion-complete-strong)]",
  warning: "bg-iw-warm-soft text-[var(--aivo-status-warning)]",
};

export function SectionCard({
  title,
  iconName,
  subtitle,
  badge,
  badgeTone = "neutral",
  children,
  cta,
  className,
}: SectionCardProps) {
  return (
    <section
      className={[
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-soft-3",
        "p-5 sm:p-6 flex flex-col gap-4",
        className ?? "",
      ].join(" ")}
    >
      <header className="flex items-start gap-3">
        {iconName ? (
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)] shrink-0">
            <AivoIcon name={iconName} size={20} />
          </span>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold text-iw-text-strong">{title}</h3>
            {badge ? (
              <span
                className={[
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  BADGE_TONE[badgeTone],
                ].join(" ")}
              >
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="text-sm text-iw-text-muted mt-1">{subtitle}</p> : null}
        </div>
      </header>

      <div className="flex-1 text-sm text-iw-text-strong">{children}</div>

      {cta ? (
        <footer className="pt-1">
          <Link
            href={cta.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
          >
            {cta.label}
            <AivoIcon name="goal" size={14} />
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

SectionCard.displayName = "ParentHomeV2/SectionCard";
