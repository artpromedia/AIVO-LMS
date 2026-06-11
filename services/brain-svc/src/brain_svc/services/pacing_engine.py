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

import re
from datetime import date, timedelta
from typing import Any

# Scope-&-sequence provenance. The default scope is AI-generated
# (curriculum_engine); when a parent/teacher uploads a whole-term syllabus
# (Sprint 6) the parsed term scope is used verbatim instead of the
# AI-guessed scope. Pacing stays break-aware regardless of source.
SCOPE_SOURCE_AI = "ai_scope_sequence"
SCOPE_SOURCE_UPLOADED_TERM = "uploaded_term_syllabus"


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


_GRADE_LADDER = ["K", "1", "2", "3", "4", "5", "6", "7", "8"]


def next_grade_band(grade: str | None) -> str | None:
    """Next K-8 band after a free-form grade value ("K", "3", "Grade 3").
    None when the grade is unparseable or already at the catalogue ceiling
    (grade 8) — callers fall back to plain holiday prep, never guess."""
    raw = str(grade or "").strip().lower()
    if raw in ("k", "kindergarten", "0"):
        current = "K"
    else:
        m = re.search(r"(\d{1,2})", raw)
        if not m:
            return None
        current = m.group(1)
    if current not in _GRADE_LADDER:
        return None
    idx = _GRADE_LADDER.index(current)
    if idx + 1 >= len(_GRADE_LADDER):
        return None
    return _GRADE_LADDER[idx + 1]


def build_summer_bridge(
    weeks: list[dict],
    break_week_index: int,
    next_grade_units: list[dict],
    review_n: int = 2,
) -> dict | None:
    """Build a summer-bridge payload for a summer-break week (Wave D, G6).

    The bridge keeps the learner ready for the NEXT grade: it (a) reviews
    the closing grade's most recent instruction weeks (same review rule as
    :func:`build_holiday_prep`) and (b) previews the next grade band's
    opening units — which the caller fetched from the AUTHORITATIVE
    curriculum catalogue (curriculum-svc), never from an LLM. Pure.

    Returns ``None`` when there are no next-grade units (unseeded band,
    grade-8 ceiling, catalogue unreachable) so the caller falls back to
    plain holiday prep instead of inventing a preview.
    """
    units = [
        u
        for u in (next_grade_units or [])
        if isinstance(u, dict) and (_clean_list(u.get("topics")) or u.get("title"))
    ]
    if not units:
        return None

    pos = next(
        (i for i, w in enumerate(weeks) if w.get("week_index") == break_week_index),
        None,
    )
    before: list[dict] = []
    if pos is not None:
        for w in reversed(weeks[:pos]):
            if w.get("kind") == "instruction":
                before.append(w)
            if len(before) >= review_n:
                break

    def gather(items: list[dict], key: str) -> list[str]:
        out: list[str] = []
        for w in items:
            vals = w.get(key) or []
            if isinstance(vals, list):
                out.extend(str(v) for v in vals if v)
        return _uniq(out)

    return {
        "review_topics": gather(before, "topics"),
        "review_standards": gather(before, "standards"),
        "review_vocabulary": gather(before, "vocabulary"),
        "next_grade_band": units[0].get("grade_band"),
        "next_grade_units": units,
        "preview_topics": _uniq([t for u in units for t in _clean_list(u.get("topics"))]),
        "preview_standards": _uniq([s for u in units for s in _clean_list(u.get("standards"))]),
        "preview_vocabulary": _uniq([v for u in units for v in _clean_list(u.get("vocabulary"))]),
        "prior_unit_title": before[0].get("unit_title") if before else None,
        "next_unit_title": units[0].get("title"),
    }


def validate_calendar_payload(terms: list[dict], breaks: list[dict]) -> list[str]:
    """Pure validation for a parent/teacher-entered school calendar (Wave B).

    Returns a list of human-readable problems (empty = valid):
      - any term/break whose end precedes its start (or has unparseable dates)
      - overlapping terms (a date can belong to at most one term)
      - break kinds outside the supported set
    Breaks may overlap terms (that is the normal case — a holiday sits inside
    a term) and may overlap each other (two adjacent entries are harmless to
    the week walk), so neither is flagged.
    """
    problems: list[str] = []
    allowed_break_kinds = {"holiday", "break", "summer"}

    spans: list[tuple[int, date, date]] = []
    for t in terms:
        number = t.get("term_number")
        start = _parse_date(t.get("start_date"))
        end = _parse_date(t.get("end_date"))
        if start is None or end is None:
            problems.append(f"term {number}: start_date/end_date must be ISO dates")
            continue
        if end < start:
            problems.append(f"term {number}: end_date precedes start_date")
            continue
        spans.append((int(number or 0), start, end))

    spans.sort(key=lambda s: s[1])
    for (n1, _s1, e1), (n2, s2, _e2) in zip(spans, spans[1:]):
        if s2 <= e1:
            problems.append(f"terms {n1} and {n2} overlap ({s2.isoformat()} <= {e1.isoformat()})")

    for b in breaks:
        name = b.get("name") or b.get("kind") or "break"
        kind = b.get("kind") or "break"
        if kind not in allowed_break_kinds:
            problems.append(
                f"break '{name}': kind '{kind}' is not one of {sorted(allowed_break_kinds)}"
            )
        start = _parse_date(b.get("start_date"))
        end = _parse_date(b.get("end_date"))
        if start is None or end is None:
            problems.append(f"break '{name}': start_date/end_date must be ISO dates")
        elif end < start:
            problems.append(f"break '{name}': end_date precedes start_date")

    return problems


def normalize_uploaded_scope(scope: Any) -> dict:
    """Validate/normalise an uploaded term scope-&-sequence (Sprint 6) into
    the shape the pacing walk consumes. Raises ``ValueError`` if it carries
    no instructional units, so the route can return a clear error instead of
    persisting an empty plan. The returned scope is fed to
    :func:`build_pacing_weeks` exactly like an AI-generated scope, so the
    plan stays break-aware."""
    if not isinstance(scope, dict):
        raise ValueError("term_scope_sequence must be an object")
    terms = scope.get("terms")
    if not isinstance(terms, list) or not terms:
        raise ValueError("term_scope_sequence must contain at least one term")
    if not flatten_unit_weeks(scope):
        raise ValueError("term_scope_sequence contains no instructional units")
    return {"terms": terms, "source": SCOPE_SOURCE_UPLOADED_TERM}


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
