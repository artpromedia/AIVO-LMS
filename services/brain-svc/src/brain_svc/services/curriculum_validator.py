"""
Validate LLM-proposed curriculum standards against curriculum-svc.

ADR 0041 (agentic boundaries): LLMs personalize; they never decide
authoritative truth. Any standard code an LLM emits is a *proposal* until
it is found in the curriculum-svc catalogue for the learner's
jurisdiction. Codes absent from the catalogue are **dropped** — never
invented, "corrected", or fuzzy-matched into existence.

The pure :func:`validate_nodes` is the contract: given proposed nodes and
the set of catalogue-valid codes, it returns ``accepted`` / ``rejected``.
:func:`validate_against_catalogue` wraps it with a live fetch from
curriculum-svc so callers can validate in one call.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Iterable

import httpx

logger = logging.getLogger("brain-svc.curriculum_validator")

_CURRICULUM_SVC_URL = os.environ.get("CURRICULUM_SVC_URL", "http://localhost:3013")


@dataclass(frozen=True)
class ValidationResult:
    """Outcome of validating proposed nodes against the catalogue.

    ``accepted`` are the proposed nodes whose code exists in the catalogue.
    ``rejected`` records each dropped node as ``{"code", "reason"}``.
    ``catalogue_available`` is False when the catalogue could not be
    consulted — in that case ``accepted`` is empty (fail toward truth: we
    never emit unvalidated LLM codes).
    """

    accepted: list[dict]
    rejected: list[dict]
    catalogue_available: bool = True


def _code_of(node: dict) -> str | None:
    """Extract the standard code from a proposed node. Accepts ``code`` or
    ``id`` keys (the engine emits ``code``; catalogue nodes use ``id``)."""
    if not isinstance(node, dict):
        return None
    code = node.get("code") or node.get("id")
    if isinstance(code, str) and code.strip():
        return code.strip()
    return None


def validate_nodes(proposed: Iterable[dict], valid_codes: set[str]) -> ValidationResult:
    """Pure validation: keep only nodes whose code is in ``valid_codes``.

    Matching is exact and case-sensitive on the canonical code — there is
    no fuzzy matching, so a hallucinated code can never be "rounded" to a
    real one.
    """
    accepted: list[dict] = []
    rejected: list[dict] = []
    for node in proposed:
        code = _code_of(node)
        if code is None:
            rejected.append({"code": None, "reason": "missing_code"})
            continue
        if code in valid_codes:
            accepted.append(node)
        else:
            rejected.append({"code": code, "reason": "not_in_catalogue"})
    if rejected:
        logger.info(
            "curriculum validation dropped %d/%d proposed standards",
            len(rejected),
            len(accepted) + len(rejected),
        )
    return ValidationResult(accepted=accepted, rejected=rejected)


async def fetch_valid_codes(
    *,
    subject: str | None = None,
    grade_band: str | None = None,
    country: str | None = None,
    region: str | None = None,
    postal_code: str | None = None,
    district_id: str | None = None,
    timeout_seconds: float = 3.0,
) -> set[str] | None:
    """Fetch the set of catalogue-valid skill codes for a jurisdiction from
    curriculum-svc. Returns ``None`` if the catalogue cannot be consulted
    (so callers can fail toward truth rather than trust LLM output)."""
    params: dict[str, str] = {}
    if subject:
        params["subject"] = subject
    if grade_band:
        params["gradeBand"] = grade_band
    if country:
        params["country"] = country
    if region:
        params["region"] = region
    if postal_code:
        params["postalCode"] = postal_code
    if district_id:
        params["districtId"] = district_id
    if not any(k in params for k in ("subject", "gradeBand")):
        # Nothing to scope a lookup by — refuse rather than fetch the world.
        return None

    headers: dict[str, str] = {}
    token = os.environ.get("INTERNAL_SERVICE_TOKEN")
    if token:
        headers["X-Service-Token"] = token

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            r = await client.get(
                f"{_CURRICULUM_SVC_URL}/lookup", params=params, headers=headers
            )
    except httpx.HTTPError as exc:
        logger.warning("curriculum-svc lookup transport error: %s", exc)
        return None
    if r.status_code != 200:
        logger.info("curriculum-svc lookup non-200 status=%s", r.status_code)
        return None
    try:
        data = r.json()
    except ValueError:
        return None
    skills = data.get("skills") or []
    return {s["id"] for s in skills if isinstance(s, dict) and s.get("id")}


async def validate_against_catalogue(
    proposed: Iterable[dict],
    *,
    subject: str | None = None,
    grade_band: str | None = None,
    country: str | None = None,
    region: str | None = None,
    postal_code: str | None = None,
    district_id: str | None = None,
) -> ValidationResult:
    """Fetch valid codes for the jurisdiction and validate ``proposed``.

    If the catalogue is unreachable, returns an empty ``accepted`` with
    ``catalogue_available=False`` — never the unvalidated LLM nodes.
    """
    proposed_list = list(proposed)
    valid_codes = await fetch_valid_codes(
        subject=subject,
        grade_band=grade_band,
        country=country,
        region=region,
        postal_code=postal_code,
        district_id=district_id,
    )
    if valid_codes is None:
        return ValidationResult(
            accepted=[],
            rejected=[
                {"code": _code_of(n), "reason": "catalogue_unavailable"}
                for n in proposed_list
            ],
            catalogue_available=False,
        )
    return validate_nodes(proposed_list, valid_codes)
