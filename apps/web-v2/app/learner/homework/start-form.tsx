"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StartHomeworkForm({ learnerId }: { learnerId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch(`/api/bff/learners/${learnerId}/homework`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
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
