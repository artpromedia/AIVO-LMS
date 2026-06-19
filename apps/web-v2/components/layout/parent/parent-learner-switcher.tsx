"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Check, Users, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface SwitcherLearner {
  id: string;
  name: string;
  avatar?: string | null;
}

/**
 * Top-bar learner switcher (ParentApp.dc.html top bar). Reflects the active
 * learner from the `?learner=` query param and switches by navigating the
 * current route with that param — the Home reads it; other pages ignore it
 * harmlessly. Real learners come from `listLearnersForParent` (parent-scoped).
 */
export function ParentLearnerSwitcher({ learners }: { learners: SwitcherLearner[] }) {
  const t = useTranslations("parent.shell");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const selectedId = params?.get("learner") ?? null;
  const active = learners.find((l) => l.id === selectedId) ?? learners[0];
  if (!active) return null;

  const switchTo = (id: string) => {
    const qs = new URLSearchParams(params?.toString() ?? "");
    qs.set("learner", id);
    router.push(`${pathname}?${qs.toString()}`);
  };

  const avatarSrc = (l: SwitcherLearner) =>
    l.avatar && /^https?:\/\//.test(l.avatar) ? l.avatar : undefined;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("switch_learner")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border border-iw-border bg-iw-raised py-1 pl-1 pr-2.5 text-iw-ink shadow-sm transition-colors",
            "hover:border-iw-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
            "data-[state=open]:border-iw-primary",
          )}
        >
          <Avatar name={active.name} src={avatarSrc(active)} size="sm" />
          <span className="hidden text-[13px] font-bold sm:inline">{active.name.split(" ")[0]}</span>
          <ChevronDown className="h-3.5 w-3.5 text-iw-ink-muted" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-50 w-60 rounded-iw-control border border-iw-border bg-iw-raised p-2 shadow-soft-3",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-iw-ink-muted">
            {t("switch_learner")}
          </p>
          <div className="flex flex-col gap-0.5">
            {learners.map((l) => {
              const isActive = l.id === active.id;
              return (
                <Popover.Close asChild key={l.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(l.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
                      isActive ? "bg-iw-primary-soft" : "hover:bg-iw-card",
                    )}
                  >
                    <Avatar name={l.name} src={avatarSrc(l)} size="sm" />
                    <span className="flex-1 truncate text-sm font-bold text-iw-ink">{l.name}</span>
                    {isActive ? (
                      <Check className="h-4 w-4 text-iw-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                </Popover.Close>
              );
            })}
          </div>
          <div className="my-1.5 h-px bg-iw-border" />
          <Popover.Close asChild>
            <Link
              href="/parent/learners"
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-semibold text-iw-ink-muted hover:bg-iw-card"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              {t("manage_learners")}
            </Link>
          </Popover.Close>
          <Popover.Close asChild>
            <Link
              href="/parent/learners/new"
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-semibold text-iw-primary hover:bg-iw-card"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {t("add_learner")}
            </Link>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
