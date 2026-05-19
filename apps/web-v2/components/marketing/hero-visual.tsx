import { Sparkles, TrendingUp } from "lucide-react";

/**
 * Inclusive-Warm hero illustration for the landing hero. Pure SVG /
 * Tailwind so no image assets are pulled in. Matches the visual weight
 * of marketing's two-column hero: a soft gradient art panel showing a
 * learner-with-device scene plus a floating "focus duration" stat card.
 *
 * Responds to sensory mode via the iw-sensory-brand / iw-primary tokens
 * so it repaints in calm / high-contrast.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative aspect-[5/6] w-full overflow-hidden rounded-iw-hero border border-iw-border bg-iw-sensory-brand shadow-soft-5">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%),radial-gradient(circle_at_75%_75%,rgba(255,255,255,0.25),transparent_50%)]"
        />

        <svg
          role="img"
          aria-label="A young learner exploring a friendly learning app"
          viewBox="0 0 400 480"
          className="relative h-full w-full"
        >
          <defs>
            <linearGradient id="iw-device" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.75)" />
            </linearGradient>
            <linearGradient id="iw-screen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fdf6ec" />
              <stop offset="100%" stopColor="#fef3c7" />
            </linearGradient>
          </defs>

          {/* Decorative shapes */}
          <circle cx="60" cy="80" r="28" fill="rgba(255,255,255,0.35)" />
          <circle cx="340" cy="120" r="18" fill="rgba(255,255,255,0.5)" />
          <circle cx="320" cy="380" r="36" fill="rgba(255,255,255,0.25)" />
          <path
            d="M40 380 Q60 360 80 380 T120 380"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* Tablet / device frame */}
          <rect
            x="60"
            y="150"
            width="280"
            height="220"
            rx="24"
            fill="url(#iw-device)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="3"
          />
          <rect x="80" y="170" width="240" height="160" rx="12" fill="url(#iw-screen)" />

          {/* On-screen content: friendly avatar + UI lines */}
          <circle cx="140" cy="220" r="22" fill="#fbbf24" />
          <circle cx="133" cy="216" r="3" fill="#1f2937" />
          <circle cx="147" cy="216" r="3" fill="#1f2937" />
          <path
            d="M132 226 Q140 232 148 226"
            stroke="#1f2937"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />

          <rect x="180" y="200" width="120" height="10" rx="5" fill="#cbd5e1" />
          <rect x="180" y="220" width="90" height="8" rx="4" fill="#e2e8f0" />
          <rect x="180" y="236" width="110" height="8" rx="4" fill="#e2e8f0" />

          <rect x="100" y="270" width="60" height="50" rx="10" fill="#a78bfa" />
          <rect x="170" y="270" width="60" height="50" rx="10" fill="#34d399" />
          <rect x="240" y="270" width="60" height="50" rx="10" fill="#fbbf24" />

          {/* Tablet base */}
          <rect x="170" y="378" width="60" height="6" rx="3" fill="rgba(255,255,255,0.7)" />
        </svg>
      </div>

      {/* Floating "focus duration" stat card */}
      <div className="absolute -bottom-6 -left-4 max-w-[220px] rounded-iw-card border border-iw-border bg-iw-raised p-4 shadow-soft-5 sm:-left-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-iw-accent-soft text-iw-primary">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium text-iw-ink-muted">Focus Duration</p>
            <p className="font-iw-display text-xl font-bold leading-none text-iw-ink">+47.2%</p>
          </div>
        </div>
      </div>

      {/* Floating "adaptive" badge */}
      <div className="absolute -right-3 top-6 inline-flex items-center gap-1.5 rounded-full border border-iw-border bg-iw-raised px-3 py-1.5 shadow-soft-3 sm:-right-6">
        <Sparkles className="h-3.5 w-3.5 text-iw-primary" aria-hidden="true" />
        <span className="text-xs font-semibold text-iw-ink">Adaptive AI</span>
      </div>
    </div>
  );
}
