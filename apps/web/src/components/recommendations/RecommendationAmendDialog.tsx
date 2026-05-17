"use client";

import { useState } from "react";

export interface RecommendationAmendDialogProps {
  open: boolean;
  recommendationTitle: string;
  initialValue: string;
  onCancel: () => void;
  onConfirm: (amendedValue: string) => void;
}

/**
 * Modal-style dialog that lets a parent amend the proposed value before
 * applying it. We keep the value typed as a string for simplicity — the
 * recommendation service stores amendedValue as `unknown` and validates
 * it inside the effect handler.
 */
export function RecommendationAmendDialog({
  open,
  recommendationTitle,
  initialValue,
  onCancel,
  onConfirm,
}: RecommendationAmendDialogProps) {
  const [value, setValue] = useState(initialValue);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded bg-white p-4">
        <h2 className="text-lg font-bold">Amend recommendation</h2>
        <p className="mt-1 text-sm text-gray-600">{recommendationTitle}</p>
        <label className="mt-3 block text-sm font-medium" htmlFor="amend-value">
          Your edited value
        </label>
        <textarea
          id="amend-value"
          rows={4}
          className="mt-1 w-full rounded border p-2 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
          >
            Apply amended
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecommendationAmendDialog;
