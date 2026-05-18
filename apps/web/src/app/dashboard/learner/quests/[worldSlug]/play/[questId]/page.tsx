"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, X, Sparkles } from "lucide-react";

interface QuestWorld {
  key: string;
  name: string;
  tutorKey: string;
  subject: string;
  description: string;
  chapters: number;
}

interface BossQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  skillTag: string;
}

interface BossAssessment {
  questions: BossQuestion[];
  passingScore: number;
}

interface QuestChapter {
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
  bossAssessment: BossAssessment | null;
}

type Phase = "intro" | "play" | "outro";

interface CompletionResult {
  score: number;
  xpAwarded: number;
  coinAwarded: number;
  alreadyCompleted: boolean;
}

export default function QuestPlayPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tCommon = useTranslations("common");
  const tGamification = useTranslations("gamification");
  const params = useParams();
  const worldSlug = params.worldSlug as string;
  const questId = params.questId as string;

  const [world, setWorld] = useState<QuestWorld | null>(null);
  const [quest, setQuest] = useState<QuestChapter | null>(null);
  const [loadError, setLoadError] = useState<"not_found" | "mismatch" | "fetch" | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    let cancelled = false;
    const auth = { Authorization: `Bearer ${accessToken}` };
    setLoadError(null);
    (async () => {
      try {
        const [wr, cr] = await Promise.all([
          fetch(`/api/engagement/quests/worlds/${encodeURIComponent(worldSlug)}`, {
            headers: auth,
          }),
          fetch(`/api/engagement/quests/chapter/${encodeURIComponent(questId)}`, { headers: auth }),
        ]);
        if (cancelled) return;
        if (wr.status === 404 || cr.status === 404) {
          setLoadError("not_found");
          return;
        }
        if (!wr.ok || !cr.ok) {
          setLoadError("fetch");
          return;
        }
        const resolvedWorld: QuestWorld = await wr.json();
        const body = await cr.json();
        const resolvedQuest: QuestChapter = body.quest;
        if (cancelled) return;
        if (resolvedQuest.worldKey !== resolvedWorld.key) {
          setLoadError("mismatch");
          return;
        }
        setWorld(resolvedWorld);
        setQuest(resolvedQuest);
      } catch {
        if (!cancelled) setLoadError("fetch");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user, worldSlug, questId]);

  const questions = useMemo<BossQuestion[]>(() => quest?.bossAssessment?.questions ?? [], [quest]);
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  const score = useMemo(() => {
    if (questions.length === 0) return 0;
    const correct = questions.reduce(
      (acc, q) => acc + (answers[q.id] === q.answerIndex ? 1 : 0),
      0,
    );
    return Math.round((correct / questions.length) * 100);
  }, [questions, answers]);

  async function submitCompletion() {
    if (!accessToken || !user || !quest) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/engagement/quests/complete", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: user.id, questId: quest.id, score }),
      });
      if (res.ok) {
        const body = await res.json();
        setCompletion({
          score: body.score ?? score,
          xpAwarded: body.xpAwarded ?? 0,
          coinAwarded: body.coinAwarded ?? 0,
          alreadyCompleted: !!body.alreadyCompleted,
        });
        setPhase("outro");
      } else {
        setLoadError("fetch");
      }
    } catch {
      setLoadError("fetch");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  if (loadError === "not_found") {
    return (
      <ErrorView
        title={t("quest_not_found")}
        slug={`${worldSlug}/${questId}`}
        backHref={`/dashboard/learner/quests/${worldSlug}`}
        backLabel={tCommon("back")}
      />
    );
  }
  if (loadError === "mismatch") {
    return (
      <ErrorView
        title={t("quest_not_found")}
        slug={`${questId} not in ${worldSlug}`}
        backHref={`/dashboard/learner/quests/${worldSlug}`}
        backLabel={tCommon("back")}
      />
    );
  }
  if (loadError === "fetch") {
    return (
      <ErrorView
        title={t("quest_not_found")}
        slug={`${worldSlug}/${questId}`}
        backHref={`/dashboard/learner/quests/${worldSlug}`}
        backLabel={tCommon("back")}
      />
    );
  }

  if (!world || !quest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 font-semibold">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href={`/dashboard/learner/quests/${world.key}`}
          className="text-sm text-primary hover:underline font-semibold mb-4 inline-block"
        >
          ← {world.name}
        </Link>

        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">
            {world.subject} · Chapter {quest.chapterNumber}
          </p>
          <h1 className="text-3xl font-heading font-bold text-slate-900">{quest.title}</h1>
          {quest.description && <p className="text-slate-500 mt-1">{quest.description}</p>}
        </header>

        {phase === "intro" && (
          <section
            className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm"
            aria-labelledby="intro-heading"
          >
            <h2 id="intro-heading" className="font-heading font-bold text-lg text-slate-800 mb-3">
              {t("start_quest")}
            </h2>
            <p className="text-slate-700 leading-relaxed mb-6">
              {quest.narrativeIntro ?? quest.description ?? ""}
            </p>
            <button
              onClick={() => setPhase("play")}
              data-testid="begin-quest"
              className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              Begin →
            </button>
          </section>
        )}

        {phase === "play" && (
          <section aria-labelledby="quest-questions" className="space-y-4">
            <h2 id="quest-questions" className="sr-only">
              {quest.title} questions
            </h2>
            {questions.map((q, idx) => {
              const chosen = answers[q.id];
              const isRevealed = revealed[q.id];
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase text-slate-400 mb-1">
                    Question {idx + 1} of {questions.length}
                  </p>
                  <p className="font-heading font-bold text-slate-900 mb-4">{q.prompt}</p>
                  <ul className="space-y-2" role="radiogroup" aria-label={q.prompt}>
                    {q.choices.map((choice, choiceIdx) => {
                      const selected = chosen === choiceIdx;
                      const correct = q.answerIndex === choiceIdx;
                      const showState = isRevealed && (selected || correct);
                      return (
                        <li key={choiceIdx}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={isRevealed}
                            onClick={() => {
                              setAnswers((a) => ({ ...a, [q.id]: choiceIdx }));
                              setRevealed((r) => ({ ...r, [q.id]: true }));
                            }}
                            data-testid={`choice-${q.id}-${choiceIdx}`}
                            className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold transition ${
                              showState
                                ? correct
                                  ? "border-green-400 bg-green-50 text-green-800"
                                  : "border-red-300 bg-red-50 text-red-800"
                                : selected
                                  ? "border-indigo-400 bg-indigo-50"
                                  : "border-slate-200 bg-white hover:border-indigo-300"
                            } ${isRevealed ? "cursor-default" : "cursor-pointer"}`}
                          >
                            <span className="inline-flex items-center gap-2">
                              {showState && correct && (
                                <Check className="w-4 h-4" aria-hidden strokeWidth={3} />
                              )}
                              {showState && !correct && selected && (
                                <X className="w-4 h-4" aria-hidden strokeWidth={3} />
                              )}
                              {choice}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {isRevealed && (
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="font-bold">
                        {answers[q.id] === q.answerIndex ? "Correct! " : "Not quite. "}
                      </span>
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between rounded-2xl bg-white border-2 border-slate-200 p-4">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400">Score</p>
                <p
                  className="text-2xl font-heading font-bold text-slate-900"
                  data-testid="running-score"
                >
                  {allAnswered ? `${score}%` : "—"}
                </p>
              </div>
              <button
                disabled={!allAnswered || submitting}
                onClick={submitCompletion}
                data-testid="finish-quest"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 hover:bg-primary-dark transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                {submitting ? tCommon("loading") : "Finish quest"}
              </button>
            </div>
          </section>
        )}

        {phase === "outro" && completion && (
          <section
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-lg"
            aria-labelledby="outro-heading"
            data-testid="completion-summary"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wide">
              <Sparkles className="w-3 h-3" aria-hidden /> Chapter complete
            </span>
            <h2 id="outro-heading" className="text-3xl font-heading font-bold mt-3">
              {completion.score}%
            </h2>
            <p className="text-white/90 leading-relaxed mt-3">
              {quest.narrativeOutro ?? `You finished ${quest.title}!`}
            </p>
            <div className="flex gap-6 mt-6">
              <div>
                <p className="text-2xl font-bold">+{completion.xpAwarded}</p>
                <p className="text-white/70 text-xs uppercase font-bold tracking-wide">
                  {tGamification("xp")}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">+{completion.coinAwarded}</p>
                <p className="text-white/70 text-xs uppercase font-bold tracking-wide">coins</p>
              </div>
            </div>
            {completion.alreadyCompleted && (
              <p className="text-white/70 text-xs mt-4">
                You finished this chapter before — rewards were not granted again.
              </p>
            )}
            <button
              onClick={() => router.push(`/dashboard/learner/quests/${world.key}`)}
              className="mt-6 px-6 py-3 rounded-xl bg-white text-indigo-700 font-bold hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Back to {world.name}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function ErrorView({
  title,
  slug,
  backHref,
  backLabel,
}: {
  title: string;
  slug: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <p className="text-slate-700 font-heading font-bold text-lg">{title}</p>
        <p
          className="text-slate-400 text-xs font-mono mt-2 break-all"
          data-testid="quest-not-found-slug"
        >
          {slug}
        </p>
        <Link
          href={backHref}
          className="text-primary hover:underline text-sm mt-4 inline-block font-semibold"
        >
          ← {backLabel}
        </Link>
      </div>
    </div>
  );
}
