import { ShieldCheck, Lock, Accessibility, Globe2, Award, FileCheck2 } from "lucide-react";

const BADGES = [
  { Icon: ShieldCheck, label: "COPPA-Aware", sub: "Children's Online Privacy" },
  { Icon: FileCheck2, label: "FERPA-Aware", sub: "Student records protected" },
  { Icon: Lock, label: "SOC 2 Aligned", sub: "Security & availability" },
  { Icon: Accessibility, label: "WCAG 2.2 AA", sub: "Accessible by design" },
  { Icon: Globe2, label: "GDPR Ready", sub: "EU data protection" },
  { Icon: Award, label: "IEP-Aware", sub: "Built for special education" },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Trust and compliance certifications"
      className="bg-white border-b border-slate-100 py-8"
    >
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
          Privacy, security, and accessibility — taken seriously
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {BADGES.map(({ Icon, label, sub }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-3"
            >
              <span className="inline-flex w-10 h-10 rounded-xl bg-white border border-slate-100 items-center justify-center text-primary shrink-0">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-heading font-bold text-slate-900 leading-tight truncate">
                  {label}
                </span>
                <span className="block text-xs text-slate-500 font-body leading-tight truncate">
                  {sub}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
