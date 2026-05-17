"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface ConnectedLearner {
  id: string;
  name: string;
}

const SUBJECTS = ["math", "ela", "science", "history", "coding", "speech", "sel", "art", "other"] as const;
type Subject = typeof SUBJECTS[number];

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

export default function TeacherCurriculumUploader({
  learners,
  accessToken,
}: {
  learners: ConnectedLearner[];
  accessToken: string | null;
}) {
  const t = useTranslations("curriculum");
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [subject, setSubject] = useState<Subject>("math");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  type HistoryEntry = {
    id: string;
    learnerId: string;
    subject: string;
    title: string | null;
    status: string;
    weekStart: string | null;
    weekEnd: string | null;
    classGroupId: string | null;
    createdAt: string;
  };
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const learnerNameById = (id: string) => learners.find((l) => l.id === id)?.name || id.slice(0, 8);

  const loadHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/tutors/curriculum/mine?limit=20", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data.uploads) ? data.uploads : []);
      }
    } catch {}
  }, [accessToken]);

  useEffect(() => {
    if (open) void loadHistory();
  }, [open, loadHistory]);

  const toggleLearner = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const selectAll = () => setSelectedIds(learners.map((l) => l.id));
  const clearAll = () => setSelectedIds([]);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (selectedIds.length === 0) {
      setError(t("err_select_learners"));
      return;
    }
    if (!text.trim() && !file) {
      setError(t("err_need_content"));
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setError(t("err_file_too_large"));
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
      const res = await fetch("/api/tutors/curriculum/parse-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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
      setError(err.message || t("err_upload_failed"));
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!preview) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        applyToLearnerIds: selectedIds,
        subject: preview.subject || subject,
        title: preview.title || title.trim() || undefined,
        weekStart: preview.weekStart || undefined,
        weekEnd: preview.weekEnd || undefined,
        parsedFocus: preview,
        // Source provenance for audit/version trail.
        sourceType: file ? "file" : "text",
        fileName: file?.name,
        mimeType: file?.type,
        text: text.trim() || undefined,
      };
      const res = await fetch("/api/tutors/curriculum/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || t("err_upload_failed"));
      }
      const data = await res.json();
      setSuccess(t("success_uploaded_n", { count: data.learnerCount || selectedIds.length }));
      setTitle("");
      setText("");
      setFile(null);
      setWeekStart("");
      setWeekEnd("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      void loadHistory();
    } catch (err: any) {
      setError(err.message || t("err_upload_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vi-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-6 py-4 flex items-center justify-between"
      >
        <div>
          <h2 className="font-heading font-bold vi-text">{t("teacher_section_title")}</h2>
          <p className="text-xs vi-text-muted mt-0.5">{t("teacher_section_desc")}</p>
        </div>
        <span className="text-sm vi-text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <form onSubmit={handleParse} className="px-6 pb-6 space-y-4 border-t vi-border pt-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold vi-text">{t("apply_to_learners")}</span>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={selectAll} className="vi-text-muted hover:underline">
                  {t("select_all")}
                </button>
                <button type="button" onClick={clearAll} className="vi-text-muted hover:underline">
                  {t("clear")}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
              {learners.length === 0 && (
                <p className="text-xs vi-text-muted">{t("no_connected_learners")}</p>
              )}
              {learners.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLearner(l.id)}
                  className={`text-xs rounded-full px-3 py-1.5 border ${
                    selectedIds.includes(l.id)
                      ? "bg-[hsl(var(--visual-primary))] text-white border-transparent"
                      : "vi-border vi-text"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>

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
                maxLength={120}
                placeholder={t("title_placeholder")}
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
              rows={5}
              maxLength={32000}
              placeholder={t("text_placeholder")}
              className="mt-1 block w-full rounded-lg border vi-border bg-transparent px-3 py-2 vi-text font-mono text-sm"
            />
          </label>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm vi-text-muted">{t("or_upload_file")}</span>
            <input
              ref={fileRef}
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

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={parsing || submitting}
              className="rounded-lg bg-[hsl(var(--visual-primary))] px-5 py-2 text-white font-semibold disabled:opacity-50"
            >
              {parsing ? t("parsing") : t("parse_preview")}
            </button>
          </div>

          {history.length > 0 && (
            <div className="rounded-lg border vi-border p-4 space-y-2">
              <h3 className="text-sm font-semibold vi-text">{t("teacher_history_heading")}</h3>
              <ul className="divide-y vi-border max-h-48 overflow-auto">
                {(() => {
                  // Group by classGroupId so a single multi-learner push collapses to one row.
                  const seen = new Set<string>();
                  const grouped: Array<{ entries: HistoryEntry[]; key: string }> = [];
                  for (const h of history) {
                    const key = h.classGroupId || h.id;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    grouped.push({
                      key,
                      entries: history.filter((x) => (x.classGroupId || x.id) === key),
                    });
                  }
                  return grouped.slice(0, 10).map((g) => {
                    const first = g.entries[0];
                    return (
                      <li key={g.key} className="py-2 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium vi-text truncate">
                            {first.title || t("untitled")}
                          </div>
                          <div className="vi-text-muted">
                            {t(`subject.${first.subject}`)} ·{" "}
                            {g.entries.length === 1
                              ? learnerNameById(first.learnerId)
                              : t("teacher_history_n_learners", { count: g.entries.length })}
                            {first.weekStart && ` · ${first.weekStart.slice(0, 10)}`}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 ${
                            first.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {first.status === "ACTIVE" ? t("status_active") : t("status_archived")}
                        </span>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border-2 border-[hsl(var(--visual-primary))] p-4 space-y-3 bg-[hsl(var(--visual-surface))]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold vi-text">{t("review_heading")}</h3>
                  <p className="text-xs vi-text-muted">{t("review_help")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-xs vi-text-muted hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              <label className="block">
                <span className="text-xs font-medium vi-text">{t("title_label")}</span>
                <input
                  type="text"
                  value={preview.title || ""}
                  onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                  maxLength={200}
                  className="mt-1 block w-full rounded border vi-border bg-transparent px-2 py-1 vi-text text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium vi-text">{t("summary")}</span>
                <textarea
                  value={preview.summary}
                  onChange={(e) => setPreview({ ...preview, summary: e.target.value })}
                  rows={2}
                  maxLength={2000}
                  className="mt-1 block w-full rounded border vi-border bg-transparent px-2 py-1 vi-text text-sm"
                />
              </label>
              {(["topics", "keywords", "standards", "skills"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-xs font-medium vi-text">{t(field)}</span>
                  <input
                    type="text"
                    value={preview[field].join(", ")}
                    onChange={(e) =>
                      setPreview({
                        ...preview,
                        [field]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder={t("comma_separated")}
                    className="mt-1 block w-full rounded border vi-border bg-transparent px-2 py-1 vi-text text-sm"
                  />
                </label>
              ))}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={submitting}
                  className="rounded-lg bg-[hsl(var(--visual-primary))] px-4 py-2 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {submitting ? t("submitting") : t("confirm_save")}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
