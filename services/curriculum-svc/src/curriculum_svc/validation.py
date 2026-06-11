"""
Syllabus ↔ jurisdiction validation (Sprint 7, G8).

Given an uploaded syllabus's topics and standards plus the learner's
resolved jurisdiction, classify each item against the jurisdiction's
*approved* skills (the content packs assigned to that district):

- **matched** — the item maps to a real catalogue skill id.
- **unmatched** — the item is off-curriculum for this jurisdiction and is
  flagged for review (never silently accepted).
- **suggestions** — for an unmatched topic, the closest approved skills.

The matching is deterministic (token-overlap with 4-char prefix stems), so
it is unit-testable and has no LLM dependency.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

from curriculum_svc.catalogue import Skill

_STOPWORDS = {
    "a", "an", "the", "to", "of", "and", "or", "in", "on", "by", "with", "for",
    "up", "as", "at", "from", "into", "within", "their", "this", "that", "is",
    "are", "be", "using", "use", "number", "numbers",  # too generic alone
}

# 'number/numbers' are deliberately demoted to stopwords so a topic isn't
# matched to every numeracy skill on the word "number" alone; specific stems
# (e.g. "whol", "frac", "subt") carry the match.

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _stems(text: str) -> set[str]:
    out: set[str] = set()
    for tok in _TOKEN_RE.findall((text or "").lower()):
        if tok in _STOPWORDS or len(tok) < 2:
            continue
        out.add(tok[:4])
    return out


# Wave D (G3) perf: at catalogue scale (10³ skills) stemming every skill's
# label+summary on EVERY request dominated /validate. Skills are frozen
# (hashable) dataclasses from an immutable snapshot, so the stems are
# memoised process-wide — computed once per skill per process, shared
# across requests and topics. Returns a frozenset so a caller can't
# mutate the cached value.
@lru_cache(maxsize=None)
def _skill_stems(skill: Skill) -> frozenset[str]:
    return frozenset(_stems(f"{skill.label} {skill.summary}"))


# Official-notation prefixes → canonical catalogue-id prefixes. A syllabus
# cites "CCSS.MATH.CONTENT.3.NF.A.1"; the catalogue id is
# "ccss.math.3.nf.a.1" (import_ccss.py). Normalising here means the exact-
# match rule below accepts the official code, the canonical id, or the
# skill's recorded source notation — and still NEVER fuzzy-matches.
_STANDARD_PREFIX_MAP = (
    ("ccss.math.content.", "ccss.math."),
    ("ccss.ela-literacy.", "ccss.ela."),
)


def normalize_standard_code(raw: str) -> str:
    """Lower-case an inbound standard code and map official notation
    prefixes onto the canonical catalogue-id scheme."""
    code = (raw or "").strip().lower()
    for prefix, canonical in _STANDARD_PREFIX_MAP:
        if code.startswith(prefix):
            return canonical + code[len(prefix):]
    return code


def _approved_code_index(approved_skills: list[Skill]) -> dict[str, str]:
    """code variant (canonical id / lowercased source notation) → skill id."""
    index: dict[str, str] = {}
    for skill in approved_skills:
        index[skill.id] = skill.id
        if skill.source:
            index[normalize_standard_code(skill.source)] = skill.id
    return index


@dataclass(frozen=True)
class MatchedItem:
    kind: str  # "topic" | "standard"
    input: str
    skillId: str


@dataclass(frozen=True)
class UnmatchedItem:
    kind: str
    input: str
    reason: str


@dataclass(frozen=True)
class Suggestion:
    input: str
    candidates: tuple[str, ...]


@dataclass(frozen=True)
class ValidationResult:
    matched: tuple[MatchedItem, ...]
    unmatched: tuple[UnmatchedItem, ...]
    suggestions: tuple[Suggestion, ...]


def _rank_skills_for_topic(
    topic: str, skills: list[Skill]
) -> list[tuple[Skill, int, float]]:
    """Return (skill, shared_count, ratio) sorted best-first."""
    topic_stems = _stems(topic)
    if not topic_stems:
        return []
    scored: list[tuple[Skill, int, float]] = []
    for skill in skills:
        shared = topic_stems & _skill_stems(skill)
        if not shared:
            continue
        ratio = len(shared) / len(topic_stems)
        scored.append((skill, len(shared), ratio))
    scored.sort(key=lambda t: (t[1], t[2], -len(t[0].id)), reverse=True)
    return scored


def validate_topics_and_standards(
    approved_skills: list[Skill],
    topics: Iterable[str],
    standards: Iterable[str],
    *,
    match_ratio: float = 0.5,
    max_suggestions: int = 3,
) -> ValidationResult:
    """Classify topics/standards against the jurisdiction's approved skills."""
    code_index = _approved_code_index(approved_skills)
    matched: list[MatchedItem] = []
    unmatched: list[UnmatchedItem] = []
    suggestions: list[Suggestion] = []

    # Standards: an exact match is required (no fuzzy matching — a standard
    # either belongs to the jurisdiction's packs or it does not). "Exact"
    # accepts the canonical catalogue id, the official notation recorded on
    # the skill (e.g. CCSS.MATH.CONTENT.3.NF.A.1), or either in any case.
    for raw in standards:
        code = (raw or "").strip()
        if not code:
            continue
        skill_id = code_index.get(code) or code_index.get(normalize_standard_code(code))
        if skill_id:
            matched.append(MatchedItem("standard", code, skill_id))
        else:
            unmatched.append(UnmatchedItem("standard", code, "not_in_jurisdiction_packs"))

    # Topics: deterministic token-overlap match against approved skill text.
    for raw in topics:
        topic = (raw or "").strip()
        if not topic:
            continue
        ranked = _rank_skills_for_topic(topic, approved_skills)
        if ranked and ranked[0][2] >= match_ratio:
            matched.append(MatchedItem("topic", topic, ranked[0][0].id))
        else:
            unmatched.append(UnmatchedItem("topic", topic, "off_curriculum"))
            candidates = tuple(s.id for s, _, _ in ranked[:max_suggestions])
            suggestions.append(Suggestion(topic, candidates))

    return ValidationResult(
        matched=tuple(matched),
        unmatched=tuple(unmatched),
        suggestions=tuple(suggestions),
    )
