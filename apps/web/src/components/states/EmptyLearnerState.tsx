"use client";
import Link from "next/link";
import { BookOpen, type LucideIcon } from "lucide-react";

type Tone = "primary" | "reading" | "science" | "sel" | "math";

interface EmptyLearnerStateProps {
  Icon?: LucideIcon;
  tone?: Tone;
  title?: string;
  description?: string;
  cta?: { label: string; href: string };
}

const WELL: Record<Tone, string> = {
  primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  sel:     "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
  math:    "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
};

export default function EmptyLearnerState({
  Icon = BookOpen,
  tone = "primary",
  title = "No learners connected yet",
  description = "Parents can invite you from the Collaboration page in their dashboard.",
  cta = { label: "Check pending invites", href: "/dashboard/notifications" },
}: EmptyLearnerStateProps) {
  return (
    <div className="vi-card p-12 text-center" role="status">
      <div
        className={`w-20 h-20 mx-auto mb-4 rounded-3xl flex items-center justify-center ${WELL[tone]}`}
        aria-hidden="true"
      >
        <Icon size={40} strokeWidth={2.5} />
      </div>
      <p className="vi-text font-heading font-bold text-xl">{title}</p>
      <p className="text-sm vi-text-muted mt-2 max-w-md mx-auto">{description}</p>
      <Link
        href={cta.href}
        className="inline-flex items-center justify-center mt-4 px-6 py-2.5 rounded-2xl bg-[hsl(var(--visual-primary))] text-white font-heading font-black text-sm uppercase tracking-wider hover:bg-[hsl(var(--visual-primary)/0.9)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-primary))] focus-visible:ring-offset-2"
        style={{ minHeight: 44 }}
      >
        {cta.label}
      </Link>
    </div>
  );
}
