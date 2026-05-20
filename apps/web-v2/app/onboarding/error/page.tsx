"use client";
import Link from "next/link";
import { AuthShell, AuthCard, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/error
 *
 * Generic auth-flow error states. Query string `?reason=` chooses the
 * variant: `expired-invite`, `offline`, `blocked`, default.
 */
export default function OnboardingErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "generic";
  const v = VARIANTS[reason] ?? VARIANTS.generic;

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name={v.icon} size={32} />}
        eyebrow={v.eyebrow}
        title={v.title}
        subtitle={v.subtitle}
        reassurance={
          <ReassuranceCard tone={v.tone} title={v.reassure.title} body={v.reassure.body} />
        }
        actions={
          <>
            <Link
              href={v.primary.href}
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {v.primary.label}
            </Link>
            {v.secondary ? (
              <Link
                href={v.secondary.href}
                className="text-xs text-iw-text-muted text-center hover:underline"
              >
                {v.secondary.label}
              </Link>
            ) : null}
          </>
        }
      >
        <p className="text-sm text-iw-text-muted">{v.body}</p>
      </AuthCard>
    </AuthShell>
  );
}

type Variant = {
  icon: "consentLock" | "safetyAlert";
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: "info" | "safety" | "privacy";
  body: string;
  reassure: { title: string; body: string };
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
};

const VARIANTS: Record<string, Variant> = {
  "expired-invite": {
    icon: "consentLock" as const,
    eyebrow: "Invite expired",
    title: "This invite isn't valid anymore.",
    subtitle: "Invites expire after 30 days. Ask the person who sent it to issue a new one.",
    tone: "info" as const,
    body: "If your school or district sent this, contact your admin. AIVO support can also re-send if you provide the original code.",
    reassure: {
      title: "We didn't lose your spot.",
      body: "Your seat at the school or district is still reserved — only the link expired.",
    },
    primary: { href: "/onboarding/welcome", label: "Back to welcome" },
    secondary: { href: "/onboarding/recovery", label: "Need help signing in?" },
  },
  offline: {
    icon: "safetyAlert" as const,
    eyebrow: "Offline",
    title: "We can't reach AIVO right now.",
    subtitle: "Check your connection and try again.",
    tone: "info" as const,
    body: "Some learner activities work offline once a lesson has loaded — but setup needs a live connection.",
    reassure: {
      title: "Nothing was lost.",
      body: "We'll pick up exactly where you left off as soon as you're back online.",
    },
    primary: { href: "/onboarding/welcome", label: "Try again" },
  },
  blocked: {
    icon: "safetyAlert" as const,
    eyebrow: "Account blocked",
    title: "This account is paused.",
    subtitle: "AIVO support has paused this account. This is usually a billing or compliance review.",
    tone: "safety" as const,
    body: "You'll get an email at the address on file once the review finishes, usually within one business day.",
    reassure: {
      title: "Your child's data is safe.",
      body: "We don't delete anything during a review — pause and resume only.",
    },
    primary: { href: "/onboarding/welcome", label: "Back to welcome" },
    secondary: { href: "mailto:support@aivolearning.com", label: "Contact support" },
  },
  generic: {
    icon: "safetyAlert" as const,
    eyebrow: "Something went wrong",
    title: "We hit a snag.",
    subtitle: "It's probably temporary — try again in a moment.",
    tone: "info" as const,
    body: "If this keeps happening, please contact AIVO support and mention what you were trying to do.",
    reassure: {
      title: "Nothing was charged or saved incorrectly.",
      body: "AIVO never persists half-finished setup data.",
    },
    primary: { href: "/onboarding/welcome", label: "Start over" },
    secondary: { href: "mailto:support@aivolearning.com", label: "Contact support" },
  },
};
