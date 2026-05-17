"""
In-memory catalogue loaded from the bundled `data/skill_graphs.json`
snapshot. The catalogue is the read-only source of truth for the
service: callers ask "what skills exist?" and "what's the prerequisite
chain to skill X?" and get back deterministic results.

The snapshot ships in the wheel (or in the source tree during dev). A
future PR can extend `Catalogue` to lazy-reload from S3, but for now the
service is purely in-memory.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Iterable


@dataclass(frozen=True)
class Skill:
    id: str
    subject: str
    grade_band: str
    label: str
    summary: str
    prerequisites: tuple[str, ...]


@dataclass(frozen=True)
class ContentPack:
    id: str
    title: str
    subject: str
    grade_band: str
    skill_ids: tuple[str, ...]


class Catalogue:
    """Read-only curriculum catalogue."""

    def __init__(self, skills: Iterable[Skill], content_packs: Iterable[ContentPack]):
        self._by_id: dict[str, Skill] = {s.id: s for s in skills}
        self._packs: dict[str, ContentPack] = {p.id: p for p in content_packs}

    # ── Lookups ──────────────────────────────────────────────────────

    def get_skill(self, skill_id: str) -> Skill | None:
        return self._by_id.get(skill_id)

    def list_skills(
        self,
        subject: str | None = None,
        grade_band: str | None = None,
    ) -> list[Skill]:
        out: list[Skill] = []
        for s in self._by_id.values():
            if subject is not None and s.subject != subject:
                continue
            if grade_band is not None and s.grade_band != grade_band:
                continue
            out.append(s)
        # Stable order — sort by id so callers get a deterministic response.
        return sorted(out, key=lambda s: s.id)

    def list_packs(
        self,
        subject: str | None = None,
        grade_band: str | None = None,
    ) -> list[ContentPack]:
        out: list[ContentPack] = []
        for p in self._packs.values():
            if subject is not None and p.subject != subject:
                continue
            if grade_band is not None and p.grade_band != grade_band:
                continue
            out.append(p)
        return sorted(out, key=lambda p: p.id)

    def prerequisite_path(self, skill_id: str) -> list[Skill]:
        """Topologically-sorted prerequisite chain leading up to `skill_id`,
        prerequisites first. Returns `[]` if the skill is unknown.
        Cycles are tolerated by skipping already-visited nodes.
        """
        target = self._by_id.get(skill_id)
        if target is None:
            return []
        order: list[Skill] = []
        visited: set[str] = set()

        def visit(node: Skill) -> None:
            if node.id in visited:
                return
            visited.add(node.id)
            for pre_id in node.prerequisites:
                pre = self._by_id.get(pre_id)
                if pre is not None:
                    visit(pre)
            order.append(node)

        visit(target)
        # Drop the target itself from the path — callers asked for the
        # *prerequisites*. The target is appended last by `visit`.
        return order[:-1]


# ── Loader ────────────────────────────────────────────────────────────

def _parse_snapshot(raw: dict) -> Catalogue:
    skills = [
        Skill(
            id=s["id"],
            subject=s["subject"],
            grade_band=s["gradeBand"],
            label=s.get("label", ""),
            summary=s.get("summary", ""),
            prerequisites=tuple(s.get("prerequisites", [])),
        )
        for s in raw.get("skills", [])
    ]
    packs = [
        ContentPack(
            id=p["id"],
            title=p.get("title", p["id"]),
            subject=p["subject"],
            grade_band=p["gradeBand"],
            skill_ids=tuple(p.get("skillIds", [])),
        )
        for p in raw.get("contentPacks", [])
    ]
    return Catalogue(skills, packs)


@lru_cache(maxsize=1)
def get_catalogue() -> Catalogue:
    """Return the (memoized) in-memory catalogue. Reads from the bundled
    JSON snapshot via `importlib.resources` so it works equally well in a
    source checkout and in an installed wheel."""
    pkg = resources.files("curriculum_svc.data")
    raw = json.loads((pkg / "skill_graphs.json").read_text(encoding="utf-8"))
    return _parse_snapshot(raw)


def load_catalogue_from_dict(raw: dict) -> Catalogue:
    """Test hook — build a catalogue from a literal dict, bypassing the
    bundled snapshot. Used by `tests/`."""
    return _parse_snapshot(raw)
