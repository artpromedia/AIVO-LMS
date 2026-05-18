"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import LearnerCardSkeleton from "@/components/states/LearnerCardSkeleton";
import FetchErrorState from "@/components/states/FetchErrorState";
import { IconWell } from "@/components/discovery/_vi";
import { CalendarDays } from "lucide-react";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

interface SessionEntry {
  id: string;
  learnerId: string;
  subject: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  xpEarned?: number;
  tutorSku: string;
  contentType: string;
}

type SessionTab = "history" | "log";

export default function TherapistSessionsPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("therapist");
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [tab, setTab] = useState<SessionTab>("history");

  const [logNotes, setLogNotes] = useState("");
  const [logCategory, setLogCategory] = useState("speech");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDuration, setLogDuration] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const fetchData = useCallback(async () => {
    if (!accessToken || !user) return;
    setFetchError(false);
    setLoadingData(true);
    try {
      const learnersData = await fetch("/api/family/collaboration/connected-learners", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : []));
      const parsed = Array.isArray(learnersData) ? learnersData : [];
      setLearners(parsed);
      if (parsed.length > 0 && !selectedLearner) setSelectedLearner(parsed[0].id);
    } catch {
      setFetchError(true);
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedLearner || !accessToken) return;
    fetch(`/api/learning/sessions?learnerId=${selectedLearner}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, [selectedLearner, accessToken]);

  const handleLogSession = async () => {
    if (!accessToken || !selectedLearner) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/learning/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          learnerId: selectedLearner,
          tutorSku: `therapy-${logCategory}`,
          topic: logNotes.slice(0, 100) || `${logCategory} session`,
          contentType: "THERAPY_SESSION",
          sessionDate: logDate,
          durationMinutes: parseInt(logDuration, 10) || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to log session");
      setSubmitMsg({ type: "success", text: "Session logged successfully" });
      setLogNotes("");
      const updated = await fetch(`/api/learning/sessions?learnerId=${selectedLearner}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : []));
      setSessions(Array.isArray(updated) ? updated : []);
    } catch {
      setSubmitMsg({ type: "error", text: "Failed to log session. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  const getLearnerName = (id: string) => learners.find((l) => l.id === id)?.name || "Unknown";

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="p-8 space-y-6 vi-bg">
      <h1 className="text-3xl font-heading font-bold vi-text">Session Logs</h1>

      {loadingData ? (
        <LearnerCardSkeleton count={3} />
      ) : fetchError ? (
        <FetchErrorState title="Unable to load data" onRetry={fetchData} />
      ) : learners.length === 0 ? (
        <div className="vi-card p-12 text-center">
          <div className="flex justify-center mb-4">
            <IconWell color="math" size="lg">
              <CalendarDays size={36} strokeWidth={2.5} aria-hidden="true" />
            </IconWell>
          </div>
          <p className="vi-text font-heading font-bold text-xl">No clients connected yet</p>
          <p className="text-sm vi-text-muted mt-2">
            Connect with learners to start logging sessions.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={selectedLearner || ""}
              onChange={(e) => setSelectedLearner(e.target.value)}
              aria-label="Select client"
              className="px-4 py-2 rounded-xl border vi-border text-sm font-semibold bg-[hsl(var(--visual-surface))] shadow-sm vi-text"
            >
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border vi-border overflow-hidden" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "history"}
                onClick={() => setTab("history")}
                className={`px-4 py-2 text-sm font-semibold transition ${tab === "history" ? "bg-[hsl(var(--visual-math))] text-white" : "bg-[hsl(var(--visual-surface))] vi-text-muted hover:vi-surface-soft"}`}
              >
                History
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "log"}
                onClick={() => setTab("log")}
                className={`px-4 py-2 text-sm font-semibold transition ${tab === "log" ? "bg-[hsl(var(--visual-math))] text-white" : "bg-[hsl(var(--visual-surface))] vi-text-muted hover:vi-surface-soft"}`}
              >
                Log Session
              </button>
            </div>
          </div>

          {tab === "history" ? (
            <div className="vi-card overflow-hidden">
              {sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="vi-text-muted text-sm">
                    No sessions recorded yet for {getLearnerName(selectedLearner || "")}.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Session history for {getLearnerName(selectedLearner || "")}
                  </caption>
                  <thead>
                    <tr className="border-b vi-border vi-surface-soft">
                      <th scope="col" className="text-left px-6 py-3 font-semibold vi-text">
                        Date
                      </th>
                      <th scope="col" className="text-left px-6 py-3 font-semibold vi-text">
                        Subject
                      </th>
                      <th scope="col" className="text-left px-6 py-3 font-semibold vi-text">
                        Type
                      </th>
                      <th scope="col" className="text-left px-6 py-3 font-semibold vi-text">
                        Duration
                      </th>
                      <th scope="col" className="text-left px-6 py-3 font-semibold vi-text">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b vi-border hover:vi-surface-soft">
                        <td className="px-6 py-3 vi-text-muted">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 vi-text font-medium">{s.subject}</td>
                        <td className="px-6 py-3 vi-text-muted">{s.contentType}</td>
                        <td className="px-6 py-3 vi-text-muted">
                          {formatDuration(s.durationSeconds)}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-bold ${s.status === "COMPLETED" ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]" : s.status === "CONTENT_READY" ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]"}`}
                          >
                            {s.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="vi-card p-6 space-y-4 max-w-2xl">
              <h2 className="text-lg font-heading font-bold vi-text">Log a Therapy Session</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="session-category"
                    className="block text-sm font-semibold vi-text mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="session-category"
                    value={logCategory}
                    onChange={(e) => setLogCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
                  >
                    <option value="speech">Speech &amp; Language</option>
                    <option value="occupational">Occupational Therapy</option>
                    <option value="behavioral">Behavioral Therapy</option>
                    <option value="physical">Physical Therapy</option>
                    <option value="sel">Social-Emotional</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="session-date"
                    className="block text-sm font-semibold vi-text mb-1"
                  >
                    Date
                  </label>
                  <input
                    id="session-date"
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
                  />
                </div>
                <div>
                  <label
                    htmlFor="session-duration"
                    className="block text-sm font-semibold vi-text mb-1"
                  >
                    Duration (min)
                  </label>
                  <input
                    id="session-duration"
                    type="number"
                    min="5"
                    max="180"
                    value={logDuration}
                    onChange={(e) => setLogDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="session-notes" className="block text-sm font-semibold vi-text mb-1">
                  Session Notes
                </label>
                <textarea
                  id="session-notes"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  rows={4}
                  placeholder="Document session observations, goals worked on, progress notes..."
                  className="w-full px-3 py-2 rounded-lg border vi-border text-sm resize-none bg-[hsl(var(--visual-surface))] vi-text"
                />
              </div>

              {submitMsg && (
                <p
                  className={`text-sm font-medium ${submitMsg.type === "success" ? "text-[hsl(var(--visual-science))]" : "text-[hsl(var(--visual-math))]"}`}
                  role="alert"
                >
                  {submitMsg.text}
                </p>
              )}

              <button
                type="button"
                onClick={handleLogSession}
                disabled={submitting || !selectedLearner}
                style={{ minHeight: "44px" }}
                className="px-6 py-2.5 rounded-xl bg-[hsl(var(--visual-math))] text-white font-heading font-black uppercase tracking-wider text-sm hover:bg-[hsl(var(--visual-math)/0.9)] transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-math))] focus-visible:ring-offset-2"
              >
                {submitting ? "Saving..." : "Log Session"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
