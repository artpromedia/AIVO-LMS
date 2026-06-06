"use client";

import { useMemo, useState } from "react";
import { AdminCard } from "@aivo/admin-ui";
import {
  type CouponDraft,
  type CouponType,
  COUPON_PRESETS,
  validateCouponDraft,
} from "./coupon-validation";
import { createCouponAction } from "./actions";

const EMPTY: CouponDraft = {
  code: "",
  description: "",
  couponType: "DISCOUNT",
  discountPct: null,
  maxRedemptions: null,
  expiresAt: null,
  grantsTier: null,
  grantsPlan: null,
  grantsSeatLimit: null,
  grantsDurationDays: null,
};

function numValue(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function CouponWizard() {
  const [draft, setDraft] = useState<CouponDraft>(EMPTY);

  function set<K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function applyPreset(presetDraft: Partial<CouponDraft>) {
    setDraft((d) => ({ ...EMPTY, code: d.code, description: d.description, ...presetDraft }));
  }

  // Live validation mirrors the server action so the operator never reaches a
  // raw 400. The submit button stays disabled until the draft is valid.
  const errors = useMemo(() => validateCouponDraft(draft), [draft]);
  const type = draft.couponType;

  return (
    <form action={createCouponAction} className="mt-8 grid gap-6 lg:grid-cols-2">
      <AdminCard className="p-6">
        <h2 className="text-2xl font-black">Coupon basics</h2>

        <p className="admin-label mt-6">Pilot presets</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COUPON_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="admin-button admin-button-secondary"
              onClick={() => applyPreset(preset.draft)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          One click prefills a provisioning pilot; set the code and confirm the seat limit.
        </p>

        <label className="admin-label mt-6" htmlFor="code">
          Code
        </label>
        <input
          className="admin-input mt-2"
          id="code"
          name="code"
          required
          value={draft.code}
          onChange={(e) => set("code", e.target.value.toUpperCase())}
          placeholder="DISTRICT-PILOT-2026"
        />
        <p className="mt-2 text-sm text-slate-500">
          2–64 characters: A–Z, 0–9, hyphen or underscore.
        </p>

        <label className="admin-label mt-5" htmlFor="description">
          Description
        </label>
        <input
          className="admin-input mt-2"
          id="description"
          name="description"
          value={draft.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />

        <label className="admin-label mt-5" htmlFor="couponType">
          Type
        </label>
        <select
          className="admin-input mt-2"
          id="couponType"
          name="couponType"
          value={type}
          onChange={(e) => set("couponType", e.target.value as CouponType)}
        >
          <option value="DISCOUNT">Discount (% off)</option>
          <option value="SUBSCRIPTION">Subscription (free days)</option>
          <option value="PROVISIONING">Provisioning (pilot: tier + seats)</option>
        </select>

        <label className="admin-label mt-5" htmlFor="maxRedemptions">
          Max redemptions (optional)
        </label>
        <input
          className="admin-input mt-2"
          id="maxRedemptions"
          name="maxRedemptions"
          type="number"
          min={1}
          value={numValue(draft.maxRedemptions)}
          onChange={(e) => set("maxRedemptions", e.target.value ? Number(e.target.value) : null)}
        />

        <label className="admin-label mt-5" htmlFor="expiresAt">
          Expires at (optional)
        </label>
        <input
          className="admin-input mt-2"
          id="expiresAt"
          name="expiresAt"
          type="date"
          value={draft.expiresAt ?? ""}
          onChange={(e) => set("expiresAt", e.target.value || null)}
        />
      </AdminCard>

      <AdminCard className="p-6">
        <h2 className="text-2xl font-black">
          {type === "DISCOUNT"
            ? "Discount"
            : type === "SUBSCRIPTION"
              ? "Free subscription days"
              : "Provisioning (pilot)"}
        </h2>

        {type === "DISCOUNT" ? (
          <>
            <label className="admin-label mt-6" htmlFor="discountPct">
              Discount %
            </label>
            <input
              className="admin-input mt-2"
              id="discountPct"
              name="discountPct"
              type="number"
              min={1}
              max={100}
              value={numValue(draft.discountPct)}
              onChange={(e) => set("discountPct", e.target.value ? Number(e.target.value) : null)}
            />
          </>
        ) : null}

        {type === "SUBSCRIPTION" ? (
          <>
            <label className="admin-label mt-6" htmlFor="grantsDurationDays">
              Free days (1–3650)
            </label>
            <input
              className="admin-input mt-2"
              id="grantsDurationDays"
              name="grantsDurationDays"
              type="number"
              min={1}
              max={3650}
              value={numValue(draft.grantsDurationDays)}
              onChange={(e) =>
                set("grantsDurationDays", e.target.value ? Number(e.target.value) : null)
              }
            />
            <label className="admin-label mt-5" htmlFor="grantsPlanSub">
              Plan (optional)
            </label>
            <input
              className="admin-input mt-2"
              id="grantsPlanSub"
              name="grantsPlan"
              value={draft.grantsPlan ?? ""}
              onChange={(e) => set("grantsPlan", e.target.value || null)}
            />
          </>
        ) : null}

        {type === "PROVISIONING" ? (
          <>
            <label className="admin-label mt-6" htmlFor="grantsTier">
              Tier
            </label>
            <input
              className="admin-input mt-2"
              id="grantsTier"
              name="grantsTier"
              value={draft.grantsTier ?? ""}
              onChange={(e) => set("grantsTier", e.target.value || null)}
              placeholder="B2B_SEAT_LICENSED"
            />
            <label className="admin-label mt-5" htmlFor="grantsPlan">
              Plan
            </label>
            <input
              className="admin-input mt-2"
              id="grantsPlan"
              name="grantsPlan"
              value={draft.grantsPlan ?? ""}
              onChange={(e) => set("grantsPlan", e.target.value || null)}
              placeholder="district"
            />
            <label className="admin-label mt-5" htmlFor="grantsSeatLimit">
              Seat limit
            </label>
            <input
              className="admin-input mt-2"
              id="grantsSeatLimit"
              name="grantsSeatLimit"
              type="number"
              min={1}
              value={numValue(draft.grantsSeatLimit)}
              onChange={(e) =>
                set("grantsSeatLimit", e.target.value ? Number(e.target.value) : null)
              }
            />
            <label className="admin-label mt-5" htmlFor="grantsDurationDaysProv">
              Duration (days, 1–3650)
            </label>
            <input
              className="admin-input mt-2"
              id="grantsDurationDaysProv"
              name="grantsDurationDays"
              type="number"
              min={1}
              max={3650}
              value={numValue(draft.grantsDurationDays)}
              onChange={(e) =>
                set("grantsDurationDays", e.target.value ? Number(e.target.value) : null)
              }
            />
          </>
        ) : null}

        {errors.length > 0 ? (
          <ul className="admin-error mt-6 list-disc pl-5 text-sm">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}

        <button className="admin-button mt-6 w-full" type="submit" disabled={errors.length > 0}>
          Create coupon
        </button>
      </AdminCard>
    </form>
  );
}
