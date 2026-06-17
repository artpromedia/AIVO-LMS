import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const alignment = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`${alignment} max-w-3xl ${className}`}>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-iw-primary">{eyebrow}</p>
      )}
      <h2 className="mt-3 font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-iw-ink">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-iw-ink-muted">{subtitle}</p>}
    </div>
  );
}
