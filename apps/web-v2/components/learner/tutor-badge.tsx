import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function TutorBadge({
  name,
  persona,
  className,
}: {
  name: string;
  persona?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-aivo-primary-soft px-3 py-1 text-xs font-medium text-aivo-primary",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      <span>
        {name}
        {persona ? <span className="ml-1 opacity-80">· {persona}</span> : null}
      </span>
    </span>
  );
}
