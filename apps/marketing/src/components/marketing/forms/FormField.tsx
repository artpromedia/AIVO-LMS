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
      <label htmlFor={id} className="block text-sm font-bold text-iw-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-iw-error">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {decoratedChild}
      {hint ? (
        <p id={hintId} className="text-xs text-iw-ink-muted font-body">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-iw-error-strong" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const fieldInputClass =
  "w-full rounded-iw-control border border-iw-border bg-white px-4 py-2.5 text-iw-ink font-body shadow-soft-1 focus:border-iw-primary focus:outline-none focus:ring-2 focus:ring-iw-ring disabled:bg-iw-raised disabled:text-iw-ink-muted";
