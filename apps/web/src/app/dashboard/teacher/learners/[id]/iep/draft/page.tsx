"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft, Save, Sparkles, Trash2, Plus, AlertCircle, CheckCircle2, Send,
  Users, MessageCircle, PenTool, History, Check, X, Link2,
} from "lucide-react";

const PLOP_AREAS = ["academic", "functional", "social", "motor", "communication"] as const;
const SECTIONS = ["plop", "goals", "accommodations", "services", "placement", "review",
  "team", "signatures", "history", "updates"] as const;
type Section = typeof SECTIONS[number];

interface TeamMember { id: string; userId: string; role: string; name: string | null; email: string | null }
interface Comment {
  id: string; section: string; goalId: string | null; body: string;
  authorId: string; authorName: string | null;
  createdAt: string; resolvedAt: string | null;
}
interface Signature {
  id: string; signerUserId: string; signerRole: string;
  typedName: string; signedAt: string; status: string;
}
interface SigStatus {
  required: string[]; signatures: Signature[]; missingRoles: string[]; complete: boolean;
}
interface Revision {
  id: string; section: string; snapshot: any;
  authorId: string; authorName: string | null; createdAt: string;
}
const TEAM_ROLES = ["case_manager", "gen_ed_teacher", "sped_teacher", "therapist", "parent", "learner", "admin"] as const;

interface Profile {
  id: string;
  learnerId: string;
  source: string;
  lifecycleState: "draft" | "in_review" | "finalised" | "archived";
  gradeLevel?: string | null;
  placement?: string | null;
  reviewDate?: string | null;
  createdAt?: string | null;
  accommodations?: any[] | null;
  assistiveTechnology?: any[] | null;
  communicationSystem?: string | null;
  disabilityCategories?: string[] | null;
  fromEvaluationId?: string | null;
}
interface PresentLevel { id: string; area: string; narrative: string }
interface Goal {
  id: string; goalText: string; domain?: string | null;
  baseline?: string | null; targetCriteria?: string | null;
}
interface Service {
  id: string; serviceType: string; providerRole?: string | null;
  minutesPerWeek?: number | null; frequency?: string | null;
  location?: string | null; notes?: string | null;
}
interface Bundle { profile: Profile; presentLevels: PresentLevel[]; services: Service[]; goals: Goal[] }

export default function IepDraftEditorPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const learnerId = params.id as string;
  const t = useTranslations("iep_authoring");
  const tc = useTranslations("iep_collab");

  const [drafts, setDrafts] = useState<Profile[]>([]);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("plop");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [drafting, setDrafting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Collab state
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sigStatus, setSigStatus] = useState<SigStatus | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newMember, setNewMember] = useState<{ userId: string; role: typeof TEAM_ROLES[number] }>({ userId: "", role: "gen_ed_teacher" });
  const [signName, setSignName] = useState("");
  const headers = useMemo(() => accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, [accessToken]);
  const lastSaved = useRef<number>(0);
  // Auto-save buffers + timers are both keyed by draft id so switching drafts
  // mid-debounce can never bleed edits from one profile into another, and a
  // pending patch on draft A always fires even after switching to draft B.
  // The buffer holds:
  //   - profile: top-level PATCH /api/iep/drafts/:id body
  //   - plops:   { [area]: narrative } → PUT present-levels/:area
  //   - goals:   { [goalId]: patch }  → PATCH goals/:goalId
  //   - services:{ [serviceId]: patch } → PATCH services/:serviceId
  type DraftBuffer = {
    profile?: Record<string, any>;
    plops?: Record<string, string>;
    goals?: Record<string, Record<string, any>>;
    services?: Record<string, Record<string, any>>;
  };
  const pendingByDraft = useRef<Record<string, DraftBuffer>>({});
  const timerByDraft = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fromEvalId = searchParams.get("fromEvaluation") || undefined;

  const refreshDrafts = useCallback(async () => {
    if (!headers) return;
    const r = await fetch(`/api/iep/drafts/learner/${learnerId}`, { headers });
    if (!r.ok) return;
    const list = await r.json();
    setDrafts(list);
    if (list.length > 0 && !activeId) setActiveId(list[0].id);
  }, [headers, learnerId, activeId]);

  const loadBundle = useCallback(async (id: string) => {
    if (!headers) return;
    const r = await fetch(`/api/iep/drafts/${id}`, { headers });
    if (r.ok) setBundle(await r.json());
  }, [headers]);

  // Pull team, comments, signatures, revisions for the active draft.
  const refreshCollab = useCallback(async (id: string) => {
    if (!headers) return;
    const [tr, cr, sr, rr] = await Promise.all([
      fetch(`/api/iep/drafts/${id}/team`, { headers }),
      fetch(`/api/iep/drafts/${id}/comments`, { headers }),
      fetch(`/api/iep/drafts/${id}/signatures`, { headers }),
      fetch(`/api/iep/drafts/${id}/revisions`, { headers }),
    ]);
    if (tr.ok) setTeam(await tr.json());
    if (cr.ok) setComments(await cr.json());
    if (sr.ok) setSigStatus(await sr.json());
    if (rr.ok) setRevisions(await rr.json());
  }, [headers]);

  useEffect(() => { refreshDrafts(); }, [refreshDrafts]);
  useEffect(() => {
    if (activeId) { loadBundle(activeId); refreshCollab(activeId); }
  }, [activeId, loadBundle, refreshCollab]);

  const createDraft = useCallback(async () => {
    if (!headers) return;
    setCreating(true);
    try {
      const r = await fetch("/api/iep/drafts", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId, fromEvaluationId: fromEvalId }),
      });
      if (r.ok) {
        const p = await r.json();
        setDrafts((d) => [p, ...d]);
        setActiveId(p.id);
      }
    } finally { setCreating(false); }
  }, [headers, learnerId, fromEvalId]);

  // Flush every pending edit (profile, present-levels, goals, services) for a
  // specific draft id immediately. Used by the debounce timer, draft switching,
  // and component unmount.
  const flushDraft = useCallback(async (draftId: string) => {
    if (!headers) return;
    const t = timerByDraft.current[draftId];
    if (t) { clearTimeout(t); delete timerByDraft.current[draftId]; }
    const buf = pendingByDraft.current[draftId];
    if (!buf) return;
    delete pendingByDraft.current[draftId];
    const calls: Promise<Response>[] = [];
    const json = (m: string, url: string, body: any) => fetch(url, {
      method: m, headers: { ...headers!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (buf.profile && Object.keys(buf.profile).length > 0) {
      calls.push(json("PATCH", `/api/iep/drafts/${draftId}`, buf.profile));
    }
    for (const [area, narrative] of Object.entries(buf.plops || {})) {
      calls.push(json("PUT", `/api/iep/drafts/${draftId}/present-levels/${area}`, { narrative }));
    }
    for (const [goalId, patch] of Object.entries(buf.goals || {})) {
      calls.push(json("PATCH", `/api/iep/drafts/${draftId}/goals/${goalId}`, patch));
    }
    for (const [sId, patch] of Object.entries(buf.services || {})) {
      calls.push(json("PATCH", `/api/iep/drafts/${draftId}/services/${sId}`, patch));
    }
    if (calls.length === 0) return;
    setSaveState("saving");
    try {
      const results = await Promise.all(calls);
      if (results.every((r) => r.ok)) { setSaveState("saved"); lastSaved.current = Date.now(); }
      else setSaveState("error");
    } catch { setSaveState("error"); }
  }, [headers]);

  // Schedule an auto-save (debounced 1s; fires at most every ~5s).
  // Each draft owns its own bucket AND its own timer.
  const armTimer = useCallback((draftId: string) => {
    const existing = timerByDraft.current[draftId];
    if (existing) clearTimeout(existing);
    const wait = Math.max(1000, 5000 - (Date.now() - lastSaved.current));
    timerByDraft.current[draftId] = setTimeout(() => { void flushDraft(draftId); }, wait);
  }, [flushDraft]);

  const scheduleSave = useCallback((patch: Record<string, any>) => {
    if (!activeId) return;
    const draftId = activeId;
    const buf = pendingByDraft.current[draftId] || {};
    buf.profile = { ...(buf.profile || {}), ...patch };
    pendingByDraft.current[draftId] = buf;
    armTimer(draftId);
  }, [activeId, armTimer]);

  const schedulePlopSave = useCallback((area: string, narrative: string) => {
    if (!activeId) return;
    const draftId = activeId;
    const buf = pendingByDraft.current[draftId] || {};
    buf.plops = { ...(buf.plops || {}), [area]: narrative };
    pendingByDraft.current[draftId] = buf;
    armTimer(draftId);
  }, [activeId, armTimer]);

  const scheduleGoalSave = useCallback((goalId: string, patch: Record<string, any>) => {
    if (!activeId) return;
    const draftId = activeId;
    const buf = pendingByDraft.current[draftId] || {};
    buf.goals = buf.goals || {};
    buf.goals[goalId] = { ...(buf.goals[goalId] || {}), ...patch };
    pendingByDraft.current[draftId] = buf;
    armTimer(draftId);
  }, [activeId, armTimer]);

  const scheduleServiceSave = useCallback((sId: string, patch: Record<string, any>) => {
    if (!activeId) return;
    const draftId = activeId;
    const buf = pendingByDraft.current[draftId] || {};
    buf.services = buf.services || {};
    buf.services[sId] = { ...(buf.services[sId] || {}), ...patch };
    pendingByDraft.current[draftId] = buf;
    armTimer(draftId);
  }, [activeId, armTimer]);

  // When the active draft changes, flush whatever was buffered for the old one
  // immediately so no edits are stranded behind a cancelled timer.
  const prevActiveId = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevActiveId.current;
    if (prev && prev !== activeId) void flushDraft(prev);
    prevActiveId.current = activeId;
  }, [activeId, flushDraft]);

  // On unmount, flush every outstanding draft buffer.
  useEffect(() => {
    return () => {
      for (const id of Object.keys(pendingByDraft.current)) void flushDraft(id);
    };
  }, [flushDraft]);

  const updateField = (field: keyof Profile, value: any) => {
    if (!bundle) return;
    setBundle({ ...bundle, profile: { ...bundle.profile, [field]: value } });
    scheduleSave({ [field]: value });
  };

  const savePresentLevel = useCallback(async (area: string, narrative: string) => {
    if (!activeId || !headers) return;
    setSaveState("saving");
    const r = await fetch(`/api/iep/drafts/${activeId}/present-levels/${area}`, {
      method: "PUT", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ narrative }),
    });
    if (r.ok) { setSaveState("saved"); lastSaved.current = Date.now(); }
    else setSaveState("error");
  }, [activeId, headers]);

  const addGoal = async () => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/goals`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ goalText: "" }),
    });
    if (r.ok && bundle) setBundle({ ...bundle, goals: [...bundle.goals, await r.json()] });
  };

  const updateGoal = (goalId: string, patch: Partial<Goal>) => {
    if (!bundle) return;
    setBundle({ ...bundle, goals: bundle.goals.map((g) => g.id === goalId ? { ...g, ...patch } : g) });
  };

  const persistGoal = async (goalId: string, patch: Partial<Goal>) => {
    if (!activeId || !headers) return;
    setSaveState("saving");
    const r = await fetch(`/api/iep/drafts/${activeId}/goals/${goalId}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) { setSaveState("saved"); lastSaved.current = Date.now(); }
    else setSaveState("error");
  };

  const deleteGoal = async (goalId: string) => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/goals/${goalId}`, { method: "DELETE", headers });
    if (r.ok && bundle) setBundle({ ...bundle, goals: bundle.goals.filter((g) => g.id !== goalId) });
  };

  // AI turns a short concern into a SMART goal. It fills any empty field —
  // including goalText — but never overwrites a non-empty teacher entry.
  const aiDraftGoal = async (goal: Goal) => {
    if (!headers) return;
    setDrafting(goal.id);
    try {
      const concern = goal.goalText?.trim()
        || goal.baseline?.trim()
        || `Draft a SMART annual IEP goal for ${goal.domain || "this learner"}`;
      const r = await fetch("/api/ai/draft-goal", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          concern,
          domain: goal.domain || "academic",
          grade_level: bundle?.profile.gradeLevel || undefined,
        }),
      });
      if (!r.ok) return;
      const ai = await r.json();
      // AI must NEVER overwrite teacher-entered values. Only fill blanks.
      const merged: Partial<Goal> = {};
      if (!goal.goalText?.trim() && ai.goal_text) merged.goalText = ai.goal_text;
      if (!goal.domain && ai.domain) merged.domain = ai.domain;
      if (!goal.baseline && ai.baseline) merged.baseline = ai.baseline;
      // SMART target / measurable criteria — combine if AI returns both.
      if (!goal.targetCriteria) {
        const target = [ai.target_criteria, ai.measurable_criteria]
          .filter((s) => s && String(s).trim())
          .join(" — ");
        if (target) merged.targetCriteria = target;
      }
      if (Object.keys(merged).length === 0) return;
      updateGoal(goal.id, merged);
      await persistGoal(goal.id, merged);
    } finally { setDrafting(null); }
  };

  const addService = async () => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/services`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ serviceType: "" }),
    });
    if (r.ok && bundle) setBundle({ ...bundle, services: [...bundle.services, await r.json()] });
  };

  const persistService = async (sId: string, patch: Partial<Service>) => {
    if (!activeId || !headers) return;
    setSaveState("saving");
    const r = await fetch(`/api/iep/drafts/${activeId}/services/${sId}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) { setSaveState("saved"); lastSaved.current = Date.now(); }
  };

  const updateService = (sId: string, patch: Partial<Service>) => {
    if (!bundle) return;
    setBundle({ ...bundle, services: bundle.services.map((s) => s.id === sId ? { ...s, ...patch } : s) });
  };

  const deleteService = async (sId: string) => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/services/${sId}`, { method: "DELETE", headers });
    if (r.ok && bundle) setBundle({ ...bundle, services: bundle.services.filter((s) => s.id !== sId) });
  };

  const transition = async (to: "in_review") => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/transition`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    if (r.ok) {
      const u = await r.json();
      setBundle((b) => b ? { ...b, profile: { ...b.profile, ...u } } : b);
      // Best-effort parent notification — never block on email failure.
      if (to === "in_review") {
        void fetch(`/api/iep/drafts/${activeId}/notify-in-review`, { method: "POST", headers });
      }
      refreshCollab(activeId);
    }
  };

  // Collab actions ---------------------------------------------------------
  const addTeamMember = async () => {
    if (!activeId || !headers || !newMember.userId.trim()) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/team`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(newMember),
    });
    if (r.ok) { setNewMember({ userId: "", role: newMember.role }); refreshCollab(activeId); }
  };
  const removeTeamMember = async (mid: string) => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/team/${mid}`, { method: "DELETE", headers });
    if (r.ok) refreshCollab(activeId);
  };
  const postComment = async () => {
    if (!activeId || !headers || !newComment.trim()) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/comments`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ section, body: newComment }),
    });
    if (r.ok) { setNewComment(""); refreshCollab(activeId); }
  };
  const toggleResolved = async (cid: string, resolved: boolean) => {
    if (!activeId || !headers) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/comments/${cid}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    });
    if (r.ok) refreshCollab(activeId);
  };
  const sign = async () => {
    if (!activeId || !headers || !signName.trim()) return;
    const r = await fetch(`/api/iep/drafts/${activeId}/signatures`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ typedName: signName }),
    });
    if (r.ok) {
      setSignName("");
      refreshCollab(activeId);
      loadBundle(activeId); // lifecycle may have flipped to finalised
    }
  };

  // Section comments rail (filters comments to current section).
  const sectionComments = useMemo(
    () => comments.filter((c) => c.section === section),
    [comments, section],
  );

  // Structural editing is only allowed while the draft is `draft`. Once the
  // case manager sends it for review, the bundle freezes — only comments and
  // signatures are accepted on the backend, so we mirror that on the client.
  const editable = bundle?.profile.lifecycleState === "draft";

  // Derived: which sections are missing required content (sidebar checklist).
  const missing = useMemo(() => {
    if (!bundle) return new Set<Section>();
    const m = new Set<Section>();
    const plopHas = (PLOP_AREAS as readonly string[]).every((a) =>
      (bundle.presentLevels.find((p) => p.area === a)?.narrative || "").trim().length > 0);
    if (!plopHas) m.add("plop");
    if (bundle.goals.length === 0) m.add("goals");
    if ((bundle.profile.accommodations || []).length === 0) m.add("accommodations");
    if (bundle.services.length === 0) m.add("services");
    if (!bundle.profile.placement) m.add("placement");
    if (!bundle.profile.reviewDate) m.add("review");
    return m;
  }, [bundle]);

  if (loading || !user) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-bold vi-text-muted hover:vi-text">
        <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" /> {t("back")}
      </button>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold vi-text">{t("title")}</h1>
          <p className="text-sm vi-text-muted mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {bundle && (
            <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold ${
              bundle.profile.lifecycleState === "in_review"
                ? "bg-[hsl(var(--visual-reading)/0.14)] text-[hsl(var(--visual-reading))]"
                : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
            }`}>{t(`status_${bundle.profile.lifecycleState}`)}</span>
          )}
          <button onClick={createDraft} disabled={creating}
            style={{ minHeight: 44 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm disabled:opacity-50">
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> {t("new_draft")}
          </button>
        </div>
      </header>

      {drafts.length === 0 ? (
        <div className="vi-card p-10 text-center">
          <p className="vi-text-muted font-semibold">{t("none_yet")}</p>
          <p className="vi-text-muted text-sm mt-2">{t("none_yet_help")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          <aside className="vi-card p-3 space-y-1 self-start">
            <p className="text-xs vi-text-muted font-bold uppercase tracking-wide px-2 py-1">{t("drafts")}</p>
            {drafts.map((d) => (
              <button key={d.id} onClick={() => setActiveId(d.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${
                  d.id === activeId ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "vi-text-muted hover:vi-surface-soft"
                }`}>
                <div>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}</div>
                <div className="text-[10px] uppercase tracking-wide vi-text-muted">{t(`status_${d.lifecycleState}`)}</div>
              </button>
            ))}
            <hr className="my-2 vi-border" />
            <p className="text-xs vi-text-muted font-bold uppercase tracking-wide px-2 py-1">{t("checklist")}</p>
            {SECTIONS.map((s) => (
              <div key={s} className="flex items-center gap-2 px-2 py-1 text-xs">
                {missing.has(s)
                  ? <AlertCircle size={14} className="text-[hsl(var(--visual-sel))]" aria-hidden="true" />
                  : <CheckCircle2 size={14} className="text-[hsl(var(--visual-science))]" aria-hidden="true" />}
                <span className="vi-text">{t(`section_${s}`)}</span>
              </div>
            ))}
          </aside>

          {bundle && (
            // Force a fresh subtree for each draft so any uncontrolled inputs
            // cannot retain values from a previously loaded draft.
            <section key={bundle.profile.id} className="space-y-4">
              {bundle.profile.fromEvaluationId && (
                <div
                  data-testid="seeded-from-evaluation"
                  className="vi-card p-3 flex flex-wrap items-center gap-3 bg-[hsl(var(--visual-reading)/0.08)] border-l-4 border-[hsl(var(--visual-reading))]">
                  <Link2 size={16} className="text-[hsl(var(--visual-reading))] shrink-0" aria-hidden="true" />
                  <p className="text-sm vi-text font-semibold flex-1 min-w-0">
                    {t("seeded_from_evaluation")}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/iep-evaluation/${learnerId}`)}
                    className="text-xs font-bold text-[hsl(var(--visual-reading))] underline">
                    {t("view_source_evaluation")}
                  </button>
                </div>
              )}
              <nav className="flex flex-wrap gap-1 border-b vi-border">
                {SECTIONS.map((s) => (
                  <button key={s} onClick={() => setSection(s)}
                    className={`px-3 py-2 text-sm font-bold rounded-t-lg ${
                      section === s
                        ? "bg-[hsl(var(--visual-surface))] border vi-border border-b-[hsl(var(--visual-surface))] -mb-[1px] text-[hsl(var(--visual-reading))]"
                        : "vi-text-muted hover:vi-text"
                    }`}>{t(`section_${s}`)}</button>
                ))}
                <span className="ml-auto inline-flex items-center gap-1 text-xs vi-text-muted px-3">
                  <Save size={12} aria-hidden="true" />
                  {saveState === "saving" ? t("saving") : saveState === "saved" ? t("saved") : saveState === "error" ? t("save_error") : ""}
                </span>
              </nav>

              {section === "plop" && (
                <div className="space-y-4">
                  {PLOP_AREAS.map((area) => {
                    const cur = bundle.presentLevels.find((p) => p.area === area);
                    return (
                      <div key={`${bundle.profile.id}-${area}`} className="vi-card p-4 space-y-2">
                        <label className="block text-sm font-bold vi-text">{t(`plop_${area}`)}</label>
                        <textarea
                          defaultValue={cur?.narrative || ""}
                          disabled={!editable}
                          onChange={(e) => schedulePlopSave(area, e.target.value)}
                          onBlur={(e) => savePresentLevel(area, e.target.value)}
                          rows={4}
                          className="w-full vi-input rounded-lg p-3 text-sm" />
                      </div>
                    );
                  })}
                </div>
              )}

              {section === "goals" && (
                <div className="space-y-4">
                  <button onClick={addGoal} disabled={!editable}
                    style={{ minHeight: 44 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full vi-surface-soft vi-text font-bold text-sm">
                    <Plus size={14} aria-hidden="true" /> {t("add_goal")}
                  </button>
                  {bundle.goals.map((goal) => (
                    <div key={goal.id} className="vi-card p-4 space-y-2">
                      <textarea value={goal.goalText} disabled={!editable}
                        onChange={(e) => { updateGoal(goal.id, { goalText: e.target.value }); scheduleGoalSave(goal.id, { goalText: e.target.value }); }}
                        onBlur={(e) => persistGoal(goal.id, { goalText: e.target.value })}
                        rows={2} placeholder={t("goal_text_placeholder")}
                        className="w-full vi-input rounded-lg p-3 text-sm font-semibold" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input value={goal.domain || ""} disabled={!editable}
                          onChange={(e) => { updateGoal(goal.id, { domain: e.target.value }); scheduleGoalSave(goal.id, { domain: e.target.value }); }}
                          onBlur={(e) => persistGoal(goal.id, { domain: e.target.value })}
                          placeholder={t("domain_placeholder")}
                          className="vi-input rounded-lg px-3 py-2 text-sm" />
                        <input value={goal.baseline || ""} disabled={!editable}
                          onChange={(e) => { updateGoal(goal.id, { baseline: e.target.value }); scheduleGoalSave(goal.id, { baseline: e.target.value }); }}
                          onBlur={(e) => persistGoal(goal.id, { baseline: e.target.value })}
                          placeholder={t("baseline_placeholder")}
                          className="vi-input rounded-lg px-3 py-2 text-sm" />
                        <input value={goal.targetCriteria || ""} disabled={!editable}
                          onChange={(e) => { updateGoal(goal.id, { targetCriteria: e.target.value }); scheduleGoalSave(goal.id, { targetCriteria: e.target.value }); }}
                          onBlur={(e) => persistGoal(goal.id, { targetCriteria: e.target.value })}
                          placeholder={t("target_placeholder")}
                          className="vi-input rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => aiDraftGoal(goal)} disabled={!editable || drafting === goal.id}
                          style={{ minHeight: 44 }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold text-xs disabled:opacity-50">
                          <Sparkles size={14} aria-hidden="true" />
                          {drafting === goal.id ? t("ai_drafting") : t("ai_draft_goal")}
                        </button>
                        <button onClick={() => deleteGoal(goal.id)} disabled={!editable}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-[hsl(var(--visual-math))] font-bold">
                          <Trash2 size={14} aria-hidden="true" /> {t("delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {section === "accommodations" && (
                <div className="vi-card p-4 space-y-2">
                  <label className="block text-sm font-bold vi-text">{t("accommodations_label")}</label>
                  <textarea
                    key={`acc-${bundle.profile.id}`}
                    defaultValue={(bundle.profile.accommodations || []).map((a: any) => typeof a === "string" ? a : a.description || JSON.stringify(a)).join("\n")}
                    disabled={!editable}
                    onBlur={(e) => {
                      const list = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((d) => ({ description: d }));
                      updateField("accommodations", list);
                    }}
                    rows={6}
                    placeholder={t("accommodations_placeholder")}
                    className="w-full vi-input rounded-lg p-3 text-sm" />
                </div>
              )}

              {section === "services" && (
                <div className="space-y-3">
                  <button onClick={addService} disabled={!editable}
                    style={{ minHeight: 44 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full vi-surface-soft vi-text font-bold text-sm">
                    <Plus size={14} aria-hidden="true" /> {t("add_service")}
                  </button>
                  {bundle.services.map((s) => (
                    <div key={s.id} className="vi-card p-4 grid grid-cols-1 md:grid-cols-6 gap-2">
                      <input value={s.serviceType} disabled={!editable}
                        onChange={(e) => { updateService(s.id, { serviceType: e.target.value }); scheduleServiceSave(s.id, { serviceType: e.target.value }); }}
                        onBlur={(e) => persistService(s.id, { serviceType: e.target.value })}
                        placeholder={t("service_type")}
                        className="vi-input rounded-lg px-3 py-2 text-sm md:col-span-2" />
                      <input value={s.providerRole || ""} disabled={!editable}
                        onChange={(e) => { updateService(s.id, { providerRole: e.target.value }); scheduleServiceSave(s.id, { providerRole: e.target.value }); }}
                        onBlur={(e) => persistService(s.id, { providerRole: e.target.value })}
                        placeholder={t("provider_role")}
                        className="vi-input rounded-lg px-3 py-2 text-sm" />
                      <input type="number" value={s.minutesPerWeek ?? ""} disabled={!editable}
                        onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; updateService(s.id, { minutesPerWeek: v }); scheduleServiceSave(s.id, { minutesPerWeek: v }); }}
                        onBlur={(e) => persistService(s.id, { minutesPerWeek: e.target.value ? Number(e.target.value) : null })}
                        placeholder={t("minutes_per_week")}
                        className="vi-input rounded-lg px-3 py-2 text-sm" />
                      <input value={s.frequency || ""} disabled={!editable}
                        onChange={(e) => { updateService(s.id, { frequency: e.target.value }); scheduleServiceSave(s.id, { frequency: e.target.value }); }}
                        onBlur={(e) => persistService(s.id, { frequency: e.target.value })}
                        placeholder={t("frequency")}
                        className="vi-input rounded-lg px-3 py-2 text-sm" />
                      <div className="flex items-center gap-2">
                        <input value={s.location || ""} disabled={!editable}
                          onChange={(e) => { updateService(s.id, { location: e.target.value }); scheduleServiceSave(s.id, { location: e.target.value }); }}
                          onBlur={(e) => persistService(s.id, { location: e.target.value })}
                          placeholder={t("location")}
                          className="vi-input rounded-lg px-3 py-2 text-sm flex-1" />
                        <button onClick={() => deleteService(s.id)} disabled={!editable}
                          className="text-[hsl(var(--visual-math))]" aria-label={t("delete")}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {section === "placement" && (
                <div className="vi-card p-4 space-y-2">
                  <label className="block text-sm font-bold vi-text">{t("placement_label")}</label>
                  <input value={bundle.profile.placement || ""} disabled={!editable}
                    onChange={(e) => updateField("placement", e.target.value)}
                    placeholder={t("placement_placeholder")}
                    className="w-full vi-input rounded-lg px-3 py-2 text-sm" />
                  <p className="text-xs vi-text-muted">{t("placement_help")}</p>
                </div>
              )}

              {section === "review" && (
                <div className="vi-card p-4 space-y-2">
                  <label className="block text-sm font-bold vi-text">{t("review_date_label")}</label>
                  <input type="date" disabled={!editable}
                    value={bundle.profile.reviewDate ? new Date(bundle.profile.reviewDate).toISOString().split("T")[0] : ""}
                    onChange={(e) => updateField("reviewDate", e.target.value)}
                    className="vi-input rounded-lg px-3 py-2 text-sm" />
                </div>
              )}

              {section === "team" && (
                <div className="space-y-3">
                  <div className="vi-card p-4 space-y-3">
                    <div className="flex items-center gap-2 vi-text font-bold text-sm">
                      <Users size={16} aria-hidden="true" /> {tc("team_title")}
                    </div>
                    <p className="text-xs vi-text-muted">{tc("team_help")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
                      <input
                        value={newMember.userId}
                        onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}
                        placeholder={tc("team_user_id_placeholder")}
                        className="vi-input rounded-lg px-3 py-2 text-sm" />
                      <select
                        value={newMember.role}
                        onChange={(e) => setNewMember({ ...newMember, role: e.target.value as typeof TEAM_ROLES[number] })}
                        className="vi-input rounded-lg px-3 py-2 text-sm">
                        {TEAM_ROLES.map((r) => (
                          <option key={r} value={r}>{tc(`role_${r}`)}</option>
                        ))}
                      </select>
                      <button onClick={addTeamMember}
                        style={{ minHeight: 44 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm">
                        <Plus size={14} aria-hidden="true" /> {tc("add_member")}
                      </button>
                    </div>
                  </div>
                  <div className="vi-card divide-y vi-border">
                    {team.length === 0 ? (
                      <p className="p-4 text-sm vi-text-muted">{tc("team_empty")}</p>
                    ) : team.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold vi-text truncate">{m.name || m.email || m.userId}</div>
                          <div className="text-xs vi-text-muted">{tc(`role_${m.role}`)}</div>
                        </div>
                        <button onClick={() => removeTeamMember(m.id)}
                          aria-label={tc("remove_member")}
                          className="text-[hsl(var(--visual-math))]">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {section === "signatures" && (
                <div className="space-y-3">
                  <div className="vi-card p-4 space-y-3">
                    <div className="flex items-center gap-2 vi-text font-bold text-sm">
                      <PenTool size={16} aria-hidden="true" /> {tc("signatures_title")}
                    </div>
                    {sigStatus && (
                      <>
                        <p className="text-xs vi-text-muted">
                          {tc("required_roles")}: {sigStatus.required.map((r) => tc(`role_${r}`)).join(", ")}
                        </p>
                        {sigStatus.missingRoles.length > 0 ? (
                          <p className="text-xs font-bold text-[hsl(var(--visual-sel))]">
                            {tc("awaiting")}: {sigStatus.missingRoles.map((r) => tc(`role_${r}`)).join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-[hsl(var(--visual-science))]">
                            {tc("all_signed")}
                          </p>
                        )}
                      </>
                    )}
                    {bundle.profile.lifecycleState === "in_review" && (
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 pt-2 border-t vi-border">
                        <input
                          value={signName}
                          onChange={(e) => setSignName(e.target.value)}
                          placeholder={tc("typed_name_placeholder")}
                          className="vi-input rounded-lg px-3 py-2 text-sm" />
                        <button onClick={sign} disabled={!signName.trim()}
                          style={{ minHeight: 44 }}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm disabled:opacity-50">
                          <PenTool size={14} aria-hidden="true" /> {tc("sign_button")}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="vi-card divide-y vi-border">
                    {(sigStatus?.signatures || []).length === 0 ? (
                      <p className="p-4 text-sm vi-text-muted">{tc("no_signatures_yet")}</p>
                    ) : sigStatus!.signatures.map((s) => (
                      <div key={s.id} className="p-3 flex items-center gap-3">
                        <Check size={16} className="text-[hsl(var(--visual-science))]" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold vi-text">{s.typedName}</div>
                          <div className="text-xs vi-text-muted">
                            {tc(`role_${s.signerRole}`)} · {new Date(s.signedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {section === "updates" && (
                <UpdatesSection
                  draftId={bundle.profile.id}
                  goals={bundle.goals}
                  headers={headers}
                  isCaseManager={(team.find((m) => m.userId === user?.id)?.role === "case_manager")}
                  isFinalised={bundle.profile.lifecycleState === "finalised"}
                />
              )}

              {section === "history" && (
                <div className="vi-card divide-y vi-border">
                  <div className="p-3 flex items-center gap-2 vi-text font-bold text-sm">
                    <History size={16} aria-hidden="true" /> {tc("history_title")}
                  </div>
                  {revisions.length === 0 ? (
                    <p className="p-4 text-sm vi-text-muted">{tc("history_empty")}</p>
                  ) : revisions.map((r) => (
                    <div key={r.id} className="p-3">
                      <div className="text-sm font-bold vi-text">
                        {t(`section_${r.section}`)} · {r.authorName || r.authorId.slice(0, 8)}
                      </div>
                      <div className="text-xs vi-text-muted">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-section comments rail (hidden on the meta tabs). */}
              {(["plop", "goals", "accommodations", "services", "placement", "review"] as Section[]).includes(section) && (
                <div className="vi-card p-4 space-y-3">
                  <div className="flex items-center gap-2 vi-text font-bold text-sm">
                    <MessageCircle size={16} aria-hidden="true" /> {tc("comments_title")}
                    <span className="ml-auto text-xs vi-text-muted">{sectionComments.length}</span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {sectionComments.length === 0 ? (
                      <p className="text-xs vi-text-muted">{tc("comments_empty")}</p>
                    ) : sectionComments.map((c) => (
                      <div key={c.id} className={`p-3 rounded-lg border vi-border ${c.resolvedAt ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-2 text-xs vi-text-muted">
                          <span className="font-bold vi-text">{c.authorName || c.authorId.slice(0, 8)}</span>
                          <span>·</span>
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                          <button onClick={() => toggleResolved(c.id, !c.resolvedAt)}
                            aria-label={c.resolvedAt ? tc("reopen") : tc("resolve")}
                            className="ml-auto text-[hsl(var(--visual-reading))] font-bold inline-flex items-center gap-1">
                            {c.resolvedAt ? <X size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
                            {c.resolvedAt ? tc("reopen") : tc("resolve")}
                          </button>
                        </div>
                        <p className="text-sm vi-text mt-1 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 pt-2 border-t vi-border">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={tc("comment_placeholder")}
                      rows={2}
                      className="vi-input rounded-lg px-3 py-2 text-sm" />
                    <button onClick={postComment} disabled={!newComment.trim()}
                      style={{ minHeight: 44 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm disabled:opacity-50 self-end">
                      <Send size={14} aria-hidden="true" /> {tc("post_comment")}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                {bundle.profile.lifecycleState === "draft" && (
                  <button onClick={() => transition("in_review")}
                    style={{ minHeight: 44 }}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm">
                    <Send size={14} aria-hidden="true" /> {t("send_for_review")}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// Inline composer + lists for progress notes, quarterly reports, and
// amendments. Lives on the teacher draft page so the case manager can
// author updates in the same surface they used to draft the IEP.
function UpdatesSection({ draftId, goals, headers, isCaseManager, isFinalised }: {
  draftId: string;
  goals: { id: string; goalText: string; domain?: string | null }[];
  headers: { Authorization: string } | undefined;
  isCaseManager: boolean;
  isFinalised: boolean;
}) {
  const tu = useTranslations("iep_updates");
  type Note = { id: string; body: string; goalId: string | null; visibility: string; authorName: string | null; createdAt: string };
  type Report = { id: string; period: string; narrative: string | null; status: string; sentAt: string | null; createdAt: string };
  type Amendment = { id: string; summary: string; status: string; proposedChanges: any; acknowledgedAt: string | null; revisionCounter: number; createdAt: string };
  const [notes, setNotes] = useState<Note[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [noteGoalId, setNoteGoalId] = useState<string>("");
  const [noteVisibility, setNoteVisibility] = useState<"parent" | "team" | "internal">("parent");
  const [noteAttachment, setNoteAttachment] = useState("");
  const [posting, setPosting] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("");
  const [reportNarrative, setReportNarrative] = useState("");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportText, setEditingReportText] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [seedingReport, setSeedingReport] = useState(false);
  const [amendSummary, setAmendSummary] = useState("");
  const [amendChanges, setAmendChanges] = useState("");
  const [creatingAmend, setCreatingAmend] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!headers) return;
    const [n, r, a] = await Promise.all([
      fetch(`/api/iep/drafts/${draftId}/notes`, { headers }).then((x) => x.ok ? x.json() : []),
      fetch(`/api/iep/drafts/${draftId}/reports`, { headers }).then((x) => x.ok ? x.json() : []),
      fetch(`/api/iep/drafts/${draftId}/amendments`, { headers }).then((x) => x.ok ? x.json() : []),
    ]);
    setNotes(Array.isArray(n) ? n : []);
    setReports(Array.isArray(r) ? r : []);
    setAmendments(Array.isArray(a) ? a : []);
  }, [draftId, headers]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const postNote = async () => {
    if (!headers || !noteBody.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/iep/drafts/${draftId}/notes`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          body: noteBody.trim(),
          goalId: noteGoalId || undefined,
          visibility: noteVisibility,
          attachmentUrl: noteAttachment.trim() || undefined,
        }),
      });
      if (r.ok) { setNoteBody(""); setNoteGoalId(""); setNoteAttachment(""); await refreshAll(); }
    } catch { /* noop */ }
    setPosting(false);
  };

  const seedReport = async () => {
    if (!headers) return;
    setSeedingReport(true);
    try {
      const r = await fetch(`/api/iep/drafts/${draftId}/reports/seed`, { headers });
      if (r.ok) {
        const j = await r.json();
        if (j.narrative) setReportNarrative(j.narrative);
      }
    } catch { /* noop */ }
    setSeedingReport(false);
  };

  const createReport = async () => {
    if (!headers || !reportPeriod.trim()) return;
    setCreatingReport(true);
    try {
      const r = await fetch(`/api/iep/drafts/${draftId}/reports`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ period: reportPeriod.trim(), narrative: reportNarrative }),
      });
      if (r.ok) { setReportPeriod(""); setReportNarrative(""); await refreshAll(); }
    } catch { /* noop */ }
    setCreatingReport(false);
  };

  const sendReport = async (rid: string) => {
    if (!headers) return;
    await fetch(`/api/iep/drafts/${draftId}/reports/${rid}/send`, {
      method: "POST", headers,
    });
    await refreshAll();
  };

  const createAmendment = async () => {
    if (!headers || !amendSummary.trim()) return;
    setCreatingAmend(true);
    let parsed: any = {};
    if (amendChanges.trim()) {
      try { parsed = JSON.parse(amendChanges); } catch { parsed = { notes: amendChanges }; }
    }
    try {
      const r = await fetch(`/api/iep/drafts/${draftId}/amendments`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: amendSummary.trim(), proposedChanges: parsed }),
      });
      if (r.ok) { setAmendSummary(""); setAmendChanges(""); await refreshAll(); }
    } catch { /* noop */ }
    setCreatingAmend(false);
  };

  return (
    <div className="space-y-6">
      {/* PROGRESS NOTES */}
      <div className="vi-card p-4 space-y-3">
        <div className="font-bold text-sm vi-text">{tu("notes_title")}</div>
        <p className="text-xs vi-text-muted">{tu("notes_help")}</p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <textarea
            value={noteBody} onChange={(e) => setNoteBody(e.target.value)}
            placeholder={tu("note_placeholder")} rows={2}
            className="vi-input rounded-lg px-3 py-2 text-sm" />
          <select value={noteGoalId} onChange={(e) => setNoteGoalId(e.target.value)}
            className="vi-input rounded-lg px-2 py-2 text-sm">
            <option value="">{tu("goal_any")}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.domain || ""}: {g.goalText.slice(0, 40)}</option>
            ))}
          </select>
          <select value={noteVisibility}
            onChange={(e) => setNoteVisibility(e.target.value as "parent" | "team" | "internal")}
            className="vi-input rounded-lg px-2 py-2 text-sm">
            <option value="parent">{tu("vis_parent")}</option>
            <option value="team">{tu("vis_team")}</option>
            <option value="internal">{tu("vis_internal")}</option>
          </select>
        </div>
        <input
          value={noteAttachment}
          onChange={(e) => setNoteAttachment(e.target.value)}
          placeholder={tu("attachment_placeholder")}
          type="url"
          className="vi-input rounded-lg px-3 py-2 text-sm w-full" />
        <div className="flex justify-end">
          <button onClick={postNote} disabled={posting || !noteBody.trim()}
            style={{ minHeight: 40 }}
            className="px-4 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-xs disabled:opacity-50">
            {posting ? tu("posting") : tu("post_note")}
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto pt-2 border-t vi-border">
          {notes.length === 0 ? (
            <p className="text-xs vi-text-muted">{tu("no_notes")}</p>
          ) : notes.map((n) => (
            <div key={n.id} className="p-3 rounded-lg border vi-border">
              <div className="flex items-center gap-2 text-xs vi-text-muted">
                <span className="font-bold vi-text">{n.authorName || ""}</span>
                <span>·</span>
                <span>{new Date(n.createdAt).toLocaleString()}</span>
                <span className="ml-auto px-2 py-0.5 rounded-full vi-surface-soft text-[10px] uppercase font-bold">
                  {tu(`vis_${n.visibility}`)}
                </span>
              </div>
              <p className="text-sm vi-text mt-1 whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* QUARTERLY REPORTS */}
      {isCaseManager && (
        <div className="vi-card p-4 space-y-3">
          <div className="font-bold text-sm vi-text">{tu("reports_title")}</div>
          <p className="text-xs vi-text-muted">{tu("reports_help")}</p>
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2">
            <input value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)}
              placeholder={tu("period_placeholder")}
              className="vi-input rounded-lg px-3 py-2 text-sm" />
            <textarea value={reportNarrative} onChange={(e) => setReportNarrative(e.target.value)}
              placeholder={tu("narrative_placeholder")} rows={4}
              className="vi-input rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={seedReport} disabled={seedingReport} style={{ minHeight: 40 }}
              className="px-3 py-2 rounded-full vi-surface-soft text-xs font-bold disabled:opacity-50">
              {seedingReport ? tu("seeding") : tu("ai_seed")}
            </button>
            <button onClick={createReport} disabled={creatingReport || !reportPeriod.trim()}
              style={{ minHeight: 40 }}
              className="px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white text-xs font-bold disabled:opacity-50">
              {creatingReport ? tu("saving") : tu("save_draft_report")}
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pt-2 border-t vi-border">
            {reports.length === 0 ? (
              <p className="text-xs vi-text-muted">{tu("no_reports")}</p>
            ) : reports.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border vi-border">
                <div className="flex items-center gap-2 text-xs vi-text-muted">
                  <span className="font-bold vi-text">{r.period}</span>
                  <span>·</span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                    r.status === "sent"
                      ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                      : "vi-surface-soft"
                  }`}>{tu(`status_${r.status}`)}</span>
                </div>
                {editingReportId === r.id ? (
                  <textarea value={editingReportText}
                    onChange={(e) => setEditingReportText(e.target.value)}
                    className="vi-input rounded-lg px-3 py-2 text-sm w-full min-h-[120px] mt-2" />
                ) : r.narrative && (
                  <p className="text-sm vi-text mt-1 whitespace-pre-wrap line-clamp-4">{r.narrative}</p>
                )}
                {r.status === "draft" && (
                  <div className="flex justify-end gap-2 mt-2">
                    {editingReportId === r.id ? (
                      <>
                        <button onClick={() => { setEditingReportId(null); setEditingReportText(""); }}
                          style={{ minHeight: 36 }}
                          className="px-3 py-1.5 rounded-full vi-surface-soft text-xs font-bold">
                          {tu("cancel") || "Cancel"}
                        </button>
                        <button disabled={savingReport}
                          onClick={async () => {
                            if (!headers) return;
                            setSavingReport(true);
                            try {
                              const resp = await fetch(`/api/iep/drafts/${draftId}/reports/${r.id}`, {
                                method: "PATCH",
                                headers: { ...headers, "Content-Type": "application/json" },
                                body: JSON.stringify({ narrative: editingReportText }),
                              });
                              if (resp.ok) { setEditingReportId(null); setEditingReportText(""); await refreshAll(); }
                            } catch { /* noop */ }
                            setSavingReport(false);
                          }}
                          style={{ minHeight: 36 }}
                          className="px-3 py-1.5 rounded-full bg-[hsl(var(--visual-primary))] text-white text-xs font-bold disabled:opacity-50">
                          {savingReport ? tu("saving") || "Saving…" : tu("save") || "Save"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingReportId(r.id); setEditingReportText(r.narrative || ""); }}
                          style={{ minHeight: 36 }}
                          className="px-3 py-1.5 rounded-full vi-surface-soft text-xs font-bold">
                          {tu("edit") || "Edit"}
                        </button>
                        <button onClick={() => sendReport(r.id)} style={{ minHeight: 36 }}
                          className="px-3 py-1.5 rounded-full bg-[hsl(var(--visual-primary))] text-white text-xs font-bold">
                          {tu("send_to_parent")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AMENDMENTS — only on finalised IEPs and only the case manager. */}
      {isCaseManager && isFinalised && (
        <div className="vi-card p-4 space-y-3">
          <div className="font-bold text-sm vi-text">{tu("amendments_title")}</div>
          <p className="text-xs vi-text-muted">{tu("amendments_help")}</p>
          <input value={amendSummary} onChange={(e) => setAmendSummary(e.target.value)}
            placeholder={tu("amendment_summary_placeholder")}
            className="vi-input rounded-lg px-3 py-2 text-sm w-full" />
          <textarea value={amendChanges} onChange={(e) => setAmendChanges(e.target.value)}
            placeholder={tu("amendment_changes_placeholder")} rows={4}
            className="vi-input rounded-lg px-3 py-2 text-sm w-full font-mono" />
          <div className="flex justify-end">
            <button onClick={createAmendment} disabled={creatingAmend || !amendSummary.trim()}
              style={{ minHeight: 40 }}
              className="px-4 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white text-xs font-bold disabled:opacity-50">
              {creatingAmend ? tu("posting") : tu("propose_amendment")}
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pt-2 border-t vi-border">
            {amendments.length === 0 ? (
              <p className="text-xs vi-text-muted">{tu("no_amendments")}</p>
            ) : amendments.map((a) => (
              <div key={a.id} className="p-3 rounded-lg border vi-border">
                <div className="flex items-center gap-2 text-xs vi-text-muted">
                  <span>{new Date(a.createdAt).toLocaleString()}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                    a.status === "acknowledged"
                      ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                      : a.status === "objected"
                        ? "bg-[hsl(var(--visual-math)/0.14)] text-[hsl(var(--visual-math))]"
                        : "bg-[hsl(var(--visual-reading)/0.14)] text-[hsl(var(--visual-reading))]"
                  }`}>{tu(`amendment_status_${a.status}`)}</span>
                </div>
                <p className="text-sm font-bold vi-text mt-1">{a.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
