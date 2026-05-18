"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Target,
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Bell,
  MessageSquare,
  AlertCircle,
  CalendarClock,
  Settings,
} from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";
import { useParentLayout } from "@/app/dashboard/parent/layout";

interface GoalProgress {
  goalId: string;
  goalText: string;
  domain: string;
  baseline: string;
  targetCriteria: string;
  currentValue: number;
  currentProgress: number;
  progressPercent: number;
  trend: "improving" | "stable" | "declining";
  status: string;
}

interface IepProgress {
  learnerId: string;
  goals: GoalProgress[];
  totalGoals: number;
  activeGoals: number;
  brainStateVersion: number;
}

interface IepDocument {
  id: string;
  fileName: string;
  fileUrl: string | null;
  status: string;
  uploadedAt: string;
}

interface ReportLearner {
  id: string;
  name: string;
  gradeLevel?: string;
  functioningLevel?: string;
}

interface ReportGoal {
  goalId: string;
  goalText: string;
  domain: string;
  status: string;
  baseline: string;
  target?: string;
  targetCriteria: string;
  currentMastery: number;
  progressPercent: number;
  evidence?: string;
  sessionEvidence: { lessonCount: number; tutorCount: number };
}

interface IepReport {
  title: string;
  generatedAt: string;
  learner: ReportLearner;
  goals: ReportGoal[];
  summary: { totalGoals: number; activeGoals: number; metGoals: number; averageProgress: number };
}

export default function IepDashboardPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [progress, setProgress] = useState<IepProgress | null>(null);
  const [documents, setDocuments] = useState<IepDocument[]>([]);
  const [report, setReport] = useState<IepReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "updates" | "goals" | "documents" | "motor" | "evaluations" | "report"
  >("updates");
  const tu = useTranslations("iep_updates");
  interface TimelineItem {
    type: "note" | "report" | "amendment" | "reminder";
    id: string;
    at: string;
    payload: any;
  }
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  // Category filter chips on the Updates tab — let parents narrow the
  // timeline to a single update type ("all" shows everything).
  const [timelineFilter, setTimelineFilter] = useState<
    "all" | "note" | "report" | "amendment" | "reminder"
  >("all");
  type Prefs = {
    progress_notes: { email: boolean; inApp: boolean };
    reports: { email: boolean; inApp: boolean };
    amendments: { email: boolean; inApp: boolean };
    reminders: { email: boolean; inApp: boolean };
  };
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  // In-app notification inbox state. We keep a server-tracked unread
  // count so the badge reflects what the parent has actually seen across
  // sessions/devices, instead of guessing from "items in the last 14
  // days" like the old badge did.
  const [inboxUnread, setInboxUnread] = useState(0);

  const refreshInbox = async () => {
    if (!accessToken || !learnerId) return;
    try {
      const r = await fetch(`/api/comms/in-app-notifications?learnerId=${learnerId}&unread=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const j = await r.json();
        setInboxUnread(typeof j.unreadCount === "number" ? j.unreadCount : 0);
      }
    } catch {
      /* noop */
    }
  };

  const { refreshUnread: refreshGlobalBell } = useParentLayout();
  const markInboxRead = async () => {
    if (!accessToken || !learnerId || inboxUnread === 0) return;
    try {
      await fetch(`/api/comms/in-app-notifications/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ all: true, learnerId }),
      });
      setInboxUnread(0);
      // Tell the dashboard layout to re-fetch its merged unread count so
      // the bell badge in the header decrements immediately instead of
      // waiting for the 60s poll.
      refreshGlobalBell();
    } catch {
      /* noop */
    }
  };

  const refreshTimeline = async () => {
    if (!accessToken || !learnerId) return;
    setTimelineLoading(true);
    try {
      const r = await fetch(`/api/iep/learners/${learnerId}/timeline`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const j = await r.json();
        setTimeline(Array.isArray(j.items) ? j.items : []);
      }
    } catch {
      /* noop */
    }
    setTimelineLoading(false);
  };

  const respondAmendment = async (
    aid: string,
    response: "acknowledged" | "objected",
    note?: string,
  ) => {
    if (!accessToken) return;
    setRespondingId(aid);
    try {
      await fetch(`/api/iep/amendments/${aid}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ response, note }),
      });
      await refreshTimeline();
    } catch {
      /* noop */
    }
    setRespondingId(null);
  };

  const savePrefs = async () => {
    if (!accessToken || !prefs) return;
    setSavingPrefs(true);
    try {
      const r = await fetch(`/api/iep/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(prefs),
      });
      if (r.ok) setPrefs(await r.json());
      setShowPrefs(false);
    } catch {
      /* noop */
    }
    setSavingPrefs(false);
  };
  const [evaluations, setEvaluations] = useState<
    Array<{
      id: string;
      status: string;
      createdAt: string;
      submittedAt: string | null;
      eligibilityDecision: string | null;
      decisionCategories: string[] | null;
      decisionRationale: string | null;
      decidedAt: string | null;
    }>
  >([]);
  const [draftSummaries, setDraftSummaries] = useState<
    Array<{
      id: string;
      lifecycleState: string;
      createdAt: string;
      updatedAt: string;
    }>
  >([]);
  const [motorProgress, setMotorProgress] = useState<null | {
    totalMotorGoals: number;
    averageMastery: number;
    categories: {
      id: string;
      label: string;
      goalCount: number;
      averageMastery: number;
      trend: "improving" | "stable" | "declining";
    }[];
  }>(null);
  const td = useTranslations("dape");
  const te = useTranslations("evaluation");

  useEffect(() => {
    if (!accessToken || !learnerId) return;
    const headers = { Authorization: `Bearer ${accessToken}` };

    fetch(`/api/family/iep/${learnerId}/progress`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Guard against non-object responses (e.g. 401/403 error bodies)
        // so downstream `.map` on `progress.goals` never crashes the page.
        if (d && typeof d === "object" && Array.isArray((d as IepProgress).goals)) {
          setProgress(d as IepProgress);
        } else {
          setProgress(null);
        }
      })
      .catch((err) => console.error("Failed to fetch IEP progress:", err));
    fetch(`/api/family/iep/${learnerId}/documents`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDocuments(Array.isArray(d) ? d : []))
      .catch((err) => console.error("Failed to fetch IEP documents:", err));
    fetch(`/api/family/iep/${learnerId}/dape/progress`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMotorProgress(d);
      })
      .catch((err) => console.error("Failed to fetch DAPE progress:", err));
    fetch(`/api/iep/evaluations/learner/${learnerId}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEvaluations(Array.isArray(d) ? d : []))
      .catch((err) => console.error("Failed to fetch evaluations:", err));
    fetch(`/api/iep/drafts/learner/${learnerId}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDraftSummaries(Array.isArray(d) ? d : []))
      .catch((err) => console.error("Failed to fetch IEP drafts:", err));
    refreshTimeline();
    refreshInbox();
    fetch(`/api/iep/preferences`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) setPrefs(p as Prefs);
      })
      .catch(() => {});
    // Light polling for the timeline + in-app inbox so new notes/reports
    // and the unread badge update without a manual refresh. 60s is plenty
    // for the volume.
    const t = setInterval(() => {
      refreshTimeline();
      refreshInbox();
    }, 60_000);
    return () => clearInterval(t);
  }, [accessToken, learnerId]);

  // Default landing tab is "updates", so any unread items the parent has
  // are considered "viewed" once the inbox count has loaded. This keeps
  // the badge consistent with what's actually on screen.
  useEffect(() => {
    if (activeTab === "updates" && inboxUnread > 0) {
      markInboxRead();
    }
  }, [activeTab, inboxUnread]);

  const inFlightDrafts = draftSummaries.filter(
    (d) => d.lifecycleState === "draft" || d.lifecycleState === "in_review",
  );
  const reviewDraft = draftSummaries.find((d) => d.lifecycleState === "in_review");
  const activeDraft = draftSummaries.find((d) => d.lifecycleState === "finalised");

  const [typedName, setTypedName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  // Reset the local "signed" UI flag whenever the active review draft changes
  // (e.g. parent navigates between learners or a draft is reverted to draft
  // and re-sent). Without this, the success state could persist stale.
  useEffect(() => {
    setSigned(false);
    setSignError(null);
    setTypedName("");
  }, [reviewDraft?.id]);
  const submitParentSignature = async () => {
    if (!reviewDraft || !accessToken || !typedName.trim()) return;
    setSigning(true);
    setSignError(null);
    try {
      const res = await fetch(`/api/iep/drafts/${reviewDraft.id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ typedName: typedName.trim(), signerRole: "parent" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSignError(j?.error || "Could not record signature");
      } else {
        setSigned(true);
        // Refresh draft list so the banner updates if finalisation occurred.
        fetch(`/api/iep/drafts/learner/${learnerId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setDraftSummaries(Array.isArray(d) ? d : []))
          .catch(() => {});
      }
    } catch {
      setSignError("Network error");
    }
    setSigning(false);
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/family/iep/${learnerId}/report`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setReport(await res.json());
        setActiveTab("report");
      }
    } catch (err) {
      console.error("Failed to generate IEP report:", err);
    }
    setGeneratingReport(false);
  };

  if (loading || !user) return null;

  const TREND_ICONS: Record<string, React.ReactNode> = {
    improving: <TrendingUp className="w-4 h-4" />,
    stable: <Minus className="w-4 h-4" />,
    declining: <TrendingDown className="w-4 h-4" />,
  };
  const TREND_COLORS: Record<string, string> = {
    improving: "text-[hsl(var(--visual-science))]",
    stable: "vi-text-muted",
    declining: "text-[hsl(var(--visual-math))]",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("iep_tracking")}</h1>
          <p className="vi-text-muted mt-1">{t("iep_tracking_desc")}</p>
          {inFlightDrafts.length > 0 && !reviewDraft && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))] text-xs font-bold">
              <ClipboardList size={14} aria-hidden="true" />
              {t("iep_draft_in_progress")}
            </div>
          )}
          {reviewDraft && (
            <div className="mt-3 p-3 rounded-xl bg-[hsl(var(--visual-reading)/0.12)] border-l-4 border-[hsl(var(--visual-reading))] space-y-3">
              <div>
                <div className="text-sm font-bold text-[hsl(var(--visual-reading))]">
                  {t.has?.("iep_action_needed")
                    ? t("iep_action_needed")
                    : "Action needed: review and sign"}
                </div>
                <p className="text-xs vi-text-muted mt-1">
                  {t.has?.("iep_action_needed_help")
                    ? t("iep_action_needed_help")
                    : "Your child's case manager has shared a draft IEP for your review. Open the document to read each section, leave comments, and add your signature."}
                </p>
              </div>
              {!signed ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder={
                      t.has?.("iep_typed_name_placeholder")
                        ? t("iep_typed_name_placeholder")
                        : "Type your full name to sign"
                    }
                    className="flex-1 px-3 py-2 rounded-lg border vi-border vi-surface text-sm"
                    style={{ minHeight: 44 }}
                    aria-label="Typed signature"
                  />
                  <button
                    onClick={submitParentSignature}
                    disabled={signing || !typedName.trim()}
                    style={{ minHeight: 44 }}
                    className="px-4 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm disabled:opacity-50"
                  >
                    {signing
                      ? t.has?.("iep_signing")
                        ? t("iep_signing")
                        : "Signing…"
                      : t.has?.("iep_sign")
                        ? t("iep_sign")
                        : "Sign IEP"}
                  </button>
                </div>
              ) : (
                <div className="text-xs font-bold text-[hsl(var(--visual-science))]">
                  {t.has?.("iep_signed_thanks")
                    ? t("iep_signed_thanks")
                    : "Thank you. Your signature has been recorded."}
                </div>
              )}
              {signError && (
                <div className="text-xs font-bold text-[hsl(var(--visual-math))]">{signError}</div>
              )}
            </div>
          )}
          {activeDraft && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-science)/0.18)] text-[hsl(var(--visual-science))] text-xs font-bold">
              <ClipboardList size={14} aria-hidden="true" />
              {t.has?.("iep_active") ? t("iep_active") : "Active IEP"}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {progress && (
            <div className="text-center px-4 py-2 rounded-xl bg-[hsl(var(--visual-primary)/0.12)]">
              <div className="text-2xl font-bold text-[hsl(var(--visual-primary))]">
                {progress.activeGoals}
              </div>
              <div className="text-xs vi-text-muted font-semibold">{t("active_goals")}</div>
            </div>
          )}
          <button
            onClick={generateReport}
            disabled={generatingReport}
            style={{ minHeight: 44 }}
            className="px-5 py-2.5 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50 text-sm"
          >
            {generatingReport ? t("generating") : t("generate_report")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b vi-border pb-1 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(["updates", "goals", "documents", "motor", "evaluations", "report"] as const).map(
            (tab) => {
              const unread = tab === "updates" ? inboxUnread : 0;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === "updates") markInboxRead();
                  }}
                  className={`px-4 py-2 text-sm font-bold rounded-t-lg transition flex items-center gap-2 ${activeTab === tab ? "bg-[hsl(var(--visual-surface))] border vi-border border-b-[hsl(var(--visual-surface))] text-[hsl(var(--visual-primary))] -mb-[1px]" : "vi-text-muted hover:vi-text"}`}
                >
                  {tab === "updates"
                    ? tu("tab")
                    : tab === "goals"
                      ? t("goals")
                      : tab === "documents"
                        ? t("documents")
                        : tab === "motor"
                          ? td("motor_progress")
                          : tab === "evaluations"
                            ? te("evaluations_tab")
                            : t("report")}
                  {tab === "updates" && unread > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[hsl(var(--visual-primary))] text-white text-[10px]">
                      {unread}
                    </span>
                  )}
                </button>
              );
            },
          )}
        </div>
        {activeTab === "updates" && (
          <button
            onClick={() => setShowPrefs(true)}
            className="text-xs font-bold vi-text-muted hover:vi-text inline-flex items-center gap-1 px-3 py-1.5 rounded-full vi-surface-soft"
          >
            <Settings size={14} /> {tu("preferences")}
          </button>
        )}
      </div>

      {activeTab === "updates" && (
        <div className="space-y-3">
          {/* Filter chips — let parents narrow the timeline by category. */}
          <div className="flex flex-wrap gap-2">
            {(["all", "note", "report", "amendment", "reminder"] as const).map((c) => {
              const cnt =
                c === "all" ? timeline.length : timeline.filter((i) => i.type === c).length;
              const isActive = timelineFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setTimelineFilter(c)}
                  style={{ minHeight: 36 }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition ${
                    isActive
                      ? "bg-[hsl(var(--visual-primary))] text-white"
                      : "vi-surface-soft vi-text-muted hover:vi-text"
                  }`}
                >
                  {c === "all" ? tu("filter_all") : tu(`type_${c}`)}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? "bg-white/20" : "vi-surface"
                    }`}
                  >
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>
          {(() => {
            const filtered =
              timelineFilter === "all"
                ? timeline
                : timeline.filter((i) => i.type === timelineFilter);
            if (timelineLoading && timeline.length === 0) {
              return (
                <div className="vi-card p-8 text-center vi-text-muted text-sm">{tu("loading")}</div>
              );
            }
            if (filtered.length === 0) {
              return (
                <div className="vi-card p-12 text-center">
                  <div className="flex justify-center mb-3">
                    <IconWell color="reading">
                      <Bell className="w-7 h-7" />
                    </IconWell>
                  </div>
                  <p className="vi-text-muted font-semibold">{tu("none_yet")}</p>
                  <p className="vi-text-muted text-sm mt-2">{tu("none_yet_help")}</p>
                </div>
              );
            }
            return filtered.map((item) => (
              <div key={`${item.type}-${item.id}`} className="vi-card p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.type === "note" && (
                      <IconWell color="reading" size="sm">
                        <MessageSquare className="w-4 h-4" />
                      </IconWell>
                    )}
                    {item.type === "report" && (
                      <IconWell color="science" size="sm">
                        <FileText className="w-4 h-4" />
                      </IconWell>
                    )}
                    {item.type === "amendment" && (
                      <IconWell color="primary" size="sm">
                        <AlertCircle className="w-4 h-4" />
                      </IconWell>
                    )}
                    {item.type === "reminder" && (
                      <IconWell color="sel" size="sm">
                        <CalendarClock className="w-4 h-4" />
                      </IconWell>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs vi-text-muted">
                      <span className="font-bold uppercase tracking-wide">
                        {tu(`type_${item.type}`)}
                      </span>
                      <span>·</span>
                      <span>{new Date(item.at).toLocaleString()}</span>
                    </div>
                    {item.type === "note" && (
                      <>
                        <p className="text-sm vi-text mt-1">{item.payload.body}</p>
                        {item.payload.attachmentUrl && (
                          <a
                            href={item.payload.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold mt-2 text-[hsl(var(--visual-primary))] hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" /> {tu("attachment_view")}
                          </a>
                        )}
                        {item.payload.authorName && (
                          <p className="text-xs vi-text-muted mt-1">
                            {tu("from", { name: item.payload.authorName })}
                            {item.payload.authorRole && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded-full vi-surface-soft text-[10px] uppercase font-bold">
                                {item.payload.authorRole.replace(/_/g, " ")}
                              </span>
                            )}
                          </p>
                        )}
                      </>
                    )}
                    {item.type === "report" && (
                      <>
                        <p className="text-sm font-bold vi-text mt-1">
                          {tu("report_period", { period: item.payload.period })}
                        </p>
                        {item.payload.narrative && (
                          <p className="text-sm vi-text mt-1 whitespace-pre-line">
                            {item.payload.narrative}
                          </p>
                        )}
                      </>
                    )}
                    {item.type === "amendment" && (
                      <>
                        <p className="text-sm font-bold vi-text mt-1">
                          {tu("amendment_proposed_by", { name: item.payload.proposedByName || "" })}
                        </p>
                        <p className="text-sm vi-text mt-1">{item.payload.summary}</p>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                              item.payload.status === "proposed"
                                ? "bg-[hsl(var(--visual-reading)/0.14)] text-[hsl(var(--visual-reading))]"
                                : item.payload.status === "acknowledged"
                                  ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                                  : "bg-[hsl(var(--visual-math)/0.14)] text-[hsl(var(--visual-math))]"
                            }`}
                          >
                            {tu(`amendment_status_${item.payload.status}`)}
                          </span>
                        </div>
                        {item.payload.status === "proposed" && (
                          <div className="flex gap-2 mt-3">
                            <button
                              disabled={respondingId === item.payload.id}
                              onClick={() => respondAmendment(item.payload.id, "acknowledged")}
                              style={{ minHeight: 40 }}
                              className="px-4 py-1.5 rounded-full bg-[hsl(var(--visual-primary))] text-white text-xs font-bold disabled:opacity-50"
                            >
                              {tu("acknowledge")}
                            </button>
                            <button
                              disabled={respondingId === item.payload.id}
                              onClick={() => respondAmendment(item.payload.id, "objected")}
                              style={{ minHeight: 40 }}
                              className="px-4 py-1.5 rounded-full vi-surface-soft text-xs font-bold disabled:opacity-50"
                            >
                              {tu("object")}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {item.type === "reminder" && (
                      <p className="text-sm vi-text mt-1">
                        {tu("reminder_text", {
                          days: item.payload.threshold,
                          date: new Date(item.payload.reviewDate).toLocaleDateString(),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {showPrefs && prefs && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => setShowPrefs(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowPrefs(false);
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- inner container only stops propagation; outer overlay handles keyboard close */}
          <div className="vi-card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading font-bold text-lg vi-text mb-1">
              {tu("preferences_title")}
            </h2>
            <p className="text-xs vi-text-muted mb-4">{tu("preferences_help")}</p>
            <div className="space-y-3">
              {(["progress_notes", "reports", "amendments", "reminders"] as const).map((cat) => {
                const locked = cat !== "progress_notes";
                return (
                  <div key={cat} className="p-3 rounded-xl vi-surface-soft">
                    <div className="font-bold text-sm vi-text">{tu(`pref_${cat}`)}</div>
                    {locked && (
                      <p className="text-[11px] vi-text-muted mt-0.5">{tu("pref_required")}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs vi-text-muted">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={prefs[cat].email}
                          disabled={locked && !prefs[cat].inApp}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              [cat]: { ...prefs[cat], email: e.target.checked },
                            })
                          }
                        />
                        {tu("pref_email")}
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={prefs[cat].inApp}
                          disabled={locked && !prefs[cat].email}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              [cat]: { ...prefs[cat], inApp: e.target.checked },
                            })
                          }
                        />
                        {tu("pref_in_app")}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPrefs(false)}
                style={{ minHeight: 44 }}
                className="px-4 py-2 rounded-full vi-surface-soft text-sm font-bold"
              >
                {tu("cancel")}
              </button>
              <button
                onClick={savePrefs}
                disabled={savingPrefs}
                style={{ minHeight: 44 }}
                className="px-4 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white text-sm font-bold disabled:opacity-50"
              >
                {savingPrefs ? tu("saving") : tu("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "goals" && (
        <div className="space-y-4">
          {!progress?.goals || progress.goals.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="science">
                  <Target className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("no_iep_goals")}</p>
            </div>
          ) : (
            progress.goals.map((goal) => (
              <div key={goal.goalId} className="vi-card p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {goal.domain && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold">
                          {goal.domain}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                          goal.status === "active"
                            ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                            : goal.status === "met"
                              ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                              : "vi-surface-soft vi-text-muted"
                        }`}
                      >
                        {goal.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                      {goal.goalText}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 ml-4 ${TREND_COLORS[goal.trend]}`}>
                    {TREND_ICONS[goal.trend]}
                    <span className="text-sm font-bold capitalize">{goal.trend}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div className="p-2 rounded-lg vi-surface-soft">
                    <div className="text-xs vi-text-muted font-semibold">{t("baseline")}</div>
                    <div className="font-bold text-slate-800">{goal.baseline || t("na")}</div>
                  </div>
                  <div className="p-2 rounded-lg vi-surface-soft">
                    <div className="text-xs vi-text-muted font-semibold">
                      {t("current_label") || "Current"}
                    </div>
                    <div className="font-bold text-[hsl(var(--visual-primary))]">
                      {goal.currentValue}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg vi-surface-soft">
                    <div className="text-xs vi-text-muted font-semibold">{t("target")}</div>
                    <div className="font-bold text-[hsl(var(--visual-science))]">
                      {goal.targetCriteria || t("na")}
                    </div>
                  </div>
                </div>

                <div className="h-4 bg-[hsl(var(--visual-surface-soft))] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${goal.progressPercent}%`,
                      backgroundColor:
                        goal.trend === "declining"
                          ? "hsl(var(--visual-math))"
                          : goal.progressPercent >= 80
                            ? "hsl(var(--visual-science))"
                            : "hsl(var(--visual-primary))",
                    }}
                  />
                </div>
                <div
                  className="text-right text-xs font-bold mt-1"
                  style={{
                    color:
                      goal.trend === "declining"
                        ? "hsl(var(--visual-math))"
                        : goal.progressPercent >= 80
                          ? "hsl(var(--visual-science))"
                          : "hsl(var(--visual-primary))",
                  }}
                >
                  {goal.progressPercent}%
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-3">
          {!Array.isArray(documents) || documents.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="reading">
                  <FileText className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("no_iep_documents")}</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="vi-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IconWell color="reading" size="sm">
                    <FileText className="w-5 h-5" />
                  </IconWell>
                  <div>
                    <div className="font-bold text-slate-800">{doc.fileName}</div>
                    <div className="text-xs vi-text-muted">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full font-bold ${
                    doc.status === "parsed"
                      ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                      : doc.status === "uploaded"
                        ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                        : "vi-surface-soft vi-text-muted"
                  }`}
                >
                  {doc.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "motor" && (
        <div className="space-y-4">
          {!motorProgress || motorProgress.totalMotorGoals === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="science">
                  <Activity className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{td("no_motor_goals")}</p>
              <p className="vi-text-muted text-sm mt-2">{td("no_motor_goals_help")}</p>
            </div>
          ) : (
            <>
              <div className="vi-card p-6">
                <h2 className="text-lg font-heading font-bold vi-text mb-1">
                  {td("motor_progress_overview")}
                </h2>
                <p className="vi-text-muted text-sm mb-4">{td("motor_progress_desc")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[hsl(var(--visual-primary)/0.12)] text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--visual-primary))]">
                      {motorProgress.totalMotorGoals}
                    </div>
                    <div className="text-xs vi-text-muted font-semibold">
                      {td("total_motor_goals")}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[hsl(var(--visual-science)/0.12)] text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--visual-science))]">
                      {motorProgress.averageMastery}%
                    </div>
                    <div className="text-xs vi-text-muted font-semibold">{td("avg_mastery")}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[hsl(var(--visual-reading)/0.12)] text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--visual-reading))]">
                      {motorProgress.categories.length}
                    </div>
                    <div className="text-xs vi-text-muted font-semibold">{td("skill_areas")}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[hsl(var(--visual-sel)/0.16)] text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--visual-sel))]">
                      {motorProgress.categories.filter((c) => c.trend === "improving").length}
                    </div>
                    <div className="text-xs vi-text-muted font-semibold">{td("improving")}</div>
                  </div>
                </div>
              </div>
              {motorProgress.categories.map((c) => (
                <div key={c.id} className="vi-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-800">{c.label}</p>
                      <p className="text-xs vi-text-muted">
                        {td("n_goals", { count: c.goalCount })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 ${TREND_COLORS[c.trend]}`}>
                      {TREND_ICONS[c.trend]}
                      <span className="text-sm font-bold capitalize">{td(`trend_${c.trend}`)}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-[hsl(var(--visual-surface-soft))] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${c.averageMastery}%`,
                        backgroundColor:
                          c.trend === "declining"
                            ? "hsl(var(--visual-math))"
                            : c.averageMastery >= 70
                              ? "hsl(var(--visual-science))"
                              : "hsl(var(--visual-primary))",
                      }}
                    />
                  </div>
                  <div className="text-right text-xs font-bold mt-1 vi-text-muted">
                    {c.averageMastery}%
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === "evaluations" && (
        <div className="space-y-3">
          {!Array.isArray(evaluations) || evaluations.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="reading">
                  <ClipboardList className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{te("none_yet_parent")}</p>
              <p className="vi-text-muted text-sm mt-2">{te("none_yet_parent_help")}</p>
            </div>
          ) : (
            evaluations.map((e) => {
              const decided = e.status === "eligibility_determined";
              const dec = e.eligibilityDecision;
              return (
                <div key={e.id} className="vi-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs vi-text-muted font-bold uppercase tracking-wide">
                        {te("started_on", { date: new Date(e.createdAt).toLocaleDateString() })}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 text-xs rounded-full font-bold ${
                        decided
                          ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                          : "bg-[hsl(var(--visual-reading)/0.14)] text-[hsl(var(--visual-reading))]"
                      }`}
                    >
                      {te(`status_${e.status}`)}
                    </span>
                  </div>
                  {decided && (
                    <div className="border-t vi-border pt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {dec === "eligible" ? (
                          <CheckCircle2
                            className="w-4 h-4 text-[hsl(var(--visual-science))]"
                            aria-hidden="true"
                          />
                        ) : dec === "not_eligible" ? (
                          <XCircle
                            className="w-4 h-4 text-[hsl(var(--visual-math))]"
                            aria-hidden="true"
                          />
                        ) : null}
                        <p className="text-sm font-bold vi-text">
                          {dec === "eligible"
                            ? te("found_eligible")
                            : dec === "not_eligible"
                              ? te("found_not_eligible")
                              : te("found_needs_more_data")}
                        </p>
                      </div>
                      {e.decisionCategories && e.decisionCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {e.decisionCategories.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded-full text-xs font-bold bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]"
                            >
                              {te.has(`category_${c}`) ? te(`category_${c}`) : c}
                            </span>
                          ))}
                        </div>
                      )}
                      {e.decisionRationale && (
                        <p className="text-sm vi-text-muted italic">{e.decisionRationale}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "report" && (
        <div className="vi-card p-8">
          {!report ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-3">
                <IconWell color="primary">
                  <BarChart3 className="w-7 h-7" />
                </IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("generate_report_prompt")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b vi-border pb-4">
                <h2 className="text-2xl font-heading font-bold vi-text">{report.title}</h2>
                <p className="text-sm vi-text-muted mt-1">
                  {t("generated_at", { date: new Date(report.generatedAt).toLocaleString() })}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-[hsl(var(--visual-primary)/0.12)] text-center">
                  <div className="text-2xl font-bold text-[hsl(var(--visual-primary))]">
                    {report.summary.totalGoals}
                  </div>
                  <div className="text-xs vi-text-muted font-semibold">
                    {t("total_goals_label")}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(var(--visual-reading)/0.12)] text-center">
                  <div className="text-2xl font-bold text-[hsl(var(--visual-reading))]">
                    {report.summary.activeGoals}
                  </div>
                  <div className="text-xs vi-text-muted font-semibold">{t("active_tab_label")}</div>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(var(--visual-science)/0.12)] text-center">
                  <div className="text-2xl font-bold text-[hsl(var(--visual-science))]">
                    {report.summary.metGoals}
                  </div>
                  <div className="text-xs vi-text-muted font-semibold">{t("met_label")}</div>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(var(--visual-sel)/0.16)] text-center">
                  <div className="text-2xl font-bold text-[hsl(var(--visual-sel))]">
                    {report.summary.averageProgress}%
                  </div>
                  <div className="text-xs vi-text-muted font-semibold">{t("avg_progress")}</div>
                </div>
              </div>

              {report.learner && (
                <div className="p-4 rounded-xl vi-surface-soft border vi-border">
                  <h3 className="font-heading font-bold text-slate-800 mb-2">
                    {t("learner_profile_title")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-bold vi-text-muted">{t("full_name")}:</span>{" "}
                      {report.learner.name}
                    </div>
                    <div>
                      <span className="font-bold vi-text-muted">{t("grade")}:</span>{" "}
                      {report.learner.gradeLevel || t("na")}
                    </div>
                    <div>
                      <span className="font-bold vi-text-muted">{t("functioning_level")}:</span>{" "}
                      {report.learner.functioningLevel || t("na")}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-heading font-bold text-lg text-slate-800">
                  {t("goal_analysis")}
                </h3>
                {report.goals.map((g: ReportGoal, i: number) => (
                  <div key={i} className="p-4 rounded-xl border vi-border">
                    <div className="flex items-center gap-2 mb-2">
                      {g.domain && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold">
                          {g.domain}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                          g.status === "active"
                            ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                            : "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 font-semibold mb-2">{g.goalText}</p>
                    <div className="h-3 bg-[hsl(var(--visual-surface-soft))] rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-[hsl(var(--visual-primary))] transition-all"
                        style={{ width: `${g.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs vi-text-muted">
                      <span>
                        {t("baseline")}: {g.baseline || t("na")}
                      </span>
                      <span className="font-bold text-[hsl(var(--visual-primary))]">
                        {g.progressPercent}%
                      </span>
                      <span>
                        {t("target")}: {g.target || t("na")}
                      </span>
                    </div>
                    {g.evidence && (
                      <p className="text-xs vi-text-muted mt-2 italic">{g.evidence}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
