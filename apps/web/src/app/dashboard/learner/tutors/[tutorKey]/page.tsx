"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { useTranslations } from "next-intl";
import { useLearnerEntitlements } from "@/hooks/useLearnerEntitlements";

export default function TutorDetailPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tutorKey = params.tutorKey as TutorKey;
  const tutor = TUTORS[tutorKey];
  const t = useTranslations("tutor");
  const tLearner = useTranslations("learner");
  const tCommon = useTranslations("common");

  const { status: entitlementStatus, isTutorEntitled } = useLearnerEntitlements({
    tenantId: user?.tenantId,
    accessToken,
  });
  const isActive = isTutorEntitled(tutorKey);
  const loadingStatus = entitlementStatus === "loading";
  const [sessionCount] = useState(0);

  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);

  if (loading || !user) return null;
  if (!tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-semibold">{t("not_found")}</p>
          <Link href="/dashboard/learner/tutors" className="text-primary hover:underline text-sm mt-2 inline-block">← {tCommon("back")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/dashboard/learner/tutors" className="text-sm text-primary hover:underline font-semibold mb-6 inline-block">← {tCommon("back")}</Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-3" style={{ backgroundColor: tutor.color }} />
          <div className="p-8">
            <div className="flex items-center gap-6 mb-6">
              <Image src={tutor.avatar} alt={tutor.name} width={80} height={80} className="rounded-2xl shadow-md" />
              <div>
                <h1 className="text-3xl font-heading font-bold text-slate-900">{tutor.name}</h1>
                <p className="text-slate-500 mt-1">{tutor.domain}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${tutor.tier === "core" ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"}`}>
                    {tutor.tier}
                  </span>
                  {!loadingStatus && (
                    isActive ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))] font-semibold">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-500 font-semibold">Locked</span>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{tLearner("subject")}</p>
                <p className="text-sm font-semibold text-slate-900">{tutor.domain}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{tLearner("sessions")}</p>
                <p className="text-sm font-semibold text-slate-900">{sessionCount} completed</p>
              </div>
            </div>

            {isActive ? (
              <Link href={`/dashboard/learner/lesson/${tutorKey}`}
                className="block w-full py-4 rounded-xl text-center font-bold text-white transition hover:shadow-lg"
                style={{ backgroundColor: tutor.color }}>
                {t("start")} - {tutor.name}
              </Link>
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-500 font-medium mb-2">{tLearner("tutor_not_in_plan")}</p>
                <p className="text-sm text-slate-400">{tLearner("ask_parent_add_tutor", { name: tutor.name })}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
