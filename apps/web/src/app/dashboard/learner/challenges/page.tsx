"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Swords } from "lucide-react";

interface Challenge {
  id: string;
  challengeType: string;
  subject: string;
  title: string;
  inviteCode: string;
  status: string;
  maxParticipants: number;
}

export default function ChallengesPage() {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tCommon = useTranslations("common");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Mathematics");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    fetch(`/api/engagement/challenges/learner/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setChallenges)
      .catch(() => {});
  }, [accessToken, user]);

  const createChallenge = async () => {
    if (!accessToken || !user || !newTitle) return;
    const res = await fetch("/api/engagement/challenges/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeType: "quiz_battle",
        subject: newSubject,
        title: newTitle,
        createdBy: user.id,
      }),
    });
    if (res.ok) {
      const challenge = await res.json();
      setChallenges((prev) => [...prev, challenge]);
      setShowCreate(false);
      setNewTitle("");
    }
  };

  const joinChallenge = async () => {
    if (!accessToken || !user || !joinCode) return;
    const res = await fetch("/api/engagement/challenges/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: joinCode, learnerId: user.id }),
    });
    if (res.ok) {
      setJoinCode("");
      window.location.reload();
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
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

      <main className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-slate-900 inline-flex items-center justify-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Swords className="w-6 h-6" strokeWidth={2} aria-hidden />
            </span>
            {t("challenges")}
          </h1>
          <p className="text-slate-500 font-semibold mt-2">{t("challenge_friends")}</p>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-6 py-3 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition"
          >
            {t("create_challenge")}
          </button>
          <div className="flex items-center gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t("enter_invite_code")}
              className="px-4 py-3 rounded-full border border-slate-200 text-sm font-semibold w-44"
              maxLength={8}
            />
            <button
              onClick={joinChallenge}
              className="px-6 py-3 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 transition"
            >
              {t("join")}
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-md mx-auto space-y-4">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("challenge_title")}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
            />
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              <option>Mathematics</option>
              <option>English Language Arts</option>
              <option>Science</option>
              <option>History</option>
              <option>Coding</option>
            </select>
            <button
              onClick={createChallenge}
              className="w-full px-6 py-3 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition"
            >
              {tCommon("add")}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {challenges.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                <Swords className="w-8 h-8" strokeWidth={2} aria-hidden />
              </div>
              <p className="text-slate-500 font-semibold">{t("no_challenges")}</p>
            </div>
          ) : (
            challenges.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between"
              >
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">{c.title}</h3>
                  <p className="text-sm text-slate-500">{c.subject}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      c.status === "ACTIVE"
                        ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                        : c.status === "COMPLETED"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.inviteCode && (
                    <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-full">
                      {c.inviteCode}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
