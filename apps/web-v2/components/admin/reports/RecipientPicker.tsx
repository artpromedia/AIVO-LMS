"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecipientPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (value.includes(email)) {
      setError("That recipient is already added.");
      return;
    }
    onChange([...value, email]);
    setDraft("");
    setError(null);
  }

  function remove(email: string) {
    onChange(value.filter((e) => e !== email));
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="name@example.com"
          className="h-11 flex-1 rounded-iw-card border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-aivo-danger">{error}</p> : null}
      {value.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((email) => (
            <li
              key={email}
              className="inline-flex items-center gap-1.5 rounded-full border border-iw-border bg-iw-card px-3 py-1 text-xs text-iw-ink"
            >
              {email}
              <button
                type="button"
                onClick={() => remove(email)}
                aria-label={`Remove ${email}`}
                className="text-iw-ink-muted hover:text-aivo-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
