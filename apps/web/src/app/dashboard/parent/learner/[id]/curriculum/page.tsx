"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const SUBJECTS = [
  "math",
  "ela",
  "science",
  "history",
  "coding",
  "speech",
  "sel",
  "art",
  "other",
] as const;
type Subject = (typeof SUBJECTS)[number];

interface CurriculumUpload {
  id: string;
  learnerId: string;
  subject: Subject;
  title: string | null;
  status: "ACTIVE" | "ARCHIVED" | "PROCESSING";
  sourceType: string;
  fileName: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  parsedFocus: {
    title?: string | null;
    topics?: string[];
    keywords?: string[];
    standards?: string[];
    skills?: string[];
    summary?: string;
    confidence?: number;
  };
  uploaderRole: string;
  notes: string | null;
  createdAt: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ParentLearnerCurriculumPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("curriculum");
  const tc = useTranslations("common");

  const [uploads, setUploads] = useState<CurriculumUpload[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [subject, setSubject] = useState<Subject>("math");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable preview after parse-preview, before final save.
  type ParsedFocus = {
    title?: string;
    subject?: Subject;
    weekStart?: string | null;
    weekEnd?: string | null;
    topics: string[];
    keywords: string[];
    standards: string[];
    skills: string[];
    summary: string;
    confidence?: number;
  };
  const [preview, setPreview] = useState<ParsedFocus | null>(null);

  const loadUploads = useCallback(async () => {
    if (!accessToken || !learnerId) return;
    setLoadingData(true);
    try {
      const res = await fetch(`/api/tutors/curriculum/learner/${learnerId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUploads(Array.isArray(data.uploads) ? data.uploads : []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, learnerId]);

  useEffect(() => {
    void loadUploads();
  }, [loadUploads]);

  const resetForm = () => {
    setTitle("");
    setText("");
    setFile(null);
    setWeekStart("");
    setWeekEnd("");
    setNotes("");
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!text.trim() && !file) {
      setErrorMsg(t("err_need_content"));
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setErrorMsg(t("err_file_too_large"));
      return;
    }

    setParsing(true);
    try {
      const body: Record<string, unknown> = {
        subject,
        text: text.trim() || undefined,
        weekStart: weekStart || undefined,
        weekEnd: weekEnd || undefined,
      };
      if (file) {
        body.imageBase64 = await fileToBase64(file);
        body.mimeType = file.type || "application/octet-stream";
      }
      const res = await fetch(`/api/tutors/curriculum/parse-preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || t("err_upload_failed"));
      }
      const data = await res.json();
      const p = (data?.parsed || {}) as Partial<ParsedFocus>;
      setPreview({
        title: p.title || title.trim() || undefined,
        subject: (p.subject as Subject) || subject,
        weekStart: p.weekStart || weekStart || null,
        weekEnd: p.weekEnd || weekEnd || null,
        topics: Array.isArray(p.topics) ? p.topics : [],
        keywords: Array.isArray(p.keywords) ? p.keywords : [],
        standards: Array.isArray(p.standards) ? p.standards : [],
        skills: Array.isArray(p.skills) ? p.skills : [],
        summary: typeof p.summary === "string" ? p.summary : "",
        confidence: p.confidence,
      });
    } catch (err: any) {
      setErrorMsg(err.message || t("err_upload_failed"));
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!preview) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        learnerId,
        subject: preview.subject || subject,
        title: preview.title || title.trim() || undefined,
        notes: notes.trim() || undefined,
        weekStart: preview.weekStart || undefined,
        weekEnd: preview.weekEnd || undefined,
        parsedFocus: preview,
        // Source provenance — kept so the row records what was actually
        // uploaded (file name, mime type, raw text snippet).
        sourceType: file ? "file" : "text",
        fileName: file?.name,
        mimeType: file?.type,
        text: text.trim() || undefined,
      };
      const res = await fetch(`/api/tutors/curriculum/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || t("err_upload_failed"));
      }
      setSuccessMsg(t("success_uploaded"));
      resetForm();
      await loadUploads();
    } catch (err: any) {
      setErrorMsg(err.message || t("err_upload_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const res = await fetch(`/api/tutors/curriculum/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      await loadUploads();
    } else {
      setErrorMsg(t("err_delete_failed"));
    }
  };

  if (loading || !user) return null;

  const activeUploads = uploads.filter((u) => u.status === "ACTIVE");
  const archivedUploads = uploads.filter((u) => u.status !== "ACTIVE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text mb-2">{t("title")}</h1>
        <p className="text-sm vi-text-muted">{t("description")}</p>
      </div>

      <form onSubmit={handleParse} className="vi-card p-6 space-y-4">
        <h2 className="font-heading font-semibold vi-text">{t("upload_heading")}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium vi-text">{t("subject_label")}</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {t(`subject.${s}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium vi-text">{t("title_label")}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("title_placeholder")}
              maxLength={120}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium vi-text">{t("week_start_label")}</span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium vi-text">{t("week_end_label")}</span>
            <input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium vi-text">{t("text_label")}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={32000}
            placeholder={t("text_placeholder")}
            className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text font-mono text-sm"
          />
        </label>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm vi-text-muted">{t("or_upload_file")}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm vi-text"
          />
          {file && (
            <span className="text-xs vi-text-muted">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium vi-text">{t("notes_label")}</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder={t("notes_placeholder")}
            className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
          />
        </label>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={parsing || submitting}
            className="rounded-lg bg-[hsl(var(--visual-primary))] px-5 py-2 text-white font-semibold disabled:opacity-50"
          >
            {parsing ? t("parsing") : t("parse_preview")}
          </button>
        </div>
      </form>

      {preview && (
        <div className="vi-card p-6 space-y-4 border-2 border-[hsl(var(--visual-primary))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading font-semibold vi-text">{t("review_heading")}</h2>
              <p className="text-xs vi-text-muted mt-1">{t("review_help")}</p>
            </div>
            <button
              onClick={() => setPreview(null)}
              className="text-xs vi-text-muted hover:text-red-600"
            >
              {tc("cancel")}
            </button>
          </div>

          <label className="block">
            <span className="text-sm font-medium vi-text">{t("title_label")}</span>
            <input
              type="text"
              value={preview.title || ""}
              onChange={(e) => setPreview({ ...preview, title: e.target.value })}
              maxLength={200}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium vi-text">{t("week_start_label")}</span>
              <input
                type="date"
                value={(preview.weekStart || "").slice(0, 10)}
                onChange={(e) => setPreview({ ...preview, weekStart: e.target.value || null })}
                className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium vi-text">{t("week_end_label")}</span>
              <input
                type="date"
                value={(preview.weekEnd || "").slice(0, 10)}
                onChange={(e) => setPreview({ ...preview, weekEnd: e.target.value || null })}
                className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium vi-text">{t("summary")}</span>
            <textarea
              value={preview.summary}
              onChange={(e) => setPreview({ ...preview, summary: e.target.value })}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text"
            />
          </label>

          {(["topics", "keywords", "standards", "skills"] as const).map((field) => (
            <label key={field} className="block">
              <span className="text-sm font-medium vi-text">{t(field)}</span>
              <input
                type="text"
                value={preview[field].join(", ")}
                onChange={(e) =>
                  setPreview({
                    ...preview,
                    [field]: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={t("comma_separated")}
                className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text text-sm"
              />
            </label>
          ))}

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPreview(null)}
              className="rounded-lg border vi-border px-4 py-2 vi-text"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleConfirmSave}
              disabled={submitting}
              className="rounded-lg bg-[hsl(var(--visual-primary))] px-5 py-2 text-white font-semibold disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("confirm_save")}
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-heading font-semibold vi-text">{t("active_heading")}</h2>
        {loadingData ? (
          <div className="vi-card p-6 text-center vi-text-muted animate-pulse">{tc("loading")}</div>
        ) : activeUploads.length === 0 ? (
          <div className="vi-card p-6 text-center vi-text-muted">{t("active_empty")}</div>
        ) : (
          activeUploads.map((u) => (
            <UploadCard key={u.id} upload={u} onDelete={handleDelete} t={t} />
          ))
        )}
      </section>

      {archivedUploads.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold vi-text">{t("archived_heading")}</h2>
          {archivedUploads.map((u) => (
            <UploadCard key={u.id} upload={u} onDelete={handleDelete} t={t} />
          ))}
        </section>
      )}
    </div>
  );
}

function UploadCard({
  upload,
  onDelete,
  t,
}: {
  upload: CurriculumUpload;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const focus = upload.parsedFocus || {};
  return (
    <div className="vi-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wide vi-text-muted">
              {t(`subject.${upload.subject}`)}
            </span>
            {upload.status === "ACTIVE" && (
              <span className="text-xs rounded-full bg-green-100 text-green-800 px-2 py-0.5">
                {t("status_active")}
              </span>
            )}
            {upload.status === "ARCHIVED" && (
              <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">
                {t("status_archived")}
              </span>
            )}
          </div>
          <h3 className="font-heading font-semibold vi-text">{upload.title || t("untitled")}</h3>
          {(upload.weekStart || upload.weekEnd) && (
            <p className="text-xs vi-text-muted mt-1">
              {upload.weekStart?.slice(0, 10) || "?"} → {upload.weekEnd?.slice(0, 10) || "?"}
            </p>
          )}
        </div>
        <button
          onClick={() => onDelete(upload.id)}
          className="text-xs vi-text-muted hover:text-red-600"
        >
          {t("delete")}
        </button>
      </div>

      {focus.summary && <p className="text-sm vi-text">{focus.summary}</p>}

      {focus?.topics && focus.topics.length > 0 && (
        <div>
          <p className="text-xs font-semibold vi-text-muted mb-1">{t("topics")}</p>
          <div className="flex flex-wrap gap-1.5">
            {(focus.topics ?? []).map((tp, i) => (
              <span
                key={i}
                className="text-xs bg-[hsl(var(--visual-surface))] vi-text rounded-full px-2 py-1"
              >
                {tp}
              </span>
            ))}
          </div>
        </div>
      )}

      {focus?.keywords && focus.keywords.length > 0 && (
        <div>
          <p className="text-xs font-semibold vi-text-muted mb-1">{t("keywords")}</p>
          <p className="text-xs vi-text-muted">{(focus.keywords ?? []).join(" · ")}</p>
        </div>
      )}

      {focus?.standards && focus.standards.length > 0 && (
        <div>
          <p className="text-xs font-semibold vi-text-muted mb-1">{t("standards")}</p>
          <p className="text-xs vi-text-muted">{(focus.standards ?? []).join(", ")}</p>
        </div>
      )}

      {upload.notes && <p className="text-xs vi-text-muted italic">"{upload.notes}"</p>}
    </div>
  );
}
