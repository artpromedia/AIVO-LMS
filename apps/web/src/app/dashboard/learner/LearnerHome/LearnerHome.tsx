"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import {
  FlVariantProvider,
  SensoryProvider,
  LearnerShell,
  PrimarySlot,
  TabsRail,
  BreakCloud,
  Celebration,
  LiveRegion,
  type NextAction,
  type FunctioningLevel,
  type SensoryProfile,
} from "@aivo/learner-ui";
import { Backpack, Map as MapIcon, Gift, Play, Brain as BrainIcon } from "lucide-react";
import { TopBar } from "./TopBar";
import { TutorShelf } from "./TutorShelf";
import { QuietProgressStrip } from "./QuietProgressStrip";
import { TodayTab } from "./TodayTab";
import { AdventuresTab } from "./AdventuresTab";
import { RewardsTab } from "./RewardsTab";
import { PreSymbolicView } from "./PreSymbolicView";
import { NonVerbalView } from "./NonVerbalView";

interface EngagementProfile {
  totalXp: number;
  level: number;
  xpForNextLevel: number;
  xpProgress: number;
  streak: {
    current: number;
    longest: number;
    tier: string;
    lastActivity: string | null;
    freezesUsed: number;
  };
  badges: { id: string; badgeType: string; name: string; rarity: string; earnedAt: string }[];
  currency: { coins: number; gems: number };
}

export function LearnerHome() {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tc = useTranslations("common");
  const TABS = [
    { id: "today", label: t("tab_today"), icon: <Backpack className="w-5 h-5" aria-hidden /> },
    {
      id: "adventures",
      label: t("tab_adventures"),
      icon: <MapIcon className="w-5 h-5" aria-hidden />,
    },
    { id: "rewards", label: t("tab_rewards"), icon: <Gift className="w-5 h-5" aria-hidden /> },
  ];
  const TABS_LOW = [
    { id: "today", label: t("tab_play"), icon: <Play className="w-5 h-5" aria-hidden /> },
    { id: "rewards", label: t("tab_gifts"), icon: <Gift className="w-5 h-5" aria-hidden /> },
  ];
  const [profile, setProfile] = useState<EngagementProfile | null>(null);
  const [functioningLevel, setFunctioningLevel] = useState<FunctioningLevel>("STANDARD");
  const [sensoryProfile, setSensoryProfile] = useState<SensoryProfile | undefined>();
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [nextActionLoading, setNextActionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [showBreakCloud, setShowBreakCloud] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [baselineChecked, setBaselineChecked] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !user || redirecting) return;
    const checkBaseline = async () => {
      try {
        const res = await fetch(`/api/assessments/learner/discovery/${user.id}/status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.baselineCompleted) {
            setRedirecting(true);
            router.replace("/dashboard/learner/assessment");
            return;
          }
          if (data.approvalStatus === "pending_parent_review") {
            setPendingApproval(true);
            setBaselineChecked(true);
            return;
          }
        }
      } catch {}
      setBaselineChecked(true);
    };
    checkBaseline();
  }, [accessToken, user, router, redirecting]);

  useEffect(() => {
    if (!accessToken || !user) return;
    fetch(`/api/users/learners`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((learners: { id: string; functioningLevel?: FunctioningLevel }[]) => {
        const me = learners.find((l) => l.id === user.id);
        if (me?.functioningLevel) setFunctioningLevel(me.functioningLevel);
      })
      .catch(() => {});
  }, [accessToken, user]);

  const fetchProfile = useCallback(() => {
    if (!accessToken || !user) return;
    fetch(`/api/engagement/profile/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => {});
  }, [accessToken, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!accessToken || !user) return;
    setNextActionLoading(true);
    fetch(`/api/brain/${user.id}/next-action`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setNextAction(data);
      })
      .catch(() => {})
      .finally(() => setNextActionLoading(false));
  }, [accessToken, user]);

  useEffect(() => {
    if (!accessToken || !user) return;
    fetch(`/api/assessments/sensory-profile/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.visual) {
          setSensoryProfile({
            visual: data.visual || "typical",
            auditory: data.auditory || "typical",
            tactile: data.tactile || "typical",
            vestibular: data.vestibular || "typical",
            proprioceptive: data.proprioceptive || "typical",
          });
        }
      })
      .catch(() => {});
  }, [accessToken, user]);

  const handleSelCheckin = async (emotion: string) => {
    if (!accessToken || !user) return null;
    try {
      const res = await fetch("/api/engagement/sel/checkin", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: user.id, emotion }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCelebration(true);
        setLiveMessage(t("mood_recorded"));
        fetchProfile();
        if (data.suggestedExercises?.length > 0) {
          return data.suggestedExercises[0];
        }
      }
    } catch {}
    return null;
  };

  const handleStartAction = () => {
    if (nextAction?.tutorKey) {
      router.push(`/dashboard/learner/lesson/${nextAction.tutorKey}`);
    }
  };

  const handleSelectTutor = (tutorKey: string) => {
    router.push(`/dashboard/learner/lesson/${tutorKey}`);
  };

  if (loading || !user || !baselineChecked || redirecting) return null;

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center px-6">
        <main id="main-content" tabIndex={-1} className="max-w-md text-center">
          <div
            className="w-24 h-24 rounded-3xl bg-purple-500/20 text-purple-200 flex items-center justify-center mx-auto mb-6 animate-pulse"
            aria-hidden="true"
          >
            <BrainIcon className="w-12 h-12" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-heading font-bold text-white mb-3">{t("approval_title")}</h1>
          <p className="text-white/60 font-body leading-relaxed mb-6">
            {t("approval_description")}
          </p>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-amber-300 font-heading font-bold text-sm">
                {t("approval_waiting")}
              </p>
            </div>
            <p className="text-white/40 text-xs">{t("approval_instruction")}</p>
          </div>
          <button
            onClick={logout}
            className="px-6 py-2 rounded-xl bg-white/10 text-white font-heading font-bold text-sm hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {tc("logout")}
          </button>
        </main>
      </div>
    );
  }

  const xpPercent = profile
    ? Math.min(100, (profile.xpProgress / profile.xpForNextLevel) * 100)
    : 0;
  const isLow =
    functioningLevel === "LOW_VERBAL" ||
    functioningLevel === "NON_VERBAL" ||
    functioningLevel === "PRE_SYMBOLIC";

  return (
    <FlVariantProvider level={functioningLevel}>
      <SensoryProvider functioningLevel={functioningLevel} sensoryProfile={sensoryProfile}>
        {functioningLevel === "PRE_SYMBOLIC" ? (
          <PreSymbolicView
            userName={user.name}
            totalXp={profile?.totalXp || 0}
            xpPercent={xpPercent}
            onLogout={logout}
            onSelectTutor={handleSelectTutor}
          />
        ) : functioningLevel === "NON_VERBAL" ? (
          <LearnerShell
            topBar={
              <TopBar
                userName={user.name}
                coins={profile?.currency.coins || 0}
                gems={profile?.currency.gems || 0}
                onLogout={logout}
                onSettings={() => router.push("/dashboard/learner/settings")}
              />
            }
            breakCloud={
              <BreakCloud isOpen={showBreakCloud} onClose={() => setShowBreakCloud(false)} />
            }
            celebration={
              <Celebration
                isVisible={showCelebration}
                onDismiss={() => setShowCelebration(false)}
                tutorColor={nextAction?.tutorColor}
              />
            }
            liveRegion={<LiveRegion message={liveMessage} />}
          >
            <NonVerbalView
              action={nextAction}
              onStart={handleStartAction}
              onBreak={() => setShowBreakCloud(true)}
            />
          </LearnerShell>
        ) : (
          <LearnerShell
            topBar={
              <TopBar
                userName={user.name}
                coins={profile?.currency.coins || 0}
                gems={profile?.currency.gems || 0}
                onLogout={logout}
                onSettings={() => router.push("/dashboard/learner/settings")}
              />
            }
            breakCloud={
              <BreakCloud isOpen={showBreakCloud} onClose={() => setShowBreakCloud(false)} />
            }
            celebration={
              <Celebration
                isVisible={showCelebration}
                onDismiss={() => setShowCelebration(false)}
                tutorColor={nextAction?.tutorColor}
                motionBudget={isLow ? 2 : 8}
              />
            }
            liveRegion={<LiveRegion message={liveMessage} />}
          >
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
              <PrimarySlot
                action={nextAction}
                loading={nextActionLoading}
                onStart={handleStartAction}
                onBreak={() => setShowBreakCloud(true)}
              />

              <div className="flex justify-center">
                <TabsRail
                  tabs={isLow ? TABS_LOW : TABS}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  iconsOnly={functioningLevel === "SUPPORTED"}
                />
              </div>

              <div role="tabpanel" aria-label={t("tab_content_label", { tab: activeTab })}>
                {activeTab === "today" && (
                  <TodayTab
                    missions={[
                      {
                        id: "m1",
                        title: t("mission_nova_session"),
                        tutorKey: "nova",
                        progress: 0,
                        target: 1,
                        xpReward: 25,
                      },
                      {
                        id: "m2",
                        title: t("mission_sage_reading"),
                        tutorKey: "sage",
                        progress: 0,
                        target: 1,
                        xpReward: 25,
                      },
                    ]}
                    onSelCheckin={handleSelCheckin}
                  />
                )}
                {activeTab === "adventures" && (
                  <AdventuresTab onNavigate={(path) => router.push(path)} />
                )}
                {activeTab === "rewards" && profile && (
                  <RewardsTab
                    badges={profile.badges}
                    streakCurrent={profile.streak.current}
                    streakLongest={profile.streak.longest}
                    coins={profile.currency.coins}
                    gems={profile.currency.gems}
                    onNavigate={(path) => router.push(path)}
                  />
                )}
              </div>

              <TutorShelf onSelectTutor={handleSelectTutor} />

              <QuietProgressStrip profile={profile} />
            </div>
          </LearnerShell>
        )}
      </SensoryProvider>
    </FlVariantProvider>
  );
}
