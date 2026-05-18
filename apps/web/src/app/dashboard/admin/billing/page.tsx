"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconWell } from "@/components/discovery/_vi";
import {
  CreditCard,
  Building2,
  User,
  GraduationCap,
  Smartphone,
  Check,
  type LucideIcon,
} from "lucide-react";

export default function AdminBillingPage() {
  const { accessToken } = useAuth();
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const tp = useTranslations("platformAdmin");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const plans = [
    {
      name: "Free Trial",
      price: "$0",
      period: "14 days",
      features: ["1 learner", "3 AI tutors", "Basic assessments", "Limited sessions"],
      color: "bg-slate-600",
    },
    {
      name: "Family",
      price: "$29",
      period: "/month",
      features: [
        "Up to 3 learners",
        "All 14 AI tutors",
        "Full assessments",
        "Brain clone",
        "Recommendations",
      ],
      color: "bg-[hsl(var(--visual-primary))]",
    },
    {
      name: "Family Plus",
      price: "$49",
      period: "/month",
      features: [
        "Up to 6 learners",
        "All 14 AI tutors",
        "IEP integration",
        "Priority support",
        "Learning team",
      ],
      color: "bg-[hsl(var(--visual-science))]",
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      features: [
        "Unlimited learners",
        "District management",
        "SSO/SAML",
        "Custom branding",
        "Dedicated support",
        "API access",
      ],
      color: "bg-[hsl(var(--visual-sel))]",
    },
  ];

  const billingMetrics: {
    label: string;
    value: string | number;
    Icon: LucideIcon;
    color: string;
  }[] = [
    { label: "Total Tenants", value: stats?.totalTenants ?? "—", Icon: Building2, color: "math" },
    { label: "Total Users", value: stats?.totalUsers ?? "—", Icon: User, color: "primary" },
    {
      label: "Active Learners",
      value: stats?.totalLearners ?? "—",
      Icon: GraduationCap,
      color: "science",
    },
    { label: "Payment Gateways", value: "2", Icon: CreditCard, color: "reading" },
  ];

  const gateways: {
    name: string;
    status: string;
    desc: string;
    Icon: LucideIcon;
    color: string;
  }[] = [
    {
      name: "Stripe",
      status: "active",
      desc: "Primary payment processor for credit/debit cards",
      Icon: CreditCard,
      color: "primary",
    },
    {
      name: "M-Pesa",
      status: "configured",
      desc: "Mobile money for East Africa markets",
      Icon: Smartphone,
      color: "science",
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <IconWell color="primary">
          <CreditCard size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{tp("services")}</h1>
          <p className="text-sm vi-text-muted mt-1">
            Manage subscription plans, payment gateways, and licensing.
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/dashboard/admin/billing/coupons"
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] border border-[hsl(var(--visual-primary)/0.25)] hover:bg-[hsl(var(--visual-primary)/0.2)] transition"
          >
            Manage Coupons
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {billingMetrics.map((m) => {
          const Icon = m.Icon;
          return (
            <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border vi-border">
              <div className="mb-2">
                <IconWell color={m.color} size="sm">
                  <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                </IconWell>
              </div>
              <p className="text-2xl font-bold vi-text mt-2">{m.value}</p>
              <p className="text-xs vi-text-muted font-semibold mt-1">{m.label}</p>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Subscription Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div key={plan.name} className="vi-card overflow-hidden">
              <div className={`${plan.color} p-4 text-white`}>
                <p className="font-heading font-bold text-lg">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-sm opacity-80">{plan.period}</span>}
                </div>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm vi-text-muted">
                      <Check
                        size={14}
                        strokeWidth={3}
                        className="text-[hsl(var(--visual-science))] flex-shrink-0"
                        aria-hidden="true"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Payment Gateways</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gateways.map((gw) => {
            const Icon = gw.Icon;
            return (
              <div
                key={gw.name}
                className="flex items-center justify-between p-4 rounded-xl border vi-border"
              >
                <div className="flex items-center gap-3">
                  <IconWell color={gw.color} size="sm">
                    <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                  </IconWell>
                  <div>
                    <p className="text-sm font-semibold vi-text">{gw.name}</p>
                    <p className="text-xs vi-text-muted">{gw.desc}</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${
                    gw.status === "active"
                      ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                      : "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                  }`}
                >
                  {gw.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Usage Metering</h2>
        <p className="text-sm vi-text-muted mb-4">
          Track AI API calls, storage, and compute usage per tenant for billing purposes.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "AI API Calls", value: "—", desc: "Total LLM inference requests" },
            { label: "Storage", value: "—", desc: "Brain states, assessments, media" },
            { label: "Sessions", value: "—", desc: "Total learning sessions completed" },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-xl vi-bg border vi-border text-center">
              <p className="text-xl font-bold vi-text">{m.value}</p>
              <p className="text-sm font-semibold vi-text mt-1">{m.label}</p>
              <p className="text-xs vi-text-muted">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
