"use client";

/**
 * Interactive replica of the learner home, applying the proposed `--lx-*`
 * design system. Self-contained: it keeps its OWN preference state and stamps
 * data-mood / data-spacing / data-typeface on its own root, so toggling the
 * controls never touches the real session cookie or <html>. Production screens
 * are untouched — this route is dev-only (see middleware DEV_ONLY_PREFIXES).
 */
import * as React from "react";
import {
  Moon,
  Sun,
  Zap,
  VolumeX,
  Volume1,
  Volume2,
  Play,
  Sparkles,
  Type,
  BookOpenText,
  SlidersHorizontal,
} from "lucide-react";
import { TUTOR_THEMES } from "@aivo/brand";
import { AivoMascot } from "./_art/aivo-mascot";
import { NovaAvatar, SageAvatar } from "./_art/tutor-avatars";
import { useChime, type SoundLevel } from "./use-chime";

// Real, AA-verified per-tutor accent treatment from @aivo/brand
// (tutor-themes.ts). Using the derived tokens — not raw hex — keeps the world
// card honest about how production per-tutor theming actually works.
const NOVA = TUTOR_THEMES.nova;

type Mood = "calm" | "balanced" | "energizing";
type Spacing = "compact" | "comfortable" | "spacious";
type Font = "standard" | "dyslexia";

const LEVEL_CAP = 100;
const LEARNER_NAME = "Annie";

export function DesignPreview() {
  const [mood, setMood] = React.useState<Mood>("balanced");
  const [spacing, setSpacing] = React.useState<Spacing>("comfortable");
  const [font, setFont] = React.useState<Font>("standard");
  const [sound, setSound] = React.useState<SoundLevel>("soft");

  const [level, setLevel] = React.useState(1);
  const [xp, setXp] = React.useState(70);
  const [glow, setGlow] = React.useState(false);
  const [floats, setFloats] = React.useState<{ id: number; amount: number }[]>([]);
  const [celebrating, setCelebrating] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const chime = useChime(sound);
  const floatId = React.useRef(0);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const gainXp = React.useCallback(
    (amount: number, opts: { quest?: boolean } = {}) => {
      setGlow(true);
      window.setTimeout(() => setGlow(false), 1100);
      const fid = ++floatId.current;
      setFloats((f) => [...f, { id: fid, amount }]);
      window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== fid)), 1000);

      setXp((prev) => {
        const total = prev + amount;
        if (total >= LEVEL_CAP) {
          const newLevel = level + 1;
          setLevel(newLevel);
          setCelebrating(true);
          window.setTimeout(() => setCelebrating(false), 1300);
          setAnnounce(`Level ${newLevel} reached. ${total - LEVEL_CAP} XP toward the next level.`);
          chime.levelUp();
          return total - LEVEL_CAP;
        }
        setAnnounce(`${amount} XP earned. ${total} of ${LEVEL_CAP} XP this level.`);
        if (opts.quest) chime.complete();
        else chime.correct();
        return total;
      });
    },
    [level, chime],
  );

  const pct = Math.round((xp / LEVEL_CAP) * 100);

  return (
    <div
      className="lx-preview min-h-screen"
      data-mood={mood}
      data-spacing={spacing}
      data-typeface={font}
    >
      <a href="#lx-main" className="sr-only focus:not-sr-only">
        Skip to preview
      </a>

      {/* polite live region for progress + level-ups */}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col" style={{ gap: "calc(1.5rem * var(--lx-density))" }}>
        {/* banner */}
        <header className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: "var(--lx-primary-soft)", color: "var(--lx-primary-ink)" }}
          >
            <Sparkles size={16} aria-hidden /> Design preview
          </span>
          <p className="text-sm" style={{ color: "var(--lx-ink-muted)" }}>
            A non-destructive replica of the learner home. Toggle the controls — every delight element
            obeys them.
          </p>
        </header>

        {reducedMotion && (
          <p
            className="lx-card text-sm"
            style={{ color: "var(--lx-ink-soft)", padding: "0.75rem 1rem" }}
            role="note"
          >
            Your OS has <strong>Reduce motion</strong> on, so animations are collapsed to static
            poses here — exactly as they will be in production.
          </p>
        )}

        <div id="lx-main" className="grid gap-6 md:grid-cols-[300px_1fr]">
          {/* ===== Workspace rail ===== */}
          <aside
            className="flex flex-col"
            style={{ gap: "calc(1.25rem * var(--lx-density))" }}
            aria-label="My Workspace preferences"
          >
            <div className="lx-card flex items-center gap-3">
              <span
                className="grid h-11 w-11 place-items-center rounded-full text-base font-bold text-white"
                style={{ background: "var(--lx-primary)", boxShadow: "0 0 0 4px var(--lx-primary-soft)" }}
                aria-hidden
              >
                AN
              </span>
              <span className="flex flex-col">
                <span className="font-bold">{LEARNER_NAME}</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--lx-mint)" }}>
                  <span aria-hidden>●</span> Approved
                </span>
              </span>
            </div>

            <div className="lx-card flex flex-col" style={{ gap: "calc(1.25rem * var(--lx-density))" }}>
              <header className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: "var(--lx-primary-soft)", color: "var(--lx-primary-ink)" }}
                  aria-hidden
                >
                  <SlidersHorizontal size={18} />
                </span>
                <span className="flex flex-col">
                  <h2 className="text-base font-bold leading-tight">My Workspace</h2>
                  <span className="text-sm" style={{ color: "var(--lx-ink-muted)" }}>
                    Make it feel right for you.
                  </span>
                </span>
              </header>

              <Segmented
                label="Mood"
                value={mood}
                onChange={(v) => setMood(v as Mood)}
                options={[
                  { value: "calm", label: "Calm", icon: <Moon size={18} /> },
                  { value: "balanced", label: "Balanced", icon: <Sun size={18} /> },
                  { value: "energizing", label: "Energizing", icon: <Zap size={18} /> },
                ]}
              />
              <Segmented
                label="Spacing"
                value={spacing}
                onChange={(v) => setSpacing(v as Spacing)}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfortable" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
              <Segmented
                label="Font Style"
                value={font}
                onChange={(v) => setFont(v as Font)}
                layout="inline"
                options={[
                  { value: "standard", label: "Standard", icon: <Type size={18} /> },
                  { value: "dyslexia", label: "Dyslexia-friendly", icon: <BookOpenText size={18} /> },
                ]}
              />
              <Segmented
                label="Sound"
                value={sound}
                onChange={(v) => setSound(v as SoundLevel)}
                options={[
                  { value: "off", label: "Off", icon: <VolumeX size={18} /> },
                  { value: "soft", label: "Soft", icon: <Volume1 size={18} /> },
                  { value: "on", label: "On", icon: <Volume2 size={18} /> },
                ]}
              />

              <p
                className="rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                style={{ background: "var(--lx-track)", color: "var(--lx-ink-soft)" }}
              >
                <strong style={{ color: "var(--lx-ink)" }}>Calm</strong> dials motion down ·{" "}
                <strong style={{ color: "var(--lx-ink)" }}>Energizing</strong> turns it up · Sound is
                synthesized live — try <strong style={{ color: "var(--lx-ink)" }}>Let&apos;s go!</strong>
              </p>
            </div>
          </aside>

          {/* ===== Main column ===== */}
          <main className="flex flex-col min-w-0" style={{ gap: "calc(1.5rem * var(--lx-density))" }}>
            {/* greeting + mascot */}
            <section className="lx-card flex items-center gap-4">
              <AivoMascot expression="greeting" size={104} />
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="font-bold leading-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>
                  Good afternoon, {LEARNER_NAME}!
                </h1>
                <p style={{ color: "var(--lx-ink-soft)" }}>
                  I&apos;m Aivo. Ready when you are — let&apos;s pick up where you left off.
                </p>
              </div>
            </section>

            {/* XP + streak strip */}
            <section className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
              {/* XP card */}
              <div className="lx-card relative flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full text-white ${celebrating ? "lx-levelpop" : ""}`}
                      style={{ background: "var(--lx-primary)" }}
                      aria-hidden
                    >
                      {level}
                    </span>
                    Level {level}
                  </span>
                  <span className="relative font-bold tabular-nums" style={{ color: "var(--lx-warm-ink)" }}>
                    {xp} / {LEVEL_CAP} XP
                    {floats.map((f) => (
                      <span
                        key={f.id}
                        className="lx-xp-float absolute -top-1 right-0 text-sm font-bold"
                        style={{ color: "var(--lx-warm-ink)" }}
                        aria-hidden
                      >
                        +{f.amount}
                      </span>
                    ))}
                  </span>
                </div>
                <div
                  className="lx-xp-track"
                  role="progressbar"
                  aria-valuenow={xp}
                  aria-valuemin={0}
                  aria-valuemax={LEVEL_CAP}
                  aria-label={`Experience: ${xp} of ${LEVEL_CAP} toward level ${level + 1}`}
                >
                  <div className="lx-xp-fill" data-glow={glow ? "on" : "off"} style={{ width: `${pct}%` }} />
                </div>
                <button type="button" className="lx-cta self-start text-sm" onClick={() => gainXp(15)}>
                  Practice · +15 XP
                </button>

                {/* level-up burst overlay */}
                {celebrating && (
                  <div className="lx-burst" aria-hidden>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span key={i} style={{ ["--a" as string]: `${i * 36}deg` }} />
                    ))}
                  </div>
                )}
              </div>

              {/* streak with grace */}
              <div className="lx-card flex items-center gap-3">
                <svg className="lx-flame" width="40" height="40" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M13 2 C13 6 9 7 9 12 a4 4 0 0 0 8 0 c0-2-1-3-1-3 0 2-1 3-2 3 1-3-1-7-1-10Z"
                    fill="var(--lx-warm)"
                  />
                </svg>
                <div className="flex flex-col">
                  <span className="font-bold">3-day streak</span>
                  <span className="text-sm" style={{ color: "var(--lx-ink-muted)" }}>
                    Nice rhythm! Missed a day? We keep it safe — no pressure.
                  </span>
                </div>
              </div>
            </section>

            {/* Today's quest — Number Galaxy (Nova) world card */}
            <section aria-labelledby="lx-quest-h">
              <h2 id="lx-quest-h" className="mb-3 text-lg font-bold">
                Today&apos;s quest
              </h2>
              <div
                className="lx-card relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${NOVA.accentSoft}, var(--lx-surface))`,
                  borderColor: `color-mix(in oklch, ${NOVA.accent} 45%, var(--lx-border))`,
                }}
              >
                {/* ambient stars (decorative, motion-gated) */}
                <div className="lx-world-stars absolute inset-0" aria-hidden>
                  {STAR_POS.map((s, i) => (
                    <span key={i} style={{ left: s.l, top: s.t, width: s.s, height: s.s, animationDelay: `${i * 400}ms` }} />
                  ))}
                </div>
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                  <NovaAvatar size={96} />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-bold" style={{ color: NOVA.accentInk }}>
                      Number Galaxy · Nova
                    </span>
                    <h3 className="text-xl font-bold">Counting constellations</h3>
                    <p style={{ color: "var(--lx-ink-soft)" }}>
                      Let&apos;s map the stars by tens. There are no wrong answers — only discoveries.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="lx-cta inline-flex items-center gap-2" onClick={() => gainXp(40, { quest: true })}>
                        <Play size={18} aria-hidden /> Let&apos;s go!
                      </button>
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
                        style={{ background: "var(--lx-primary-soft)", color: "var(--lx-primary-ink)" }}
                      >
                        ~8 mins · just right
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* tutor row */}
            <section aria-labelledby="lx-tutors-h">
              <h2 id="lx-tutors-h" className="mb-3 text-lg font-bold">
                Your tutors
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <TutorTile avatar={<NovaAvatar size={64} />} name="Nova" subject="Mathematics" />
                <TutorTile avatar={<SageAvatar size={64} />} name="Sage" subject="Reading" />
                <TutorTile
                  avatar={<AivoMascot expression="thinking" size={64} />}
                  name="More worlds"
                  subject="coming alive in Phase 2"
                  muted
                />
                <TutorTile
                  avatar={<AivoMascot expression="encouraging" size={64} />}
                  name="14 tutors"
                  subject="one family of characters"
                  muted
                />
              </div>
            </section>

            {/* break card — Aivo resting (kept & celebrated) */}
            <section
              className="lx-card flex items-center gap-4"
              style={{ background: "color-mix(in oklch, var(--lx-mint) 10%, var(--lx-surface))" }}
            >
              <AivoMascot expression="resting" size={72} />
              <div className="flex flex-col">
                <span className="font-bold">Breaks are good</span>
                <span style={{ color: "var(--lx-ink-soft)" }}>
                  Stretch, sip water, look out the window. Aivo will save your place.
                </span>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

const STAR_POS = [
  { l: "8%", t: "20%", s: "5px" },
  { l: "24%", t: "70%", s: "4px" },
  { l: "70%", t: "16%", s: "6px" },
  { l: "88%", t: "55%", s: "4px" },
  { l: "55%", t: "82%", s: "5px" },
  { l: "40%", t: "12%", s: "3px" },
];

function TutorTile({
  avatar,
  name,
  subject,
  muted,
}: {
  avatar: React.ReactNode;
  name: string;
  subject: string;
  muted?: boolean;
}) {
  return (
    <div
      className="lx-card flex flex-col items-center gap-2 text-center"
      style={{ padding: "calc(1rem * var(--lx-density))", opacity: muted ? 0.85 : 1 }}
    >
      {avatar}
      <span className="font-bold leading-tight">{name}</span>
      <span className="text-xs" style={{ color: "var(--lx-ink-muted)" }}>
        {subject}
      </span>
    </div>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
  layout = "stack",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  layout?: "stack" | "inline";
}) {
  const groupId = React.useId();
  const activeLabel = options.find((o) => o.value === value)?.label;
  return (
    <div className="lx-seg">
      <div className="lx-seg-head">
        <span id={groupId} className="lx-seg-label">
          {label}
        </span>
        <span className="lx-seg-value" aria-hidden>
          {activeLabel}
        </span>
      </div>
      <div role="radiogroup" aria-labelledby={groupId} className="lx-seg-track">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${label}: ${o.label}`}
              data-layout={layout}
              onClick={() => onChange(o.value)}
              className="lx-seg-btn"
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
