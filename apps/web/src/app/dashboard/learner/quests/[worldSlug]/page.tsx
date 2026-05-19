"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, type ComponentType } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock, Check, Sparkles, BookOpen, FlaskConical, Castle, Code2, Globe2 } from "lucide-react";

interface QuestWorld {
  key: string;
  name: string;
  tutorKey: string;
  subject: string;
  description: string;
  chapters: number;
}

interface QuestRow {
  id: string;
  worldKey: string;
  chapterNumber: number;
  title: string;
  description: string | null;
  narrativeIntro: string | null;
  narrativeOutro: string | null;
  subject: string;
  xpReward: number | null;
  coinReward: number | null;
}

interface QuestProgress {
  id: string;
  learnerId: string;
  questId: string;
  status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | string;
  score: number | null;
  completedAt: string | null;
}

type IconCmp = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

// Per-world theme keyed by worldKey. Falls back to a neutral gradient.
// (Gradients are Tailwind class names — no raw hex — so no lint disable needed.)
const WORLD_THEMES: Record<string, { icon: IconCmp; gradient: string }> = {
  nova_number_galaxy: { icon: Sparkles, gradient: "from-indigo-500 to-purple-600" },
  sage_story_kingdom: { icon: BookOpen, gradient: "from-emerald-500 to-teal-600" },
  spark_science_lab: { icon: FlaskConical, gradient: "from-amber-500 to-orange-600" },
  chrono_time_tower: { icon: Castle, gradient: "from-violet-500 to-fuchsia-600" },
  pixel_code_forge: { icon: Code2, gradient: "from-blue-500 to-cyan-600" },
};
const DEFAULT_THEME = { icon: Globe2 as IconCmp, gradient: "from-slate-500 to-slate-700" };

type UiStatus = "completed" | "in_progress" | "available" | "locked";

function deriveStatus(
  quest: QuestRow,
  progressByQuest: Map<string, QuestProgress>,
  prevCompleted: boolean,
): UiStatus {
  const p = progressByQuest.get(quest.id);
  if (p) {
    if (p.status === "COMPLETED") return "completed";
    if (p.status === "IN_PROGRESS") return "in_progress";
    if (p.status === "AVAILABLE") return "available";
    if (p.status === "LOCKED") return "locked";
  }
  // No progress row: chapter 1 is available; later chapters unlock when the previous one is completed.
  if (quest.chapterNumber <= 1 || prevCompleted) return "available";
  return "locked";
}

export default function QuestWorldPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tCommon = useTranslations("common");
  const tGamification = useTranslations("gamification");
  const params = useParams();
  const worldSlug = params.worldSlug as string;

  const [world, setWorld] = useState<QuestWorld | null>(null);
  const [worldStatus, setWorldStatus] = useState<"loading" | "found" | "not_found" | "error">(
    "loading",
  );
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    let cancelled = false;
    const auth = { Authorization: `Bearer ${accessToken}` };
    setWorldStatus("loading");
    setFetchError(null);
    (async () => {
      try {
        const wr = await fetch(`/api/engagement/quests/worlds/${encodeURIComponent(worldSlug)}`, {
          headers: auth,
        });
        if (cancelled) return;
        if (wr.status === 404) {
          setWorld(null);
          setWorldStatus("not_found");
          return;
        }
        if (!wr.ok) throw new Error(`worlds ${wr.status}`);
        const resolvedWorld: QuestWorld = await wr.json();
        if (cancelled) return;
        setWorld(resolvedWorld);
        setWorldStatus("found");
        const [qr, pr] = await Promise.all([
          fetch(`/api/engagement/quests/${resolvedWorld.key}`, { headers: auth }),
          fetch(`/api/engagement/quests/progress/${user.id}`, { headers: auth }),
        ]);
        if (cancelled) return;
        if (qr.ok) {
          const body = await qr.json();
          setQuests((body.quests ?? []) as QuestRow[]);
        }
        if (pr.ok) setProgress(await pr.json());
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : String(e));
          setWorldStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user, worldSlug]);

  const startQuest = useCallback(
    async (questId: string) => {
      if (!accessToken || !user || !world) return;
      setStarting(questId);
      try {
        const res = await fetch("/api/engagement/quests/start", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ learnerId: user.id, questId }),
        });
        if (res.ok) {
          router.push(`/dashboard/learner/quests/${world.key}/play/${questId}`);
        }
      } finally {
        setStarting(null);
      }
    },
    [accessToken, user, world, router],
  );

  if (loading || !user) return null;

  if (worldStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 font-semibold">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <p className="text-slate-700 font-heading font-bold text-lg">{t("quest_not_found")}</p>
          <p
            className="text-slate-400 text-xs font-mono mt-2 break-all"
            data-testid="quest-not-found-slug"
          >
            {worldSlug}
          </p>
          <Link
            href="/dashboard/learner/quests"
            className="text-primary hover:underline text-sm mt-4 inline-block font-semibold"
          >
            ← {tCommon("back")}
          </Link>
        </div>
      </div>
    );
  }

  const theme = WORLD_THEMES[world.key] ?? DEFAULT_THEME;
  const WorldIcon = theme.icon;

  const progressByQuest = new Map<string, QuestProgress>(progress.map((p) => [p.questId, p]));
  const sortedQuests = [...quests].sort((a, b) => a.chapterNumber - b.chapterNumber);

  // Pre-compute statuses so we can read prev-completed for unlock logic.
  const decorated = sortedQuests.reduce<Array<QuestRow & { uiStatus: UiStatus }>>((acc, q) => {
    const prev = acc[acc.length - 1];
    const prevCompleted = prev ? prev.uiStatus === "completed" : true;
    acc.push({ ...q, uiStatus: deriveStatus(q, progressByQuest, prevCompleted) });
    return acc;
  }, []);

  const completedCount = decorated.filter((q) => q.uiStatus === "completed").length;
  const totalXP = decorated.reduce(
    (sum, q) => sum + (q.uiStatus === "completed" ? (q.xpReward ?? 0) : 0),
    0,
  );

  const STATUS_STYLES: Record<UiStatus, string> = {
    completed: "border-green-300 bg-green-50",
    in_progress: "border-blue-300 bg-blue-50",
    available: "border-slate-200 bg-white",
    locked: "border-slate-200 bg-slate-50 opacity-60",
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link
          href="/dashboard/learner/quests"
          className="text-sm text-primary hover:underline font-semibold mb-6 inline-block"
        >
          ← {tCommon("back")}
        </Link>

        <div
          className={`bg-linear-to-r ${theme.gradient} rounded-3xl p-8 text-white mb-8 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <span className="w-16 h-16 mb-3 rounded-2xl bg-white/20 text-white flex items-center justify-center">
              <WorldIcon className="w-9 h-9" strokeWidth={2} aria-hidden />
            </span>
            <h1 className="text-3xl font-heading font-bold">{world.name}</h1>
            <p className="text-white/80 mt-1">{world.description}</p>
            <p className="text-white/60 text-xs font-semibold mt-1">{world.subject}</p>
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-2xl font-bold">
                  {completedCount}/{world.chapters}
                </p>
                <p className="text-white/60 text-xs">{t("quests_done")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{totalXP}</p>
                <p className="text-white/60 text-xs">{tGamification("xp")}</p>
              </div>
            </div>
          </div>
        </div>

        {decorated.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-600 font-semibold">{t("quest_not_found")}</p>
            <p className="text-slate-400 text-sm mt-1">
              0/{world.chapters} {t("quests_done").toLowerCase()}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {decorated.map((quest, index) => (
              <div
                key={quest.id}
                className={`rounded-2xl border-2 p-6 transition ${STATUS_STYLES[quest.uiStatus]}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      quest.uiStatus === "completed"
                        ? "bg-green-500 text-white"
                        : quest.uiStatus === "in_progress"
                          ? "bg-blue-500 text-white"
                          : quest.uiStatus === "available"
                            ? "bg-slate-200 text-slate-600"
                            : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {quest.uiStatus === "completed" ? (
                      <Check className="w-5 h-5" strokeWidth={3} aria-hidden />
                    ) : quest.uiStatus === "locked" ? (
                      <Lock className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-heading font-bold text-slate-900">{quest.title}</h3>
                      <span className="text-sm font-bold text-amber-600">
                        +{quest.xpReward ?? 0} XP
                      </span>
                    </div>
                    {quest.description && (
                      <p className="text-sm text-slate-500 mb-3">{quest.description}</p>
                    )}

                    {quest.uiStatus === "available" && (
                      <button
                        onClick={() => startQuest(quest.id)}
                        disabled={starting === quest.id}
                        className="mt-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-dark transition disabled:opacity-60"
                      >
                        {starting === quest.id ? tCommon("loading") : t("start_quest")}
                      </button>
                    )}
                    {quest.uiStatus === "in_progress" && (
                      <button
                        onClick={() =>
                          router.push(`/dashboard/learner/quests/${world.key}/play/${quest.id}`)
                        }
                        className="mt-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
                      >
                        {t("continue_quest")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {fetchError && <p className="text-xs text-slate-400 mt-6">debug: {fetchError}</p>}
      </div>
    </div>
  );
}
