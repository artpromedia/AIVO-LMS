"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type CalmActivity,
  type CalmActivityId,
  BOX_BREATH_PHASES,
  BOX_BREATH_PHASE_SECONDS,
  boxBreathRounds,
} from "@/lib/learner/calm";
import { createCalmChime, type CalmChime } from "@/lib/learner/calm-audio";
import { PatternFocus } from "./games/pattern-focus";
import { SortingCalm } from "./games/sorting-calm";

interface CalmCornerProps {
  learnerId: string;
  catalog: readonly CalmActivity[];
  recommendedId: CalmActivityId | null;
  audioCuesEnabled?: boolean;
}

export function CalmCorner({
  learnerId,
  catalog,
  recommendedId,
  audioCuesEnabled = false,
}: Readonly<CalmCornerProps>) {
  const t = useTranslations("learner.calm");
  const [active, setActive] = useState<CalmActivity | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState<number>(0);

  const recommended = useMemo(
    () => catalog.find((a) => a.id === recommendedId) ?? null,
    [catalog, recommendedId],
  );

  const complete = useCallback(
    async (activity: CalmActivity, secondsSpent: number, completed: boolean) => {
      try {
        const res = await fetch(`/api/bff/learners/${learnerId}/calm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ activityId: activity.id, completed, secondsSpent }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { affirmationKey?: string };
        };
        // Affirmation is encouragement only — never block the learner on it.
        setAffirmation(json?.data?.affirmationKey ?? "calmer");
        // Fetch the freshly-updated streak; the affirmation renders with or
        // without it, so a failed/absent streak never blocks encouragement.
        try {
          const sres = await fetch(`/api/bff/learners/${learnerId}/calm`);
          const sjson = (await sres.json().catch(() => ({}))) as {
            data?: { streak?: { currentStreakDays?: number } };
          };
          setStreakDays(sjson?.data?.streak?.currentStreakDays ?? 0);
        } catch {
          /* streak is optional encouragement; ignore failures */
        }
      } catch {
        setAffirmation("calmer");
      } finally {
        setActive(null);
      }
    },
    [learnerId],
  );

  if (affirmation) {
    return (
      <Card className="mt-6 p-6 text-center" aria-live="polite">
        <p className="text-4xl" aria-hidden="true">
          🌿
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold">
          {t(`affirmations.${affirmation}`)}
        </h2>
        {streakDays > 0 ? (
          <p className="mt-2 text-sm font-medium text-iw-ink-muted">
            {t("streak.label", { count: streakDays })}
          </p>
        ) : null}
        <div className="mt-5 flex justify-center gap-3">
          <Button onClick={() => setAffirmation(null)}>{t("do_another")}</Button>
        </div>
      </Card>
    );
  }

  if (active) {
    return (
      <ActivityRunner
        activity={active}
        audioCuesEnabled={audioCuesEnabled}
        onDone={(secs) => complete(active, secs, true)}
        onCancel={() => complete(active, 0, false)}
      />
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {recommended ? (
        <section aria-labelledby="calm-suggested">
          <h2 id="calm-suggested" className="mb-3 text-lg font-semibold text-iw-text-strong">
            {t("suggested_title")}
          </h2>
          <ActivityCard
            activity={recommended}
            highlighted
            onPick={() => setActive(recommended)}
          />
        </section>
      ) : null}

      <section aria-labelledby="calm-all">
        <h2 id="calm-all" className="mb-3 text-lg font-semibold text-iw-text-strong">
          {t("all_title")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {catalog.map((a) => (
            <li key={a.id}>
              <ActivityCard activity={a} onPick={() => setActive(a)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ActivityCard({
  activity,
  highlighted = false,
  onPick,
}: Readonly<{
  activity: CalmActivity;
  highlighted?: boolean;
  onPick: () => void;
}>) {
  const t = useTranslations("learner.calm.activities");
  return (
    <button
      type="button"
      onClick={onPick}
      className={
        "w-full min-h-11 rounded-iw-card-lg border p-4 text-left transition-shadow " +
        "focus:outline-none focus:ring-2 focus:ring-offset-2 " +
        (highlighted
          ? "border-iw-primary bg-iw-primary/5"
          : "border-iw-border bg-white hover:shadow-soft-3")
      }
    >
      <p className="font-semibold text-iw-text-strong">{t(activity.titleKey)}</p>
      <p className="mt-1 text-sm text-iw-ink-muted">{t(activity.bodyKey)}</p>
    </button>
  );
}

function ActivityRunner({
  activity,
  audioCuesEnabled,
  onDone,
  onCancel,
}: Readonly<{
  activity: CalmActivity;
  audioCuesEnabled: boolean;
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}>) {
  if (activity.kind === "breathing") {
    return (
      <BoxBreathing audioCuesEnabled={audioCuesEnabled} onDone={onDone} onCancel={onCancel} />
    );
  }
  if (activity.id === "pattern_focus") {
    return <PatternFocus onDone={onDone} onCancel={onCancel} />;
  }
  if (activity.id === "sorting_calm") {
    return <SortingCalm onDone={onDone} onCancel={onCancel} />;
  }
  return <StaticActivity activity={activity} onDone={onDone} onCancel={onCancel} />;
}

/** Box breathing: 4-4-4-4. Honors prefers-reduced-motion by replacing the
 *  animated orb with a static cue + manual "Next breath" affordance. */
function BoxBreathing({
  audioCuesEnabled,
  onDone,
  onCancel,
}: Readonly<{
  audioCuesEnabled: boolean;
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}>) {
  const t = useTranslations("learner.calm.breathing");
  const ta = useTranslations("learner.calm.audio");
  const totalPhases = BOX_BREATH_PHASES.length * boxBreathRounds();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Session-local mute — never writes the stored preference.
  const [muted, setMuted] = useState(false);
  const chimeRef = useRef<CalmChime | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!("window" in globalThis)) return;
    const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Build the chime once (lazy: no AudioContext until the first cue, which
  // follows the learner's gesture that started the activity). Dispose on
  // unmount — i.e. on completion, cancel, or navigating away.
  useEffect(() => {
    if (!audioCuesEnabled) return;
    chimeRef.current = createCalmChime();
    return () => {
      chimeRef.current?.dispose();
      chimeRef.current = null;
    };
  }, [audioCuesEnabled]);

  // One soft cue per phase transition (and the first phase). No autoplay:
  // the cue only sounds because the learner entered/advanced the activity.
  useEffect(() => {
    if (!audioCuesEnabled || muted) return;
    if (phaseIdx >= totalPhases) return;
    chimeRef.current?.phaseCue(BOX_BREATH_PHASES[phaseIdx % BOX_BREATH_PHASES.length]);
  }, [phaseIdx, audioCuesEnabled, muted, totalPhases]);

  // Auto-advance only when motion is allowed; reduced-motion users tap.
  useEffect(() => {
    if (reducedMotion) return;
    if (phaseIdx >= totalPhases) {
      onDone(Math.round((Date.now() - startedAt.current) / 1000));
      return;
    }
    const id = setTimeout(() => setPhaseIdx((i) => i + 1), BOX_BREATH_PHASE_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [phaseIdx, reducedMotion, totalPhases, onDone]);

  const phase = BOX_BREATH_PHASES[phaseIdx % BOX_BREATH_PHASES.length];
  const round = Math.floor(phaseIdx / BOX_BREATH_PHASES.length) + 1;
  const rounds = boxBreathRounds();

  // Reduced-motion users advance manually; extracted so the JSX below stays
  // a single (non-nested) conditional.
  const reducedMotionButton =
    phaseIdx + 1 >= totalPhases ? (
      <Button onClick={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}>
        {t("finish")}
      </Button>
    ) : (
      <Button onClick={() => setPhaseIdx((i) => i + 1)}>{t("next")}</Button>
    );

  return (
    <Card className="mt-6 flex flex-col items-center gap-5 p-8 text-center">
      <p className="text-sm text-iw-ink-muted">{t("round", { round, rounds })}</p>
      <div
        aria-hidden="true"
        data-phase={phase}
        className={
          "h-40 w-40 rounded-full bg-iw-primary/20 " +
          (reducedMotion ? "" : "transition-transform duration-4000 ease-in-out ") +
          (!reducedMotion && (phase === "inhale" || phase === "hold_in")
            ? "scale-110"
            : "scale-90")
        }
      />
      <p role="status" aria-live="polite" className="font-display text-2xl font-bold">
        {t(`phase.${phase}`)}
      </p>

      <div className="flex gap-3">
        {reducedMotion ? reducedMotionButton : null}
        {audioCuesEnabled ? (
          <Button
            variant="ghost"
            aria-pressed={muted}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? ta("unmute") : ta("mute")}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onCancel}>
          {t("done_early")}
        </Button>
      </div>
    </Card>
  );
}

function StaticActivity({
  activity,
  onDone,
  onCancel,
}: Readonly<{
  activity: CalmActivity;
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}>) {
  const t = useTranslations("learner.calm.activities");
  const tc = useTranslations("learner.calm");
  const startedAt = useRef<number>(Date.now());
  return (
    <Card className="mt-6 flex flex-col gap-4 p-6">
      <h2 className="font-display text-2xl font-bold">{t(activity.titleKey)}</h2>
      <p className="text-iw-ink-muted">{t(activity.bodyKey)}</p>
      <div className="flex gap-3">
        <Button
          onClick={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}
        >
          {tc("im_done")}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {tc("go_back")}
        </Button>
      </div>
    </Card>
  );
}
