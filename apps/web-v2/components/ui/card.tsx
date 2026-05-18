import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * - `flat`: default cream card on page background.
   * - `elevated`: same surface, raised shadow — used for hero card stacks.
   * - `hero`: the largest-radius variant from the Inclusive-Warm mockup —
   *   used for splash sections on the parent / learner home.
   * - `accent` / `warm`: low-saturation tinted cards (lavender / amber).
   *   These pull from `iw-*-soft` so they stay readable in calm mode and
   *   collapse to white in high-contrast mode.
   */
  variant?: "flat" | "elevated" | "hero" | "accent" | "warm";
}

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  flat: "rounded-iw-card border border-iw-border bg-iw-card shadow-sm",
  elevated: "rounded-iw-card border border-iw-border bg-iw-card shadow-soft-3",
  hero: "rounded-iw-hero border border-iw-border bg-iw-raised shadow-soft-5",
  accent: "rounded-iw-card border border-iw-border bg-iw-accent-soft",
  warm: "rounded-iw-card border border-iw-border bg-iw-warm-soft",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "flat", ...props }, ref) => (
    <div ref={ref} className={cn(variantClasses[variant], className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1", className)}
      style={{ padding: "var(--aivo-density-card-pad, 1.5rem)", ...style }}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-iw-display text-lg font-semibold text-iw-ink", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-iw-ink-muted", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        padding: "var(--aivo-density-card-pad, 1.5rem)",
        paddingTop: 0,
        ...style,
      }}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-2", className)}
      style={{
        padding: "var(--aivo-density-card-pad, 1.5rem)",
        paddingTop: 0,
        ...style,
      }}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";
