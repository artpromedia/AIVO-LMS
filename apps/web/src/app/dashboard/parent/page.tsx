"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/providers/i18n-provider";
import Image from "next/image";
import { TUTORS } from "@aivo/brand";
import { WelcomeHero } from "./components/WelcomeHero";
import { LearnerSummaryCard } from "./components/LearnerSummaryCard";
import { QuickActions } from "./components/QuickActions";
import { WhileYouWereAway } from "./components/WhileYouWereAway";
import { WhatsWorkingPanel } from "./components/WhatsWorkingPanel";
import { StatIconWell } from "@/components/discovery/_vi";
import {
  Users,
  Plus,
  CheckCircle2,
  Sparkles,
  MapPin,
  Languages,
  Loader2,
  AlertCircle,
  Store,
  GraduationCap,
} from "lucide-react";

interface Learner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
  curriculumFramework?: string;
}

interface CurriculumInfo {
  country: string;
  state?: string;
  districtId?: string;
  districtName?: string;
  curriculumFramework: string;
  standards: string;
}

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA_INT", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "IE", label: "Ireland" },
  { code: "SG", label: "Singapore" },
  { code: "IN", label: "India" },
  { code: "AE", label: "UAE" },
  { code: "ZA", label: "South Africa" },
  { code: "PH", label: "Philippines" },
  { code: "KE", label: "Kenya" },
  { code: "NG", label: "Nigeria" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
];

const LEARNING_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

export default function ParentDashboard() {
  const { user, accessToken, loading, refreshToken } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const { locale: currentLocale } = useLocale();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLearner, setNewLearner] = useState({
    name: "", gradeLevel: "", pin: "", dateOfBirth: "", zipCode: "", country: "US", region: "", preferredLanguage: "en",
  });
  const [curriculumInfo, setCurriculumInfo] = useState<CurriculumInfo | null>(null);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Record<string, boolean>>({});
  const [hasBrain, setHasBrain] = useState<Record<string, boolean>>({});
  const [baselineCompleted, setBaselineCompleted] = useState<Record<string, boolean>>({});
  const [familySummary, setFamilySummary] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    setNewLearner((prev) => ({ ...prev, preferredLanguage: currentLocale }));
  }, [currentLocale]);

  useEffect(() => {
    if (!accessToken || !user) return;

    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list: Learner[] = Array.isArray(data) ? data : [];
        setLearners(list);
        list.forEach((l) => {
          fetch(`/api/brain/${l.id}/review`, { headers: { Authorization: `Bearer ${accessToken}` } })
            .then((r) => r.ok ? r.json() : null)
            .then((brain) => {
              if (brain) {
                setHasBrain((prev) => ({ ...prev, [l.id]: true }));
                if (brain.approval_status === "pending_parent_review") {
                  setPendingReviews((prev) => ({ ...prev, [l.id]: true }));
                }
              }
            })
            .catch(() => {});
          fetch(`/api/assessments/learner/discovery/${l.id}/status`, { headers: { Authorization: `Bearer ${accessToken}` } })
            .then((r) => r.ok ? r.json() : null)
            .then((status) => {
              if (status?.baselineCompleted) setBaselineCompleted((prev) => ({ ...prev, [l.id]: true }));
            })
            .catch(() => {});
        });
      })
      .catch(() => {});

    fetch(`/api/family/summary/${user.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFamilySummary(data); })
      .catch(() => {});

    fetch(`/api/family/activity-feed/${user.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { activities: [] })
      .then(data => setActivities(data.activities || []))
      .catch(() => {});

    fetch(`/api/family/inbox/${user.id}?filter=unread&limit=1`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { unreadCount: 0 })
      .then(data => setUnreadCount(data.unreadCount || 0))
      .catch(() => {});
  }, [accessToken, user]);

  const lookupCurriculum = useCallback(async (zipCode: string, country: string) => {
    if (!zipCode && country === "US") return;
    setCurriculumLoading(true);
    try {
      const params = new URLSearchParams();
      if (zipCode) params.set("zipCode", zipCode);
      if (country) params.set("country", country);
      const res = await fetch(`/api/curriculum/lookup?${params}`);
      if (res.ok) setCurriculumInfo(await res.json());
    } catch { setCurriculumInfo(null); }
    setCurriculumLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newLearner.zipCode.length >= 3 || newLearner.country !== "US") {
        lookupCurriculum(newLearner.zipCode, newLearner.country);
      } else { setCurriculumInfo(null); }
    }, 400);
    return () => clearTimeout(timer);
  }, [newLearner.zipCode, newLearner.country, lookupCurriculum]);

  const addLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setSubmitError("You are not authenticated. Please refresh and try again.");
      return;
    }

    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    try {
      const createLearner = (token: string) => fetch("/api/users/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newLearner),
      });

      let res = await createLearner(accessToken);

      // Access tokens are short-lived. Attempt one silent refresh + retry on 401.
      if (res.status === 401) {
        const freshToken = await refreshToken();
        if (freshToken) {
          res = await createLearner(freshToken);
        }
      }

      if (!res.ok) {
        let message = "Unable to add learner. Please try again.";
        try {
          const err = await res.json();
          if (err?.error) message = String(err.error);
        } catch {}

        if (res.status === 401) {
          message = "Your session expired. Please sign in again and retry.";
        }

        setSubmitError(message);
        return;
      }

      const data = await res.json();
      const createdLearner = data?.learner;
      if (!createdLearner?.id) {
        setSubmitError("Learner was created, but navigation data is missing.");
        return;
      }

      setLearners((prev) => [...prev, createdLearner]);
      setShowAddForm(false);
      setNewLearner({ name: "", gradeLevel: "", pin: "", dateOfBirth: "", zipCode: "", country: "US", region: "", preferredLanguage: currentLocale });
      setCurriculumInfo(null);
      setSubmitSuccess("Learner added successfully. Opening profile...");
      setTimeout(() => {
        router.push(`/dashboard/parent/learner/${createdLearner.id}`);
      }, 700);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  const getLearnerSummary = (learnerId: string) => {
    if (!familySummary?.learners) return {};
    const ls = familySummary.learners.find((l: any) => l.id === learnerId);
    return ls || {};
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
      <WelcomeHero
        userName={user.name}
        unreadCount={unreadCount}
        lastVisit={familySummary?.parent?.lastDashboardVisit || null}
      />

      <WhileYouWereAway
        activities={activities}
        lastVisit={familySummary?.parent?.lastDashboardVisit || null}
      />

      <QuickActions
        learners={learners}
        pendingReviews={pendingReviews}
        hasBrain={hasBrain}
        baselineCompleted={baselineCompleted}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatIconWell color="primary" className="shadow-sm">
            <Users size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <h2 className="text-2xl font-heading font-bold vi-text">Your Children</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[hsl(var(--visual-primary))] text-white font-heading font-black text-sm uppercase tracking-wider hover:bg-[hsl(var(--visual-primary)/0.9)] transition shadow-lg"
          style={{ minHeight: 44 }}
        >
          <Plus size={18} strokeWidth={3} aria-hidden="true" />
          Add a Child
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={addLearner}
          className="vi-card p-6 lg:p-8 space-y-6"
        >
          <div className="flex items-center gap-3">
            <StatIconWell color="primary" className="shadow-sm">
              <Sparkles size={22} strokeWidth={2.5} aria-hidden="true" />
            </StatIconWell>
            <h3 className="font-heading font-bold text-xl vi-text">{t("onboarding.add_learner_title")}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="learner-name" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.learner_name")}</label>
              <input id="learner-name" type="text" value={newLearner.name} onChange={(e) => setNewLearner({...newLearner, name: e.target.value})} required
                className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body" />
            </div>
            <div>
              <label htmlFor="learner-grade" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.grade_level")}</label>
              <input id="learner-grade" type="text" value={newLearner.gradeLevel} onChange={(e) => setNewLearner({...newLearner, gradeLevel: e.target.value})}
                className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body" placeholder={t("onboarding.grade_level_placeholder")} />
            </div>
            <div>
              <label htmlFor="learner-pin" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.pin")}</label>
              <input id="learner-pin" type="text" value={newLearner.pin} onChange={(e) => setNewLearner({...newLearner, pin: e.target.value})} maxLength={6}
                className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body" placeholder={t("onboarding.pin_placeholder")} />
            </div>
            <div>
              <label htmlFor="learner-dob" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.date_of_birth")}</label>
              <input id="learner-dob" type="date" value={newLearner.dateOfBirth} onChange={(e) => setNewLearner({...newLearner, dateOfBirth: e.target.value})}
                className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body" />
            </div>
          </div>

          <div className="border-t-2 vi-border pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={18} strokeWidth={2.5} className="text-[hsl(var(--visual-primary))]" aria-hidden="true" />
              <h4 className="font-heading font-bold text-lg vi-text">{t("onboarding.location")}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="learner-country" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.country")}</label>
                <select id="learner-country" value={newLearner.country} onChange={(e) => setNewLearner({...newLearner, country: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              {newLearner.country === "US" ? (
                <div>
                  <label htmlFor="learner-zip" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.zip_code")}</label>
                  <input id="learner-zip" type="text" value={newLearner.zipCode} onChange={(e) => setNewLearner({...newLearner, zipCode: e.target.value})}
                    maxLength={5} placeholder={t("onboarding.zip_placeholder")}
                    className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body" />
                </div>
              ) : (
                <div>
                  <label htmlFor="learner-region" className="block text-sm font-bold text-slate-800 mb-2">{t("onboarding.region")}</label>
                  <input id="learner-region" type="text" value={newLearner.region} onChange={(e) => setNewLearner({...newLearner, region: e.target.value})}
                    placeholder={t("onboarding.region_placeholder")}
                    className="w-full px-4 py-3 rounded-2xl border-2 vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition font-body" />
                </div>
              )}
              <div className="flex items-end">
                {curriculumLoading && (
                  <div className="inline-flex items-center gap-2 px-4 py-3 text-sm vi-text-muted font-bold">
                    <Loader2 size={16} strokeWidth={2.5} className="motion-safe:animate-spin" aria-hidden="true" />
                    {t("common.loading")}
                  </div>
                )}
              </div>
            </div>
            {curriculumInfo && (
              <div className="mt-4 p-5 rounded-2xl bg-[hsl(var(--visual-science)/0.08)] border-2 border-[hsl(var(--visual-science)/0.3)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 rounded-xl bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-science))] flex items-center justify-center shadow-sm">
                    <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className="font-heading font-bold text-[hsl(var(--visual-science))]">Curriculum Detected</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><span className="font-bold text-[hsl(var(--visual-science))]">Framework:</span> <span className="text-slate-800">{curriculumInfo.curriculumFramework}</span></div>
                  <div><span className="font-bold text-[hsl(var(--visual-science))]">Standards:</span> <span className="text-slate-800">{curriculumInfo.standards}</span></div>
                  {curriculumInfo.state && <div><span className="font-bold text-[hsl(var(--visual-science))]">State:</span> <span className="text-slate-800">{curriculumInfo.state}</span></div>}
                  {curriculumInfo.districtName && <div><span className="font-bold text-[hsl(var(--visual-science))]">District:</span> <span className="text-slate-800">{curriculumInfo.districtName}</span></div>}
                </div>
              </div>
            )}
          </div>

          <div className="border-t-2 vi-border pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Languages size={18} strokeWidth={2.5} className="text-[hsl(var(--visual-primary))]" aria-hidden="true" />
              <h4 className="font-heading font-bold text-lg vi-text">{t("onboarding.preferred_language")}</h4>
            </div>
            <p className="text-sm vi-text-muted mb-4 font-body">{t("onboarding.language_description")}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {LEARNING_LANGUAGES.map((lang) => (
                <button key={lang.code} type="button" onClick={() => setNewLearner({...newLearner, preferredLanguage: lang.code})}
                  className={`px-4 py-3 rounded-2xl border-2 text-sm font-bold transition text-left ${
                    newLearner.preferredLanguage === lang.code
                      ? "border-[hsl(var(--visual-primary))] bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] shadow-md"
                      : "vi-border bg-[hsl(var(--visual-surface))] vi-text hover:border-[hsl(var(--visual-primary)/0.4)]"
                  }`}>
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-heading font-black text-base uppercase tracking-wider transition shadow-lg text-white ${
              submitting ? "bg-[hsl(var(--visual-primary)/0.6)] cursor-not-allowed" : "bg-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary)/0.9)] active:scale-[0.97]"
            }`}
            style={{ minHeight: 48 }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} strokeWidth={2.5} className="motion-safe:animate-spin" aria-hidden="true" />
                {t("common.saving")}
              </>
            ) : (
              t("common.submit")
            )}
          </button>

          {submitError && (
            <div role="alert" aria-live="assertive" className="flex items-start gap-3 p-4 rounded-2xl bg-[hsl(var(--visual-math)/0.08)] border-2 border-[hsl(var(--visual-math)/0.3)] text-[hsl(var(--visual-math))] text-sm font-bold">
              <span className="w-8 h-8 rounded-xl bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-math))] flex items-center justify-center shrink-0 shadow-sm">
                <AlertCircle size={18} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="pt-1">{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div role="status" aria-live="polite" className="flex items-start gap-3 p-4 rounded-2xl bg-[hsl(var(--visual-science)/0.08)] border-2 border-[hsl(var(--visual-science)/0.3)] text-[hsl(var(--visual-science))] text-sm font-bold">
              <span className="w-8 h-8 rounded-xl bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-science))] flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="pt-1">{submitSuccess}</span>
            </div>
          )}
        </form>
      )}

      {learners.length === 0 && !showAddForm ? (
        <div className="vi-card p-12 lg:p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center shadow-sm">
            <Sparkles size={40} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <h3 className="text-2xl font-heading font-bold vi-text mb-2">Welcome to AIVO!</h3>
          <p className="vi-text-muted font-body mb-6">Add your first child to get started with personalized learning.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[hsl(var(--visual-primary))] text-white font-heading font-black text-sm uppercase tracking-wider hover:bg-[hsl(var(--visual-primary)/0.9)] transition shadow-lg"
            style={{ minHeight: 48 }}
          >
            <Plus size={18} strokeWidth={3} aria-hidden="true" />
            Add Your First Child
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {learners.map((l) => {
            const summary = getLearnerSummary(l.id);
            return (
              <LearnerSummaryCard
                key={l.id}
                learner={l}
                streak={summary.streak}
                badgeCount={summary.badgeCount}
                hasBrain={!!hasBrain[l.id]}
                pendingReview={!!pendingReviews[l.id]}
                baselineCompleted={!!baselineCompleted[l.id]}
                accessToken={accessToken}
              />
            );
          })}
        </div>
      )}

      {/* Patterns parents can take to an IEP meeting — DB-backed,
          no synthetic data. One panel per learner. */}
      {learners.length > 0 && accessToken && (
        <div className="space-y-3">
          {learners.map((l) => (
            <WhatsWorkingPanel
              key={`ww-${l.id}`}
              learnerId={l.id}
              learnerName={l.name ?? "your learner"}
              accessToken={accessToken}
            />
          ))}
        </div>
      )}

      <div className="vi-card p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <StatIconWell color="sel" className="shadow-sm">
              <GraduationCap size={22} strokeWidth={2.5} aria-hidden="true" />
            </StatIconWell>
            <div>
              <h2 className="text-xl font-heading font-bold vi-text">{t("tutor.meet_tutors")}</h2>
              <p className="text-xs vi-text-muted font-body font-semibold">7 core tutors + 7 expansion specialists</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/parent/store")}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-2xl bg-[hsl(var(--visual-primary))] text-white font-heading font-black uppercase tracking-wider hover:bg-[hsl(var(--visual-primary)/0.9)] transition shadow-md"
            style={{ minHeight: 44 }}
          >
            <Store size={16} strokeWidth={2.5} aria-hidden="true" />
            {t("gamification.shop")}
          </button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
          {Object.entries(TUTORS).map(([key, tutor]) => (
            <button
              key={key}
              onClick={() => router.push(`/dashboard/parent/store?tutor=${key}`)}
              className="text-center p-3 rounded-2xl hover:vi-surface-soft transition cursor-pointer group"
            >
              <div
                className="relative w-14 h-14 mx-auto mb-1.5 rounded-full overflow-hidden border-[3px] group-hover:scale-110 transition-transform shadow-md"
                style={{ borderColor: tutor.color }}
              >
                <Image src={tutor.avatar} alt={`${tutor.name} - ${tutor.domain}`} fill className="object-cover object-top" sizes="56px" />
              </div>
              <div className="font-heading font-bold text-xs" style={{ color: tutor.color }}>{tutor.name}</div>
              <div className="text-[10px] vi-text-muted mt-0.5 leading-tight font-body font-semibold">{tutor.domain}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
