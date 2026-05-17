import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-aivo-surface-2 text-aivo-ink-soft",
        primary: "bg-aivo-primary-soft text-aivo-primary",
        success: "bg-aivo-success/15 text-aivo-success",
        warning: "bg-aivo-warning/20 text-aivo-ink",
        danger: "bg-aivo-danger/15 text-aivo-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
