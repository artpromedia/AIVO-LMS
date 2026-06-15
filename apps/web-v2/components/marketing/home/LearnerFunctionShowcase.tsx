import { Lightbulb, ListChecks, MessageCircle, SlidersHorizontal } from "lucide-react";

type Panel = { title: string; caption: string };

/**
 * "Built around how each learner functions" — a row of four mini product
 * mockups. Titles and captions are passed in (translatable marketing copy);
 * the small in-mockup labels are illustrative product UI kept as plain text.
 *
 * Ported from apps/marketing so both public landing pages match. The only
 * divergence is `font-iw-display` in place of marketing's `font-heading`.
 */
export function LearnerFunctionShowcase({ panels }: { panels: [Panel, Panel, Panel, Panel] }) {
  const bodies = [
    <CalmExperience key="calm" />,
    <AdaptiveBaseline key="baseline" />,
    <SupportLevels key="levels" />,
    <NextSupport key="next" />,
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {panels.map((panel, i) => (
        <article
          key={panel.title}
          className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_22px_55px_-30px_rgba(76,29,149,0.28)]"
        >
          <div className="mb-4 flex-1 rounded-2xl bg-[var(--aivo-cloud-50)] p-4">{bodies[i]}</div>
          <h3 className="font-iw-display text-base font-bold text-slate-900">{panel.title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{panel.caption}</p>
        </article>
      ))}
    </div>
  );
}

function PanelIcon({ Icon }: { Icon: typeof MessageCircle }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-[var(--aivo-sensory-primary)]">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function CalmExperience() {
  return (
    <div aria-hidden="true">
      <div className="mb-3 flex items-center gap-2">
        <PanelIcon Icon={MessageCircle} />
        <p className="text-sm font-semibold text-slate-700">Let&apos;s learn together.</p>
      </div>
      <div className="space-y-2">
        {["Explain it", "Practice", "Try a strategy"].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdaptiveBaseline() {
  const rows = [
    ["Skill", "Reading comprehension"],
    ["Level", "Developing"],
    ["Best modality", "Visual"],
    ["Preferred response", "Choice"],
  ];
  return (
    <div aria-hidden="true">
      <div className="mb-3 flex items-center gap-2">
        <PanelIcon Icon={ListChecks} />
        <p className="text-sm font-semibold text-slate-700">Baseline results</p>
      </div>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 text-xs">
            <dt className="font-medium text-slate-500">{k}</dt>
            <dd className="font-semibold text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SupportLevels() {
  return (
    <div aria-hidden="true">
      <div className="mb-3 flex items-center gap-2">
        <PanelIcon Icon={SlidersHorizontal} />
        <p className="text-sm font-semibold text-slate-700">Support level</p>
      </div>
      <p className="mb-3 text-center font-iw-display text-sm font-bold text-[var(--aivo-sensory-primary)]">
        Just Right
      </p>
      <div className="relative h-1.5 w-full rounded-full bg-slate-200">
        <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-[var(--aivo-sensory-primary)]" />
        <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--aivo-sensory-primary)] bg-white" />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
        <span>More support</span>
        <span>More independence</span>
      </div>
    </div>
  );
}

function NextSupport() {
  return (
    <div aria-hidden="true">
      <div className="mb-3 flex items-center gap-2">
        <PanelIcon Icon={Lightbulb} />
        <p className="text-sm font-semibold text-slate-700">Insight</p>
      </div>
      <p className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600">
        Jordan does best with short chunks and visuals.
      </p>
      <p className="mt-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-semibold text-[var(--aivo-sensory-primary)]">
        Break reading tasks into smaller parts.
      </p>
    </div>
  );
}
