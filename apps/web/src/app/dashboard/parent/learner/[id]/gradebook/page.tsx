"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, Gamepad2, Map } from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";
import { subjectIcon, subjectBarClass, subjectViColor } from "@/lib/subject-icons";

interface GradebookEntry {
  id: string;
  subject: string;
  skill: string;
  masteryScore: number;
  attemptsCount: number;
  lastAssessedAt: string | null;
  trend: string;
}

interface LearningPath {
  id: string;
  subject: string;
  currentTopic: string | null;
  topicSequence: string[];
  completedTopics: string[];
  masteryMap: Record<string, number>;
}

interface SessionRecord {
  id: string;
  tutorSku: string;
  subject: string;
  status: string;
  xpEarned: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string | null;
}

const SUBJECT_KEY: Record<string, string> = {
  Mathematics: "math",
  "English Language Arts": "ela",
  Science: "science",
  "History & Social Studies": "history",
  "Coding & Computer Science": "coding",
  "Speech & Language": "speech",
  "Social-Emotional Learning": "sel",
};

function subjectKey(subject: string): string {
  return SUBJECT_KEY[subject] || subject.toLowerCase();
}

const VI_TEXT_CLASS: Record<ReturnType<typeof subjectViColor>, string> = {
  primary: "text-[hsl(var(--visual-primary))]",
  math: "text-[hsl(var(--visual-math))]",
  reading: "text-[hsl(var(--visual-reading))]",
  science: "text-[hsl(var(--visual-science))]",
  sel: "text-[hsl(var(--visual-sel))]",
};

function subjectTextClass(subject: string): string {
  return VI_TEXT_CLASS[subjectViColor(subjectKey(subject))];
}

export default function GradebookPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [activeTab, setActiveTab] = useState<"gradebook" | "sessions" | "paths">("gradebook");

  useEffect(() => {
    if (!learnerId || !accessToken) return;
    const ctl = new AbortController();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const opts = { headers, signal: ctl.signal };

    fetch(`/api/learning/gradebook/${learnerId}`, opts)
      .then((r) => (r.ok ? r.json() : []))
      .then(setGradebook)
      .catch(() => {});
    fetch(`/api/learning/sessions?learnerId=${learnerId}`, opts)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSessions)
      .catch(() => {});

    const subjects = [
      "Mathematics",
      "English Language Arts",
      "Science",
      "History & Social Studies",
      "Coding & Computer Science",
      "Speech & Language",
      "Social-Emotional Learning",
    ];
    Promise.all(
      subjects.map((s) =>
        fetch(`/api/learning/path/${learnerId}/${encodeURIComponent(s)}`, opts)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((results) => setPaths(results.filter(Boolean)));

    return () => ctl.abort();
  }, [learnerId, accessToken]);

  if (loading || !user) return null;

  const subjectGroups = gradebook.reduce<Record<string, GradebookEntry[]>>((acc, entry) => {
    if (!acc[entry.subject]) acc[entry.subject] = [];
    acc[entry.subject].push(entry);
    return acc;
  }, {});

  const totalXP = sessions.reduce((sum, s) => sum + (s.xpEarned || 0), 0);
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold vi-text">{t("progress_gradebook")}</h1>
        <div className="flex gap-4">
          <div className="text-center px-4 py-2 rounded-xl bg-[hsl(var(--visual-primary)/0.12)]">
            <div className="text-2xl font-bold text-[hsl(var(--visual-primary))]">{totalXP}</div>
            <div className="text-xs vi-text-muted font-semibold">{t("total_xp")}</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-[hsl(var(--visual-science)/0.12)]">
            <div className="text-2xl font-bold text-[hsl(var(--visual-science))]">
              {completedSessions}
            </div>
            <div className="text-xs vi-text-muted font-semibold">{t("sessions")}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b vi-border pb-1">
        {(["gradebook", "sessions", "paths"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeTab === tab ? "bg-[hsl(var(--visual-surface))] border vi-border border-b-[hsl(var(--visual-surface))] text-[hsl(var(--visual-primary))] -mb-[1px]" : "vi-text-muted hover:vi-text"}`}
          >
            {tab === "gradebook"
              ? t("mastery")
              : tab === "sessions"
                ? t("sessions")
                : t("learning_paths")}
          </button>
        ))}
      </div>

      {activeTab === "gradebook" && (
        <div className="space-y-6">
          {Object.keys(subjectGroups).length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="primary">
                  <BarChart3 className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("no_mastery_data")}</p>
            </div>
          ) : (
            Object.entries(subjectGroups).map(([subject, entries]) => {
              const sKey = subjectKey(subject);
              const SubjectIcon = subjectIcon(sKey);
              const barClass = subjectBarClass(sKey);
              const textClass = subjectTextClass(subject);
              const viColor = subjectViColor(sKey);
              return (
                <div key={subject} className="vi-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <IconWell color={viColor} size="sm">
                      <SubjectIcon className="w-5 h-5" />
                    </IconWell>
                    <h3 className={`font-heading font-bold text-lg ${textClass}`}>{subject}</h3>
                  </div>
                  <div className="space-y-3">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4">
                        <span className="text-sm text-slate-800 font-semibold w-40 truncate">
                          {entry.skill}
                        </span>
                        <div className="flex-1 h-4 bg-[hsl(var(--visual-surface-soft))] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                            style={{ width: `${Math.min(100, (entry.masteryScore || 0) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold w-12 text-right ${textClass}`}>
                          {Math.round((entry.masteryScore || 0) * 100)}%
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            entry.trend === "improving"
                              ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                              : entry.trend === "declining"
                                ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                                : "vi-surface-soft vi-text-muted"
                          }`}
                        >
                          {entry.trend === "improving"
                            ? t("trend_up")
                            : entry.trend === "declining"
                              ? t("trend_down")
                              : t("trend_steady")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="primary">
                  <Gamepad2 className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("no_sessions")}</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="vi-card p-4 flex items-center justify-between">
                <div>
                  <span className="font-heading font-bold text-slate-800">{s.subject}</span>
                  <span className="ml-2 text-xs vi-text-muted">{s.tutorSku}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                      s.status === "COMPLETED"
                        ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                        : s.status === "IN_PROGRESS"
                          ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                          : "vi-surface-soft vi-text-muted"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-[hsl(var(--visual-primary))] font-bold">
                    +{s.xpEarned} XP
                  </span>
                  <span className="vi-text-muted">
                    {new Date(s.startedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "paths" && (
        <div className="space-y-4">
          {paths.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="reading">
                  <Map className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("learning_paths_desc")}</p>
            </div>
          ) : (
            paths.map((path) => {
              const completed = (path.completedTopics || []).length;
              const total = (path.topicSequence || []).length;
              const progress = total > 0 ? (completed / total) * 100 : 0;
              const sKey = subjectKey(path.subject);
              const SubjectIcon = subjectIcon(sKey);
              const barClass = subjectBarClass(sKey);
              const textClass = subjectTextClass(path.subject);
              const viColor = subjectViColor(sKey);
              return (
                <div key={path.id} className="vi-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <IconWell color={viColor} size="sm">
                        <SubjectIcon className="w-5 h-5" />
                      </IconWell>
                      <h3 className={`font-heading font-bold text-lg ${textClass}`}>
                        {path.subject}
                      </h3>
                    </div>
                    <span className={`text-sm font-bold ${textClass}`}>
                      {completed}/{total} {t("topics")}
                    </span>
                  </div>
                  <div className="h-3 bg-[hsl(var(--visual-surface-soft))] rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(path.topicSequence || []).map((topic: string, i: number) => {
                      const isDone = (path.completedTopics || []).includes(topic);
                      const isCurrent = !isDone && i === completed;
                      return (
                        <span
                          key={i}
                          className={`px-3 py-1 text-xs rounded-full font-semibold ${
                            isDone
                              ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                              : isCurrent
                                ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] ring-2 ring-[hsl(var(--visual-primary)/0.3)]"
                                : "vi-surface-soft vi-text-muted"
                          }`}
                        >
                          {topic}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
