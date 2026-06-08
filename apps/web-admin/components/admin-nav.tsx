import Link from "next/link";
import { AdminCard } from "@aivo/admin-ui";

export type AdminNavItem = {
  href: string;
  title: string;
  description: string;
};

/** A responsive grid of link cards used to navigate between admin sections. */
export function AdminNavGrid({ heading, items }: { heading?: string; items: AdminNavItem[] }) {
  return (
    <section className="mt-8">
      {heading ? <h2 className="text-xl font-black">{heading}</h2> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <AdminCard className="p-5" key={item.href}>
            <h3 className="text-lg font-black">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            <Link className="mt-3 inline-flex text-sm font-bold text-blue-700" href={item.href}>
              Open
            </Link>
          </AdminCard>
        ))}
      </div>
    </section>
  );
}
