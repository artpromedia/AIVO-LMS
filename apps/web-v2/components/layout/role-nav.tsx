"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type RoleNavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Optional right-aligned slot (e.g. an unread-count badge). Rendered
   * after the label. Pass a client component to drive live updates.
   */
  badgeSlot?: React.ReactNode;
};

/**
 * Nav links inside the sidebar. Uses the `--color-aivo-sidebar-*` tokens
 * (set per role theme in globals.css) so that dark-sidebar themes
 * (learner, platform) render legibly without overriding the active state's
 * contrast on the primary-soft pill.
 */
export function RoleNav({ items, ariaLabel }: { items: RoleNavItem[]; ariaLabel: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "aivo-nav-link aivo-nav-link--active" : "aivo-nav-link",
            )}
          >
            {item.icon ? <span aria-hidden>{item.icon}</span> : null}
            <span className="flex-1">{item.label}</span>
            {item.badgeSlot ?? null}
          </Link>
        );
      })}
    </nav>
  );
}
