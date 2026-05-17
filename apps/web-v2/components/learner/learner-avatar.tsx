import { cn } from "@/lib/utils";

const BG = [
  "bg-aivo-primary-soft text-aivo-primary",
  "bg-aivo-warning/30 text-aivo-ink",
  "bg-aivo-success/20 text-aivo-success",
  "bg-aivo-danger/15 text-aivo-danger",
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
