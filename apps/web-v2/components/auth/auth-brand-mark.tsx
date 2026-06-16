import { Sparkles } from "lucide-react";

/**
 * AivoBrandMark — the centered "AIVO" wordmark + tracked sublabel that tops
 * every auth card in the design mockups (AIVO · LEARNING / FAMILY / ADMIN).
 *
 * Colors flow through the iw-* sensory tokens so the mark repaints with the
 * rest of the surface; the wordmark uses a purple→teal gradient via
 * bg-clip-text.
 */
export function AivoBrandMark({
  sublabel = "Learning",
  align = "center",
  className,
}: {
  sublabel?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-0.5",
        align === "center" ? "items-center" : "items-start",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-5 w-5 text-iw-primary" aria-hidden="true" />
        <span className="font-iw-display text-3xl font-extrabold tracking-tight bg-gradient-to-r from-iw-primary to-iw-accent bg-clip-text text-transparent">
          AIVO
        </span>
      </div>
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-iw-accent pl-6">
        {sublabel}
      </span>
    </div>
  );
}

AivoBrandMark.displayName = "Auth/AivoBrandMark";
