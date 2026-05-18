"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";

type Coupon = {
  code: string;
  description: string | null;
  discount_pct: number;
  max_redemptions: number | null;
  redemptions: number;
  active: boolean;
  created_at: string;
  expires_at: string | null;
  coupon_type?: "DISCOUNT" | "PROVISIONING" | "SUBSCRIPTION";
  grants_tier?: string | null;
  grants_plan?: string | null;
  grants_seat_limit?: number | null;
  grants_duration_days?: number | null;
};

type CouponForm = {
  code: string;
  description: string;
  couponType: "DISCOUNT" | "SUBSCRIPTION" | "PROVISIONING";
  discountPct: number;
  maxRedemptions: string;
  expiresAt: string;
  subscriptionDurationDays: string;
  grantsTier: string;
  grantsPlan: string;
  grantsSeatLimit: string;
  grantsDurationDays: string;
};

const INITIAL_FORM: CouponForm = {
  code: "",
  description: "",
  couponType: "SUBSCRIPTION",
  discountPct: 20,
  maxRedemptions: "",
  expiresAt: "",
  subscriptionDurationDays: "30",
  grantsTier: "district",
  grantsPlan: "pilot",
  grantsSeatLimit: "",
  grantsDurationDays: "90",
};

export default function AdminCouponsPage() {
  const { accessToken } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(INITIAL_FORM);

  const activeCount = useMemo(() => coupons.filter((c) => c.active).length, [coupons]);

  async function loadCoupons() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/admin/coupons", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Failed to load coupons (${res.status})`);
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (e: any) {
      setError(e.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoupons();
  }, [accessToken]);

  function updateField<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      couponType: form.couponType,
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };

    if (form.couponType === "DISCOUNT") {
      payload.discountPct = Number(form.discountPct);
    } else if (form.couponType === "SUBSCRIPTION") {
      payload.discountPct = 0;
      payload.grantsDurationDays = form.subscriptionDurationDays
        ? Number(form.subscriptionDurationDays)
        : null;
    } else {
      payload.discountPct = 0;
      payload.grantsTier = form.grantsTier.trim();
      payload.grantsPlan = form.grantsPlan.trim();
      payload.grantsSeatLimit = form.grantsSeatLimit ? Number(form.grantsSeatLimit) : null;
      payload.grantsDurationDays = form.grantsDurationDays ? Number(form.grantsDurationDays) : null;
    }

    try {
      const res = await fetch("/api/billing/admin/coupons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Create failed (${res.status})`);
      }
      setSuccess(`Coupon ${payload.code as string} created.`);
      setForm(INITIAL_FORM);
      await loadCoupons();
    } catch (e: any) {
      setError(e.message || "Failed to create coupon");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateCoupon(code: string) {
    if (!accessToken) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/billing/admin/coupons/${encodeURIComponent(code)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Deactivate failed (${res.status})`);
      setSuccess(`Coupon ${code} deactivated.`);
      await loadCoupons();
    } catch (e: any) {
      setError(e.message || "Failed to deactivate coupon");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link
          href="/dashboard/admin/billing"
          className="hover:text-[hsl(var(--visual-primary))] transition"
        >
          Billing
        </Link>
        <span>/</span>
        <span className="vi-text font-medium">Coupons</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Coupons & Subscriptions</h1>
          <p className="text-sm vi-text-muted mt-1">
            Create coupons for subscription access (1-12 months), discounts, or pilot provisioning
            to districts.
          </p>
        </div>
        <button
          onClick={loadCoupons}
          disabled={loading}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] border border-[hsl(var(--visual-primary)/0.25)] hover:bg-[hsl(var(--visual-primary)/0.2)] transition disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="vi-card p-4">
          <p className="text-xs vi-text-muted uppercase font-bold">Total Coupons</p>
          <p className="text-2xl font-bold vi-text mt-2">{coupons.length}</p>
        </div>
        <div className="vi-card p-4">
          <p className="text-xs vi-text-muted uppercase font-bold">Active</p>
          <p className="text-2xl font-bold text-[hsl(var(--visual-science))] mt-2">{activeCount}</p>
        </div>
        <div className="vi-card p-4">
          <p className="text-xs vi-text-muted uppercase font-bold">Inactive</p>
          <p className="text-2xl font-bold text-[hsl(var(--visual-math))] mt-2">
            {Math.max(0, coupons.length - activeCount)}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={onCreateCoupon} className="vi-card p-5 space-y-4">
        <h2 className="font-heading font-bold text-lg vi-text">Create Coupon</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="coupon-code" className="block text-sm font-medium vi-text mb-1">
              Code
            </label>
            <input
              id="coupon-code"
              required
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toUpperCase())}
              className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
              placeholder="PILOT-DIST-2026"
            />
          </div>

          <div>
            <label htmlFor="coupon-type" className="block text-sm font-medium vi-text mb-1">
              Type
            </label>
            <select
              id="coupon-type"
              value={form.couponType}
              onChange={(e) =>
                updateField(
                  "couponType",
                  e.target.value as "DISCOUNT" | "SUBSCRIPTION" | "PROVISIONING",
                )
              }
              className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
            >
              <option value="SUBSCRIPTION">Subscription Duration (1mo, 3mo, 6mo, 12mo)</option>
              <option value="DISCOUNT">Discount (%)</option>
              <option value="PROVISIONING">Provisioning (district pilot tier/plan)</option>
            </select>
          </div>

          <div>
            <label htmlFor="coupon-max" className="block text-sm font-medium vi-text mb-1">
              Max Redemptions
            </label>
            <input
              id="coupon-max"
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) => updateField("maxRedemptions", e.target.value)}
              className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
              placeholder="Leave blank for unlimited"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="coupon-description" className="block text-sm font-medium vi-text mb-1">
              Description
            </label>
            <input
              id="coupon-description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
              placeholder="Pilot coupon for District Alpha"
            />
          </div>
          <div>
            <label htmlFor="coupon-expiry" className="block text-sm font-medium vi-text mb-1">
              Expires At
            </label>
            <input
              id="coupon-expiry"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => updateField("expiresAt", e.target.value)}
              className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
            />
          </div>
        </div>

        {form.couponType === "DISCOUNT" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="discount-pct" className="block text-sm font-medium vi-text mb-1">
                Discount %
              </label>
              <input
                id="discount-pct"
                type="number"
                min={1}
                max={100}
                value={form.discountPct}
                onChange={(e) => updateField("discountPct", Number(e.target.value || 0))}
                className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
              />
            </div>
          </div>
        ) : form.couponType === "SUBSCRIPTION" ? (
          <div className="space-y-4">
            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- group of toggle buttons, no single control */}
              <label className="block text-sm font-medium vi-text mb-2">
                Subscription Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => updateField("subscriptionDurationDays", "30")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    form.subscriptionDurationDays === "30"
                      ? "bg-[hsl(var(--visual-primary))] text-white border-[hsl(var(--visual-primary))]"
                      : "border-vi-border vi-text-muted hover:vi-text"
                  }`}
                >
                  1 mo
                </button>
                <button
                  type="button"
                  onClick={() => updateField("subscriptionDurationDays", "90")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    form.subscriptionDurationDays === "90"
                      ? "bg-[hsl(var(--visual-primary))] text-white border-[hsl(var(--visual-primary))]"
                      : "border-vi-border vi-text-muted hover:vi-text"
                  }`}
                >
                  3 mo
                </button>
                <button
                  type="button"
                  onClick={() => updateField("subscriptionDurationDays", "180")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    form.subscriptionDurationDays === "180"
                      ? "bg-[hsl(var(--visual-primary))] text-white border-[hsl(var(--visual-primary))]"
                      : "border-vi-border vi-text-muted hover:vi-text"
                  }`}
                >
                  6 mo
                </button>
                <button
                  type="button"
                  onClick={() => updateField("subscriptionDurationDays", "365")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    form.subscriptionDurationDays === "365"
                      ? "bg-[hsl(var(--visual-primary))] text-white border-[hsl(var(--visual-primary))]"
                      : "border-vi-border vi-text-muted hover:vi-text"
                  }`}
                >
                  12 mo
                </button>
              </div>
            </div>
            <div>
              <label
                htmlFor="subscription-custom-days"
                className="block text-sm font-medium vi-text mb-1"
              >
                Or enter custom days
              </label>
              <input
                id="subscription-custom-days"
                type="number"
                min={1}
                value={form.subscriptionDurationDays}
                onChange={(e) => updateField("subscriptionDurationDays", e.target.value)}
                className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
                placeholder="Custom duration in days"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="grants-tier" className="block text-sm font-medium vi-text mb-1">
                Grants Tier
              </label>
              <input
                id="grants-tier"
                value={form.grantsTier}
                onChange={(e) => updateField("grantsTier", e.target.value)}
                className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
                placeholder="district"
              />
            </div>
            <div>
              <label htmlFor="grants-plan" className="block text-sm font-medium vi-text mb-1">
                Grants Plan
              </label>
              <input
                id="grants-plan"
                value={form.grantsPlan}
                onChange={(e) => updateField("grantsPlan", e.target.value)}
                className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
                placeholder="pilot"
              />
            </div>
            <div>
              <label htmlFor="grants-seat-limit" className="block text-sm font-medium vi-text mb-1">
                Seat Limit
              </label>
              <input
                id="grants-seat-limit"
                type="number"
                min={1}
                value={form.grantsSeatLimit}
                onChange={(e) => updateField("grantsSeatLimit", e.target.value)}
                className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="grants-duration" className="block text-sm font-medium vi-text mb-1">
                Duration (days)
              </label>
              <input
                id="grants-duration"
                type="number"
                min={1}
                value={form.grantsDurationDays}
                onChange={(e) => updateField("grantsDurationDays", e.target.value)}
                className="w-full border vi-border rounded-lg px-3 py-2 text-sm vi-bg"
                placeholder="90"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL_FORM);
              setError(null);
              setSuccess(null);
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium border vi-border vi-text-muted hover:vi-bg transition"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[hsl(var(--visual-primary))] text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Coupon"}
          </button>
        </div>
      </form>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between gap-4">
          <h2 className="font-heading font-bold text-lg vi-text">Existing Coupons</h2>
          <p className="text-xs vi-text-muted">Use /signup?coupon=CODE when handing out links.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">Usage</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center vi-text-muted">
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center vi-text-muted">
                    No coupons yet.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const couponType = c.coupon_type || "DISCOUNT";
                  const isSubscription = couponType === "SUBSCRIPTION";
                  const isProvision = couponType === "PROVISIONING";
                  const isDiscount = couponType === "DISCOUNT";

                  let badgeColor =
                    "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]";
                  let typeLabel = "Discount";
                  let details = `${c.discount_pct || 0}% off`;

                  if (isSubscription) {
                    badgeColor =
                      "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]";
                    typeLabel = "Subscription";
                    const days = c.grants_duration_days || 0;
                    const months = Math.round(days / 30);
                    details = months > 0 ? `${months}mo (${days}d)` : `${days}d`;
                  } else if (isProvision) {
                    badgeColor = "bg-[hsl(var(--visual-math)/0.14)] text-[hsl(var(--visual-math))]";
                    typeLabel = "Provisioning";
                    details = `${c.grants_tier || "-"} / ${c.grants_plan || "-"} / ${c.grants_duration_days || "-"}d`;
                  }

                  return (
                    <tr key={c.code} className="border-b vi-border hover:vi-bg/50 transition">
                      <td className="px-4 py-3 font-semibold vi-text">{c.code}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 vi-text-muted">{details}</td>
                      <td className="px-4 py-3 vi-text-muted">
                        {c.redemptions} / {c.max_redemptions ?? "∞"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            c.active
                              ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                              : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                          }`}
                        >
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.active ? (
                          <button
                            onClick={() => deactivateCoupon(c.code)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <span className="text-xs vi-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
