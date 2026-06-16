import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-iw-card text-iw-ink-muted border border-iw-border",
        primary: "bg-iw-accent-soft text-iw-primary",
        accent: "bg-iw-accent-soft text-iw-accent",
        warm: "bg-iw-warm-soft text-iw-ink",
        success: "bg-iw-success/20 text-iw-ink",
        warning: "bg-iw-warning/20 text-iw-ink",
        danger: "bg-iw-error/20 text-iw-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
