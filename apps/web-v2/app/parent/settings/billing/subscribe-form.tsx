"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type PlanRow = {
  plan: { id: string; code: string; name: string; description: string; features: string[]; maxLearners: number | null };
  prices: Array<{ id: string; amountCents: number; interval: string; trialDays: number }>;
};

export function SubscribeForm({ plans, activePlanId }: { plans: PlanRow[]; activePlanId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subscribe(planId: string, priceId: string) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/bff/parent/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, priceId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not change plan.");
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
          <div key={row.plan.id} className="rounded-xl border border-aivo-border bg-aivo-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold">{row.plan.name}</h3>
                <p className="mt-1 text-sm text-aivo-ink-soft">{row.plan.description}</p>
              </div>
              {isActive ? (
                <span className="rounded-full bg-aivo-success/10 px-2 py-0.5 text-xs font-medium text-aivo-success">Current</span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-2xl font-bold">
              {price ? `$${(price.amountCents / 100).toFixed(2)}` : "—"}
              <span className="ml-1 text-sm font-normal text-aivo-ink-soft">/ {price?.interval ?? "month"}</span>
            </p>
            {price && price.trialDays > 0 ? (
              <p className="mt-1 text-xs text-aivo-ink-soft">{price.trialDays}-day free trial</p>
            ) : null}
            <ul className="mt-3 space-y-1 text-sm text-aivo-ink-soft">
              {row.plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <Button
              className="mt-4 w-full"
              variant={isActive ? "outline" : "default"}
              disabled={pending || isActive || !price}
              onClick={() => price && subscribe(row.plan.id, price.id)}
            >
              {isActive ? "Current plan" : pending ? "Working..." : "Switch to this plan"}
            </Button>
          </div>
        );
      })}
      {error ? <p className="text-sm text-aivo-danger md:col-span-2">{error}</p> : null}
    </div>
  );
}

export function CancelButton({ subscriptionId, cancelAtPeriodEnd }: { subscriptionId: string; cancelAtPeriodEnd: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (cancelAtPeriodEnd) {
    return <p className="text-sm text-aivo-ink-soft">Set to cancel at period end.</p>;
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
        {pending ? "Canceling..." : "Cancel at period end"}
      </Button>
      {error ? <p className="mt-2 text-sm text-aivo-danger">{error}</p> : null}
    </div>
  );
}
