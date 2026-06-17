import Link from "next/link";
import { User, UserRound } from "lucide-react";

/**
 * AudienceToggle — the Adult / Learner pill switch shown at the top of the
 * sign-in cards. Each option is a real link so the toggle works without
 * JavaScript and stays shareable. The active pill is filled with the primary
 * token; the inactive pill is quiet.
 */
export function AudienceToggle({
  active,
  adultHref,
  learnerHref,
  adultLabel,
  learnerLabel,
  ariaLabel,
}: {
  active: "adult" | "learner";
  adultHref: string;
  learnerHref: string;
  adultLabel: string;
  learnerLabel: string;
  ariaLabel: string;
}) {
  const base =
    "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring";
  const on = "bg-iw-primary text-iw-primary-fg shadow-sm";
  const off = "text-iw-ink-muted hover:text-iw-ink";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-full border border-iw-border bg-iw-raised p-1"
    >
      <Link
        href={adultHref}
        role="tab"
        aria-selected={active === "adult"}
        className={`${base} ${active === "adult" ? on : off}`}
      >
        <User className="h-4 w-4" aria-hidden="true" />
        {adultLabel}
      </Link>
      <Link
        href={learnerHref}
        role="tab"
        aria-selected={active === "learner"}
        className={`${base} ${active === "learner" ? on : off}`}
      >
        <UserRound className="h-4 w-4" aria-hidden="true" />
        {learnerLabel}
      </Link>
    </div>
  );
}

AudienceToggle.displayName = "Auth/AudienceToggle";
