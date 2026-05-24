"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_HOMEWORK_MIME_TYPES,
  MAX_HOMEWORK_ATTACHMENT_BYTES,
} from "@/lib/homework/attachments";

const ACCEPT_ATTR = ALLOWED_HOMEWORK_MIME_TYPES.join(",");

type SelectedAttachment = {
  file: File;
  dataBase64: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      // result is a data URL ("data:image/png;base64,<...>"); strip the prefix.
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function StartHomeworkForm({ learnerId }: { learnerId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState("");
  const [attachment, setAttachment] = useState<SelectedAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (!(ALLOWED_HOMEWORK_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("Please choose a PNG, JPEG, WEBP, or PDF file.");
      return;
    }
    if (file.size > MAX_HOMEWORK_ATTACHMENT_BYTES) {
      setError("That file is larger than 10 MB.");
      return;
    }
    try {
      const dataBase64 = await fileToBase64(file);
      setAttachment({ file, dataBase64 });
    } catch {
      setError("Could not read that file. Try a different one.");
    }
  }

  function removeAttachment() {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Please describe what you're working on.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { topic: trimmed };
      if (attachment) {
        payload.attachment = {
          mimeType: attachment.file.type,
          filename: attachment.file.name,
          dataBase64: attachment.dataBase64,
        };
      }
      const res = await fetch(`/api/bff/learners/${learnerId}/homework`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { session: { id: string } };
        error?: { message: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setError(body.error?.message ?? "Couldn't start a session. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/learner/homework/${body.data.session.id}`);
    } catch {
      setError("Couldn't reach the helper. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label htmlFor="hw-topic" className="text-sm font-medium">
        What do you need help with?
      </label>
      <textarea
        id="hw-topic"
        name="topic"
        rows={3}
        maxLength={500}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. I have to add 27 + 14 and I don't know how to carry"
        className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        required
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="hw-attachment" className="text-sm font-medium">
          Add a photo or PDF (optional)
        </label>
        <input
          ref={fileInputRef}
          id="hw-attachment"
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onPickFile}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
        />
        {attachment ? (
          <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
            <span className="truncate">
              {attachment.file.name} · {(attachment.file.size / 1024).toFixed(0)} KB
            </span>
            <button
              type="button"
              onClick={removeAttachment}
              className="text-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Starting…" : "Get help"}
        </Button>
      </div>
    </form>
  );
}
