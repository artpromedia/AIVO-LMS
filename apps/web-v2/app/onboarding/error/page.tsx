"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("onboarding.error");
  const reason = searchParams.reason ?? "generic";
  const v = VARIANTS[reason] ?? VARIANTS.generic;

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name={v.icon} size={32} />}
        eyebrow={t(`${v.key}_eyebrow`)}
        title={t(`${v.key}_title`)}
        subtitle={t(`${v.key}_subtitle`)}
        reassurance={
          <ReassuranceCard
            tone={v.tone}
            title={t(`${v.key}_reassure_title`)}
            body={t(`${v.key}_reassure_body`)}
          />
        }
        actions={
          <>
            <Link
              href={v.primary.href}
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {t(`${v.key}_primary`)}
            </Link>
            {v.secondary ? (
              <Link
                href={v.secondary.href}
                className="text-xs text-iw-text-muted text-center hover:underline"
              >
                {t(`${v.key}_secondary`)}
              </Link>
            ) : null}
          </>
        }
      >
        <p className="text-sm text-iw-text-muted">{t(`${v.key}_body`)}</p>
      </AuthCard>
    </AuthShell>
  );
}

type Variant = {
  key: "expired_invite" | "offline" | "blocked" | "generic";
  icon: "consentLock" | "safetyAlert";
  tone: "info" | "safety" | "privacy";
  primary: { href: string };
  secondary?: { href: string };
};

const VARIANTS: Record<string, Variant> = {
  "expired-invite": {
    key: "expired_invite",
    icon: "consentLock",
    tone: "info",
    primary: { href: "/onboarding/welcome" },
    secondary: { href: "/onboarding/recovery" },
  },
  offline: {
    key: "offline",
    icon: "safetyAlert",
    tone: "info",
    primary: { href: "/onboarding/welcome" },
  },
  blocked: {
    key: "blocked",
    icon: "safetyAlert",
    tone: "safety",
    primary: { href: "/onboarding/welcome" },
    secondary: { href: "mailto:support@aivolearning.com" },
  },
  generic: {
    key: "generic",
    icon: "safetyAlert",
    tone: "info",
    primary: { href: "/onboarding/welcome" },
    secondary: { href: "mailto:support@aivolearning.com" },
  },
};
