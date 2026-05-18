"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, Check, Mic, Loader2, Square } from "lucide-react";
import { subjectIcon, subjectWellClass } from "@/lib/subject-icons";
import { useSpeechInput } from "@/components/stage/useSpeechInput";
import { useLocale } from "@/providers/i18n-provider";

const STT_LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  hi: "hi-IN",
};

interface AdaptedProblem {
  problem_number: number;
  original: string;
  adapted: string;
  scaffolding: string;
  accommodation_notes: string;
  visual_supports: string[];
  choices: string[];
  parent_guide: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function HomeworkSessionPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("homework");
  const tCommon = useTranslations("common");
  const tStt = useTranslations("stt");
  const { locale } = useLocale();
  const sttLocale = STT_LOCALE_MAP[locale] || "en-US";
  const sessionId = params.sessionId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [adaptedProblems, setAdaptedProblems] = useState<AdaptedProblem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentProblem, setCurrentProblem] = useState(0);
  const [completedProblems, setCompletedProblems] = useState<Set<number>>(new Set());
  const [showProblems, setShowProblems] = useState(true);

  const speech = useSpeechInput({
    locale: sttLocale,
    authToken: accessToken,
    onResult: (text) => {
      if (!text) return;
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  });

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  useEffect(() => {
    if (!user || !sessionId) return;
    loadSession();
  }, [user, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSession() {
    try {
      const res = await fetch(`/api/tutors/homework/session/${sessionId}/state`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Session not found");
      const data = await res.json();

      setSubject(data.subject || "");
      setAdaptedProblems(data.adaptedProblems || []);

      const existingMessages: ChatMessage[] = data.messages || [];
      if (existingMessages.length === 0) {
        const problems = data.adaptedProblems || [];
        const greeting =
          problems.length > 0
            ? `Hi! I see you have ${problems.length} problem${problems.length > 1 ? "s" : ""} to work on. Let's start with Problem ${problems[0]?.problem_number || 1}. Take a look and tell me what you think the first step is!`
            : "Hi! I'm here to help with your homework. What would you like to work on?";
        setMessages([
          { role: "assistant", content: greeting, timestamp: new Date().toISOString() },
        ]);
      } else {
        setMessages(existingMessages);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date().toISOString() },
    ]);

    try {
      const h = { ...authHeaders(), "Content-Type": "application/json" };

      const res = await fetch(`/api/tutors/homework/session/${sessionId}/message`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ message: userMessage, locale }),
      });

      if (!res.ok) throw new Error("Message failed");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble thinking about that. Could you try again?",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function completeSession() {
    if (!sessionId) return;
    try {
      const h = { ...authHeaders(), "Content-Type": "application/json" };

      await fetch(`/api/tutors/homework/session/${sessionId}/complete`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          problemsAttempted: adaptedProblems.length || 0,
          problemsCompleted: completedProblems.size,
        }),
      });
      router.push("/dashboard/learner/homework");
    } catch {
      setError("Failed to complete session");
    }
  }

  function markProblemDone(num: number) {
    setCompletedProblems((prev) => new Set([...prev, num]));
    const nextIdx = adaptedProblems.findIndex(
      (p) => !completedProblems.has(p.problem_number) && p.problem_number !== num,
    );
    if (nextIdx >= 0) setCurrentProblem(nextIdx);
  }

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center space-y-4">
          <p className="text-red-600 font-bold text-lg">{error}</p>
          <button
            onClick={() => router.push("/dashboard/learner/homework")}
            className="px-6 py-2 bg-purple-600 text-white rounded-full font-bold"
          >
            {tCommon("back")}
          </button>
        </div>
      </div>
    );
  }

  const subjectLower = subject?.toLowerCase() || "other";

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-cyan-50">
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/learner/homework")}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm"
          >
            ← {tCommon("back")}
          </button>
          {(() => {
            const Icon = subjectIcon(subjectLower);
            return (
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${subjectWellClass(subjectLower)}`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} aria-hidden />
              </span>
            );
          })()}
          <span className="font-heading font-bold text-slate-800 capitalize">
            {subjectLower} Homework
          </span>
          {adaptedProblems.length > 0 && (
            <span className="text-xs text-slate-400">
              {completedProblems.size}/{adaptedProblems.length} complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {adaptedProblems.length > 0 && (
            <button
              onClick={() => setShowProblems(!showProblems)}
              className="text-xs text-purple-600 font-bold hover:underline"
            >
              {showProblems ? tCommon("hide") : tCommon("show_all")}
            </button>
          )}
          <button
            onClick={completeSession}
            className="px-4 py-1.5 bg-green-500 text-white rounded-full text-sm font-bold hover:bg-green-600 transition"
          >
            {tCommon("done")}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {showProblems && adaptedProblems.length > 0 && (
          <div className="w-80 border-r border-slate-200 bg-white/50 overflow-y-auto p-4 space-y-3 shrink-0">
            <h3 className="font-heading font-bold text-sm text-slate-600 uppercase tracking-wide">
              Problems
            </h3>
            {adaptedProblems.map((p, idx) => {
              const isDone = completedProblems.has(p.problem_number);
              const isActive = idx === currentProblem;
              return (
                <button
                  key={p.problem_number}
                  onClick={() => {
                    setCurrentProblem(idx);
                    setInput(`I'd like to work on problem ${p.problem_number}`);
                  }}
                  className={`w-full text-left rounded-xl p-3 border-2 transition text-sm ${
                    isDone
                      ? "bg-green-50 border-green-200 opacity-70"
                      : isActive
                        ? "bg-purple-50 border-purple-300 shadow-sm"
                        : "bg-white border-slate-100 hover:border-purple-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? "bg-[hsl(var(--visual-science))] text-white" : "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]"}`}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
                      ) : (
                        p.problem_number
                      )}
                    </span>
                    <span className="font-bold text-slate-700 text-xs">
                      {isDone ? tCommon("done") : `#${p.problem_number}`}
                    </span>
                    {!isDone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markProblemDone(p.problem_number);
                        }}
                        className="ml-auto text-xs text-green-600 hover:underline"
                      >
                        {tCommon("done")}
                      </button>
                    )}
                  </div>
                  <p className="text-slate-600 text-xs line-clamp-3">{p.adapted || p.original}</p>
                  {p.scaffolding && (
                    <p className="text-purple-500 text-xs mt-1 italic line-clamp-2 inline-flex items-start gap-1">
                      <Lightbulb
                        className="w-3.5 h-3.5 shrink-0 mt-0.5"
                        strokeWidth={2.5}
                        aria-hidden
                      />{" "}
                      {p.scaffolding}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-md"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-5 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-white/80 backdrop-blur p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-3 max-w-3xl mx-auto"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  speech.status === "listening"
                    ? tStt("listening")
                    : speech.status === "processing"
                      ? t("mic_processing")
                      : t("ask_help_placeholder")
                }
                className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                disabled={sending || speech.status === "processing"}
              />
              {speech.isSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (speech.status === "listening") speech.stop();
                    else if (speech.status !== "processing") void speech.start();
                  }}
                  disabled={sending || speech.status === "processing"}
                  aria-label={
                    speech.status === "listening"
                      ? t("mic_listening")
                      : speech.status === "processing"
                        ? t("mic_processing")
                        : t("mic_button")
                  }
                  aria-pressed={speech.status === "listening"}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition shrink-0 ${
                    speech.status === "listening"
                      ? "bg-rose-500 text-white border-rose-500 animate-pulse"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  } disabled:opacity-50`}
                  title={
                    speech.status === "listening"
                      ? t("mic_listening")
                      : speech.status === "processing"
                        ? t("mic_processing")
                        : t("mic_button")
                  }
                >
                  {speech.status === "processing" ? (
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} aria-hidden />
                  ) : speech.status === "listening" ? (
                    <Square className="w-4 h-4 fill-current" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Mic className="w-5 h-5" strokeWidth={2} aria-hidden />
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-full font-bold text-sm hover:bg-purple-700 transition disabled:opacity-50"
              >
                {tCommon("submit")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
