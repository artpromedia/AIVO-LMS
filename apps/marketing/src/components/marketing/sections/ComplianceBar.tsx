import { ShieldCheck, Lock, BadgeCheck, Accessibility } from "lucide-react";

/**
 * Slim, honest trust/compliance bar — mirrors the home page compliance strip.
 *
 * Wording is deliberately hedged per the AIVO marketing claims policy:
 * "COPPA-Aware", "FERPA-Aware", "SOC 2 Aligned", "WCAG 2.2 AA design target" —
 * never absolute "Compliant". Keep the COPPA / FERPA / SOC 2 tokens present so
 * the trust signal reads at a glance for procurement.
 */
const ITEMS = [
  { icon: ShieldCheck, label: "COPPA-Aware" },
  { icon: Lock, label: "FERPA-Aware" },
  { icon: BadgeCheck, label: "SOC 2 Aligned" },
  { icon: Accessibility, label: "WCAG 2.2 AA design target" },
] as const;

export function ComplianceBar({
  note = "Designed for privacy, accessibility, and responsible student-data practices.",
}: {
  note?: string;
}) {
  return (
    <section className="border-y border-slate-200/70 bg-slate-50/60" aria-label="Trust and compliance">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {ITEMS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Icon className="w-4 h-4 text-[var(--aivo-sensory-primary)]" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 font-medium lg:max-w-xs">{note}</p>
      </div>
    </section>
  );
}
