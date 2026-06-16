import type { ReactNode } from "react";

export function ProductMockupFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-iw-card border border-iw-border bg-white shadow-soft-5 overflow-hidden ${className}`}
      role="img"
      aria-label={title ? `Product preview: ${title}` : "Product preview"}
    >
      <div className="flex items-center gap-1.5 border-b border-iw-border bg-iw-raised/70 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-iw-error/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-iw-warning" />
        <span className="h-2.5 w-2.5 rounded-full bg-iw-success" />
        {title && <span className="ml-2 text-xs font-medium text-iw-ink-muted">{title}</span>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
