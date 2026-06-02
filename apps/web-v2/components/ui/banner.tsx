import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Info, ShieldCheck, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const bannerVariants = cva(
  cn("flex w-full items-start gap-3 rounded-iw-card border px-4 py-3 text-sm", "shadow-soft-1"),
  {
    variants: {
      tone: {
        info: "border-iw-border bg-iw-card text-iw-ink",
        demo: "border-iw-accent/40 bg-iw-accent-soft text-iw-ink",
        warning:
          "border-aivo-warning/40 bg-[color-mix(in_oklab,var(--aivo-status-warning)_12%,transparent)] text-iw-ink",
        danger:
          "border-aivo-danger/40 bg-[color-mix(in_oklab,var(--aivo-status-error)_10%,transparent)] text-iw-ink",
        success:
          "border-aivo-success/40 bg-[color-mix(in_oklab,var(--aivo-status-success)_10%,transparent)] text-iw-ink",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

const TONE_ICON: Record<NonNullable<BannerProps["tone"]>, React.ReactNode> = {
  info: <Info className="h-4 w-4" aria-hidden="true" />,
  demo: <Sparkles className="h-4 w-4" aria-hidden="true" />,
  warning: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  danger: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  success: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
};

export interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof bannerVariants> {
  /** Short, scannable label. */
  readonly title?: React.ReactNode;
  /** Optional secondary text. */
  readonly description?: React.ReactNode;
  /** Optional trailing slot (e.g. a small action `<Button>`). */
  readonly action?: React.ReactNode;
  /** When provided, renders a close button that calls this handler. */
  readonly onDismiss?: () => void;
  /** Hide the leading icon (otherwise inferred from `tone`). */
  readonly hideIcon?: boolean;
}

/**
 * Banner — page-level advisory strip. Use for environment context (demo
 * mode, staging, read-only), system status (incident, maintenance), and
 * positive confirmations that should persist longer than a toast.
 *
 * Do not use for transient feedback (use `Toast`) or for inline form
 * validation (use the field-level error slot on `Input`).
 *
 * Accessibility:
 *   - `role="status"` for info/demo/success
 *   - `role="alert"` for warning/danger
 *   - Close button is `aria-label="Dismiss"`
 */
export function Banner({
  className,
  tone,
  title,
  description,
  action,
  onDismiss,
  hideIcon,
  children,
  ...props
}: BannerProps) {
  const resolvedTone = tone ?? "info";
  const isAlert = resolvedTone === "warning" || resolvedTone === "danger";
  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      className={cn(bannerVariants({ tone }), className)}
      {...props}
    >
      {!hideIcon && (
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-iw-ink-muted">
          {TONE_ICON[resolvedTone]}
        </span>
      )}
      <div className="flex flex-1 flex-col gap-0.5">
        {title && <div className="font-semibold leading-snug">{title}</div>}
        {description && <div className="text-iw-ink-muted leading-snug">{description}</div>}
        {children}
      </div>
      {action && <div className="ml-2 shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            "text-iw-ink-muted hover:bg-iw-card focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2",
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
