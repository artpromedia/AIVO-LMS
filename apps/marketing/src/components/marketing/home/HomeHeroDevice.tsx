import Image from "next/image";
import { BookOpen, Calculator, GraduationCap, PenLine, Sparkles } from "lucide-react";

/**
 * Decorative hero scene for the marketing home page — a stylized tablet
 * showing the learner dashboard ("Hi, Jordan!") with the AIVO Virtual Brain
 * mascot waving alongside a short speech bubble.
 *
 * The inner labels ("Reading", "72%", etc.) are illustrative product UI, not
 * translatable marketing copy, so they live here as plain text rather than in
 * the i18n catalog. The whole scene is aria-hidden because the surrounding
 * hero copy already conveys the message to assistive tech.
 */
export function HomeHeroDevice() {
  const chips = [
    { label: "Reading", Icon: BookOpen },
    { label: "Writing", Icon: PenLine },
    { label: "Math", Icon: Calculator },
    { label: "Study Skills", Icon: GraduationCap },
  ];

  return (
    <div className="relative" aria-hidden="true">
      {/* Soft glow behind the device */}
      <div
        className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-purple-200/50 via-white to-indigo-100/40 blur-2xl"
        aria-hidden="true"
      />

      {/* Tablet frame */}
      <div className="relative rounded-[2rem] border border-slate-200/70 bg-white p-3 shadow-[0_40px_90px_-40px_rgba(76,29,149,0.45)]">
        <div className="rounded-[1.4rem] bg-[var(--aivo-cloud-50)] p-4 sm:p-5">
          {/* Greeting */}
          <div className="mb-4">
            <p className="font-heading text-lg font-bold text-slate-900">Hi, Jordan! 👋</p>
            <p className="text-sm font-medium text-slate-500">
              Let&apos;s keep going—you&apos;ve got this.
            </p>
          </div>

          {/* Help card */}
          <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              What would you like help with today?
            </p>
            <div className="flex flex-wrap gap-2">
              {chips.map(({ label, Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-[var(--aivo-sensory-primary)]"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Progress card */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Jordan&apos;s Progress</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                This week
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/* 72% ring */}
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="var(--aivo-cloud-100)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="var(--aivo-sensory-primary)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="97.4"
                    strokeDashoffset="27.3"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-heading text-lg font-bold text-slate-900">
                  72%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-600">On track</p>
                <p className="text-sm font-medium text-slate-500">4 of 6 goals</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[var(--aivo-sensory-primary)]"
                    style={{ width: "72%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mascot + speech bubble */}
      <div className="pointer-events-none absolute -bottom-10 -right-4 flex flex-col items-end sm:-right-10">
        <div className="mb-2 mr-6 max-w-[190px] rounded-2xl rounded-br-sm border border-purple-100 bg-white px-3.5 py-2.5 shadow-[0_18px_40px_-20px_rgba(76,29,149,0.45)]">
          <p className="flex items-center gap-1 text-[11px] font-bold text-[var(--aivo-sensory-primary)]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            I&apos;m AIVO, your Virtual Brain.
          </p>
          <p className="text-[11px] font-medium text-slate-500">I adapt to how you learn best.</p>
        </div>
        <Image
          src="/images/mascot/virtual-brain-robot.png"
          alt=""
          width={150}
          height={150}
          className="h-28 w-28 drop-shadow-[0_20px_30px_rgba(76,29,149,0.30)] sm:h-36 sm:w-36"
        />
      </div>
    </div>
  );
}
