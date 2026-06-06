"""
In-memory catalogue loaded from the bundled `data/skill_graphs.json`
snapshot. The catalogue is the read-only source of truth for the
service: callers ask "what skills exist?" and "what's the prerequisite
chain to skill X?" and get back deterministic results.

District scoping is enforced here, not in callers. Enrollment can pass a
learner ZIP code to the curriculum API, the catalogue resolves it to a
home district, and only content packs assigned to that district are
eligible to be served.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Iterable

from curriculum_svc.frameworks import get_framework, normalize_country
from curriculum_svc.jurisdiction import (
    JurisdictionNotSeededError,
    MalformedJurisdictionError,
    ResolvedJurisdiction,
    UnknownJurisdictionError,
)

_ZIP5_RE = re.compile(r"^\d{5}$")


@dataclass(frozen=True)
class Skill:
    id: str
    subject: str
    grade_band: str
    label: str
    summary: str
    prerequisites: tuple[str, ...]
    # Provenance: the authoritative standard/document this skill cites
    # (e.g. "NERDC Primary Mathematics, P3 Number"). Empty for older US
    # snapshot rows. Surfaced so consumers can audit where a code came from.
    source: str = ""


@dataclass(frozen=True)
class District:
    id: str
    name: str
    state: str
    zip_codes: tuple[str, ...]
    # schemaVersion 2: jurisdiction generalisation. US districts default to
    # country "US" with region == state so existing snapshots load unchanged.
    country: str = "US"
    region: str | None = None


@dataclass(frozen=True)
class ContentPack:
    id: str
    title: str
    subject: str
    grade_band: str
    skill_ids: tuple[str, ...]
    district_ids: tuple[str, ...]
    # schemaVersion 2: the framework this pack's standards belong to.
    framework_code: str = ""


class Catalogue:
    """Read-only curriculum catalogue."""

    def __init__(
        self,
        skills: Iterable[Skill],
        content_packs: Iterable[ContentPack],
        districts: Iterable[District] = (),
    ):
        self._by_id: dict[str, Skill] = {s.id: s for s in skills}
        self._packs: dict[str, ContentPack] = {p.id: p for p in content_packs}
        self._districts: dict[str, District] = {d.id: d for d in districts}
        self._district_by_zip: dict[str, District] = {}
        for district in districts:
            for zip_code in district.zip_codes:
                self._district_by_zip[zip_code] = district

    # ── District resolution ──────────────────────────────────────────

    @staticmethod
    def normalize_zip_code(zip_code: str) -> str:
        """Return a normalized US ZIP5 value. Accepts ZIP+4 by truncating
        to the first five digits. Raises ValueError for malformed input.
        """
        candidate = zip_code.strip()
        if len(candidate) >= 5:
            candidate = candidate[:5]
        if not _ZIP5_RE.match(candidate):
            raise ValueError("zipCode must contain a valid 5-digit ZIP code.")
        return candidate

    def resolve_district_by_zip(self, zip_code: str) -> District | None:
        return self._district_by_zip.get(self.normalize_zip_code(zip_code))

    def get_district(self, district_id: str) -> District | None:
        return self._districts.get(district_id)

    def list_districts(
        self,
        country: str | None = None,
        region: str | None = None,
    ) -> list[District]:
        """All districts, optionally filtered by country and/or region
        (both case-insensitive). Sorted by id for deterministic responses."""
        out: list[District] = []
        for d in self._districts.values():
            if country is not None and d.country.upper() != country.upper():
                continue
            if region is not None and (d.region or "").lower() != region.lower():
                continue
            out.append(d)
        return sorted(out, key=lambda d: d.id)

    @staticmethod
    def validate_postal_code(country: str, postal_code: str | None) -> str | None:
        """Per-country postal validation, replacing the global ZIP5-only
        rule. US requires a valid 5-digit ZIP; other countries treat the
        postal code as optional metadata (resolution is by country/region).
        Raises :class:`MalformedJurisdictionError` for an invalid US ZIP."""
        if normalize_country(country) == "US":
            if not postal_code:
                return None
            try:
                return Catalogue.normalize_zip_code(postal_code)
            except ValueError as exc:
                raise MalformedJurisdictionError(str(exc)) from exc
        return postal_code.strip() if postal_code else None

    def resolve_jurisdiction(
        self,
        country: str,
        region: str | None = None,
        district_id: str | None = None,
        postal_code: str | None = None,
    ) -> ResolvedJurisdiction:
        """Resolve ``{country, region?, district?, postalCode?}`` to a
        concrete district scope plus its governing framework.

        US resolves by ZIP/district; other countries by country (+region).
        A recognised-but-unseeded country raises
        :class:`JurisdictionNotSeededError` — never a silent US fallback.
        """
        normalized_country = normalize_country(country)
        if not normalized_country:
            raise MalformedJurisdictionError("country is required")

        framework = get_framework(normalized_country)
        if framework is None:
            raise UnknownJurisdictionError(
                f"no curriculum framework registered for country '{normalized_country}'"
            )

        if normalized_country == "US":
            district = self._resolve_us_district(district_id, postal_code)
            region_out = district.region or district.state
        else:
            district = self._resolve_intl_district(normalized_country, region, district_id)
            region_out = region or district.region

        return ResolvedJurisdiction(
            country=normalized_country,
            region=region_out,
            district_id=district.id,
            district_name=district.name,
            framework_code=framework.standards_code,
            framework_name=framework.framework,
            grade_band_scheme=framework.grade_band_scheme,
        )

    def _resolve_us_district(
        self, district_id: str | None, postal_code: str | None
    ) -> District:
        if district_id:
            district = self.get_district(district_id)
            if district is None:
                raise JurisdictionNotSeededError(
                    f"no curriculum seeded for district '{district_id}'"
                )
            return district
        normalized = self.validate_postal_code("US", postal_code)
        if not normalized:
            raise MalformedJurisdictionError(
                "US jurisdictions require a postalCode (ZIP) or districtId"
            )
        district = self.resolve_district_by_zip(normalized)
        if district is None:
            raise JurisdictionNotSeededError(
                f"no district curriculum mapping found for ZIP code {normalized}"
            )
        return district

    def _resolve_intl_district(
        self, country: str, region: str | None, district_id: str | None
    ) -> District:
        candidates = self.list_districts(country=country, region=region)
        if not candidates:
            scope = country + (f"-{region}" if region else "")
            raise JurisdictionNotSeededError(
                f"no curriculum seeded for {scope}"
            )
        if district_id:
            match = next((d for d in candidates if d.id == district_id), None)
            if match is None:
                raise JurisdictionNotSeededError(
                    f"district '{district_id}' is not seeded for {country}"
                )
            return match
        return candidates[0]

    # ── Lookups ──────────────────────────────────────────────────────

    def get_skill(self, skill_id: str) -> Skill | None:
        return self._by_id.get(skill_id)

    def list_skills(
        self,
        subject: str | None = None,
        grade_band: str | None = None,
        district_id: str | None = None,
    ) -> list[Skill]:
        allowed_skill_ids: set[str] | None = None
        if district_id is not None:
            allowed_skill_ids = {
                skill_id
                for pack in self.list_packs(subject=subject, grade_band=grade_band, district_id=district_id)
                for skill_id in pack.skill_ids
            }
        out: list[Skill] = []
        for s in self._by_id.values():
            if allowed_skill_ids is not None and s.id not in allowed_skill_ids:
                continue
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
        district_id: str | None = None,
    ) -> list[ContentPack]:
        out: list[ContentPack] = []
        for p in self._packs.values():
            if district_id is not None and district_id not in p.district_ids:
                continue
            if subject is not None and p.subject != subject:
                continue
            if grade_band is not None and p.grade_band != grade_band:
                continue
            out.append(p)
        return sorted(out, key=lambda p: p.id)

    def skill_is_available_to_district(self, skill_id: str, district_id: str) -> bool:
        return any(skill_id in pack.skill_ids for pack in self.list_packs(district_id=district_id))

    def prerequisite_path(self, skill_id: str, district_id: str | None = None) -> list[Skill]:
        """Topologically-sorted prerequisite chain leading up to `skill_id`,
        prerequisites first. Returns `[]` if the skill is unknown.
        Cycles are tolerated by skipping already-visited nodes.

        When `district_id` is supplied, the path is filtered so callers
        only receive prerequisite skills available through that district's
        approved content packs.
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
        path = order[:-1]
        if district_id is not None:
            path = [s for s in path if self.skill_is_available_to_district(s.id, district_id)]
        return path


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
            source=s.get("source", ""),
        )
        for s in raw.get("skills", [])
    ]
    districts = [
        District(
            id=d["id"],
            name=d.get("name", d["id"]),
            state=d.get("state", ""),
            zip_codes=tuple(str(z) for z in d.get("zipCodes", [])),
            # schemaVersion 1 snapshots omit these — default to US, with the
            # state standing in as the region so US resolution is unchanged.
            country=normalize_country(d.get("country", "US")) or "US",
            region=d.get("region") or d.get("state") or None,
        )
        for d in raw.get("districts", [])
    ]
    packs = [
        ContentPack(
            id=p["id"],
            title=p.get("title", p["id"]),
            subject=p["subject"],
            grade_band=p["gradeBand"],
            skill_ids=tuple(p.get("skillIds", [])),
            district_ids=tuple(p.get("districtIds", [])),
            framework_code=p.get("frameworkCode", ""),
        )
        for p in raw.get("contentPacks", [])
    ]
    return Catalogue(skills, packs, districts)


@lru_cache(maxsize=1)
def _bundled_catalogue() -> Catalogue:
    """Return the (memoized) catalogue parsed from the bundled JSON
    snapshot via `importlib.resources` so it works equally well in a
    source checkout and in an installed wheel."""
    pkg = resources.files("curriculum_svc.data")
    raw = json.loads((pkg / "skill_graphs.json").read_text(encoding="utf-8"))
    return _parse_snapshot(raw)


def get_catalogue() -> Catalogue:
    """Return the current catalogue read model.

    In the default ``snapshot`` persistence mode this is the immutable
    bundled snapshot. When ``CURRICULUM_PERSISTENCE`` selects a mutable
    store (``memory``/``postgres``, Sprint 4) the read model comes from
    that store so authoring writes are reflected after a reload."""
    # Imported lazily to avoid a circular import (store imports this module).
    from curriculum_svc.store import get_store, store_enabled

    if store_enabled():
        return get_store().to_catalogue()
    return _bundled_catalogue()


def load_catalogue_from_dict(raw: dict) -> Catalogue:
    """Test hook — build a catalogue from a literal dict, bypassing the
    bundled snapshot. Used by `tests/`."""
    return _parse_snapshot(raw)
