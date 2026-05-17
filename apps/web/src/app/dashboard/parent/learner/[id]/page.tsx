"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TUTORS, type TutorKey, getTutorsForTier } from "@aivo/brand";
import { gradeToTier } from "@aivo/learner-ui";
import BrainVisualizationPanel from "@/components/BrainVisualizationPanel";
import { useTranslations } from "next-intl";
import {
  Brain,
  ClipboardList,
  PartyPopper,
  Search,
  Flame,
  BookOpen,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

interface Learner {
  id: string;
  name: string;
  gradeLevel?: string;
  functioningLevel?: string;
  curriculumFramework?: string;
}

export default function LearnerHubPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [learner, setLearner] = useState<Learner | null>(null);
  const [loadingLearner, setLoadingLearner] = useState(true);
  const [baselineCompleted, setBaselineCompleted] = useState(false);
  const [hasBrain, setHasBrain] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [streak, setStreak] = useState<any>(null);

  useEffect(() => {
    if (!accessToken || !user) return;

    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const found = (Array.isArray(data) ? data : []).find((l: Learner) => l.id === learnerId);
        if (found) setLearner(found);
      })
      .catch(() => {})
      .finally(() => setLoadingLearner(false));

    fetch(`/api/assessments/learner/discovery/${learnerId}/status`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(status => { if (status?.baselineCompleted) setBaselineCompleted(true); })
      .catch(() => {});

    fetch(`/api/brain/${learnerId}/review`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(brain => {
        if (brain) {
          setHasBrain(true);
          if (brain.approval_status === "pending_parent_review") setPendingReview(true);
        }
      })
      .catch(() => {});

    fetch(`/api/family/streaks/${learnerId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStreak(data); })
      .catch(() => {});
  }, [accessToken, user, learnerId]);

  if (loading || !user) return null;

  if (loadingLearner) {
    return <div className="text-center py-20 vi-text-muted animate-pulse">{t("loading_learner")}</div>;
  }

  if (!learner) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center">
          <Search size={28} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <p className="vi-text-muted font-semibold">{t("learner_not_found")}</p>
        <Link href="/dashboard/parent" className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline mt-2 inline-block">{t("back_to_dashboard")}</Link>
      </div>
    );
  }

  type RightNowCard = {
    Icon: LucideIcon;
    iconWrap: string;
    label: string;
    description: string;
    href: string;
    color: string;
  };

  const RIGHT_NOW_CARDS: RightNowCard[] = [];
  if (pendingReview) {
    RIGHT_NOW_CARDS.push({
      Icon: Brain,
      iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-sel))]",
      label: `Review ${learner.name}'s Brain Profile`, description: "AIVO updated the brain profile based on recent sessions.",
      href: `/dashboard/parent/learner/${learnerId}/brain-review`, color: "bg-[hsl(var(--visual-sel)/0.12)] border-[hsl(var(--visual-sel)/0.3)] text-[hsl(var(--visual-sel))]",
    });
  }
  if (!baselineCompleted && !hasBrain) {
    RIGHT_NOW_CARDS.push({
      Icon: ClipboardList,
      iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-reading))]",
      label: "Complete the Assessment", description: "Help AIVO understand your child's learning needs (10 min).",
      href: `/dashboard/parent/learner/${learnerId}/assessment`, color: "bg-[hsl(var(--visual-reading)/0.12)] border-[hsl(var(--visual-reading)/0.3)] text-[hsl(var(--visual-reading))]",
    });
  }
  if (RIGHT_NOW_CARDS.length === 0) {
    RIGHT_NOW_CARDS.push({
      Icon: PartyPopper,
      iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-science))]",
      label: `${learner.name} is on track!`, description: "Everything's looking great. Keep it up!",
      href: "", color: "bg-[hsl(var(--visual-science)/0.12)] border-[hsl(var(--visual-science)/0.3)] text-[hsl(var(--visual-science))]",
    });
  }

  return (
    <div className="space-y-6">
      <div className="vi-card p-5 lg:p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--visual-primary))] flex items-center justify-center text-2xl text-white font-bold shadow-lg flex-shrink-0">
            {learner.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-heading font-bold vi-text">{learner.name}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {streak && streak.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--visual-sel))] font-semibold">
                  <Flame size={14} strokeWidth={2.5} aria-hidden="true" />
                  {streak.currentStreak}-day streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-heading font-bold vi-text">Right Now</h2>
        {RIGHT_NOW_CARDS.map((card, i) => {
          const inner = (
            <div className="flex items-center gap-3">
              <span className={`w-11 h-11 rounded-2xl ${card.iconWrap} flex items-center justify-center shrink-0 shadow-sm`}>
                <card.Icon size={20} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold">{card.label}</p>
                <p className="text-xs opacity-80 mt-0.5">{card.description}</p>
              </div>
            </div>
          );
          return card.href ? (
            <Link key={i} href={card.href} className={`block rounded-2xl p-4 border-2 ${card.color} hover:shadow-md transition`}>
              {inner}
            </Link>
          ) : (
            <div key={i} className={`rounded-2xl p-4 border-2 ${card.color}`}>
              {inner}
            </div>
          );
        })}
      </div>

      {accessToken && hasBrain && (
        <div className="vi-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-bold vi-text">Brain Profile</h2>
            <Link href={`/dashboard/parent/learner/${learnerId}/brain`} className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline">
              View Full Profile →
            </Link>
          </div>
          <BrainVisualizationPanel
            learnerName={learner.name}
            version="v1"
            updatedAt={new Date().toLocaleDateString()}
          />
        </div>
      )}

      <div className="vi-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold vi-text">Active Tutors</h2>
          <Link href="/dashboard/parent/store" className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline">
            Visit Store →
          </Link>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
          {/* Fail closed: when gradeLevel is unknown, fall back to the
              EARLY tier (the strictest, K-5 catalogue) rather than showing
              the unrestricted full catalogue. Matches TierThemeProvider's
              "safest, brightest baseline" behaviour. */}
          {(getTutorsForTier(learner?.gradeLevel ? gradeToTier(learner.gradeLevel) : "EARLY") as [TutorKey, typeof TUTORS[TutorKey]][]).slice(0, 7).map(([key, tutor]) => (
            <button key={key} onClick={() => router.push(`/dashboard/parent/store?tutor=${key}`)}
              className="flex flex-col items-center gap-1.5 group">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 group-hover:scale-110 transition-transform shadow" style={{ borderColor: tutor.color }}>
                <Image src={tutor.avatar} alt={tutor.name} width={48} height={48} className="object-cover" />
              </div>
              <span className="text-[10px] font-heading font-bold vi-text-muted group-hover:text-[hsl(var(--visual-primary))] transition">{tutor.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="vi-card p-5">
        <h2 className="text-lg font-heading font-bold vi-text mb-4">Explore</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-bold vi-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen size={14} strokeWidth={2.5} className="text-[hsl(var(--visual-reading))]" aria-hidden="true" />
              Learning & Assessment
            </h3>
            <div className="space-y-1">
              <Link href={`/dashboard/parent/learner/${learnerId}/progress`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Progress & XP
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/gradebook`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Gradebook
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/insights`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Insights
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/assessment`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Assessments
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/homework`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Homework History
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/curriculum`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Weekly Curriculum
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold vi-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Brain size={14} strokeWidth={2.5} className="text-[hsl(var(--visual-primary))]" aria-hidden="true" />
              Brain & Accommodations
            </h3>
            <div className="space-y-1">
              <Link href={`/dashboard/parent/learner/${learnerId}/brain`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Brain Profile
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/brain-history`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Brain History
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/sensory`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Sensory Needs
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/settings`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Settings & Accommodations
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold vi-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target size={14} strokeWidth={2.5} className="text-[hsl(var(--visual-science))]" aria-hidden="true" />
              IEP & Support
            </h3>
            <div className="space-y-1">
              <Link href={`/dashboard/parent/learner/${learnerId}/iep`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                IEP Goals
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/recommendations`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Recommendations
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/team`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Learning Team
              </Link>
              <Link href={`/dashboard/parent/learner/${learnerId}/transitions`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Transition Planning
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold vi-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Trophy size={14} strokeWidth={2.5} className="text-[hsl(var(--visual-sel))]" aria-hidden="true" />
              Achievements
            </h3>
            <div className="space-y-1">
              <Link href={`/dashboard/parent/learner/${learnerId}/milestones`} className="block px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--visual-primary)/0.08)] text-sm font-semibold vi-text hover:text-[hsl(var(--visual-primary))] transition" style={{ minHeight: 44 }}>
                Milestones & Badges
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
