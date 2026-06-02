"use client";

/**
 * Phase 1 (weekly curriculum sync): "This week at school" manager used by both
 * the parent and teacher learner views. Lets a parent/teacher paste or upload
 * the week's syllabus, review the AI-extracted topics/vocabulary/standards,
 * and save it so AIVO's tutor teaches in sync with class.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CurriculumFocus = {
  title: string;
  subject: string;
  weekStart: string | null;
  weekEnd: string | null;
  topics: string[];
  keywords: string[];
  standards: string[];
  skills: string[];
  summary: string;
  confidence: number;
};

type Upload = {
  id: string;
  subject: string;
  title: string;
  status: "active" | "archived";
  weekStart: string | null;
  weekEnd: string | null;
  parsedFocus: CurriculumFocus;
  uploaderRole?: string;
  createdAt: string;
};

type SubjectOption = { slug: string; name: string };

const FALLBACK_SUBJECTS: SubjectOption[] = [
  { slug: "math", name: "Math" },
  { slug: "reading", name: "Reading" },
  { slug: "writing", name: "Writing" },
  { slug: "science", name: "Science" },
  { slug: "social", name: "Social Studies" },
  { slug: "art", name: "Art" },
  { slug: "life", name: "Life Skills" },
  { slug: "other", name: "Other" },
];

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
}

function commaList(arr: string[]): string {
  return (arr ?? []).join(", ");
}
function splitList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function CurriculumManager({
  apiBase,
  learnerName,
  initialUploads,
  subjects,
}: {
  /** e.g. /api/bff/parent/learners/<id>/curriculum */
  apiBase: string;
  learnerName: string;
  initialUploads: Upload[];
  subjects?: SubjectOption[];
}) {
  const router = useRouter();
  const subjectOptions = subjects && subjects.length > 0 ? subjects : FALLBACK_SUBJECTS;

  const [uploads, setUploads] = useState<Upload[]>(initialUploads);
  const [subject, setSubject] = useState(subjectOptions[0]?.slug ?? "other");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const [draft, setDraft] = useState<CurriculumFocus | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [busy, setBusy] = useState<"idle" | "analyzing" | "saving" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is larger than 5 MB. Please upload a smaller file.");
      return;
    }
    setFileName(file.name);
    setMimeType(file.type || "application/octet-stream");
    if (file.type === "text/plain") {
      setText(await file.text());
      setImageBase64(null);
    } else {
      setImageBase64(await fileToBase64(file));
    }
  }

  async function onAnalyze() {
    setError(null);
    if (!text.trim() && !imageBase64) {
      setError("Paste the week's plan or upload a file first.");
      return;
    }
    setBusy("analyzing");
    try {
      const res = await fetch(`${apiBase}/parse-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          imageBase64: imageBase64 || undefined,
          mimeType: mimeType || undefined,
          subject,
          weekStart: weekStart || undefined,
          weekEnd: weekEnd || undefined,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { parsed: CurriculumFocus; usedFallback: boolean };
        error?: { userMessage?: string; message?: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setError(
          body.error?.userMessage ?? body.error?.message ?? "Couldn't analyze that. Try again.",
        );
        setBusy("idle");
        return;
      }
      setDraft({
        ...body.data.parsed,
        subject: body.data.parsed.subject || subject,
        weekStart: body.data.parsed.weekStart || weekStart || null,
        weekEnd: body.data.parsed.weekEnd || weekEnd || null,
      });
      setUsedFallback(body.data.usedFallback);
      setBusy("idle");
    } catch {
      setError("Network problem. Please try again.");
      setBusy("idle");
    }
  }

  async function onSave() {
    if (!draft) return;
    setError(null);
    if (draft.topics.length === 0 && !draft.summary.trim()) {
      setError("Add at least one topic or a short summary before saving.");
      return;
    }
    setBusy("saving");
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          title: draft.title,
          text,
          sourceType: imageBase64 ? "file" : "text",
          fileName,
          parsedFocus: draft,
          weekStart: draft.weekStart || undefined,
          weekEnd: draft.weekEnd || undefined,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { upload: Upload };
        error?: { userMessage?: string; message?: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setError(body.error?.userMessage ?? body.error?.message ?? "Couldn't save. Try again.");
        setBusy("idle");
        return;
      }
      setUploads((prev) => [
        body.data!.upload,
        ...prev.map((u) =>
          u.subject === body.data!.upload.subject && u.status === "active"
            ? { ...u, status: "archived" as const }
            : u,
        ),
      ]);
      // Reset the form.
      setDraft(null);
      setText("");
      setFileName(null);
      setImageBase64(null);
      setMimeType(null);
      setWeekStart("");
      setWeekEnd("");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
      setBusy("idle");
    }
  }

  async function onDelete(id: string) {
    setBusy("deleting");
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: { userMessage?: string } };
      if (!res.ok || !body.ok) {
        setError(body.error?.userMessage ?? "Couldn't remove that. Try again.");
        setBusy("idle");
        return;
      }
      setUploads((prev) => prev.filter((u) => u.id !== id));
      setBusy("idle");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
      setBusy("idle");
    }
  }

  const subjectName = (slug: string) => subjectOptions.find((s) => s.slug === slug)?.name ?? slug;

  return (
    <div className="grid gap-6">
      {/* Upload / analyze form */}
      <Card className="grid gap-4 p-[var(--aivo-density-card-pad)]">
        <div>
          <h2 className="text-base font-semibold">Add this week&apos;s lessons</h2>
          <p className="text-sm text-muted-foreground">
            Paste or upload what {learnerName} is covering in class this week. AIVO&apos;s tutor
            will teach the same topics, fitted to {learnerName}&apos;s learning profile.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <label htmlFor="cm-subject" className="text-sm font-medium">
              Subject
            </label>
            <select
              id="cm-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {subjectOptions.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="cm-start" className="text-sm font-medium">
              Week starts
            </label>
            <input
              id="cm-start"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="cm-end" className="text-sm font-medium">
              Week ends
            </label>
            <input
              id="cm-end"
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label htmlFor="cm-text" className="text-sm font-medium">
            Paste the weekly plan / syllabus
          </label>
          <textarea
            id="cm-text"
            rows={5}
            maxLength={32000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Mon–Fri: multiplying fractions, equivalent fractions, word problems. Vocabulary: numerator, denominator…"
            className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="flex items-center gap-3 text-sm">
            <label className="cursor-pointer text-primary underline">
              Or upload a file (image, PDF, or .txt)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                className="sr-only"
                onChange={onPickFile}
              />
            </label>
            {fileName && <span className="text-muted-foreground">{fileName}</span>}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {!draft && (
          <div className="flex gap-2">
            <Button type="button" onClick={onAnalyze} disabled={busy !== "idle"}>
              {busy === "analyzing" ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
        )}
      </Card>

      {/* Review + edit extracted focus */}
      {draft && (
        <Card className="grid gap-4 p-[var(--aivo-density-card-pad)]">
          <div>
            <h2 className="text-base font-semibold">Review &amp; save</h2>
            <p className="text-sm text-muted-foreground">
              {usedFallback
                ? "We pulled out the basics — please check and edit before saving."
                : "Here's what we found. Edit anything that's off, then save."}
            </p>
          </div>

          <div className="grid gap-2">
            <label htmlFor="cm-title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="cm-title"
              type="text"
              maxLength={200}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="cm-topics" className="text-sm font-medium">
              Topics (one per line or comma-separated)
            </label>
            <textarea
              id="cm-topics"
              rows={3}
              value={commaList(draft.topics)}
              onChange={(e) => setDraft({ ...draft, topics: splitList(e.target.value) })}
              className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="cm-vocab" className="text-sm font-medium">
                Vocabulary
              </label>
              <textarea
                id="cm-vocab"
                rows={2}
                value={commaList(draft.keywords)}
                onChange={(e) => setDraft({ ...draft, keywords: splitList(e.target.value) })}
                className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="cm-standards" className="text-sm font-medium">
                Standards
              </label>
              <textarea
                id="cm-standards"
                rows={2}
                value={commaList(draft.standards)}
                onChange={(e) => setDraft({ ...draft, standards: splitList(e.target.value) })}
                className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="cm-summary" className="text-sm font-medium">
              Summary
            </label>
            <textarea
              id="cm-summary"
              rows={2}
              maxLength={2000}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={onSave} disabled={busy !== "idle"}>
              {busy === "saving" ? "Saving…" : "Save this week's focus"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={busy !== "idle"}
            >
              Back
            </Button>
          </div>
        </Card>
      )}

      {/* Existing uploads */}
      <Card className="grid gap-3 p-[var(--aivo-density-card-pad)]">
        <h2 className="text-base font-semibold">Saved weekly plans</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Add this week&apos;s lessons above to keep {learnerName}&apos;s tutoring in
            sync with school.
          </p>
        ) : (
          <ul className="grid gap-3">
            {uploads.map((u) => (
              <li
                key={u.id}
                className="rounded-md border border-border p-3 text-sm"
                data-status={u.status}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {u.title}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {subjectName(u.subject)}
                      </span>
                      {u.status === "active" ? (
                        <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Active
                        </span>
                      ) : (
                        <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Past
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(u.weekStart)} – {fmtDate(u.weekEnd)}
                    </p>
                    {u.parsedFocus?.topics?.length > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        {u.parsedFocus.topics.slice(0, 5).join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onDelete(u.id)}
                    disabled={busy !== "idle"}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
