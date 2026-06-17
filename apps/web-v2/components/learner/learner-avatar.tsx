import { cn } from "@/lib/utils";

const BG = [
  "bg-iw-accent-soft text-iw-primary",
  "bg-iw-warning/30 text-iw-ink",
  "bg-iw-success/20 text-iw-success",
  "bg-iw-error/15 text-iw-error",
];

function pickBg(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return BG[hash % BG.length];
}

export function LearnerAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-12 w-12 text-base", lg: "h-16 w-16 text-xl" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid place-items-center rounded-full font-bold",
        sizes[size],
        pickBg(name),
        className,
      )}
    >
      {initials}
    </span>
  );
}
