"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";

/**
 * LearnerDashboard/TutorAvatar
 *
 * The pastel character tile for AI tutors. Renders a soft-rounded
 * square with a tinted background and centered glyph slot (emoji or
 * image). Sized for the tutor grid (md/lg) and the featured-lesson
 * hero card (xl).
 *
 * Caller passes a `glyph` (any ReactNode — emoji string today, real
 * 3D character asset later). The component centers and scales it.
 */
export type TutorAvatarSize = "sm" | "md" | "lg" | "xl";
export type TutorAvatarTone = "lavender" | "mint" | "peach" | "coral" | "sunshine" | "sky";

export interface TutorAvatarProps {
  glyph: React.ReactNode;
  tone?: TutorAvatarTone;
  size?: TutorAvatarSize;
  /** Optional image URL — when supplied, glyph becomes alt content. */
  imageUrl?: string;
  alt?: string;
  className?: string;
}

const SIZE_MAP: Record<TutorAvatarSize, string> = {
  sm: "w-12 h-12 text-2xl rounded-xl",
  md: "w-16 h-16 text-3xl rounded-2xl",
  lg: "w-20 h-20 text-4xl rounded-[20px]",
  xl: "w-28 h-28 text-5xl rounded-[24px]",
};

const TONE_MAP: Record<TutorAvatarTone, string> = {
  lavender: "bg-[var(--aivo-lavender-100)]",
  mint: "bg-[var(--aivo-meadow-100)]",
  peach: "bg-[var(--aivo-aivoOrange-100)]",
  coral: "bg-[var(--aivo-sunriseCoral-100)]",
  sunshine: "bg-[var(--aivo-sunshine-100)]",
  sky: "bg-[var(--aivo-calmSky-100)]",
};

export function TutorAvatar({
  glyph,
  tone = "lavender",
  size = "md",
  imageUrl,
  alt,
  className,
}: TutorAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center leading-none select-none",
        SIZE_MAP[size],
        TONE_MAP[tone],
        className,
      )}
      role={imageUrl && alt ? "img" : undefined}
      aria-label={imageUrl && alt ? alt : undefined}
      aria-hidden={imageUrl && alt ? undefined : "true"}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={alt ?? ""} className="w-[80%] h-[80%] object-contain" />
      ) : (
        <span aria-hidden="true">{glyph}</span>
      )}
    </span>
  );
}

TutorAvatar.displayName = "LearnerDashboard/TutorAvatar";
