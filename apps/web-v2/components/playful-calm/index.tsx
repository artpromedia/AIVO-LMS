import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function LearningPath({ nodes }: { nodes: Array<{ id: string; label: string; state: "locked" | "current" | "complete" }> }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {nodes.map((node) => (
        <Card key={node.id} className="p-4">
          <Badge tone={node.state === "complete" ? "success" : node.state === "current" ? "primary" : "neutral"}>
            {node.state}
          </Badge>
          <p className="mt-2 font-display text-lg">{node.label}</p>
        </Card>
      ))}
    </ol>
  );
}

export function MascotCoach({ name, tip }: { name: string; tip: string }) {
  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <p className="text-xs uppercase tracking-wide text-aivo-muted">{name}</p>
      <p className="mt-1 font-display text-xl">{tip}</p>
      <Button className="mt-3" variant="soft">Read aloud</Button>
    </Card>
  );
}

export function AudioControlBar() {
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className="text-sm text-aivo-ink-soft">Audio controls</span>
      <Badge tone="primary">Voice: Calm</Badge>
      <Badge tone="neutral">Speed: 1.0x</Badge>
      <Badge tone="neutral">Volume: 60%</Badge>
    </Card>
  );
}

export function StickerBook({ earned, total }: { earned: number; total: number }) {
  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <p className="font-display text-xl">Sticker Book</p>
      <p className="text-sm text-aivo-ink-soft">{earned}/{total} collected</p>
      <Progress className="mt-3" value={(earned / Math.max(total, 1)) * 100} />
    </Card>
  );
}

export function FocusMode({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-aivo-surface p-[var(--aivo-density-card-pad)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">{title}</h2>
        <Badge tone="primary">Focus mode</Badge>
      </div>
      {children}
    </Card>
  );
}
