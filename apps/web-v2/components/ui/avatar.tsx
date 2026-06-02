"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
    "rounded-full bg-iw-card text-iw-ink select-none",
  ),
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px] font-semibold",
        sm: "h-8 w-8 text-xs font-semibold",
        md: "h-10 w-10 text-sm font-semibold",
        lg: "h-12 w-12 text-base font-semibold",
        xl: "h-16 w-16 text-lg font-semibold",
        "2xl": "h-20 w-20 text-xl font-semibold",
      },
      ring: {
        none: "",
        soft: "ring-2 ring-iw-border ring-offset-2 ring-offset-iw-bg",
        primary: "ring-2 ring-iw-primary ring-offset-2 ring-offset-iw-bg",
      },
    },
    defaultVariants: { size: "md", ring: "none" },
  },
);

export interface AvatarProps
  extends
    Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, "asChild">,
    VariantProps<typeof avatarVariants> {
  /** Image URL. Falls back to initials when missing or fails to load. */
  readonly src?: string | null;
  /** Used for the `<img>` alt and for deriving initials when no src is given. */
  readonly name?: string;
  /** Override the rendered initials (otherwise derived from `name`). */
  readonly initials?: string;
}

function deriveInitials(name: string | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar — circular identity element. Renders a photo when `src` resolves,
 * otherwise falls back to a tonal monogram derived from `name`. Built on
 * Radix Avatar so the fallback shows only after the image is known to be
 * missing (no flash of initials behind a loaded photo).
 *
 * Do not use as a clickable affordance on its own — wrap in `<Button>` or
 * `<Link>` and add accessible text.
 */
export const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  function Avatar({ className, size, ring, src, name, initials, ...props }, ref) {
    const fallback = initials ?? deriveInitials(name);
    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(avatarVariants({ size, ring }), className)}
        {...props}
      >
        {src && (
          <AvatarPrimitive.Image
            src={src}
            alt={name ?? ""}
            className="h-full w-full object-cover"
          />
        )}
        <AvatarPrimitive.Fallback
          delayMs={src ? 400 : 0}
          className="flex h-full w-full items-center justify-center bg-iw-accent-soft text-iw-primary"
        >
          {fallback || (
            <span aria-hidden="true" className="text-iw-ink-muted">
              •
            </span>
          )}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
    );
  },
);

/**
 * AvatarGroup — overlapping cluster of avatars (e.g. "5 family members").
 * Limit the visible count with `max`; the remainder collapses into a
 * `+N` chip with the same size as the avatars.
 */
export interface AvatarGroupProps {
  readonly children: React.ReactNode;
  readonly max?: number;
  readonly size?: AvatarProps["size"];
  readonly className?: string;
}

export function AvatarGroup({ children, max = 4, size = "md", className }: AvatarGroupProps) {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((child, index) => (
        <span key={index} className="ring-2 ring-iw-bg rounded-full inline-flex">
          {child}
        </span>
      ))}
      {overflow > 0 && (
        <Avatar
          size={size}
          ring="none"
          initials={`+${overflow}`}
          className="bg-iw-card text-iw-ink-muted ring-2 ring-iw-bg"
        />
      )}
    </div>
  );
}
