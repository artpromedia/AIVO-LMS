"""
Authoritative framework registry.

A *framework* is the standards system a country's curriculum is expressed
in (e.g. Nigeria → NERDC, UK → National Curriculum). This registry is the
single source of truth for "which framework governs country X" — the
international map that previously lived as strings in
``identity-svc/src/services/curriculum-lookup.ts`` is consolidated here so
there is exactly one registry (see ADR 0040). identity-svc will call the
jurisdictions API rather than carry its own copy (Sprint 3).

This registry says *which* framework applies; it does not contain the
skills/standards themselves — those live in the catalogue
(``skill_graphs.json``, compiled from ``packages/skill-graphs`` and
``packages/content-pack``). A country having a framework here does **not**
mean curriculum is seeded for it; that is resolved against the catalogue.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Framework:
    """A country's authoritative standards framework."""

    country: str
    framework: str          # human-readable name
    standards_code: str     # canonical code prefix, e.g. "NG-NERDC"
    grade_band_scheme: str  # how grade bands are named in this framework


# country (ISO-3166 alpha-2, except CA_INT to disambiguate from US "CA"
# state) → Framework. Ported verbatim from identity-svc's
# US_STATE_FRAMEWORKS (collapsed to a single US entry — per-state names are
# a US concern handled by ZIP→district) and INTERNATIONAL_FRAMEWORKS.
FRAMEWORKS: dict[str, Framework] = {
    "US": Framework("US", "US State Standards (CCSS-aligned)", "US-CCSS", "US-K12"),
    "GB": Framework("GB", "UK National Curriculum", "UK-NC", "GB-KS"),
    "NG": Framework("NG", "Nigeria NERDC Curriculum", "NG-NERDC", "NG-BASIC"),
    "AE": Framework("AE", "UAE MOE Curriculum", "UAE-MOE", "AE-CYCLE"),
    "CA_INT": Framework("CA_INT", "Canadian Provincial Curricula", "CAN", "CAN-GRADES"),
    "AU": Framework("AU", "Australian Curriculum (ACARA)", "ACARA", "AU-YEARS"),
    "NZ": Framework("NZ", "New Zealand Curriculum (NZC)", "NZC", "NZ-LEVELS"),
    "IE": Framework("IE", "Irish Primary/Junior Cycle Curriculum", "IE-NC", "IE-CLASSES"),
    "SG": Framework("SG", "Singapore MOE Syllabus", "SG-MOE", "SG-PRIMARY"),
    "IN": Framework("IN", "Indian CBSE/ICSE Curriculum", "CBSE", "IN-CLASSES"),
    "ZA": Framework("ZA", "South African CAPS Curriculum", "ZA-CAPS", "ZA-GRADES"),
    "PH": Framework("PH", "Philippines K-12 Curriculum", "PH-K12", "PH-K12"),
    "KE": Framework("KE", "Kenya CBC Curriculum", "KE-CBC", "KE-GRADES"),
    "JP": Framework("JP", "Japan MEXT Course of Study", "JP-MEXT", "JP-GRADES"),
    "KR": Framework("KR", "South Korea National Curriculum", "KR-NC", "KR-GRADES"),
    "DE": Framework("DE", "German Bildungsstandards", "DE-KMK", "DE-KLASSEN"),
    "FR": Framework("FR", "French Programme Scolaire", "FR-EN", "FR-NIVEAUX"),
    "BR": Framework("BR", "Brazil BNCC", "BR-BNCC", "BR-ANOS"),
    "MX": Framework("MX", "Mexico SEP Curriculum", "MX-SEP", "MX-GRADOS"),
}


def normalize_country(country: str | None) -> str:
    """Uppercase + trim a country code. Returns ``""`` for empty input."""
    return (country or "").strip().upper()


def get_framework(country: str | None) -> Framework | None:
    """Return the framework for ``country`` (case-insensitive), or ``None``
    if no framework is registered for it."""
    return FRAMEWORKS.get(normalize_country(country))
