"use client";

import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, User, Settings, Accessibility, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const item =
  "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-semibold text-iw-ink hover:bg-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring";

/**
 * Top-bar account menu (ParentApp.dc.html top bar): name + role chip + avatar
 * that opens to Profile / Settings / Accessibility / Sign out. Sign out posts
 * the real `logoutAction`; the rest are real routes.
 */
export function ParentUserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const t = useTranslations("parent.shell");
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("account_menu")}
          className="inline-flex items-center gap-2 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        >
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-[13px] font-bold text-iw-ink">{name}</span>
            <span className="block text-[11px] text-iw-ink-muted">{roleLabel}</span>
          </span>
          <Avatar name={name} size="md" />
          <ChevronDown className="hidden h-3.5 w-3.5 text-iw-ink-muted sm:block" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-56 rounded-iw-control border border-iw-border bg-iw-raised p-2 shadow-soft-3",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-iw-border px-2 pb-2.5 pt-1">
            <Avatar name={name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-iw-ink">{name}</p>
              <p className="truncate text-[11px] text-iw-ink-muted" title={email}>
                {email}
              </p>
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            <Popover.Close asChild>
              <Link href="/parent/settings" className={item}>
                <User className="h-4 w-4 text-iw-primary" aria-hidden="true" />
                {t("profile")}
              </Link>
            </Popover.Close>
            <Popover.Close asChild>
              <Link href="/parent/settings" className={item}>
                <Settings className="h-4 w-4 text-iw-primary" aria-hidden="true" />
                {t("settings")}
              </Link>
            </Popover.Close>
            <Popover.Close asChild>
              <Link href="/settings/accessibility" className={item}>
                <Accessibility className="h-4 w-4 text-iw-primary" aria-hidden="true" />
                {t("accessibility")}
              </Link>
            </Popover.Close>
            <div className="my-1 h-px bg-iw-border" />
            <form action={logoutAction}>
              <button
                type="submit"
                className={cn(item, "w-full text-[var(--aivo-status-warning-strong)]")}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t("sign_out")}
              </button>
            </form>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
