"""
Whole-term / trimester syllabus parser (Sprint 6).

The weekly curriculum parser (``routes/curriculum.py``) handles a single
week and truncates input at 16 KB. This module parses an **entire term**
document (12+ weeks) into an ordered scope-&-sequence the pacing engine
consumes — without truncation:

- Large documents are split into ordered chunks on week/unit boundaries
  (never cut mid-unit, never dropped) so the 16 KB cap no longer applies.
- An LLM extracts structured units per chunk when available; a fully
  deterministic **heuristic fallback** runs when the LLM is unavailable or
  errors, so a parse never hard-fails.

Output is a scope-&-sequence in the exact shape
``brain_svc.pacing_engine.flatten_unit_weeks`` expects::

    {
      "subject": "math",
      "source": "uploaded_term_syllabus",
      "total_terms": 1,
      "terms": [
        {"term_number": 1, "title": "...", "units": [
          {"title", "duration_weeks", "learning_objectives",
           "standards_addressed", "key_vocabulary", "topics"}, ...
        ]}
      ]
    }
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger("ai-svc.term_syllabus_parser")

# Heading that starts a new week/unit block, e.g. "Week 3: Fractions",
# "Unit 2 - Place Value", "Module 1". Capoverture group 2 is the remainder.
_HEADING_RE = re.compile(
    r"(?im)^[ \t]*(?:week|unit|module|lesson)\s*#?\s*(\d+)\s*[:.\-–)]*\s*(.*)$"
)

# Standard-code shapes we recognise without inventing any: CCSS-like
# (3.NF.A.1 / K.CC.A.1), dotted framework codes (CCSS.MATH.3.OA.A.1),
# and hyphenated intl codes (NG-NERDC.x, UK-NC.x, UAE-MOE.x).
_STANDARD_RES = (
    re.compile(r"\b[A-Z]{2,}(?:-[A-Z]{2,})?\.[A-Za-z0-9.\-]+\b"),
    re.compile(r"\b[A-Za-z]{0,3}\d{1,2}\.[A-Z]{1,3}\.[A-Z]\.\d+\b"),
)

_VOCAB_LABEL_RE = re.compile(r"(?im)^[ \t]*(?:vocabulary|key terms?|vocab)\s*[:\-]\s*(.+)$")
_STANDARDS_LABEL_RE = re.compile(r"(?im)^[ \t]*(?:standards?|aligned to)\s*[:\-]\s*(.+)$")
_OBJECTIVE_RE = re.compile(r"(?im)^[ \t]*(?:[-*•]\s*)?(?:objective[s]?\s*[:\-]\s*)?(students? will[^\n]+)$")
_BULLET_RE = re.compile(r"(?m)^[ \t]*[-*•]\s*(.+)$")

_DEFAULT_MAX_CHARS = 12000


def _normalize(text: str) -> str:
    return (text or "").replace("\r\n", "\n").replace("\r", "\n")


def _split_terms_for_text(t: str) -> list[str]:
    """Split on comma/semicolon/'and' into individual standard tokens."""
    return [s.strip() for s in re.split(r"[;,]|\band\b", t) if s.strip()]


def _find_standards(block: str) -> list[str]:
    found: list[str] = []
    for m in _STANDARDS_LABEL_RE.finditer(block):
        found.extend(_split_terms_for_text(m.group(1)))
    for rx in _STANDARD_RES:
        found.extend(rx.findall(block))
    return _dedupe(found)


def _find_vocabulary(block: str) -> list[str]:
    out: list[str] = []
    for m in _VOCAB_LABEL_RE.finditer(block):
        out.extend(_split_terms_for_text(m.group(1)))
    return _dedupe(out)


def _find_objectives(block: str) -> list[str]:
    return _dedupe(m.group(1).strip() for m in _OBJECTIVE_RE.finditer(block))


def _find_topics(block: str, heading_remainder: str) -> list[str]:
    topics: list[str] = []
    if heading_remainder.strip():
        topics.append(heading_remainder.strip())
    topics.extend(b.strip() for b in _BULLET_RE.findall(block))
    return _dedupe(topics)


def _dedupe(items) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        s = str(x).strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _heading_positions(text: str) -> list[tuple[int, int, str]]:
    """Return ``(start_index, week_number, heading_remainder)`` for each
    week/unit heading, in document order."""
    out: list[tuple[int, int, str]] = []
    for m in _HEADING_RE.finditer(text):
        out.append((m.start(), int(m.group(1)), (m.group(2) or "").strip()))
    return out


def _duration_weeks(block: str) -> int:
    m = re.search(r"(\d+)\s*weeks?\b", block, re.IGNORECASE)
    if m:
        try:
            return max(1, int(m.group(1)))
        except ValueError:
            return 1
    return 1


def parse_term_syllabus_heuristic(
    text: str, *, subject: str | None = None, term_count: int = 1
) -> dict:
    """Deterministic, LLM-free term parse. Splits the document into
    week/unit blocks and extracts topics/objectives/standards/vocabulary
    per block. Handles arbitrarily large input (no truncation)."""
    text = _normalize(text)
    headings = _heading_positions(text)
    units: list[dict] = []

    if headings:
        for i, (start, _num, remainder) in enumerate(headings):
            end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
            block = text[start:end]
            first_line_end = block.find("\n")
            body = block[first_line_end + 1 :] if first_line_end != -1 else ""
            units.append(
                {
                    "title": (remainder or f"Week {_num}").strip()[:200],
                    "duration_weeks": _duration_weeks(block),
                    "topics": _find_topics(body, remainder)[:12],
                    "learning_objectives": _find_objectives(block)[:12],
                    "standards_addressed": _find_standards(block)[:24],
                    "key_vocabulary": _find_vocabulary(block)[:24],
                }
            )
    elif text.strip():
        # No week markers — treat the whole document as one unit so the
        # caller still gets a usable (if coarse) scope rather than nothing.
        units.append(
            {
                "title": "Term overview",
                "duration_weeks": 1,
                "topics": _find_topics(text, "")[:12],
                "learning_objectives": _find_objectives(text)[:12],
                "standards_addressed": _find_standards(text)[:24],
                "key_vocabulary": _find_vocabulary(text)[:24],
            }
        )

    return _assemble_scope(units, subject=subject, term_count=term_count)


def _assemble_scope(units: list[dict], *, subject: str | None, term_count: int) -> dict:
    """Distribute ordered units across ``term_count`` terms."""
    term_count = max(1, term_count)
    terms: list[dict] = []
    if units:
        # Even, order-preserving split across terms.
        per_term = max(1, -(-len(units) // term_count))  # ceil division
        for ti in range(term_count):
            chunk = units[ti * per_term : (ti + 1) * per_term]
            if not chunk and ti > 0:
                continue
            terms.append({"term_number": ti + 1, "title": f"Term {ti + 1}", "units": chunk})
    return {
        "subject": subject,
        "source": "uploaded_term_syllabus",
        "total_terms": len(terms),
        "terms": terms,
    }


def split_into_chunks(text: str, max_chars: int = _DEFAULT_MAX_CHARS) -> list[str]:
    """Split ``text`` into ordered chunks no larger than ``max_chars``,
    cutting on week/unit boundaries so no unit is split and **no text is
    dropped** (the concatenation of chunks reproduces the input)."""
    text = _normalize(text)
    if len(text) <= max_chars:
        return [text] if text else []

    headings = _heading_positions(text)
    # Boundaries are heading starts (plus 0 and len). Build segments, then
    # greedily pack segments into <= max_chars chunks.
    bounds = [0] + [h[0] for h in headings if h[0] > 0] + [len(text)]
    bounds = sorted(set(bounds))
    segments = [text[bounds[i] : bounds[i + 1]] for i in range(len(bounds) - 1)]

    chunks: list[str] = []
    current = ""
    for seg in segments:
        if len(seg) > max_chars:
            # A single oversized segment — flush current, then hard-split it
            # on lines so we never drop characters.
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(_hard_split(seg, max_chars))
            continue
        if len(current) + len(seg) > max_chars and current:
            chunks.append(current)
            current = seg
        else:
            current += seg
    if current:
        chunks.append(current)
    return chunks


def _hard_split(text: str, max_chars: int) -> list[str]:
    out: list[str] = []
    lines = text.splitlines(keepends=True)
    current = ""
    for line in lines:
        if len(line) > max_chars:
            if current:
                out.append(current)
                current = ""
            for i in range(0, len(line), max_chars):
                out.append(line[i : i + max_chars])
            continue
        if len(current) + len(line) > max_chars and current:
            out.append(current)
            current = line
        else:
            current += line
    if current:
        out.append(current)
    return out


_LLM_SYSTEM_PROMPT = """You are a curriculum analyst. Read this PORTION of a full-term syllabus and extract every week/unit it describes, in order. Return ONLY JSON (no fences):
{"units": [{"title": "...", "duration_weeks": 1, "topics": ["..."], "learning_objectives": ["students will ..."], "standards_addressed": ["codes present in the text only"], "key_vocabulary": ["..."]}]}
Rules: keep topics concrete; never invent standard codes not present in the text; duration_weeks defaults to 1."""


async def _parse_chunk_with_llm(chunk: str, generate_completion) -> list[dict]:
    import json

    result = await generate_completion(
        system_prompt=_LLM_SYSTEM_PROMPT,
        user_prompt=chunk,
        temperature=0.1,
        max_tokens=2500,
    )
    content = (result or {}).get("content", "")
    if "```" in content:
        parts = content.split("```")
        content = parts[1] if len(parts) > 1 else content
        if content.startswith("json"):
            content = content[4:]
    data = json.loads(content.strip())
    units = data.get("units") if isinstance(data, dict) else None
    if not isinstance(units, list):
        return []
    cleaned: list[dict] = []
    for u in units:
        if not isinstance(u, dict) or not u.get("title"):
            continue
        cleaned.append(
            {
                "title": str(u["title"])[:200],
                "duration_weeks": _safe_int(u.get("duration_weeks"), 1),
                "topics": _dedupe(u.get("topics") or [])[:12],
                "learning_objectives": _dedupe(u.get("learning_objectives") or [])[:12],
                "standards_addressed": _dedupe(u.get("standards_addressed") or [])[:24],
                "key_vocabulary": _dedupe(u.get("key_vocabulary") or [])[:24],
            }
        )
    return cleaned


def _safe_int(v, default: int) -> int:
    try:
        return max(1, int(v))
    except (TypeError, ValueError):
        return default


async def parse_term_syllabus(
    text: str,
    *,
    subject: str | None = None,
    term_count: int = 1,
    use_llm: bool = True,
    generate_completion=None,
    max_chars_per_chunk: int = _DEFAULT_MAX_CHARS,
) -> dict:
    """Parse a full-term syllabus into a scope-&-sequence.

    Chunks large input on unit boundaries, parses each chunk with the LLM,
    and concatenates the units in order. Falls back to the deterministic
    heuristic parser if no LLM is provided or the LLM path errors — a parse
    never hard-fails.
    """
    text = _normalize(text)
    if use_llm and generate_completion is None:
        try:
            from ai_svc.services.llm_gateway import generate_completion as gc

            generate_completion = gc
        except Exception:  # noqa: BLE001 — heuristic still works without it
            generate_completion = None

    if use_llm and generate_completion is not None and text.strip():
        try:
            units: list[dict] = []
            for chunk in split_into_chunks(text, max_chars_per_chunk):
                units.extend(await _parse_chunk_with_llm(chunk, generate_completion))
            if units:
                return _assemble_scope(units, subject=subject, term_count=term_count)
            logger.info("LLM term parse returned no units; using heuristic fallback")
        except Exception as exc:  # noqa: BLE001 — never hard-fail a parse
            logger.warning("LLM term parse failed (%s); using heuristic fallback", exc)

    return parse_term_syllabus_heuristic(text, subject=subject, term_count=term_count)
