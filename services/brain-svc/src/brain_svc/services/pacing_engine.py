"""Phase 2 — calendar-driven weekly pacing.

Pure functions that turn an AI-generated scope-&-sequence into a dated,
week-by-week plan aligned to a school calendar. Instruction is paced one
"unit-week" per calendar week and pauses over breaks (holidays/summer), so the
plan stays in step with the learner's actual school year. Break weeks are
emitted with ``kind="break"`` so a later phase can fill them with holiday-prep
content.

These functions are intentionally side-effect free (no DB, no LLM) so they can
be unit-tested deterministically.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def _parse_date(v: Any) -> date | None:
    if isinstance(v, date):
        return v
    if isinstance(v, str) and v.strip():
        try:
            return date.fromisoformat(v.strip()[:10])
        except ValueError:
            return None
    return None


def _clean_list(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    return [str(x).strip() for x in v if x is not None and str(x).strip()]


def flatten_unit_weeks(scope_sequence: dict) -> list[dict]:
    """Expand terms -> units into one entry per instructional week.

    A unit with ``duration_weeks: 3`` yields three identical unit-weeks so the
    pacing walk can lay them onto the calendar one week at a time.
    """
    out: list[dict] = []
    for term in scope_sequence.get("terms", []) or []:
        term_number = term.get("term_number")
        for unit in term.get("units", []) or []:
            try:
                weeks = int(unit.get("duration_weeks"))
            except (TypeError, ValueError):
                weeks = 1
            weeks = max(1, weeks)
            objectives = _clean_list(unit.get("learning_objectives"))
            title = unit.get("title")
            topics = objectives or ([str(title)] if title else [])
            entry = {
                "term_number": term_number,
                "unit_title": title,
                "topics": topics,
                "standards": _clean_list(unit.get("standards_addressed")),
                "objectives": objectives,
                "vocabulary": _clean_list(unit.get("key_vocabulary")),
            }
            out.extend(dict(entry) for _ in range(weeks))
    return out


def _overlapping_break(week_start: date, week_end: date, breaks: list[dict]) -> dict | None:
    for b in breaks:
        bs = _parse_date(b.get("start_date"))
        be = _parse_date(b.get("end_date"))
        if bs is None or be is None:
            continue
        # Inclusive overlap between [week_start, week_end] and [bs, be].
        if week_start <= be and bs <= week_end:
            return b
    return None


def build_pacing_weeks(
    scope_sequence: dict,
    breaks: list[dict] | None,
    plan_start: Any,
    max_weeks: int = 120,
) -> list[dict]:
    """Lay the scope-&-sequence onto a weekly calendar starting at ``plan_start``.

    Each calendar week (7 days) gets either the next instructional unit-week or,
    if it overlaps a break, a ``kind="break"`` placeholder (instruction pauses).
    The walk ends once every instructional unit-week is placed.
    """
    unit_weeks = flatten_unit_weeks(scope_sequence)
    breaks = breaks or []
    start = _parse_date(plan_start)
    if start is None:
        raise ValueError("plan_start must be a date or ISO date string")

    weeks: list[dict] = []
    cursor = start
    placed = 0  # index into unit_weeks
    week_index = 0
    while placed < len(unit_weeks) and week_index < max_weeks:
        ws = cursor
        we = cursor + timedelta(days=6)
        br = _overlapping_break(ws, we, breaks)
        if br is not None:
            weeks.append(
                {
                    "week_index": week_index,
                    "week_start": ws.isoformat(),
                    "week_end": we.isoformat(),
                    "kind": "break",
                    "term_number": None,
                    "unit_title": br.get("name"),
                    "topics": [],
                    "standards": [],
                    "objectives": [],
                    "vocabulary": [],
                }
            )
        else:
            uw = unit_weeks[placed]
            placed += 1
            weeks.append(
                {
                    "week_index": week_index,
                    "week_start": ws.isoformat(),
                    "week_end": we.isoformat(),
                    "kind": "instruction",
                    "term_number": uw["term_number"],
                    "unit_title": uw["unit_title"],
                    "topics": uw["topics"],
                    "standards": uw["standards"],
                    "objectives": uw["objectives"],
                    "vocabulary": uw["vocabulary"],
                }
            )
        week_index += 1
        cursor = we + timedelta(days=1)
    return weeks


def _uniq(xs: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in xs:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def build_holiday_prep(
    weeks: list[dict],
    break_week_index: int,
    review_n: int = 2,
    preview_n: int = 1,
) -> dict | None:
    """Build a holiday-prep payload for a break week.

    During a break, the tutor keeps the learner ready for school resumption by
    (a) **reviewing** the most recent instruction weeks before the break and
    (b) **previewing** the next instruction week(s) after it. Pure: operates on
    the already-ordered pacing weeks.

    Returns ``None`` if the index isn't found or there's no instructional
    content on either side (nothing to prep with).
    """
    pos = next(
        (i for i, w in enumerate(weeks) if w.get("week_index") == break_week_index),
        None,
    )
    if pos is None:
        return None

    def take_instruction(seq) -> list[dict]:
        picked: list[dict] = []
        for w in seq:
            if w.get("kind") == "instruction":
                picked.append(w)
        return picked

    # Nearest instruction weeks before (most recent first) and after the break.
    before = take_instruction(reversed(weeks[:pos]))[:review_n]
    after = take_instruction(weeks[pos + 1 :])[:preview_n]

    def gather(items: list[dict], key: str) -> list[str]:
        out: list[str] = []
        for w in items:
            vals = w.get(key) or []
            if isinstance(vals, list):
                out.extend(str(v) for v in vals if v)
        return _uniq(out)

    review_topics = gather(before, "topics")
    preview_topics = gather(after, "topics")
    if not review_topics and not preview_topics:
        return None

    return {
        "review_topics": review_topics,
        "review_standards": gather(before, "standards"),
        "review_vocabulary": gather(before, "vocabulary"),
        "preview_topics": preview_topics,
        "preview_standards": gather(after, "standards"),
        "preview_vocabulary": gather(after, "vocabulary"),
        "prior_unit_title": before[0].get("unit_title") if before else None,
        "next_unit_title": after[0].get("unit_title") if after else None,
    }
