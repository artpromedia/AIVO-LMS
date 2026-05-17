"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountForm({ initial }: { initial: { displayName: string } }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/bff/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.userMessage ?? "Could not save changes.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="displayName">
          Display name
        </label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          maxLength={120}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1"
        />
      </div>
      {error ? <p className="text-sm text-aivo-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-aivo-success">Saved.</p> : null}
      <Button type="submit" disabled={pending || displayName.trim().length === 0}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
