"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  searchResources,
  RESOURCE_CATEGORIES,
  type ParentResource,
  type ResourceCategory,
} from "@/lib/parent/resources-content";

/**
 * Searchable, filterable resources list. Search is client-side over the curated
 * set (title + summary + tags + body). Categories are toggle chips. Honest empty
 * state when nothing matches.
 */
export function ResourcesBrowser({ resources }: { resources: ParentResource[] }) {
  const t = useTranslations("parent.resources");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<ResourceCategory | "all">("all");
  const results = React.useMemo(
    () => searchResources(resources, query, category),
    [resources, query, category],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aivo-ink-soft"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_placeholder")}
          aria-label={t("search_label")}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("category_label")}>
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          {t("all_categories")}
        </Chip>
        {RESOURCE_CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {t(`category_${c}`)}
          </Chip>
        ))}
      </div>

      <p className="text-sm text-aivo-ink-soft" aria-live="polite">
        {t("result_count", { count: results.length })}
      </p>

      {results.length === 0 ? (
        <EmptyState title={t("no_results_title")} description={t("no_results_body")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <li key={r.slug}>
              <Link href={`/parent/resources/${r.slug}`} className="block h-full">
                <Card className="flex h-full flex-col p-4 transition hover:border-aivo-accent">
                  <span className="text-xs font-medium uppercase tracking-wide text-aivo-accent">
                    {t(`category_${r.category}`)}
                  </span>
                  <p className="mt-1 font-display font-semibold text-iw-text-strong">{r.title}</p>
                  <p className="mt-1 flex-1 text-sm text-aivo-ink-soft">{r.summary}</p>
                  <p className="mt-2 text-xs text-aivo-ink-soft">
                    {t("read_minutes", { count: r.readMinutes })}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-aivo-accent text-white"
          : "border border-iw-border text-aivo-ink-soft hover:border-aivo-accent"
      }`}
    >
      {children}
    </button>
  );
}
