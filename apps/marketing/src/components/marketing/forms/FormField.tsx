"use client";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type BaseProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

type DescribedChildProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export function FormField({ id, label, required, hint, error, children }: BaseProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const decoratedChild =
    isValidElement(children) && (describedBy || error)
      ? cloneElement(children as ReactElement<DescribedChildProps>, {
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })
      : children;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-slate-700">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-rose-600">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {decoratedChild}
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500 font-body">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const fieldInputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 font-body shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:bg-slate-50 disabled:text-slate-500";
