"use client";
import { useTranslations } from "next-intl";
import type { SubscriptionStatus } from "@/hooks/useBillingState";

interface Props {
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
}

const PALETTE: Record<SubscriptionStatus, { fg: string; bg: string }> = {
  trialing:           { fg: "var(--visual-primary)",  bg: "var(--visual-primary)/0.12" },
  active:             { fg: "var(--visual-science)",  bg: "var(--visual-science)/0.12" },
  past_due:           { fg: "var(--visual-math)",     bg: "var(--visual-math)/0.12" },
  unpaid:             { fg: "var(--visual-math)",     bg: "var(--visual-math)/0.18" },
  canceled:           { fg: "var(--visual-sel)",      bg: "var(--visual-sel)/0.12" },
  incomplete:         { fg: "var(--visual-math)",     bg: "var(--visual-math)/0.10" },
  incomplete_expired: { fg: "var(--visual-sel)",      bg: "var(--visual-sel)/0.15" },
  inactive:           { fg: "var(--visual-text)",     bg: "var(--visual-border)/0.4" },
};

/**
 * Compact subscription-status pill used in the billing header and the
 * "Current Plan" summary card. Colors come from the design tokens so
 * dark mode and high-contrast modes inherit automatically.
 */
export function SubscriptionStatusBadge({ status, cancelAtPeriodEnd }: Props) {
  const t = useTranslations("parent");
  const palette = PALETTE[status] ?? PALETTE.inactive;
  const label =
    cancelAtPeriodEnd
      ? t("cancels_at_period_end")
      : t(`subscription_status_${status}` as const);
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full"
      style={{
        color: `hsl(${palette.fg})`,
        background: `hsl(${palette.bg})`,
      }}
    >
      {label}
    </span>
  );
}
