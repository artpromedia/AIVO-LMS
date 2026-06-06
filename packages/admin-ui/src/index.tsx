import type { ReactNode } from "react";

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function AdminPageFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-black">{title}</h1>
            {description ? <p className="mt-2 text-slate-600">{description}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </div>
    </main>
  );
}

export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx("admin-card", className)}>{children}</section>;
}

export function AdminMetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <AdminCard className="p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value.toLocaleString()}</p>
    </AdminCard>
  );
}
