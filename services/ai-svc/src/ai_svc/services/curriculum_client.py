"""Async client for curriculum-svc — provides district-scoped skill nodes
and prerequisite chains so the baseline generator can ground LLM output
in the curriculum the learner's enrolled district actually teaches.

The client is intentionally tolerant: every failure mode (missing ZIP,
unknown subject, 4xx/5xx, network timeout) returns an empty grounding
result so the LLM still gets called and the parent still sees a
baseline. Curriculum grounding is *enrichment*, not a hard requirement.

Enabled when ``AIVO_FEATURE_CURRICULUM_GROUNDING`` is truthy. Off by
default to give ops a kill switch if the curriculum-svc snapshot is out
of date.
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
    raw = os.environ.get("AIVO_FEATURE_CURRICULUM_GROUNDING", "")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


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
    zip_code: str,
) -> list[dict]:
    """Return up to ``max_skills`` skill nodes for (subject, grade, district).
    On any non-200 response or transport error returns an empty list.
    """
    try:
        r = await client.get(
            f"{_CURRICULUM_SVC_URL}/lookup",
            params={"subject": subject, "gradeBand": grade_band, "zipCode": zip_code},
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


async def load_curriculum_grounding(
    *,
    zip_code: str | None,
    grade_level: str | int | None,
    subjects: Iterable[str] = SUBJECTS_TO_FETCH,
    max_skills_per_subject: int = 5,
    timeout_seconds: float = 3.0,
) -> dict:
    """Fetch district-scoped skill anchors for each requested subject and
    bundle them into a single structure for the prompt builder.

    Returns a dict with shape::

        {
          "district": {"id": "...", "name": "...", "state": "..."} | None,
          "gradeBand": "3" | "K" | None,
          "subjects": {
            "math": [{"id", "label", "summary", "prerequisites"}, ...],
            "ela":  [...],
          },
        }

    Empty subjects keys are omitted so the prompt builder doesn't emit
    "no anchors" sections for every untaught subject.
    """
    empty: dict = {"district": None, "gradeBand": None, "subjects": {}}
    if not curriculum_grounding_enabled():
        return empty
    if not zip_code:
        return empty
    grade_band = normalize_grade_band(grade_level)
    if not grade_band:
        # Still useful: caller may want to see the district even without
        # a usable grade. Resolve the district but skip per-subject anchors.
        grade_band = None

    out: dict = {"district": None, "gradeBand": grade_band, "subjects": {}}

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            # Resolve district once; if it 404s the learner's ZIP is not
            # in the catalogue and we cannot ground at all.
            try:
                dr = await client.get(
                    f"{_CURRICULUM_SVC_URL}/districts/resolve",
                    params={"zipCode": zip_code},
                )
            except httpx.HTTPError as exc:
                logger.warning("curriculum-svc district resolve transport error: %s", exc)
                return empty
            if dr.status_code != 200:
                logger.info(
                    "curriculum-svc district resolve non-200 zip=%s status=%s",
                    zip_code, dr.status_code,
                )
                return empty
            try:
                district = (dr.json() or {}).get("district") or {}
            except ValueError:
                return empty
            out["district"] = {
                "id": district.get("id"),
                "name": district.get("name"),
                "state": district.get("state"),
            }

            if grade_band is None:
                return out

            for subject in subjects:
                skills = await _fetch_subject(
                    client, subject=subject, grade_band=grade_band, zip_code=zip_code
                )
                if not skills:
                    continue
                # Trim & keep only the fields the prompt actually surfaces.
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
