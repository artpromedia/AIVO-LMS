import { BookOpen, Calculator, FlaskConical, Globe, Music, Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  reading: { Icon: BookOpen, tone: "bg-aivo-primary-soft text-aivo-primary" },
  math: { Icon: Calculator, tone: "bg-aivo-warning/30 text-aivo-ink" },
  science: { Icon: FlaskConical, tone: "bg-aivo-success/20 text-aivo-success" },
  social: { Icon: Globe, tone: "bg-aivo-danger/15 text-aivo-danger" },
  music: { Icon: Music, tone: "bg-aivo-primary-soft text-aivo-primary" },
  art: { Icon: Palette, tone: "bg-aivo-warning/30 text-aivo-ink" },
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
  const entry = MAP[subject] ?? { Icon: Sparkles, tone: "bg-aivo-surface-2 text-aivo-ink-soft" };
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
