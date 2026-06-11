#!/usr/bin/env python3
"""
Wave D (G3) — deterministic CCSS K–8 importer.

Transforms the vendored official Common Core State Standards sets
(``packages/content-pack/data/sources/ccss/*.json`` — fetched once from the
Common Standards Project API, CC BY 3.0 US) and the vendored NCES district
slice (``packages/content-pack/data/sources/nces/top-districts.json``) into
``packages/content-pack/data/us-ccss/catalogue.imported.json``:

  - one catalogue **skill** per standard with an official content
    statementNotation (Mathematical-Practice standards and unlabelled
    hierarchy headers are skipped),
  - intra-domain **prerequisite ordering**: a sub-standard requires its
    parent (3.NF.A.1a ← 3.NF.A.1), a numbered standard requires its
    predecessor in the same cluster (3.NF.A.2 ← 3.NF.A.1), and the first
    standard of a cluster requires the last standard of the previous
    cluster in the same domain (3.NF.B ← 3.NF.A),
  - one **content pack** per (subject × grade band) assigned to every US
    district in the catalogue, so jurisdiction validation accepts the
    official codes everywhere,
  - the NCES **districts** (top-N by enrollment) with their primary ZIP.

The OUTPUT file is the committed artifact; ``build_snapshot.py`` folds
``catalogue.imported.json`` files into the bundled snapshot exactly like
the hand-authored catalogues. This script is deterministic — re-running it
over unchanged sources produces byte-identical output — and CI runs
``import_ccss.py --check`` next to ``build_snapshot.py --check`` so the
committed import can never drift from the vendored sources.

Never invent standards (ADR 0041): every skill row here carries the
official statementNotation in ``source`` and the official description
verbatim in ``summary``.

Usage::

    python import_ccss.py            # regenerate catalogue.imported.json
    python import_ccss.py --check    # exit 1 if the committed file is stale
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SOURCES = _REPO_ROOT / "packages" / "content-pack" / "data" / "sources"
_CCSS_DIR = _SOURCES / "ccss"
_NCES_FILE = _SOURCES / "nces" / "top-districts.json"
_HAND_CATALOGUE = _REPO_ROOT / "packages" / "content-pack" / "data" / "us-ccss" / "catalogue.json"
_OUT_PATH = _REPO_ROOT / "packages" / "content-pack" / "data" / "us-ccss" / "catalogue.imported.json"

GRADE_BANDS = ["k", "1", "2", "3", "4", "5", "6", "7", "8"]
SUBJECTS = ["math", "ela"]

_MATH_PREFIX = "ccss.math.content."
_ELA_PREFIX = "ccss.ela-literacy."
_NUM_SUB_RE = re.compile(r"^(\d+)([a-z]*)$")


class ImportError_(RuntimeError):
    """Structural problem in the vendored sources."""


def notation_to_skill_id(notation: str, subject: str) -> str | None:
    """Official statementNotation → canonical catalogue skill id.

    ``CCSS.Math.Content.3.NF.A.1``   → ``ccss.math.3.nf.a.1``
    ``CCSS.ELA-Literacy.RF.K.1``     → ``ccss.ela.rf.k.1``
    Practice standards and anything outside the content prefixes → None.
    """
    low = (notation or "").strip().lower()
    if subject == "math":
        if not low.startswith(_MATH_PREFIX):
            return None
        return "ccss.math." + low[len(_MATH_PREFIX):]
    if not low.startswith(_ELA_PREFIX):
        return None
    tail = low[len(_ELA_PREFIX):]
    # Skipped strands:
    #   - CCRA anchors (CCSS.ELA-Literacy.CCRA.R.1 …): grade-agnostic
    #     umbrellas repeated verbatim in every grade set.
    #   - RH/RST/WHST (literacy in history/science/technical subjects):
    #     banded 6–8 strands duplicated across the 6/7/8 grade sets; they
    #     belong to the content-area sets, not the core K–8 ELA catalogue.
    if tail.startswith(("ccra.", "rh.", "rst.", "whst.")):
        return None
    return "ccss.ela." + tail


def parse_code_parts(skill_id: str, subject: str) -> dict | None:
    """Split a canonical id into ordering parts.

    math: ``ccss.math.<grade>.<domain>.<cluster>.<numsub>``
    ela:  ``ccss.ela.<domain>.<grade>.<numsub>`` (no cluster letter)
    Returns ``{domain, cluster, number, sub}`` or None when the tail does
    not follow the numbered shape (e.g. an intro/range statement).
    """
    parts = skill_id.split(".")
    if subject == "math":
        if len(parts) != 6:
            return None
        _, _, _grade, domain, cluster, numsub = parts
    else:
        if len(parts) != 5:
            return None
        _, _, domain, _grade, numsub = parts
        cluster = ""
    m = _NUM_SUB_RE.match(numsub)
    if not m:
        return None
    return {
        "domain": domain,
        "cluster": cluster,
        "number": int(m.group(1)),
        "sub": m.group(2),
    }


def derive_label(description: str) -> str:
    """Short display label from the official description: the first
    sentence, trimmed to ≤80 chars on a word boundary."""
    text = " ".join((description or "").split())
    first = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0].rstrip(".")
    if len(first) <= 80:
        return first
    cut = first[:80].rsplit(" ", 1)[0].rstrip(",;:")
    return cut + "…"


def build_prerequisites(skills: list[dict], subject: str) -> None:
    """Fill ``prerequisites`` in place per the intra-domain ordering rules.
    ``skills`` rows must carry ``id``/``gradeBand``/``_parts``/``_position``."""
    by_id = {s["id"] for s in skills}
    groups: dict[tuple, list[dict]] = {}
    for s in skills:
        p = s["_parts"]
        if p is None:
            continue
        groups.setdefault((s["gradeBand"], p["domain"]), []).append(s)

    for (_band, _domain), rows in groups.items():
        rows.sort(key=lambda s: (s["_parts"]["cluster"], s["_parts"]["number"], s["_parts"]["sub"], s["id"]))
        prev_numbered: str | None = None
        for s in rows:
            p = s["_parts"]
            prereqs: list[str] = []
            if p["sub"]:
                # Sub-standard ← its numbered parent when present.
                parent = s["id"][: -len(p["sub"])]
                if parent in by_id:
                    prereqs.append(parent)
            else:
                # CCSS numbering runs ACROSS clusters within a domain
                # (3.MD.A.2 is followed by 3.MD.B.3), so the same-cluster
                # predecessor is preferred and the previous numbered
                # standard in domain order is the fallback — which also
                # chains the first standard of cluster B onto the last of
                # cluster A.
                same_cluster_prev = re.sub(r"\d+$", str(p["number"] - 1), s["id"])
                if p["number"] > 1 and same_cluster_prev in by_id:
                    prereqs.append(same_cluster_prev)
                elif prev_numbered:
                    prereqs.append(prev_numbered)
            s["prerequisites"] = prereqs
            if not p["sub"]:
                prev_numbered = s["id"]


def import_skills() -> list[dict]:
    skills: list[dict] = []
    seen: dict[str, str] = {}
    for subject in SUBJECTS:
        subject_rows: list[dict] = []
        for band in GRADE_BANDS:
            path = _CCSS_DIR / f"{subject}-grade-{band}.json"
            if not path.exists():
                raise ImportError_(f"missing vendored source: {path}")
            data = json.loads(path.read_text(encoding="utf-8"))["data"]
            standards = sorted(
                data["standards"].values(), key=lambda s: (s.get("position") or 0)
            )
            for std in standards:
                notation = std.get("statementNotation")
                if not notation:
                    continue
                skill_id = notation_to_skill_id(notation, subject)
                if skill_id is None:
                    continue  # practice standards / out-of-scope notations
                if skill_id in seen:
                    raise ImportError_(
                        f"duplicate skill id '{skill_id}' from {path.name} "
                        f"(first seen in {seen[skill_id]})"
                    )
                seen[skill_id] = path.name
                description = " ".join((std.get("description") or "").split())
                subject_rows.append(
                    {
                        "id": skill_id,
                        "subject": subject,
                        "gradeBand": "K" if band == "k" else band,
                        "label": derive_label(description),
                        "summary": description[:480],
                        "prerequisites": [],
                        "source": notation,
                        "_parts": parse_code_parts(skill_id, subject),
                        "_position": std.get("position") or 0,
                    }
                )
        build_prerequisites(subject_rows, subject)
        skills.extend(subject_rows)
    for s in skills:
        s.pop("_parts", None)
        s.pop("_position", None)
    skills.sort(key=lambda s: s["id"])
    return skills


def import_districts() -> list[dict]:
    if not _NCES_FILE.exists():
        return []
    data = json.loads(_NCES_FILE.read_text(encoding="utf-8"))
    out = []
    for d in data.get("districts", []):
        out.append(
            {
                "id": d["id"],
                "name": d["name"],
                "state": d["state"],
                "region": d["state"],
                "zipCodes": [str(z) for z in d.get("zipCodes", [])],
                "source": f"NCES CCD {data.get('year', '')} LEAID {d.get('leaid', '')}".strip(),
            }
        )
    out.sort(key=lambda d: d["id"])
    return out


def build_packs(skills: list[dict], imported_districts: list[dict]) -> list[dict]:
    """One pack per (subject × band), assigned to EVERY US district in the
    catalogue (hand-seeded + imported) — CCSS is the common framework."""
    hand = json.loads(_HAND_CATALOGUE.read_text(encoding="utf-8"))
    district_ids = sorted(
        {d["id"] for d in hand.get("districts", [])}
        | {d["id"] for d in imported_districts}
    )
    packs: list[dict] = []
    for subject in SUBJECTS:
        for band in GRADE_BANDS:
            band_label = "K" if band == "k" else band
            skill_ids = [
                s["id"] for s in skills if s["subject"] == subject and s["gradeBand"] == band_label
            ]
            if not skill_ids:
                raise ImportError_(f"no skills imported for {subject} grade {band_label}")
            packs.append(
                {
                    "id": f"us-ccss-import-{subject}-{band}",
                    "title": f"CCSS {subject.upper()} Grade {band_label} (official import)",
                    "subject": subject,
                    "gradeBand": band_label,
                    "districtIds": district_ids,
                    "skillIds": skill_ids,
                    "frameworkCode": "US-CCSS",
                }
            )
    packs.sort(key=lambda p: p["id"])
    return packs


def compile_imported() -> dict:
    skills = import_skills()
    districts = import_districts()
    packs = build_packs(skills, districts)
    return {
        "country": "US",
        "framework": "US-CCSS",
        "source": (
            "Common Core State Standards K–8 Math + ELA (official text via the "
            "Common Standards Project API, CC BY 3.0 US; see data/sources/ccss) "
            "+ NCES CCD district directory (see data/sources/nces). GENERATED by "
            "services/curriculum-svc/scripts/import_ccss.py — do not hand-edit."
        ),
        "districts": districts,
        "skills": skills,
        "contentPacks": packs,
    }


def render(payload: dict) -> str:
    return json.dumps(payload, indent=1, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import vendored CCSS sources into the catalogue.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the committed catalogue.imported.json matches the sources (exit 1 on drift)",
    )
    args = parser.parse_args(argv)

    rendered = render(compile_imported())
    if args.check:
        current = _OUT_PATH.read_text(encoding="utf-8") if _OUT_PATH.exists() else ""
        if current != rendered:
            print(
                "✗ catalogue.imported.json is stale — run "
                "`python services/curriculum-svc/scripts/import_ccss.py` and commit.",
                file=sys.stderr,
            )
            return 1
        print("✓ catalogue.imported.json is up to date with the vendored sources.")
        return 0

    _OUT_PATH.write_text(rendered, encoding="utf-8")
    payload = json.loads(rendered)
    math_n = sum(1 for s in payload["skills"] if s["subject"] == "math")
    ela_n = sum(1 for s in payload["skills"] if s["subject"] == "ela")
    print(
        f"✓ wrote {_OUT_PATH.relative_to(_REPO_ROOT)} — "
        f"{math_n} math + {ela_n} ela skills, {len(payload['districts'])} districts, "
        f"{len(payload['contentPacks'])} packs."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
