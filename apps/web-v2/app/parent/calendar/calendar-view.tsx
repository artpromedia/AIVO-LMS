"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  addMonths,
  buildMonthGrid,
  buildWeekKeys,
  dayKeyInTz,
  groupEventsByDay,
  eventsInDayRange,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/parent/calendar";

type View = "month" | "week" | "agenda";

interface LearnerOption {
  id: string;
  displayName: string;
}

const KIND_DOT: Record<CalendarEventKind, string> = {
  assignment: "bg-aivo-accent",
  lesson: "bg-aivo-success",
  session: "bg-aivo-primary",
  therapy: "bg-aivo-warning",
};

const DAY_MS = 86_400_000;
const shiftKey = (dateKey: string, days: number): string =>
  new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const partsOf = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return { year: y, month0: m - 1, day: d };
};

/**
 * Accessible parent calendar. Aggregated real events render as month / week /
 * agenda. The month grid is a keyboard-navigable WAI-ARIA grid (arrow keys move
 * one day, up/down a week, Home/End to week edges, PageUp/PageDown a month).
 * Events are bucketed into the viewer's local day; "today" comes from the
 * server so SSR and hydration agree.
 */
export function CalendarView({
  events,
  learners,
  todayKey,
}: {
  events: CalendarEvent[];
  learners: LearnerOption[];
  todayKey: string;
}) {
  const t = useTranslations("parent.calendar");
  const [view, setView] = React.useState<View>("month");
  const [cursor, setCursor] = React.useState(todayKey);
  const [selected, setSelected] = React.useState(todayKey);
  const [activeLearner, setActiveLearner] = React.useState<string | "all">("all");
  const gridRef = React.useRef<HTMLDivElement>(null);
  const focusPending = React.useRef(false);

  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`weekday_${i}`));
  const filtered = React.useMemo(
    () => (activeLearner === "all" ? events : events.filter((e) => e.learnerId === activeLearner)),
    [events, activeLearner],
  );
  const byDay = React.useMemo(() => groupEventsByDay(filtered), [filtered]);

  // Move keyboard focus to the cursor cell after an arrow key changed it.
  React.useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${cursor}"]`);
    el?.focus();
  }, [cursor]);

  function moveCursor(days: number) {
    focusPending.current = true;
    setCursor((c) => shiftKey(c, days));
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        moveCursor(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveCursor(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveCursor(-7);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveCursor(7);
        break;
      case "Home": {
        e.preventDefault();
        focusPending.current = true;
        setCursor(buildWeekKeys(cursor)[0]);
        break;
      }
      case "End": {
        e.preventDefault();
        focusPending.current = true;
        setCursor(buildWeekKeys(cursor)[6]);
        break;
      }
      case "PageUp": {
        e.preventDefault();
        const { year, month0, day } = partsOf(cursor);
        const m = addMonths(year, month0, -1);
        focusPending.current = true;
        setCursor(`${m.year}-${String(m.month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        break;
      }
      case "PageDown": {
        e.preventDefault();
        const { year, month0, day } = partsOf(cursor);
        const m = addMonths(year, month0, 1);
        focusPending.current = true;
        setCursor(`${m.year}-${String(m.month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        setSelected(cursor);
        break;
    }
  }

  const { year, month0 } = partsOf(cursor);
  const monthCells = buildMonthGrid(year, month0);
  const weekKeys = buildWeekKeys(cursor);
  const monthLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function step(direction: -1 | 1) {
    if (view === "month") {
      const m = addMonths(year, month0, direction);
      setCursor(`${m.year}-${String(m.month0 + 1).padStart(2, "0")}-01`);
    } else {
      setCursor((c) => shiftKey(c, direction * 7));
    }
  }

  const periodLabel = view === "agenda" ? t("upcoming") : view === "week" ? t("week_of", { date: prettyDate(weekKeys[0]) }) : monthLabel;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label={t("view_label")}>
          {(["month", "week", "agenda"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-iw-control px-3 py-1.5 text-sm font-medium transition ${
                view === v
                  ? "bg-aivo-accent text-white"
                  : "border border-iw-border text-aivo-ink-soft hover:border-aivo-accent"
              }`}
            >
              {t(`view_${v}`)}
            </button>
          ))}
        </div>
        {view !== "agenda" ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label={t("previous")}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCursor(todayKey);
                setSelected(todayKey);
              }}
            >
              {t("today")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => step(1)} aria-label={t("next")}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      <p className="font-display text-lg font-semibold text-iw-text-strong" aria-live="polite">
        {periodLabel}
      </p>

      {/* Per-learner filter */}
      {learners.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("filter_label")}>
          <FilterChip active={activeLearner === "all"} onClick={() => setActiveLearner("all")}>
            {t("all_learners")}
          </FilterChip>
          {learners.map((l) => (
            <FilterChip
              key={l.id}
              active={activeLearner === l.id}
              onClick={() => setActiveLearner(l.id)}
            >
              {l.displayName}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {view === "agenda" ? (
        <AgendaList events={filtered} t={t} />
      ) : view === "week" ? (
        <WeekView
          weekKeys={weekKeys}
          byDay={byDay}
          weekdayLabels={weekdayLabels}
          todayKey={todayKey}
          t={t}
        />
      ) : (
        <>
          <div
            ref={gridRef}
            role="grid"
            aria-label={t("grid_label", { month: monthLabel })}
            onKeyDown={onGridKeyDown}
            className="overflow-hidden rounded-iw-card border border-iw-border"
          >
            <div role="row" className="grid grid-cols-7 border-b border-iw-border bg-iw-raised">
              {weekdayLabels.map((w, i) => (
                <div
                  key={i}
                  role="columnheader"
                  className="px-2 py-2 text-center text-xs font-semibold text-aivo-ink-soft"
                >
                  <span aria-hidden>{w.slice(0, 3)}</span>
                  <span className="sr-only">{w}</span>
                </div>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, wk) => (
              <div role="row" key={wk} className="grid grid-cols-7">
                {monthCells.slice(wk * 7, wk * 7 + 7).map((cell) => (
                  <DayCell
                    key={cell.dateKey}
                    cell={cell}
                    events={byDay.get(cell.dateKey) ?? []}
                    isToday={cell.dateKey === todayKey}
                    isSelected={cell.dateKey === selected}
                    isCursor={cell.dateKey === cursor}
                    onSelect={() => {
                      setCursor(cell.dateKey);
                      setSelected(cell.dateKey);
                    }}
                    t={t}
                  />
                ))}
              </div>
            ))}
          </div>
          <DayDetail dateKey={selected} events={byDay.get(selected) ?? []} t={t} />
        </>
      )}
    </div>
  );
}

function FilterChip({
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
        active ? "bg-aivo-accent text-white" : "border border-iw-border text-aivo-ink-soft hover:border-aivo-accent"
      }`}
    >
      {children}
    </button>
  );
}

function DayCell({
  cell,
  events,
  isToday,
  isSelected,
  isCursor,
  onSelect,
  t,
}: {
  cell: { dateKey: string; inMonth: boolean };
  events: CalendarEvent[];
  isToday: boolean;
  isSelected: boolean;
  isCursor: boolean;
  onSelect: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const day = Number(cell.dateKey.split("-")[2]);
  const label = `${prettyDate(cell.dateKey)}${events.length ? `, ${t("events_count", { count: events.length })}` : `, ${t("no_events")}`}`;
  return (
    <button
      type="button"
      role="gridcell"
      data-key={cell.dateKey}
      tabIndex={isCursor ? 0 : -1}
      aria-selected={isSelected}
      aria-label={label}
      onClick={onSelect}
      className={`flex min-h-[5rem] flex-col gap-1 border-b border-r border-iw-border p-1.5 text-left last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-aivo-accent ${
        cell.inMonth ? "" : "bg-iw-raised/40 text-aivo-ink-soft"
      } ${isSelected ? "ring-2 ring-inset ring-aivo-accent" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          isToday ? "bg-aivo-accent text-white" : "text-iw-text-strong"
        }`}
      >
        {day}
      </span>
      <span className="flex flex-col gap-0.5">
        {events.slice(0, 2).map((e) => (
          <span key={e.id} className="flex items-center gap-1 truncate text-[11px] text-aivo-ink-soft">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} aria-hidden />
            <span className="truncate">{e.title}</span>
          </span>
        ))}
        {events.length > 2 ? (
          <span className="text-[11px] font-medium text-aivo-accent">
            {t("more_count", { count: events.length - 2 })}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function DayDetail({
  dateKey,
  events,
  t,
}: {
  dateKey: string;
  events: CalendarEvent[];
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <section aria-label={t("day_events", { date: prettyDate(dateKey) })} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-iw-text-strong">{prettyDate(dateKey)}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-aivo-ink-soft">{t("no_events_day")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <EventRow key={e.id} event={e} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekView({
  weekKeys,
  byDay,
  weekdayLabels,
  todayKey,
  t,
}: {
  weekKeys: string[];
  byDay: Map<string, CalendarEvent[]>;
  weekdayLabels: string[];
  todayKey: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {weekKeys.map((key, i) => {
        const events = byDay.get(key) ?? [];
        return (
          <li
            key={key}
            className={`rounded-iw-card border p-3 ${key === todayKey ? "border-aivo-accent" : "border-iw-border"}`}
          >
            <p className="text-sm font-semibold text-iw-text-strong">
              {weekdayLabels[i]} · {prettyDate(key)}
            </p>
            {events.length === 0 ? (
              <p className="mt-1 text-xs text-aivo-ink-soft">{t("no_events_day")}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {events.map((e) => (
                  <EventRow key={e.id} event={e} t={t} />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AgendaList({
  events,
  t,
}: {
  events: CalendarEvent[];
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = eventsInDayRange(events, todayKey, "9999-12-31");
  const byDay = groupEventsByDay(upcoming);
  const days = [...byDay.keys()].sort();
  if (days.length === 0) {
    return <EmptyState title={t("empty_title")} description={t("empty_body")} />;
  }
  return (
    <div className="flex flex-col gap-4">
      {days.map((key) => (
        <section key={key} aria-label={prettyDate(key)}>
          <h3 className="mb-2 text-sm font-semibold text-iw-text-strong">{prettyDate(key)}</h3>
          <ul className="flex flex-col gap-2">
            {byDay.get(key)!.map((e) => (
              <EventRow key={e.id} event={e} t={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EventRow({
  event,
  t,
}: {
  event: CalendarEvent;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-iw-control border border-iw-border bg-iw-card p-3">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT[event.kind]}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-iw-text-strong">{event.title}</p>
        <p className="text-xs text-aivo-ink-soft">
          {t(`kind_${event.kind}`)}
          {event.subjectName ? ` · ${event.subjectName}` : ""} · {event.learnerName}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {event.href ? (
          <Link
            href={event.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-aivo-accent hover:underline"
          >
            {t("open")}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
        {event.rescheduleHref ? (
          <Link
            href={event.rescheduleHref}
            className="text-xs font-medium text-aivo-primary hover:underline"
          >
            {t("reschedule")}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function prettyDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? dateKey
    : d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}
