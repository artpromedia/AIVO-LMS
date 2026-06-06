"""Async client for curriculum-svc — provides district-scoped skill nodes
and prerequisite chains so the baseline generator can ground LLM output
in the curriculum the learner's enrolled district actually teaches.

The client is intentionally tolerant: every failure mode (missing ZIP,
unknown subject, 4xx/5xx, network timeout) returns an empty grounding
result so the LLM still gets called and the parent still sees a
baseline. Curriculum grounding is *enrichment*, not a hard requirement.

Grounding is **on by default** (ADR 0041 / Sprint 3): personalization is
always anchored to the authoritative catalogue. ``AIVO_FEATURE_CURRICULUM_
GROUNDING`` remains only as an ops kill switch — set it to a falsey value
to disable.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Iterable

import httpx

logger = logging.getLogger("ai-svc.curriculum_client")


_CURRICULUM_SVC_URL = os.environ.get(
    "CURRICULUM_SVC_URL", "http://localhost:3013"
)

# curriculum-svc requires auth (service token or verified JWT). We send the
# internal service token; in dev both services share the documented fallback.
_DEV_SERVICE_TOKEN = "aivo-internal-dev-token"  # noqa: S105 (dev-only fallback)


def _service_headers() -> dict[str, str]:
    return {"X-Service-Token": os.environ.get("INTERNAL_SERVICE_TOKEN") or _DEV_SERVICE_TOKEN}

# ai-svc speaks 7 subjects; curriculum-svc's catalogue currently covers a
# subset (math, ela). When a subject has no matching catalogue entries we
# silently skip it so the LLM still receives partial grounding rather
# than no grounding at all.
SUBJECTS_TO_FETCH: tuple[str, ...] = (
    "math",
    "ela",
    "science",
    "speech",
    "sel",
    "life_skills",
    "executive_function",
)


def curriculum_grounding_enabled() -> bool:
    """On by default (Sprint 3). Only an explicit falsey value disables it,
    so the env var acts purely as an ops kill switch."""
    raw = os.environ.get("AIVO_FEATURE_CURRICULUM_GROUNDING")
    if raw is None or raw.strip() == "":
        return True
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def normalize_grade_band(grade: str | int | None) -> str | None:
    """Coerce noisy grade strings ("3", "3rd", "Third", "Kindergarten",
    "Pre-K") into the short grade-band tokens curriculum-svc indexes on
    (``K``, ``1``..``12``, ``PK``). Returns ``None`` for unmappable input.
    """
    if grade is None:
        return None
    s = str(grade).strip().lower()
    if not s:
        return None
    if s in {"pk", "pre-k", "prek", "pre kindergarten", "pre-kindergarten"}:
        return "PK"
    if s in {"k", "kindergarten", "kinder"}:
        return "K"
    # Pull the first integer 1..12 we can find ("3", "3rd", "grade 3", "third").
    # Word boundaries would miss "3rd" (digit followed by letter), so we
    # accept any 1-2 digit run and clamp the result.
    m = re.search(r"(\d{1,2})", s)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 12:
            return str(n)
    word_map = {
        "first": "1", "second": "2", "third": "3", "fourth": "4",
        "fifth": "5", "sixth": "6", "seventh": "7", "eighth": "8",
        "ninth": "9", "tenth": "10", "eleventh": "11", "twelfth": "12",
    }
    for word, n in word_map.items():
        if word in s:
            return n
    return None


async def _fetch_subject(
    client: httpx.AsyncClient,
    *,
    subject: str,
    grade_band: str,
    location_params: dict[str, str],
) -> list[dict]:
    """Return up to ``max_skills`` skill nodes for (subject, grade, jurisdiction).
    ``location_params`` carries the jurisdiction locator (``zipCode`` for US
    or ``country``/``region`` for intl). On any non-200/transport error
    returns an empty list.
    """
    try:
        r = await client.get(
            f"{_CURRICULUM_SVC_URL}/lookup",
            params={**location_params, "subject": subject, "gradeBand": grade_band},
            headers=_service_headers(),
        )
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        logger.warning("curriculum-svc lookup transport error (%s): %s", subject, exc)
        return []
    if r.status_code != 200:
        # 404 = no district for ZIP, 400 = bad params, etc. All non-fatal.
        logger.info(
            "curriculum-svc lookup non-200 subject=%s grade=%s status=%s",
            subject, grade_band, r.status_code,
        )
        return []
    try:
        data = r.json()
    except ValueError:
        return []
    skills = data.get("skills") or []
    if not isinstance(skills, list):
        return []
    return [s for s in skills if isinstance(s, dict)]


async def _resolve_location(
    client: httpx.AsyncClient,
    *,
    zip_code: str | None,
    country: str | None,
    region: str | None,
) -> tuple[dict | None, dict[str, str] | None]:
    """Resolve a learner's jurisdiction to ``(district_info, location_params)``.

    US (no country, or country == "US") resolves by ZIP via
    ``/districts/resolve``; other countries resolve by country(+region) via
    ``/jurisdictions/resolve``. Returns ``(None, None)`` when the location
    cannot be resolved — grounding then degrades to empty.
    """
    if country and country.strip().upper() != "US":
        c = country.strip().upper()
        params = {"country": c}
        if region:
            params["region"] = region
        try:
            jr = await client.get(
                f"{_CURRICULUM_SVC_URL}/jurisdictions/resolve",
                params=params,
                headers=_service_headers(),
            )
        except httpx.HTTPError as exc:
            logger.warning("curriculum-svc jurisdiction resolve transport error: %s", exc)
            return None, None
        if jr.status_code != 200:
            logger.info("curriculum-svc jurisdiction resolve non-200 status=%s", jr.status_code)
            return None, None
        try:
            body = jr.json() or {}
        except ValueError:
            return None, None
        district = {
            "id": body.get("districtId"),
            "name": body.get("districtName"),
            "state": body.get("region"),
        }
        return district, params

    # US path — ZIP required.
    if not zip_code:
        return None, None
    try:
        dr = await client.get(
            f"{_CURRICULUM_SVC_URL}/districts/resolve",
            params={"zipCode": zip_code},
            headers=_service_headers(),
        )
    except httpx.HTTPError as exc:
        logger.warning("curriculum-svc district resolve transport error: %s", exc)
        return None, None
    if dr.status_code != 200:
        logger.info("curriculum-svc district resolve non-200 zip=%s status=%s", zip_code, dr.status_code)
        return None, None
    try:
        district = (dr.json() or {}).get("district") or {}
    except ValueError:
        return None, None
    return (
        {"id": district.get("id"), "name": district.get("name"), "state": district.get("state")},
        {"zipCode": zip_code},
    )


async def load_curriculum_grounding(
    *,
    zip_code: str | None = None,
    grade_level: str | int | None,
    country: str | None = None,
    region: str | None = None,
    subjects: Iterable[str] = SUBJECTS_TO_FETCH,
    max_skills_per_subject: int = 5,
    timeout_seconds: float = 3.0,
) -> dict:
    """Fetch jurisdiction-scoped skill anchors for each requested subject and
    bundle them into a single structure for the prompt builder.

    US learners pass ``zip_code``; non-US learners pass ``country`` (and
    optionally ``region``). A non-US country is resolved against its own
    framework — never US/CCSS.

    Returns a dict with shape::

        {
          "district": {"id": "...", "name": "...", "state": "..."} | None,
          "gradeBand": "3" | "K" | "Primary-3" | None,
          "subjects": {"math": [{"id","label","summary","prerequisites"}, ...]},
        }

    Empty subjects keys are omitted so the prompt builder doesn't emit
    "no anchors" sections for every untaught subject.
    """
    empty: dict = {"district": None, "gradeBand": None, "subjects": {}}
    if not curriculum_grounding_enabled():
        return empty
    if not zip_code and not country:
        return empty

    # US grade strings are normalised to catalogue tokens; intl grade bands
    # (e.g. "Primary-3", "Year-1") are framework-native and pass through.
    if country and country.strip().upper() != "US":
        grade_band = str(grade_level).strip() if grade_level not in (None, "") else None
    else:
        grade_band = normalize_grade_band(grade_level)

    out: dict = {"district": None, "gradeBand": grade_band, "subjects": {}}

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            district, location_params = await _resolve_location(
                client, zip_code=zip_code, country=country, region=region
            )
            if district is None or location_params is None:
                return empty
            out["district"] = district

            if grade_band is None:
                return out

            for subject in subjects:
                skills = await _fetch_subject(
                    client, subject=subject, grade_band=grade_band, location_params=location_params
                )
                if not skills:
                    continue
                out["subjects"][subject] = [
                    {
                        "id": s.get("id"),
                        "label": s.get("label") or "",
                        "summary": s.get("summary") or "",
                        "prerequisites": list(s.get("prerequisites") or []),
                    }
                    for s in skills[:max_skills_per_subject]
                ]
    except Exception as exc:  # noqa: BLE001 — must never break baseline.
        logger.warning("curriculum-svc grounding aborted: %s", exc)
        return empty

    return out
