"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/UploadDropZone
 *
 * Large rounded drop zone for the IEP upload step. On desktop it
 * supports drag-and-drop or click-to-browse. On mobile (touch
 * primary) it surfaces two secondary actions: "Use camera" (capture
 * image) and "Choose file" (system picker) so a parent can
 * photograph the document on the spot.
 *
 * Renders a hidden file input wired to the surrounding <form>. The
 * server action receives the file under the field name passed via
 * `name`. The component reports the chosen file via `onFileChosen`
 * so the parent can pre-validate before submit if desired.
 *
 * State model — driven by `state`:
 *  - "idle"        → empty drop zone
 *  - "ready"       → file chosen, awaiting submit
 *  - "uploading"   → in-flight upload with progress (use `progress` 0-100)
 *  - "extracting"  → server is parsing the document (indeterminate)
 *  - "error"       → upload or extraction failed
 *  - "parsed"      → done, supports extracted (use UploadFileCard for this)
 *
 * The drop zone itself is `idle` | `ready` only; the other states are
 * represented by UploadFileCard inside the same form area.
 */
export interface UploadDropZoneProps {
  /** Form field name. The file is submitted under this name. */
  name: string;
  /** Comma-separated accept string passed to the input. */
  accept?: string;
  /** Max bytes (rendered as a helper line). */
  maxBytes?: number;
  /** Required hint for screen-reader announcement. */
  label: React.ReactNode;
  /** Optional helper / acceptable-formats line. */
  helper?: React.ReactNode;
  /** When set, renders the "Use camera" mobile shortcut alongside file picker. */
  enableCameraCapture?: boolean;
  /** Optional callback when the user picks a file. */
  onFileChosen?: (file: File | null) => void;
  /** Error to display under the zone. */
  error?: React.ReactNode;
  className?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropZone({
  name,
  accept,
  maxBytes,
  label,
  helper,
  enableCameraCapture,
  onFileChosen,
  error,
  className,
}: UploadDropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const setFile = React.useCallback(
    (file: File | null) => {
      setChosen(file);
      onFileChosen?.(file);
      // Wire the file into the visible primary input so form submit posts it.
      if (inputRef.current) {
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          inputRef.current.files = dt.files;
        } else {
          inputRef.current.value = "";
        }
      }
    },
    [onFileChosen],
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) setFile(file);
  }

  function onChooseClick() {
    inputRef.current?.click();
  }
  function onCameraClick() {
    cameraRef.current?.click();
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <label htmlFor={name} className="text-sm font-semibold text-iw-text-strong">
        {label}
      </label>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "rounded-iw-card-lg border-2 border-dashed transition-colors duration-150",
          "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)]/30",
          dragActive
            ? "border-[var(--aivo-sensory-primary,#7c3aed)] bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)]"
            : "border-[var(--aivo-color-aivoPurple-200,#ddd6fe)]",
          "p-6 md:p-10 flex flex-col items-center text-center gap-4",
        )}
        aria-describedby={helper ? `${name}-helper` : undefined}
      >
        <span
          className={cn(
            "w-14 h-14 rounded-iw-control flex items-center justify-center",
            "bg-white shadow-[0_2px_8px_rgba(124,58,237,0.12)]",
            "text-[var(--aivo-sensory-primary,#7c3aed)]",
          )}
          aria-hidden="true"
        >
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-base md:text-lg font-semibold text-iw-text-strong">
            {chosen ? chosen.name : "Drop the IEP here, or choose a file"}
          </p>
          <p className="text-xs md:text-sm text-iw-text-muted">
            {chosen
              ? `${formatBytes(chosen.size)} · ready to upload`
              : "PDF, Word, or photo. We'll only extract structured supports."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onChooseClick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2",
              "text-sm font-semibold text-white",
              "bg-[var(--aivo-sensory-primary,#7c3aed)]",
              "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus:ring-offset-2 focus:ring-offset-white",
            )}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Choose file
          </button>
          {enableCameraCapture ? (
            <button
              type="button"
              onClick={onCameraClick}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2",
                "text-sm font-semibold text-iw-text-strong bg-white border border-iw-border",
                "hover:bg-[var(--aivo-color-surface-muted,#f1f5f9)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus:ring-offset-2 focus:ring-offset-white",
              )}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Use camera
            </button>
          ) : null}
          {chosen ? (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs font-medium text-iw-text-muted hover:text-iw-text-strong underline underline-offset-2"
            >
              Choose a different file
            </button>
          ) : null}
        </div>
        {/* Primary picker — wired to the form. The other inputs proxy into this one. */}
        <input
          ref={inputRef}
          id={name}
          name={name}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
        />
        {enableCameraCapture ? (
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            aria-hidden="true"
            tabIndex={-1}
          />
        ) : null}
      </div>
      {helper ? (
        <p id={`${name}-helper`} className="text-xs text-iw-text-muted">
          {helper}
          {typeof maxBytes === "number" ? (
            <span className="ml-1">· Up to {formatBytes(maxBytes)}.</span>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className={cn(
            "rounded-iw-card border px-3 py-2 text-sm",
            "border-[var(--aivo-color-status-error-default,#fecaca)]",
            "bg-[var(--aivo-color-status-error-subtle,#fef2f2)]",
            "text-[var(--aivo-color-status-error-strong,#b91c1c)]",
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

UploadDropZone.displayName = "Assessment/UploadDropZone";
