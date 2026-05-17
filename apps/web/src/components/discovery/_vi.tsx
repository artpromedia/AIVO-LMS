"use client";
import type { ReactNode } from "react";

export const VI_COLOR: Record<string, string> = {
  primary: "hsl(262 83% 58%)",
  math: "hsl(340 82% 52%)",
  reading: "hsl(199 89% 48%)",
  science: "hsl(142 71% 45%)",
  sel: "hsl(43 100% 50%)",
};
export const VI_TINT: Record<string, string> = {
  primary: "hsl(262 83% 58% / 0.06)",
  math: "hsl(340 82% 52% / 0.06)",
  reading: "hsl(199 89% 48% / 0.06)",
  science: "hsl(142 71% 45% / 0.06)",
  sel: "hsl(43 100% 50% / 0.06)",
};
export const VI_BORDER: Record<string, string> = {
  primary: "hsl(262 83% 58% / 0.3)",
  math: "hsl(340 82% 52% / 0.3)",
  reading: "hsl(199 89% 48% / 0.3)",
  science: "hsl(142 71% 45% / 0.3)",
  sel: "hsl(43 100% 50% / 0.3)",
};
const WELL: Record<string, string> = {
  primary: "bg-[hsl(262_83%_58%/0.12)] text-[hsl(262_83%_58%)]",
  math: "bg-[hsl(340_82%_52%/0.12)] text-[hsl(340_82%_52%)]",
  reading: "bg-[hsl(199_89%_48%/0.12)] text-[hsl(199_89%_48%)]",
  science: "bg-[hsl(142_71%_45%/0.12)] text-[hsl(142_71%_45%)]",
  sel: "bg-[hsl(43_100%_50%/0.16)] text-[hsl(43_100%_50%)]",
};

export function colorForTutor(tutorColor?: string): string {
  if (!tutorColor) return "primary";
  const c = tutorColor.toLowerCase();
  if (c.includes("ec4899") || c.includes("be185d") || c.includes("pink") || c.includes("rose")) return "math";
  if (c.includes("0369a1") || c.includes("0ea5e9") || c.includes("blue") || c.includes("cyan")) return "reading";
  if (c.includes("15803d") || c.includes("10b981") || c.includes("green") || c.includes("emerald")) return "science";
  if (c.includes("b45309") || c.includes("f59e0b") || c.includes("amber") || c.includes("yellow")) return "sel";
  return "primary";
}

export function IconWell({
  children,
  color = "primary",
  size = "md",
}: {
  children: ReactNode;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "lg" ? "w-20 h-20 rounded-3xl" :
    size === "sm" ? "w-10 h-10 rounded-xl" :
    "w-14 h-14 rounded-2xl";
  return <div className={`${sz} flex items-center justify-center ${WELL[color] || WELL.primary}`}>{children}</div>;
}

const STAT_WELL: Record<string, string> = {
  primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  math: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  sel: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  overlay: "bg-white/20",
};

export type StatIconWellColor = keyof typeof STAT_WELL;

export function StatIconWell({
  children,
  color = "primary",
  size = "md",
  className = "",
  wellClass,
}: {
  children: ReactNode;
  color?: StatIconWellColor;
  size?: "sm" | "md";
  className?: string;
  wellClass?: string;
}) {
  const sz = size === "sm" ? "w-10 h-10 rounded-xl" : "w-11 h-11 rounded-2xl";
  const palette = wellClass ?? STAT_WELL[color] ?? STAT_WELL.primary;
  return (
    <div className={`${sz} flex items-center justify-center ${palette}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
