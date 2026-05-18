import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "flat" | "elevated" | "lesson" | "achievement" | "topic";
}

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  flat: "shadow-none",
  elevated: "shadow-soft-3",
  lesson: "shadow-soft-3 bg-[var(--aivo-color-calmSky-50)]",
  achievement: "shadow-soft-3 bg-[var(--aivo-color-sunshine-50)]",
  topic: "shadow-soft-3 bg-[var(--aivo-color-lavender-50)]",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "flat", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-card)] border border-aivo-border bg-aivo-surface",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1", className)}
      style={{ padding: "var(--aivo-density-card-pad, 1.25rem)", ...style }}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-lg font-semibold", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-aivo-ink-soft", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        padding: "var(--aivo-density-card-pad, 1.25rem)",
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
        padding: "var(--aivo-density-card-pad, 1.25rem)",
        paddingTop: 0,
        ...style,
      }}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";
