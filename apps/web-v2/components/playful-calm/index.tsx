import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/**
 * Shared dashboard primitives. The folder name is `playful-calm/` for
 * historical reasons (renaming is out of scope for the Inclusive-Warm
 * rollout) — every primitive below has been re-skinned onto the
 * Inclusive-Warm token surface (`iw-*` Tailwind classes from
 * `@aivo/brand/tailwind-preset`), so a single sensory-mode toggle in
 * the top bar repaints them all without per-component wiring.
 */

export function LearningPath({
  nodes,
}: {
  nodes: Array<{ id: string; label: string; state: "locked" | "current" | "complete" }>;
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {nodes.map((node) => (
        <Card
          key={node.id}
          variant={node.state === "current" ? "elevated" : "flat"}
          className="p-[var(--aivo-density-card-pad,1.25rem)]"
        >
          <Badge
            tone={
              node.state === "complete"
                ? "success"
                : node.state === "current"
                  ? "primary"
                  : "neutral"
            }
          >
            {node.state}
          </Badge>
          <p className="mt-2 font-iw-display text-lg font-semibold text-iw-ink">{node.label}</p>
        </Card>
      ))}
    </ol>
  );
}

export function MascotCoach({ name, tip }: { name: string; tip: string }) {
  return (
    <Card variant="accent" className="p-[var(--aivo-density-card-pad,1.25rem)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-iw-ink-muted">
        {name}
      </p>
      <p className="mt-1 font-iw-display text-xl font-semibold text-iw-ink">{tip}</p>
      <Button className="mt-3" variant="soft">
        Read aloud
      </Button>
    </Card>
  );
}

export function AudioControlBar() {
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className="text-sm text-iw-ink-muted">Audio controls</span>
      <Badge tone="primary">Voice: Calm</Badge>
      <Badge tone="neutral">Speed: 1.0x</Badge>
      <Badge tone="neutral">Volume: 60%</Badge>
    </Card>
  );
}

export function StickerBook({ earned, total }: { earned: number; total: number }) {
  return (
    <Card variant="warm" className="p-[var(--aivo-density-card-pad,1.25rem)]">
      <p className="font-iw-display text-xl font-semibold text-iw-ink">Sticker Book</p>
      <p className="text-sm text-iw-ink-muted">
        {earned}/{total} collected
      </p>
      <Progress className="mt-3" value={(earned / Math.max(total, 1)) * 100} />
    </Card>
  );
}

export function FocusMode({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-iw-card p-[var(--aivo-density-card-pad,1.25rem)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-iw-display text-2xl font-semibold text-iw-ink">{title}</h2>
        <Badge tone="primary">Focus mode</Badge>
      </div>
      {children}
    </Card>
  );
}
