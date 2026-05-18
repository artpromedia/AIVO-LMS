"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  learnerId: string;
  totalXp: number;
  level: number;
  weeklyXp: number;
  rank: number | null;
}

export default function LeaderboardPage() {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tCommon = useTranslations("common");
  const tGamification = useTranslations("gamification");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [scope, setScope] = useState("global");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`/api/engagement/leaderboard/${scope}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => {});
  }, [accessToken, scope]);

  if (loading || !user) return null;

  const MEDAL_ICONS = [Trophy, Medal, Award];
  const MEDAL_TINTS = ["text-amber-500", "text-slate-400", "text-orange-600"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={100}
          height={30}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/learner")}
            className="text-sm text-primary font-semibold hover:underline"
          >
            {tCommon("back")}
          </button>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-red-500 font-semibold"
          >
            {t("log_out")}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-slate-900 inline-flex items-center justify-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Trophy className="w-6 h-6" strokeWidth={2} aria-hidden />
            </span>
            {t("leaderboard")}
          </h1>
          <p className="text-slate-500 font-semibold mt-2">{t("leaderboard_desc")}</p>
        </div>

        <div className="flex gap-2 justify-center">
          {["global", "class", "school"].map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition capitalize ${
                scope === s
                  ? "bg-amber-500 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                <Trophy className="w-8 h-8" strokeWidth={2} aria-hidden />
              </div>
              <p className="text-slate-500 font-semibold">{t("no_leaderboard_entries")}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {entries.map((entry, idx) => {
                const isMe = entry.learnerId === user.id;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 px-6 py-4 ${isMe ? "bg-purple-50" : ""}`}
                  >
                    <div className="w-10 text-center text-xl font-heading font-bold flex items-center justify-center">
                      {idx < 3 ? (
                        (() => {
                          const Icon = MEDAL_ICONS[idx];
                          return (
                            <Icon
                              className={`w-7 h-7 ${MEDAL_TINTS[idx]}`}
                              strokeWidth={2}
                              aria-hidden
                            />
                          );
                        })()
                      ) : (
                        <span className="text-slate-400">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-heading font-bold text-slate-900">
                        {isMe ? `${user.name} (You)` : `Learner ${entry.learnerId.slice(0, 6)}`}
                      </div>
                      <div className="text-xs text-slate-400 font-semibold">
                        Level {entry.level}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading font-bold text-primary">{entry.totalXp} XP</div>
                      <div className="text-xs text-slate-400">+{entry.weeklyXp || 0} this week</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
