"""
The ``Jurisdiction`` model — internationalizes curriculum resolution.

Before this, the catalogue could only resolve a learner via a US ZIP code,
so non-US learners were rejected outright (gap G3). A *jurisdiction* is the
``{country, region?, district?, postalCode?}`` tuple that identifies whose
approved curriculum a learner should receive:

- **US** keeps the existing ZIP → district resolution.
- **NG / AE / GB / …** resolve by ``country`` (+ optional ``region``).

A non-US country is **never** silently mapped to US/CCSS. If a country has
no curriculum seeded in the catalogue yet, resolution raises
:class:`JurisdictionNotSeededError` (surfaced as an explicit 404) rather
than falling back to US content (see ADR 0040).

The dataclasses and exceptions live here; the actual resolution logic lives
on :class:`curriculum_svc.catalogue.Catalogue` (it needs the catalogue
data). :func:`resolve` is a thin convenience over the process-wide
catalogue.
"""
from __future__ import annotations

from dataclasses import dataclass


class JurisdictionError(Exception):
    """Base class for jurisdiction-resolution failures."""


class MalformedJurisdictionError(JurisdictionError):
    """Input was malformed or insufficient (→ HTTP 400). E.g. a US lookup
    with no ZIP/district, or a non-numeric US ZIP."""


class UnknownJurisdictionError(JurisdictionError):
    """No framework is registered for the requested country (→ HTTP 404).
    Distinct from 'seeded' — we don't even recognise the country."""


class JurisdictionNotSeededError(JurisdictionError):
    """The country/region is recognised but has no curriculum seeded yet
    (→ HTTP 404). Returned instead of a silent US fallback."""


@dataclass(frozen=True)
class Jurisdiction:
    """A requested jurisdiction, before resolution."""

    country: str
    region: str | None = None
    district_id: str | None = None
    postal_code: str | None = None


@dataclass(frozen=True)
class ResolvedJurisdiction:
    """A resolved jurisdiction: a concrete district scope plus the
    framework that governs it."""

    country: str
    region: str | None
    district_id: str
    district_name: str
    framework_code: str
    framework_name: str
    grade_band_scheme: str


def resolve(
    country: str,
    region: str | None = None,
    district_id: str | None = None,
    postal_code: str | None = None,
) -> ResolvedJurisdiction:
    """Resolve a jurisdiction against the process-wide catalogue.

    Raises :class:`MalformedJurisdictionError` (400),
    :class:`UnknownJurisdictionError` (404), or
    :class:`JurisdictionNotSeededError` (404).
    """
    # Imported lazily to avoid a circular import (catalogue imports this
    # module for the dataclasses/exceptions).
    from curriculum_svc.catalogue import get_catalogue

    return get_catalogue().resolve_jurisdiction(
        country=country,
        region=region,
        district_id=district_id,
        postal_code=postal_code,
    )
