"""Wave D (G6) — next-grade opening units from the authoritative catalogue.

The summer bridge previews the NEXT grade band. Those units come from
curriculum-svc (the single source of curriculum truth, ADR-0040) via the
jurisdiction-scoped ``/lookup`` — never from an LLM. Mirrors the transport
discipline of ``curriculum_validator.py``: service-token header, short
timeout, and every failure returns ``[]`` so the caller degrades to plain
holiday prep instead of inventing a preview (ADR-0041).
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("brain-svc.next-grade")

_CURRICULUM_SVC_URL = os.environ.get("CURRICULUM_SVC_URL", "http://localhost:3013")

# Pacing subjects → catalogue subjects. The web app paces "reading"; the
# CCSS catalogue names the strand "ela".
_SUBJECT_ALIASES = {"reading": "ela", "english": "ela", "writing": "ela"}

#: How many opening domains become preview units, and caps per unit so the
#: bridge focus stays lesson-sized.
OPENING_DOMAINS = 2
MAX_TOPICS_PER_UNIT = 6
MAX_STANDARDS_PER_UNIT = 8


def catalogue_subject(subject: str | None) -> str:
    s = str(subject or "").strip().lower()
    return _SUBJECT_ALIASES.get(s, s)


def _domain_of(skill_id: str, subject: str) -> str | None:
    """ccss.math.4.nf.a.1 → nf · ccss.ela.rf.4.1 → rf (None when foreign)."""
    parts = skill_id.split(".")
    if subject == "math" and len(parts) >= 4 and parts[0] == "ccss":
        return parts[3]
    if subject == "ela" and len(parts) >= 4 and parts[0] == "ccss":
        return parts[2]
    return None


def group_skills_into_units(
    skills: list[dict], subject: str, grade_band: str
) -> list[dict]:
    """Pure: catalogue skills (id-sorted) → the opening preview units.

    Skills are grouped by domain in first-appearance order; the first
    ``OPENING_DOMAINS`` domains become units. A unit's title prefers the
    domain's cluster-level statement (math cluster rows have a one-letter
    tail); topics are the numbered standards' labels; standards are the
    official source notations.
    """
    domains: dict[str, list[dict]] = {}
    order: list[str] = []
    for s in skills:
        dom = _domain_of(str(s.get("id", "")), subject)
        if dom is None:
            continue
        if dom not in domains:
            domains[dom] = []
            order.append(dom)
        domains[dom].append(s)

    units: list[dict] = []
    for dom in order[:OPENING_DOMAINS]:
        rows = domains[dom]
        cluster_rows = [
            r for r in rows if str(r.get("id", "")).split(".")[-1].isalpha()
        ]
        numbered_rows = [
            r for r in rows if not str(r.get("id", "")).split(".")[-1].isalpha()
        ]
        title = (
            str(cluster_rows[0].get("label") or "").strip()
            if cluster_rows
            else f"Grade {grade_band} {dom.upper()}"
        ) or f"Grade {grade_band} {dom.upper()}"
        topics = [
            str(r.get("label") or "").strip()
            for r in (numbered_rows or rows)
            if str(r.get("label") or "").strip()
        ][:MAX_TOPICS_PER_UNIT]
        standards = [
            str(r.get("source") or "").strip()
            for r in (numbered_rows or rows)
            if str(r.get("source") or "").strip()
        ][:MAX_STANDARDS_PER_UNIT]
        if not topics:
            continue
        units.append(
            {
                "title": title,
                "grade_band": grade_band,
                "topics": topics,
                "standards": standards,
                "vocabulary": [],
            }
        )
    return units


async def fetch_next_grade_units(
    subject: str,
    grade_band: str,
    *,
    zip_code: str | None = None,
    district_id: str | None = None,
    timeout_seconds: float = 5.0,
) -> list[dict]:
    """Fetch the next grade band's opening units for the learner's
    jurisdiction. ``[]`` on ANY failure — the bridge then falls back to
    plain holiday prep rather than fabricating next-grade content."""
    cat_subject = catalogue_subject(subject)
    params: dict[str, str] = {"subject": cat_subject, "gradeBand": grade_band}
    if district_id:
        params["districtId"] = district_id
    elif zip_code:
        params["zipCode"] = str(zip_code)[:5]
    else:
        return []

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
        logger.warning("next-grade lookup transport error: %s", exc)
        return []
    if r.status_code != 200:
        logger.info("next-grade lookup non-200 status=%s", r.status_code)
        return []
    try:
        data = r.json()
    except ValueError:
        return []
    skills = [s for s in (data.get("skills") or []) if isinstance(s, dict)]
    skills.sort(key=lambda s: str(s.get("id", "")))
    return group_skills_into_units(skills, cat_subject, grade_band)
