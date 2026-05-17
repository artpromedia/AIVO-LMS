import { useId, type ComponentType, type SVGProps } from "react";
import { Shield, Lock, Eye, Accessibility } from "lucide-react";

type ChipIcon = ComponentType<SVGProps<SVGSVGElement>>;
type Chip = { icon: ChipIcon; label: string };

const DEFAULT_CHIPS: Chip[] = [
  { icon: Shield, label: "Designed for COPPA-aware workflows" },
  { icon: Lock, label: "Designed for FERPA-aware data handling" },
  { icon: Accessibility, label: "WCAG 2.2 AA design target" },
  { icon: Eye, label: "No ads · No data sales" },
];

export function TrustStripInline({
  heading = "Trust, privacy, and accessibility",
  subheading,
  chips = DEFAULT_CHIPS,
}: {
  heading?: string;
  subheading?: string;
  chips?: Chip[];
}) {
  const headingId = useId();
  return (
    <section className="mb-14" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-3"
      >
        {heading}
      </h2>
      {subheading && (
        <p className="text-slate-600 font-body mb-6 leading-relaxed">{subheading}</p>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <li
              key={c.label}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-purple-700">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="font-body text-sm text-slate-700">{c.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
