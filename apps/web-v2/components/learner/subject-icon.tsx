import { BookOpen, Calculator, FlaskConical, Globe, Music, Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  reading: { Icon: BookOpen, tone: "bg-iw-accent-soft text-iw-primary" },
  math: { Icon: Calculator, tone: "bg-iw-warning/30 text-iw-ink" },
  science: { Icon: FlaskConical, tone: "bg-iw-success/20 text-iw-success" },
  social: { Icon: Globe, tone: "bg-iw-error/15 text-iw-error" },
  music: { Icon: Music, tone: "bg-iw-accent-soft text-iw-primary" },
  art: { Icon: Palette, tone: "bg-iw-warning/30 text-iw-ink" },
};

export function SubjectIcon({
  subject,
  className,
  label,
}: {
  subject: string;
  className?: string;
  label?: string;
}) {
  const entry = MAP[subject] ?? { Icon: Sparkles, tone: "bg-iw-raised text-iw-ink-muted" };
  const { Icon, tone } = entry;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      className={cn("inline-grid h-10 w-10 place-items-center rounded-lg", tone, className)}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}
