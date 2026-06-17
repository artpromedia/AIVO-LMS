"use client";

/**
 * Wave E (S12) — "What your tutor remembers" card.
 *
 * Lists every episodic memory the agent tutors keep about this learner —
 * kind, plain-language content, which tutor wrote it, and when it expires
 * — with a delete button per row. Nothing the tutor remembers is hidden
 * from the parent, and a delete is final (the row can never ride into
 * another session's context).
 *
 * Renders nothing at all when agentic mode is off for the tenant
 * (enabled:false with no rows), so non-pilot parents see no empty shell.
 */
import * as React from "react";
import { bffFetch } from "@/lib/api/client";
import { useTranslations } from "next-intl";
import { TUTORS } from "@aivo/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MemoryRow {
  id: string;
  tutorKey: string;
  kind: string;
  content: string;
  createdAt: string;
  expiresAt: string;
}

export function TutorMemoryCard({ learnerId }: { learnerId: string }) {
  const t = useTranslations("parent.tutor_memories");
  const [enabled, setEnabled] = React.useState(false);
  const [memories, setMemories] = React.useState<MemoryRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    bffFetch<{ enabled?: boolean; memories?: MemoryRow[] }>(
      `/api/bff/learners/${learnerId}/tutor-memories`,
    )
      .then((data) => {
        if (cancelled) return;
        setEnabled(data.enabled === true);
        setMemories(Array.isArray(data.memories) ? data.memories : []);
      })
      .catch(() => {
        // Memory card is additive parent context — absence reads as "off".
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  async function remove(memoryId: string) {
    setDeleting(memoryId);
    try {
      await bffFetch(`/api/bff/learners/${learnerId}/tutor-memories/${memoryId}`, {
        method: "DELETE",
      });
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } finally {
      setDeleting(null);
    }
  }

  // Off-pilot tenants see nothing — not even an empty card.
  if (!loaded || !enabled) return null;

  return (
    <Card data-testid="tutor-memory-card" className="p-[var(--aivo-density-card-pad)]">
      <h3 className="font-display text-lg">{t("title")}</h3>
      <p className="mt-1 text-sm text-iw-ink-muted">{t("description")}</p>
      {memories.length === 0 ? (
        <p data-testid="tutor-memory-empty" className="mt-3 text-sm text-iw-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {memories.map((m) => {
            const tutor = TUTORS[m.tutorKey as keyof typeof TUTORS];
            return (
              <li
                key={m.id}
                data-testid="tutor-memory-row"
                className="flex items-start justify-between gap-3 rounded-md border border-iw-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{t(`kind_${m.kind}`)}</Badge>
                    <span className="text-xs text-iw-ink-muted">
                      {tutor ? `${tutor.icon} ${tutor.name}` : m.tutorKey}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{m.content}</p>
                  <p className="mt-1 text-xs text-iw-ink-muted">
                    {t("expires", {
                      date: new Date(m.expiresAt).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(m.id)}
                  disabled={deleting === m.id}
                  aria-label={t("delete_label")}
                >
                  {t("delete")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
