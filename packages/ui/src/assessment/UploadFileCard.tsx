"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/UploadFileCard
 *
 * The post-pick card that represents a single uploaded IEP / 504 /
 * accommodation letter. Renders the file name, size, upload status,
 * and a primary action (review / replace / remove).
 *
 * Status model:
 *   queued      — file picked, awaiting submit
 *   uploading   — server is receiving; show `progress` 0-100
 *   extracting  — server is parsing; indeterminate shimmer
 *   parsed      — supports extracted; ready for review
 *   error       — upload or extraction failed; show retry
 */
export type UploadFileStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "parsed"
  | "error";

export interface UploadFileCardProps {
  fileName: string;
  /** Bytes — rendered next to the name. */
  bytes?: number;
  /** Mime type or display kind ("PDF", "Word", "Photo"). */
  kind?: React.ReactNode;
  status: UploadFileStatus;
  /** 0–100 — required for `uploading`. */
  progress?: number;
  /** Optional error message rendered under the row. */
  errorMessage?: React.ReactNode;
  /** Optional uploadedAt timestamp string (already formatted). */
  uploadedAt?: React.ReactNode;
  /** Right-aligned action slot. */
  actions?: React.ReactNode;
  className?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<UploadFileStatus, string> = {
  queued: "Ready to upload",
  uploading: "Uploading",
  extracting: "Reading the document",
  parsed: "Supports extracted",
  error: "We couldn't read this",
};

const STATUS_TINT: Record<UploadFileStatus, string> = {
  queued:
    "bg-[var(--aivo-color-surface-muted,#f1f5f9)] text-[var(--aivo-color-text-default,#0f172a)]",
  uploading:
    "bg-[var(--aivo-color-status-info-subtle,#eff6ff)] text-[var(--aivo-color-status-info-strong,#1d4ed8)]",
  extracting:
    "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-color-aivoPurple-700,#6d28d9)]",
  parsed:
    "bg-[var(--aivo-color-status-success-subtle,#f0fdf4)] text-[var(--aivo-color-status-success-strong,#15803d)]",
  error:
    "bg-[var(--aivo-color-status-error-subtle,#fef2f2)] text-[var(--aivo-color-status-error-strong,#b91c1c)]",
};

export function UploadFileCard({
  fileName,
  bytes,
  kind,
  status,
  progress,
  errorMessage,
  uploadedAt,
  actions,
  className,
}: UploadFileCardProps) {
  const isIndeterminate = status === "extracting";
  const showProgress = status === "uploading" || isIndeterminate;
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  return (
    <article
      aria-busy={status === "uploading" || status === "extracting" || undefined}
      aria-live="polite"
      className={cn(
        "rounded-iw-card-lg border bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]",
        "p-4 md:p-5 flex flex-col gap-4",
        status === "error"
          ? "border-[var(--aivo-color-status-error-default,#fecaca)]"
          : "border-iw-border",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "shrink-0 w-12 h-12 rounded-iw-control flex items-center justify-center",
            "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-sensory-primary,#7c3aed)]",
          )}
          aria-hidden="true"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="font-semibold text-iw-text-strong truncate">{fileName}</p>
          <p className="text-xs text-iw-text-muted">
            {kind ? <span>{kind}</span> : null}
            {kind && (typeof bytes === "number" || uploadedAt) ? (
              <span aria-hidden="true"> · </span>
            ) : null}
            {typeof bytes === "number" ? <span>{formatBytes(bytes)}</span> : null}
            {typeof bytes === "number" && uploadedAt ? (
              <span aria-hidden="true"> · </span>
            ) : null}
            {uploadedAt ? <span>uploaded {uploadedAt}</span> : null}
          </p>
          <span
            className={cn(
              "inline-flex items-center self-start mt-1 px-2 py-0.5 rounded-iw-chip text-[11px] font-semibold",
              STATUS_TINT[status],
            )}
          >
            {STATUS_LABEL[status]}
            {status === "uploading" ? (
              <span className="ml-1 tabular-nums">{pct}%</span>
            ) : null}
          </span>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {showProgress ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isIndeterminate ? undefined : pct}
          aria-label={STATUS_LABEL[status]}
          className="relative h-1.5 rounded-full bg-[var(--aivo-color-surface-muted,#e2e8f0)] overflow-hidden"
        >
          {isIndeterminate ? (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] aivo-motion-indeterminate"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      ) : null}

      {status === "error" && errorMessage ? (
        <p className="text-sm text-[var(--aivo-color-status-error-strong,#b91c1c)]">
          {errorMessage}
        </p>
      ) : null}
    </article>
  );
}

UploadFileCard.displayName = "Assessment/UploadFileCard";
