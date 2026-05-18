"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { TUTOR_KEY_TO_SKU, type TutorSku } from "@aivo/billing-entitlements";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { describeTrial, useBillingState } from "@/hooks/useBillingState";
import { SubscriptionStatusBadge } from "@/components/billing/SubscriptionStatusBadge";
import { BillingSkeleton } from "@/components/billing/BillingSkeleton";

export default function ParentBillingPage() {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("parent");
  const tc = useTranslations("common");

  const billing = useBillingState({ tenantId: user?.tenantId, accessToken });

  const [addonLoading, setAddonLoading] = useState<TutorKey | null>(null);
  const [addonMsg, setAddonMsg] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "PARENT") router.push("/");
  }, [user, loading, router]);

  const goToCheckout = async (planId: string) => {
    if (planId === "district") return;
    if (planId === "free") {
      handleCancel();
      return;
    }
    setUpgradeLoading(planId);
    setUpgradeMsg("");
    try {
      const res = await fetch("/api/billing/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          tenantId: user?.tenantId,
          planId,
          successUrl: `${window.location.origin}/dashboard/parent/billing?checkout=success`,
          cancelUrl: `${window.location.origin}/dashboard/parent/billing?checkout=cancel`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setUpgradeMsg(data.error || tc("error"));
    } catch {
      setUpgradeMsg(t("billing_network_error"));
    }
    setUpgradeLoading(null);
  };

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          tenantId: user?.tenantId,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (res.ok && data.portalUrl) {
        window.location.href = data.portalUrl;
        return;
      }
      setUpgradeMsg(data.error || tc("error"));
    } catch {
      setUpgradeMsg(t("billing_network_error"));
    }
    setPortalLoading(false);
  };

  const handleAddTutor = async (key: TutorKey) => {
    setAddonLoading(key);
    setAddonMsg("");
    try {
      const sku = TUTOR_KEY_TO_SKU[key];
      const res = await fetch("/api/billing/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tenantId: user?.tenantId, tutorSku: sku }),
      });
      const data = await res.json();
      if (res.ok) {
        await billing.refreshEntitlements();
        const tutor = TUTORS[key];
        setAddonMsg(t("tutor_added_msg", { name: tutor?.name || key }));
      } else {
        setAddonMsg(data.error || t("failed_add_tutor"));
      }
    } catch {
      setAddonMsg(t("billing_network_error"));
    }
    setAddonLoading(null);
  };

  const handleRemoveTutor = async (key: TutorKey) => {
    setAddonLoading(key);
    setAddonMsg("");
    try {
      const sku = TUTOR_KEY_TO_SKU[key];
      const res = await fetch(`/api/billing/addons/${user?.tenantId}/${sku}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        await billing.refreshEntitlements();
        const tutor = TUTORS[key];
        setAddonMsg(t("tutor_removed_msg", { name: tutor?.name || key }));
      } else {
        const data = await res.json();
        setAddonMsg(data.error || t("failed_remove_tutor"));
      }
    } catch {
      setAddonMsg(t("billing_network_error"));
    }
    setAddonLoading(null);
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    setCancelMsg("");
    try {
      const res = await fetch(`/api/billing/subscription/${user?.tenantId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setCancelMsg(t("cancel_will_end"));
        await billing.refresh();
        setShowCancelModal(false);
      }
    } catch {}
    setCancelLoading(false);
  };

  const handleResume = async () => {
    try {
      const res = await fetch(`/api/billing/subscription/${user?.tenantId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) await billing.refresh();
    } catch {}
  };

  const trialInfo = useMemo(
    () => describeTrial(billing.subscription?.trialEndsAt ?? null),
    [billing.subscription?.trialEndsAt],
  );

  if (loading || !user) return null;

  const { subscription, plans, usage, invoices, entitlements } = billing;
  const currentPlan = plans.find((p) => p.id === subscription?.plan);
  const parentPlans = plans.filter((p) => p.id !== "district");
  const districtPlan = plans.find((p) => p.id === "district");
  const includedSkus = new Set<TutorSku>(entitlements?.includedTutorSkus ?? []);
  const purchasedSkus = new Set<TutorSku>(entitlements?.purchasedTutorSkus ?? []);
  const paymentFailed =
    subscription?.paymentStatus === "failed" || subscription?.status === "past_due";
  const incomplete =
    subscription?.status === "incomplete" || subscription?.status === "incomplete_expired";
  const status = subscription?.status ?? "active";
  const statusHelpKey =
    status === "past_due"
      ? "subscription_past_due_help"
      : status === "unpaid"
        ? "subscription_unpaid_help"
        : status === "incomplete"
          ? "subscription_incomplete_help"
          : status === "incomplete_expired"
            ? "subscription_incomplete_expired_help"
            : null;

  return (
    <div className="vi-bg">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={120}
          height={36}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/parent"
            className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline"
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/dashboard/parent/settings"
            className="text-sm vi-text-muted font-semibold hover:text-[hsl(var(--visual-primary))]"
          >
            {t("settings")}
          </Link>
          <span className="text-sm font-semibold vi-text-muted">{user.name}</span>
          <button
            onClick={logout}
            className="text-sm vi-text-muted hover:text-[hsl(var(--visual-math))] font-semibold transition"
          >
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        <h1 className="text-2xl font-heading font-bold vi-text">{t("billing_page_title")}</h1>

        {billing.status === "forbidden" && (
          <div className="vi-card p-4 border-2 border-[hsl(var(--visual-math)/0.4)] bg-[hsl(var(--visual-math)/0.06)]">
            <p className="text-sm text-[hsl(var(--visual-math))] font-semibold">
              {t("billing_access_denied")}
            </p>
          </div>
        )}
        {billing.status === "network" && (
          <div className="vi-card p-4 border-2 border-[hsl(var(--visual-math)/0.4)] bg-[hsl(var(--visual-math)/0.06)] flex items-center justify-between">
            <p className="text-sm text-[hsl(var(--visual-math))] font-semibold">
              {t("billing_network_error")}
            </p>
            <button
              onClick={billing.refresh}
              className="px-4 py-2 rounded-lg bg-[hsl(var(--visual-math))] text-white font-bold text-sm hover:opacity-90 transition"
            >
              {tc("retry")}
            </button>
          </div>
        )}
        {billing.status === "loading" && <BillingSkeleton />}

        {billing.status === "ok" && (
          <>
            {paymentFailed && (
              <div className="vi-card p-4 border-2 border-[hsl(var(--visual-math)/0.4)] bg-[hsl(var(--visual-math)/0.06)] flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[hsl(var(--visual-math))] font-semibold">
                    {t("payment_failed_warning")}
                  </p>
                  {statusHelpKey && (
                    <p className="text-xs vi-text-muted mt-1">{t(statusHelpKey)}</p>
                  )}
                </div>
                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="px-4 py-2 rounded-lg bg-[hsl(var(--visual-math))] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex-shrink-0"
                >
                  {portalLoading ? "..." : t("manage_payment_method")}
                </button>
              </div>
            )}

            {incomplete && !paymentFailed && (
              <div className="vi-card p-4 border-2 border-[hsl(var(--visual-primary)/0.4)] bg-[hsl(var(--visual-primary)/0.06)] flex items-center justify-between gap-4">
                <p className="text-sm text-[hsl(var(--visual-primary))] font-semibold">
                  {status === "incomplete_expired"
                    ? t("subscription_incomplete_expired_help")
                    : t("subscription_incomplete_help")}
                </p>
                <button
                  onClick={() => goToCheckout(subscription?.plan ?? "single")}
                  className="px-4 py-2 rounded-lg bg-[hsl(var(--visual-primary))] text-white font-bold text-sm hover:opacity-90 transition flex-shrink-0"
                >
                  {t("subscribe")}
                </button>
              </div>
            )}

            {trialInfo && (
              <div className="vi-card p-3 border border-[hsl(var(--visual-primary)/0.3)] bg-[hsl(var(--visual-primary)/0.06)]">
                <p className="text-sm text-[hsl(var(--visual-primary))] font-semibold">
                  {trialInfo.daysRemaining === 0
                    ? t("trial_ends_today")
                    : trialInfo.daysRemaining === 1
                      ? t("trial_ends_tomorrow")
                      : t("trial_ends_in_days", { days: trialInfo.daysRemaining })}
                </p>
              </div>
            )}

            {upgradeMsg && (
              <p className="text-sm text-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.12)] p-3 rounded-lg">
                {upgradeMsg}
              </p>
            )}
            {cancelMsg && (
              <p className="text-sm text-[hsl(var(--visual-sel))] bg-[hsl(var(--visual-sel)/0.12)] p-3 rounded-lg">
                {cancelMsg}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="vi-card p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs vi-text-muted font-semibold uppercase">
                    {t("current_plan")}
                  </h3>
                  <SubscriptionStatusBadge
                    status={status}
                    cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd}
                  />
                </div>
                <p className="text-2xl font-heading font-bold vi-text">
                  {currentPlan?.name || t("free_trial")}
                </p>
                <p className="text-sm text-[hsl(var(--visual-primary))] font-bold mt-1">
                  {currentPlan && currentPlan.price > 0
                    ? currentPlan.priceLabel || `$${currentPlan.price}/mo`
                    : t("free")}
                </p>
                {subscription?.cancelAtPeriodEnd && (
                  <button
                    onClick={handleResume}
                    className="mt-2 text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline"
                  >
                    {t("resume_subscription")}
                  </button>
                )}
              </div>
              <div className="vi-card p-6">
                <h3 className="text-xs vi-text-muted font-semibold uppercase mb-1">
                  {t("billing_period")}
                </h3>
                <p className="text-sm vi-text-muted">
                  {subscription?.currentPeriodStart
                    ? new Date(subscription.currentPeriodStart).toLocaleDateString()
                    : "--"}
                  {" - "}
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : "--"}
                </p>
                {subscription?.paymentMethod ? (
                  <p className="text-xs vi-text-muted mt-2">
                    {subscription.paymentMethod.last4
                      ? t("payment_method_card_label", {
                          brand: capitalize(subscription.paymentMethod.brand ?? "Card"),
                          last4: subscription.paymentMethod.last4,
                        })
                      : t("payment_method_other_label", {
                          brand: capitalize(subscription.paymentMethod.brand ?? "Card"),
                        })}
                  </p>
                ) : subscription?.hasStripeCustomer ? (
                  <p className="text-xs vi-text-muted mt-2">{t("no_payment_method")}</p>
                ) : null}
                {subscription?.hasStripeCustomer && (
                  <button
                    onClick={openCustomerPortal}
                    disabled={portalLoading}
                    className="mt-3 text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline disabled:opacity-50"
                  >
                    {portalLoading ? "..." : t("manage_billing")}
                  </button>
                )}
              </div>
              <div className="vi-card p-6">
                <h3 className="text-xs vi-text-muted font-semibold uppercase mb-1">
                  {t("this_period_usage")}
                </h3>
                {usage ? (
                  <div className="text-sm vi-text-muted space-y-1 mt-1">
                    <p>
                      {usage.learners} {usage.learners !== 1 ? "learners" : "learner"}
                    </p>
                    <p>
                      {usage.tutorSessions} {t("sessions").toLowerCase()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm vi-text-muted">{tc("loading")}</p>
                )}
              </div>
            </div>

            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-bold vi-text mb-2">
                {t("choose_your_plan")}
              </h2>
              <p className="text-sm vi-text-muted mb-6">{t("plan_description")}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {parentPlans.map((plan) => {
                  const isCurrent = subscription?.plan === plan.id;
                  const isFree = plan.id === "free";
                  const highlighted = plan.id === "family";
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl p-6 border-2 transition flex flex-col ${isCurrent ? "border-[hsl(var(--visual-primary))] bg-[hsl(var(--visual-primary)/0.06)] shadow-md" : highlighted ? "border-[hsl(var(--visual-primary)/0.4)] bg-[hsl(var(--visual-surface))] shadow-sm" : "vi-border bg-[hsl(var(--visual-surface))]"}`}
                    >
                      {highlighted && !isCurrent && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-bold rounded-full bg-[hsl(var(--visual-primary))] text-white">
                          {t("best_value")}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-bold rounded-full bg-[hsl(var(--visual-science))] text-white">
                          {t("current")}
                        </span>
                      )}
                      <h3 className="font-heading font-bold text-lg vi-text">{plan.name}</h3>
                      <div className="mt-2 mb-1">
                        {isFree ? (
                          <p className="text-3xl font-bold vi-text">{t("free")}</p>
                        ) : (
                          <>
                            <p className="text-3xl font-bold text-[hsl(var(--visual-primary))]">
                              ${plan.price}
                              <span className="text-base vi-text-muted font-normal">/mo</span>
                            </p>
                            <p className="text-xs vi-text-muted mt-0.5">{t("per_learner")}</p>
                          </>
                        )}
                      </div>
                      {plan.learnerMinimum && (
                        <p className="text-xs text-[hsl(var(--visual-sel))] font-medium mb-2">
                          {t("requires_learners", { count: plan.learnerMinimum })}
                        </p>
                      )}
                      <ul className="mt-3 space-y-2 flex-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="text-sm vi-text-muted flex items-start gap-2">
                            <Check
                              size={16}
                              strokeWidth={3}
                              aria-hidden="true"
                              className="text-[hsl(var(--visual-science))] mt-0.5 flex-shrink-0"
                            />{" "}
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => !isCurrent && goToCheckout(plan.id)}
                        disabled={isCurrent || upgradeLoading === plan.id}
                        className={`w-full mt-5 py-2.5 rounded-xl text-sm font-bold transition ${isCurrent ? "vi-surface-soft vi-text-muted cursor-default" : highlighted ? "bg-[hsl(var(--visual-primary))] text-white hover:bg-[hsl(var(--visual-primary)/0.9)] shadow-sm" : "bg-[hsl(var(--visual-text))] text-white hover:opacity-90"} disabled:opacity-50`}
                        style={{ minHeight: 44 }}
                      >
                        {isCurrent
                          ? t("current_plan_label")
                          : upgradeLoading === plan.id
                            ? t("switching")
                            : isFree
                              ? t("downgrade_to_free")
                              : t("subscribe")}
                      </button>
                    </div>
                  );
                })}
              </div>

              {districtPlan && (
                <div className="mt-6 p-5 rounded-2xl border-2 border-dashed vi-border vi-surface-soft flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-lg vi-text">{districtPlan.name}</h3>
                    <p className="text-sm vi-text-muted mt-1">{t("district_plan_desc")}</p>
                  </div>
                  <a
                    href="mailto:sales@aivolearning.com"
                    className="px-6 py-2.5 rounded-xl bg-[hsl(var(--visual-text))] text-white font-bold text-sm hover:opacity-90 transition flex-shrink-0"
                    style={{ minHeight: 44 }}
                  >
                    {t("contact_sales")}
                  </a>
                </div>
              )}
            </div>

            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-bold vi-text mb-2">
                {t("addon_tutors_title")}
              </h2>
              <p className="text-sm vi-text-muted mb-4">
                {t("addon_tutors_desc", { count: includedSkus.size })}
              </p>
              {addonMsg && (
                <p
                  className={`text-sm p-3 rounded-lg mb-4 ${addonMsg.includes("added") || addonMsg.includes("agregado") ? "text-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.12)]" : addonMsg.includes("removed") || addonMsg.includes("eliminado") ? "text-[hsl(var(--visual-sel))] bg-[hsl(var(--visual-sel)/0.12)]" : "text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.12)]"}`}
                >
                  {addonMsg}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.entries(TUTORS) as [TutorKey, (typeof TUTORS)[TutorKey]][]).map(
                  ([key, tutor]) => {
                    const sku = TUTOR_KEY_TO_SKU[key];
                    const isIncluded = includedSkus.has(sku);
                    const isAddon = purchasedSkus.has(sku);
                    const isProcessing = addonLoading === key;

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition ${isIncluded ? "vi-surface-soft vi-border" : isAddon ? "bg-[hsl(var(--visual-science)/0.12)] border-[hsl(var(--visual-science)/0.3)]" : "bg-[hsl(var(--visual-surface))] vi-border hover:border-[hsl(var(--visual-primary)/0.3)]"}`}
                      >
                        <Image
                          src={tutor.avatar}
                          alt={tutor.name}
                          width={40}
                          height={40}
                          className="rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm vi-text">{tutor.name}</p>
                          <p className="text-xs vi-text-muted truncate">{tutor.domain}</p>
                        </div>
                        {isIncluded ? (
                          <span className="px-3 py-1 text-xs rounded-full vi-surface-soft vi-text-muted font-medium flex-shrink-0">
                            {t("included")}
                          </span>
                        ) : isAddon ? (
                          <button
                            onClick={() => handleRemoveTutor(key)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] font-semibold hover:bg-[hsl(var(--visual-math)/0.2)] transition flex-shrink-0 disabled:opacity-50"
                          >
                            {isProcessing ? "..." : tc("remove")}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddTutor(key)}
                            disabled={isProcessing || !subscription?.hasStripeCustomer}
                            title={
                              !subscription?.hasStripeCustomer
                                ? t("subscribe_to_add_tutors")
                                : undefined
                            }
                            className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--visual-primary))] text-white font-semibold hover:bg-[hsl(var(--visual-primary)/0.9)] transition flex-shrink-0 disabled:opacity-50"
                          >
                            {isProcessing ? "..." : "+ $4.99/mo"}
                          </button>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
              {purchasedSkus.size > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--visual-primary)/0.06)] border border-[hsl(var(--visual-primary)/0.3)]">
                  <p className="text-sm vi-text-muted">
                    <span className="font-semibold">
                      {t("addon_tutors_summary", { count: purchasedSkus.size })}
                    </span>{" "}
                    &middot;{" "}
                    <span className="text-[hsl(var(--visual-primary))] font-bold">
                      ${(purchasedSkus.size * 4.99).toFixed(2)}/mo
                    </span>{" "}
                    {t("added_to_subscription")}
                  </p>
                </div>
              )}
            </div>

            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-bold vi-text mb-4">
                {t("invoice_history")}
              </h2>
              {invoices.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left vi-text-muted border-b vi-border">
                      <th className="pb-2">{tc("date")}</th>
                      <th className="pb-2">{tc("total")}</th>
                      <th className="pb-2">{tc("status")}</th>
                      <th className="pb-2">{t("invoice_history")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b vi-border">
                        <td className="py-2">
                          {inv.date ? new Date(inv.date).toLocaleDateString() : "--"}
                        </td>
                        <td className="py-2">${inv.amount.toFixed(2)}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]">
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2">
                          {inv.url && (
                            <a
                              href={inv.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[hsl(var(--visual-primary))] text-xs hover:underline"
                            >
                              {tc("download")}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm vi-text-muted">{t("no_invoices")}</p>
              )}
            </div>

            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-bold vi-text mb-2">
                {t("cancel_subscription")}
              </h2>
              <p className="text-sm vi-text-muted mb-4">
                {subscription?.cancelAtPeriodEnd ? t("cancel_scheduled") : t("cancel_description")}
              </p>
              {!subscription?.cancelAtPeriodEnd ? (
                !showCancelModal ? (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-6 py-2.5 rounded-lg border-2 border-[hsl(var(--visual-math)/0.3)] text-[hsl(var(--visual-math))] font-semibold hover:bg-[hsl(var(--visual-math)/0.06)] transition text-sm"
                    style={{ minHeight: 44 }}
                  >
                    {t("cancel_subscription")}
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-[hsl(var(--visual-math)/0.06)] border border-[hsl(var(--visual-math)/0.3)] space-y-3">
                    <p className="text-sm text-[hsl(var(--visual-math))] font-medium">
                      {t("cancel_confirm_message", {
                        date: subscription?.currentPeriodEnd
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                          : "",
                      })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelLoading}
                        className="px-4 py-2 text-xs rounded-lg bg-[hsl(var(--visual-math))] text-white font-semibold hover:bg-[hsl(var(--visual-math)/0.9)] transition disabled:opacity-50"
                        style={{ minHeight: 44 }}
                      >
                        {cancelLoading ? t("cancelling") : t("confirm_cancellation")}
                      </button>
                      <button
                        onClick={() => setShowCancelModal(false)}
                        className="px-4 py-2 text-xs rounded-lg vi-surface-soft vi-text font-semibold hover:bg-[hsl(var(--visual-border))] transition"
                        style={{ minHeight: 44 }}
                      >
                        {t("keep_subscription")}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <span className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] font-medium">
                  {t("subscription_will_cancel")}
                </span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
