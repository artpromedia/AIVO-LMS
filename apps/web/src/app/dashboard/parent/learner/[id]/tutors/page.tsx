"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TUTORS, type TutorKey, getTutorsForTier } from "@aivo/brand";
import { gradeToTier } from "@aivo/learner-ui";
import type { LearnerEntitlementPayload } from "@aivo/billing-entitlements";
import { useTranslations } from "next-intl";

export default function ParentLearnerTutorsPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");
  const tc = useTranslations("common");

  const [entitlements, setEntitlements] = useState<LearnerEntitlementPayload | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [learnerGrade, setLearnerGrade] = useState<string | null>(null);
  const [learnerLookupFailed, setLearnerLookupFailed] = useState(false);

  useEffect(() => {
    if (!accessToken || !learnerId || !user) return;
    Promise.all([
      // Authoritative per-learner entitlements: resolves plan-included,
      // active add-ons, and grace-period tutors against the learner's
      // tenant. Keyed by tutor key so we can match directly.
      fetch(`/api/tutors/entitlements/${learnerId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/users/learners`, { headers: { Authorization: `Bearer ${accessToken}` } }).then(
        (r) => (r.ok ? r.json() : []),
      ),
    ])
      .then(([entResp, learnersData]) => {
        setEntitlements(entResp as LearnerEntitlementPayload | null);
        const learners = Array.isArray(learnersData) ? learnersData : [];
        const me = learners.find((l: any) => l.id === learnerId);
        if (me?.gradeLevel) {
          setLearnerGrade(me.gradeLevel);
        } else {
          setLearnerLookupFailed(true);
        }
      })
      .catch(() => setLearnerLookupFailed(true))
      .finally(() => setLoadingData(false));
  }, [accessToken, learnerId, user]);

  if (loading || !user) return null;

  // Filter to tutors that fit this learner's age tier (e.g. K-5 hides
  // Chrono / Lingua / Forge / Compass).
  const tier = learnerGrade != null ? gradeToTier(learnerGrade) : null;
  const tutorEntries = getTutorsForTier(tier) as [TutorKey, (typeof TUTORS)[TutorKey]][];
  const effective = new Set(entitlements?.effectiveTutors ?? []);
  const grace = new Set(entitlements?.graceTutors ?? []);
  const isActive = (key: TutorKey) => effective.has(key);
  const isGrace = (key: TutorKey) => grace.has(key);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text mb-2">
          {t("tutors_title", { name: "" }).trim()}
        </h1>
        <p className="text-sm vi-text-muted">
          {t("tutors_manage_desc")} {t("visit_store")}{" "}
          <Link
            href="/dashboard/parent/store"
            className="text-[hsl(var(--visual-primary))] hover:underline font-semibold"
          >
            {t("tutor_store_link")}
          </Link>{" "}
          {t("to_add_more")}
        </p>
      </div>

      {loadingData ? (
        <div className="vi-card p-12 text-center animate-pulse vi-text-muted">
          {t("loading_tutors")}
        </div>
      ) : learnerLookupFailed ? (
        // Fail closed: if we can't determine this learner's grade, do NOT
        // show the catalogue (it would expose tier-restricted tutors).
        <div className="vi-card p-12 text-center vi-text-muted">{t("loading_tutors")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutorEntries.map(([key, tutor]) => {
            const active = isActive(key);
            return (
              <div
                key={key}
                className={`rounded-2xl border-2 overflow-hidden transition ${active ? "border-[hsl(var(--visual-primary)/0.3)] bg-[hsl(var(--visual-surface))] shadow-sm" : "vi-border vi-surface-soft opacity-60"}`}
              >
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Image
                      src={tutor.avatar}
                      alt={tutor.name}
                      width={48}
                      height={48}
                      className="rounded-xl"
                    />
                    <div>
                      <h3 className="font-heading font-bold vi-text">{tutor.name}</h3>
                      <p className="text-xs vi-text-muted">{tutor.domain}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-semibold ${tutor.tier === "core" ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]"}`}
                    >
                      {tutor.tier}
                    </span>
                    {active ? (
                      isGrace(key) ? (
                        <span className="px-3 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-semibold">
                          Grace period
                        </span>
                      ) : (
                        <span className="px-3 py-1 text-xs rounded-full bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] font-semibold">
                          {tc("active")}
                        </span>
                      )
                    ) : (
                      <span className="px-3 py-1 text-xs rounded-full vi-surface-soft vi-text-muted font-semibold">
                        {t("not_subscribed")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1" style={{ backgroundColor: tutor.color }} />
              </div>
            );
          })}
        </div>
      )}

      <div className="p-5 rounded-2xl vi-surface-soft border vi-border">
        <p className="text-sm vi-text">
          <span className="font-semibold">{t("want_more_tutors")}</span> {t("visit_store")}{" "}
          <Link
            href="/dashboard/parent/store"
            className="text-[hsl(var(--visual-primary))] font-bold hover:underline"
          >
            {t("tutor_store_link")}
          </Link>{" "}
          {tc("or")}{" "}
          <Link
            href="/dashboard/parent/billing"
            className="text-[hsl(var(--visual-primary))] font-bold hover:underline"
          >
            {t("billing_link")}
          </Link>{" "}
          {t("manage_addons_desc")}
        </p>
      </div>
    </div>
  );
}
