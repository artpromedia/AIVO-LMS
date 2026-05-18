"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Camera, Pencil, BookMarked } from "lucide-react";
import { subjectIcon, subjectWellClass } from "@/lib/subject-icons";

interface HomeworkAssignment {
  id: string;
  subject: string;
  status: string;
  homeworkMode: string;
  detectedSubject: string;
  problemCount: number;
  adaptedCount: number;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PROCESSING: {
    label: "Processing...",
    color: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  },
  READY: {
    label: "Ready",
    color: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  },
  COMPLETED: {
    label: "Done!",
    color: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  },
  FAILED: {
    label: "Failed",
    color: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  },
};

export default function HomeworkPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("homework");
  const tCommon = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [lockedInfo, setLockedInfo] = useState<{
    locked: boolean;
    requiredSku: string;
    detectedSubject: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchAssignments();
  }, [user]);

  async function fetchAssignments() {
    try {
      const res = await fetch(`/api/tutors/homework/learner/${user!.id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch {
      setError("Failed to load homework");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file?: File) {
    if (!user) return;
    setUploading(true);
    setError(null);
    setLockedInfo(null);

    try {
      let body: any = { learnerId: user.id, userId: user.id };

      if (file) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(file);
        });
        body.imageBase64 = base64;
        body.mimeType = file.type || "image/jpeg";
      } else if (pastedText.trim()) {
        body.textInput = pastedText.trim();
      } else {
        setError("Please upload an image or paste homework text");
        setUploading(false);
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res = await fetch("/api/tutors/homework/upload", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.locked) {
        setLockedInfo({
          locked: true,
          requiredSku: data.requiredSku,
          detectedSubject: data.detectedSubject,
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (data.assignment) {
        setAssignments((prev) => [data.assignment, ...prev]);
        setPastedText("");
        setTextMode(false);
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-cyan-50">
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
            className="text-sm text-slate-500 hover:text-purple-600 font-semibold"
          >
            {tCommon("back")}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-heading font-bold text-slate-900">{t("title")}</h1>
          <p className="text-slate-500 font-semibold text-lg">{t("upload_description")}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center font-semibold">
            {error}
          </div>
        )}

        {lockedInfo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
            <p className="text-amber-800 font-bold text-lg">{t("subscription_required")}</p>
            <p className="text-amber-700">
              This homework is {lockedInfo.detectedSubject.toLowerCase()} — you need a{" "}
              {lockedInfo.detectedSubject.toLowerCase()} tutor subscription to get help.
            </p>
            <button
              onClick={() => router.push("/dashboard/parent/store")}
              className="px-6 py-2 bg-purple-600 text-white rounded-full font-bold hover:bg-purple-700 transition"
            >
              {t("visit_tutor_store")}
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={`bg-white rounded-2xl p-8 border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] space-y-4 ${
              isDragging
                ? "border-purple-500 bg-purple-50"
                : "border-slate-200 hover:border-purple-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploading ? (
              <>
                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-purple-600 font-bold">{t("processing")}</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Camera className="w-7 h-7" strokeWidth={2} aria-hidden />
                </div>
                <p className="text-slate-700 font-bold text-lg">{t("upload_photo")}</p>
                <p className="text-slate-400 text-sm">{t("drag_drop")}</p>
                <p className="text-slate-300 text-xs">{t("supported_formats")}</p>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl p-8 border-2 border-slate-200 flex flex-col min-h-[200px] space-y-4">
            <p className="text-slate-700 font-bold text-lg text-center inline-flex items-center justify-center gap-2">
              <Pencil className="w-5 h-5 text-purple-600" strokeWidth={2.5} aria-hidden />{" "}
              {t("paste_text")}
            </p>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your homework problems here...&#10;&#10;1) What is 5 + 3?&#10;2) Solve for x: 2x = 10"
              className="flex-1 border border-slate-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button
              onClick={() => handleUpload()}
              disabled={uploading || !pastedText.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-full font-bold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? t("processing") : t("get_help")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <BookMarked className="w-8 h-8" strokeWidth={2} aria-hidden />
            </div>
            <p className="font-semibold text-lg">{t("no_homework")}</p>
            <p className="text-sm">{t("upload_to_start")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-bold text-slate-800">{t("your_homework")}</h2>
            {assignments.map((hw) => {
              const subjectLower = hw.subject?.toLowerCase() || "other";
              const status = STATUS_LABELS[hw.status] || STATUS_LABELS.PROCESSING;
              const SubjectIcon = subjectIcon(subjectLower);
              return (
                <button
                  key={hw.id}
                  onClick={async () => {
                    if (hw.status === "READY" || hw.status === "IN_PROGRESS") {
                      try {
                        const headers: Record<string, string> = {
                          "Content-Type": "application/json",
                        };
                        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
                        const res = await fetch("/api/tutors/homework/session/start", {
                          method: "POST",
                          headers,
                          body: JSON.stringify({ assignmentId: hw.id, learnerId: user!.id }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          router.push(`/dashboard/learner/homework/${data.sessionId}`);
                        }
                      } catch {}
                    }
                  }}
                  disabled={hw.status === "FAILED"}
                  className="w-full bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition flex items-center gap-4 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${subjectWellClass(subjectLower)}`}
                  >
                    <SubjectIcon className="w-6 h-6" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 capitalize">{subjectLower} Homework</p>
                    <p className="text-sm text-slate-400">
                      {hw.problemCount} problem{hw.problemCount !== 1 ? "s" : ""} &middot;{" "}
                      {new Date(hw.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
