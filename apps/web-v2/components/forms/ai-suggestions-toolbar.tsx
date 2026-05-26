"use client";

import * as React from "react";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldType, SuggestionContext } from "@/lib/ai/suggestions";

type ServerResponse =
  | { ok: true; data: { suggestions: string[]; completion: string | null } }
  | { ok: false; error: { code: string; userMessage: string } };

type Props = {
  /** id of the <textarea> or <input> this toolbar augments. */
  targetId: string;
  /** Field-type discriminator the suggestion engine uses. */
  fieldType: FieldType;
  /** Optional context (age/grade) so suggestions can be age-appropriate. */
  context?: SuggestionContext;
  /** Separator inserted between entries when chip is clicked. */
  separator?: "newline" | "comma";
  /** When true, also fetch suggestions automatically while the user types. */
  autoSuggest?: boolean;
  className?: string;
};

/**
 * AISuggestionsToolbar
 *
 * Drop-in companion for any existing `<textarea>` / `<input>` that adds
 * AI-style suggestions and inline ghost-text autocomplete without
 * forcing the host page to become a client component or rewire to
 * controlled inputs. It locates the field by `targetId`, watches its
 * value via DOM events, and offers:
 *
 *   1. A "✨ Suggest" button that fetches chip-style ideas the parent
 *      can click to append to the field.
 *   2. Inline ghost-text completion of the partial token the parent is
 *      typing — pressing `Tab` or `→` accepts the completion.
 *   3. Optional auto-suggest while typing, debounced 600ms.
 *
 * The component keeps the underlying field uncontrolled (so the normal
 * `name=` / `defaultValue=` submission story still works) — it mutates
 * `.value` directly and dispatches an `input` event so any listeners
 * (validation, character counters) still fire.
 */
export function AISuggestionsToolbar({
  targetId,
  fieldType,
  context,
  separator = "newline",
  autoSuggest = true,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [completion, setCompletion] = React.useState<string | null>(null);
  const [textNow, setTextNow] = React.useState("");
  const ghostRef = React.useRef<HTMLDivElement | null>(null);
  const ghostHostRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Track the current field value so completion + dedupe stay in sync.
  React.useEffect(() => {
    const el = document.getElementById(targetId) as
      | HTMLTextAreaElement
      | HTMLInputElement
      | null;
    if (!el) return;
    const handler = () => setTextNow(el.value);
    setTextNow(el.value);
    el.addEventListener("input", handler);
    el.addEventListener("focus", handler);
    return () => {
      el.removeEventListener("input", handler);
      el.removeEventListener("focus", handler);
    };
  }, [targetId]);

  const existingItems = React.useMemo(
    () =>
      textNow
        .split(/[\n,·•]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [textNow],
  );

  const fetchSuggestions = React.useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
        setOpen(true);
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/bff/ai/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          signal: ctrl.signal,
          body: JSON.stringify({
            fieldType,
            currentText: textNow,
            context: {
              ageRange: context?.ageRange ?? null,
              gradeBand: context?.gradeBand ?? null,
              existingItems,
            },
          }),
        });
        const json = (await res.json()) as ServerResponse;
        if (!json.ok) {
          if (!silent) setError(json.error.userMessage);
          return;
        }
        setSuggestions(json.data.suggestions);
        setCompletion(json.data.completion);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        if (!silent) setError("Couldn't fetch suggestions. Try again.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fieldType, textNow, context?.ageRange, context?.gradeBand, existingItems],
  );

  // Auto-suggest: debounced refresh while typing, but only when the
  // palette is already open or the field has meaningful content.
  React.useEffect(() => {
    if (!autoSuggest) return;
    const t = setTimeout(() => {
      if (open || textNow.trim().length >= 2) {
        void fetchSuggestions(true);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [autoSuggest, textNow, open, fetchSuggestions]);

  const insertSuggestion = React.useCallback(
    (value: string) => {
      const el = document.getElementById(targetId) as
        | HTMLTextAreaElement
        | HTMLInputElement
        | null;
      if (!el) return;
      const current = el.value;
      const sep = separator === "newline" ? "\n" : ", ";
      let next: string;
      if (!current.trim()) {
        next = value;
      } else if (/[\n,]\s*$/.test(current) || current.endsWith(" ")) {
        next = current + value;
      } else {
        next = current + sep + value;
      }
      el.value = next;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
      // Drop the consumed suggestion from the chip palette.
      setSuggestions((prev) => prev.filter((s) => s !== value));
    },
    [targetId, separator],
  );

  const acceptCompletion = React.useCallback(() => {
    if (!completion) return;
    const el = document.getElementById(targetId) as
      | HTMLTextAreaElement
      | HTMLInputElement
      | null;
    if (!el) return;
    el.value = el.value + completion;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    setCompletion(null);
  }, [completion, targetId]);

  // Bind Tab / → to accept ghost-text completion when present.
  React.useEffect(() => {
    const el = document.getElementById(targetId) as
      | HTMLTextAreaElement
      | HTMLInputElement
      | null;
    if (!el) return;
    const onKey: EventListener = (ev) => {
      if (!completion) return;
      const ke = ev as KeyboardEvent;
      if (ke.key === "Tab" || (ke.key === "ArrowRight" && el.selectionStart === el.value.length)) {
        ke.preventDefault();
        acceptCompletion();
      } else if (ke.key === "Escape") {
        setCompletion(null);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [targetId, completion, acceptCompletion]);

  const handleToggle = () => {
    if (!open) {
      void fetchSuggestions(false);
    } else {
      setOpen(false);
    }
  };

  const hasGhost = Boolean(completion) && textNow.length > 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls={`${targetId}-ai-panel`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            "border-iw-border bg-iw-raised text-iw-ink hover:bg-iw-warm-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
            open && "bg-iw-warm-soft",
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-aivo-accent" aria-hidden="true" />
          )}
          {open ? "Hide suggestions" : "Suggest with AI"}
        </button>
        {hasGhost ? (
          <span
            ref={ghostHostRef}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-iw-border bg-iw-bg px-2.5 py-0.5 text-[11px] text-iw-ink-muted"
            aria-live="polite"
          >
            <span className="text-iw-ink-muted">finish with</span>
            <span ref={ghostRef} className="font-medium text-iw-ink">
              {completion}
            </span>
            <kbd className="ml-1 rounded border border-iw-border bg-iw-raised px-1 text-[10px] text-iw-ink-muted">Tab</kbd>
          </span>
        ) : null}
      </div>

      {open ? (
        <div
          id={`${targetId}-ai-panel`}
          role="region"
          aria-label="AI suggestions"
          className="rounded-iw-control border border-iw-border bg-iw-bg p-3"
        >
          {error ? (
            <p className="text-xs text-aivo-danger">{error}</p>
          ) : loading && suggestions.length === 0 ? (
            <p className="text-xs text-iw-ink-muted">Thinking of ideas…</p>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-iw-ink-muted">
              No new suggestions — everything we'd recommend is already in
              the box.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-iw-ink-muted">
                Tap to add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => insertSuggestion(s)}
                    className={cn(
                      "group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                      "border-iw-border bg-iw-raised text-iw-ink",
                      "hover:border-aivo-accent hover:bg-iw-warm-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
                    )}
                  >
                    <Plus className="h-3 w-3 text-iw-ink-muted group-hover:text-aivo-accent" aria-hidden="true" />
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => fetchSuggestions(false)}
                className="mt-2 text-[11px] text-iw-ink-muted underline-offset-2 hover:underline"
              >
                Refresh ideas
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
