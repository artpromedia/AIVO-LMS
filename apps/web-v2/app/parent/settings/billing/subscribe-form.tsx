"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  captureCheckoutAttribution,
  readCheckoutAttribution,
} from "@/lib/bff/checkout-attribution";

type PlanRow = {
  plan: {
    id: string;
    code: string;
    name: string;
    description: string;
    features: string[];
    maxLearners: number | null;
  };
  prices: Array<{ id: string; amountCents: number; interval: string; trialDays: number }>;
};

export function SubscribeForm({
  plans,
  activePlanId,
}: {
  plans: PlanRow[];
  activePlanId: string | null;
}) {
  const t = useTranslations("parent.billing");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Per-plan acceptance of the per-child subscription terms. The parent must
  // tick the box before we start a (trialing) $39.99/mo-per-child plan.
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  // Persist any utm_*/coupon present when the billing page loads so a campaign
  // deep-link is still attributed when the parent subscribes.
  useEffect(() => {
    captureCheckoutAttribution();
  }, []);

  function subscribe(planId: string, priceId: string) {
    setError(null);
    if (!accepted[planId]) {
      setError(t("sub_terms_required"));
      return;
    }
    start(async () => {
      const res = await fetch("/api/bff/parent/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          priceId,
          termsAccepted: true,
          ...readCheckoutAttribution(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not change plan.");
        return;
      }
      // Real billing path: billing-svc returns a hosted Stripe Checkout
      // URL — hand off to it. The store path returns no URL, so we just
      // refresh to reflect the simulated change.
      const checkoutUrl = json?.data?.checkoutUrl;
      if (typeof checkoutUrl === "string" && checkoutUrl.length > 0) {
        window.location.assign(checkoutUrl);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plans.map((row) => {
        const price = row.prices[0];
        const isActive = row.plan.id === activePlanId;
        return (
          <div
            key={row.plan.id}
            className="rounded-iw-card border border-iw-border bg-iw-card p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold">{row.plan.name}</h3>
                <p className="mt-1 text-sm text-iw-ink-muted">{row.plan.description}</p>
              </div>
              {isActive ? (
                <span className="rounded-full bg-iw-success/10 px-2 py-0.5 text-xs font-medium text-iw-success">
                  {t("sub_current_badge")}
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-2xl font-bold">
              {price ? `$${(price.amountCents / 100).toFixed(2)}` : "—"}
              <span className="ml-1 text-sm font-normal text-iw-ink-muted">
                / {price?.interval ?? "month"}
              </span>
            </p>
            {price && price.trialDays > 0 ? (
              <p className="mt-1 text-xs text-iw-ink-muted">
                {t("sub_free_trial", { days: price.trialDays })}
              </p>
            ) : null}
            <ul className="mt-3 space-y-1 text-sm text-iw-ink-muted">
              {row.plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {!isActive ? (
              <label className="mt-4 flex items-start gap-2 text-xs text-iw-ink-muted">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(accepted[row.plan.id])}
                  onChange={(e) =>
                    setAccepted((prev) => ({ ...prev, [row.plan.id]: e.target.checked }))
                  }
                />
                <span>{t("sub_terms_label")}</span>
              </label>
            ) : null}
            <Button
              className="mt-4 w-full"
              variant={isActive ? "outline" : "default"}
              disabled={pending || isActive || !price || (!isActive && !accepted[row.plan.id])}
              onClick={() => price && subscribe(row.plan.id, price.id)}
            >
              {isActive ? t("sub_current_plan") : pending ? t("sub_working") : t("sub_switch")}
            </Button>
          </div>
        );
      })}
      {error ? <p className="text-sm text-iw-error md:col-span-2">{error}</p> : null}
    </div>
  );
}

export function CancelButton({
  subscriptionId,
  cancelAtPeriodEnd,
}: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
}) {
  const t = useTranslations("parent.billing");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (cancelAtPeriodEnd) {
    return <p className="text-sm text-iw-ink-muted">{t("sub_set_to_cancel")}</p>;
  }
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await fetch("/api/bff/parent/subscription", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ subscriptionId, atPeriodEnd: true }),
            });
            const json = await res.json();
            if (!res.ok) {
              setError(json?.error?.message ?? "Could not cancel.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {t(pending ? "sub_canceling" : "sub_cancel_at_period_end")}
      </Button>
      {error ? <p className="mt-2 text-sm text-iw-error">{error}</p> : null}
    </div>
  );
}
