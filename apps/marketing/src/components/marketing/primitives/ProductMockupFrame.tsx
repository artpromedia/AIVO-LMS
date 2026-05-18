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
      className={`rounded-2xl border border-slate-200 bg-white shadow-xl shadow-purple-900/5 overflow-hidden ${className}`}
      role="img"
      aria-label={title ? `Product preview: ${title}` : "Product preview"}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        {title && <span className="ml-2 text-xs font-medium text-slate-500">{title}</span>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
