#!/usr/bin/env python3
"""
Deterministic snapshot compiler for curriculum-svc.

Compiles the per-jurisdiction source data under
``packages/content-pack/data/<jurisdiction>/catalogue.json`` (US + intl)
into the single bundled snapshot
``services/curriculum-svc/src/curriculum_svc/data/skill_graphs.json``.

This replaces the hand-maintained snapshot: the source data is the thing
humans edit, and this script regenerates the snapshot reproducibly. CI
runs ``build_snapshot.py --check`` to fail the build if the committed
snapshot has drifted from the sources.

Determinism: districts/skills/contentPacks are sorted by id, JSON is
emitted with a stable 2-space indent and a trailing newline, and
``generatedAt`` is a fixed constant (bumped only when the format changes)
so re-running the build never produces spurious diffs.

Usage::

    python build_snapshot.py            # regenerate the snapshot in place
    python build_snapshot.py --check    # exit 1 if the snapshot is stale
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Bumped only when the snapshot *format* changes — NOT a wall-clock time,
# so `--check` stays stable across rebuilds.
SNAPSHOT_GENERATED_AT = "2026-06-06T00:00:00Z"
SCHEMA_VERSION = 2

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SOURCE_DIR = _REPO_ROOT / "packages" / "content-pack" / "data"
_SNAPSHOT_PATH = (
    _REPO_ROOT
    / "services"
    / "curriculum-svc"
    / "src"
    / "curriculum_svc"
    / "data"
    / "skill_graphs.json"
)


class BuildError(RuntimeError):
    """Raised on a structural problem in the source data (duplicate id, …)."""


def _load_sources(source_dir: Path) -> list[tuple[str, dict]]:
    """Load every ``<jurisdiction>/catalogue.json`` under ``source_dir``,
    sorted by path for stable iteration. Returns ``(name, data)`` tuples."""
    out: list[tuple[str, dict]] = []
    for catalogue_path in sorted(source_dir.glob("*/catalogue.json")):
        data = json.loads(catalogue_path.read_text(encoding="utf-8"))
        out.append((catalogue_path.parent.name, data))
    if not out:
        raise BuildError(f"no source catalogues found under {source_dir}")
    return out


def _district_record(country: str, d: dict) -> dict:
    return {
        "id": d["id"],
        "name": d.get("name", d["id"]),
        "state": d.get("state", ""),
        "country": country,
        "region": d.get("region") or d.get("state") or None,
        "zipCodes": [str(z) for z in d.get("zipCodes", [])],
    }


def _skill_record(s: dict) -> dict:
    return {
        "id": s["id"],
        "subject": s["subject"],
        "gradeBand": s["gradeBand"],
        "label": s.get("label", ""),
        "summary": s.get("summary", ""),
        "prerequisites": list(s.get("prerequisites", [])),
        "source": s.get("source", ""),
    }


def _pack_record(framework_code: str, p: dict) -> dict:
    return {
        "id": p["id"],
        "title": p.get("title", p["id"]),
        "subject": p["subject"],
        "gradeBand": p["gradeBand"],
        "districtIds": list(p.get("districtIds", [])),
        "skillIds": list(p.get("skillIds", [])),
        "frameworkCode": p.get("frameworkCode", framework_code),
    }


def compile_snapshot(source_dir: Path = _SOURCE_DIR) -> dict:
    """Merge all source catalogues into one snapshot dict."""
    districts: dict[str, dict] = {}
    skills: dict[str, dict] = {}
    packs: dict[str, dict] = {}

    for name, data in _load_sources(source_dir):
        country = (data.get("country") or "US").upper()
        framework_code = data.get("framework", "")
        for d in data.get("districts", []):
            rec = _district_record(country, d)
            if rec["id"] in districts:
                raise BuildError(f"duplicate district id '{rec['id']}' (in {name})")
            districts[rec["id"]] = rec
        for s in data.get("skills", []):
            rec = _skill_record(s)
            if rec["id"] in skills:
                raise BuildError(f"duplicate skill id '{rec['id']}' (in {name})")
            skills[rec["id"]] = rec
        for p in data.get("contentPacks", []):
            rec = _pack_record(framework_code, p)
            if rec["id"] in packs:
                raise BuildError(f"duplicate content pack id '{rec['id']}' (in {name})")
            packs[rec["id"]] = rec

    # Referential integrity: every pack skill id must exist.
    known_skills = set(skills)
    for pack in packs.values():
        missing = [sid for sid in pack["skillIds"] if sid not in known_skills]
        if missing:
            raise BuildError(f"content pack '{pack['id']}' references unknown skills: {missing}")

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": SNAPSHOT_GENERATED_AT,
        "districts": [districts[k] for k in sorted(districts)],
        "skills": [skills[k] for k in sorted(skills)],
        "contentPacks": [packs[k] for k in sorted(packs)],
    }


def render(snapshot: dict) -> str:
    return json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compile the curriculum snapshot.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the committed snapshot matches the sources (exit 1 on drift)",
    )
    args = parser.parse_args(argv)

    rendered = render(compile_snapshot())

    if args.check:
        current = _SNAPSHOT_PATH.read_text(encoding="utf-8") if _SNAPSHOT_PATH.exists() else ""
        if current != rendered:
            print(
                "✗ skill_graphs.json is stale — run "
                "`python services/curriculum-svc/scripts/build_snapshot.py` and commit.",
                file=sys.stderr,
            )
            return 1
        print("✓ skill_graphs.json is up to date with the source catalogues.")
        return 0

    _SNAPSHOT_PATH.write_text(rendered, encoding="utf-8")
    snap = json.loads(rendered)
    print(
        f"✓ wrote {_SNAPSHOT_PATH.relative_to(_REPO_ROOT)} — "
        f"{len(snap['districts'])} districts, {len(snap['skills'])} skills, "
        f"{len(snap['contentPacks'])} content packs."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
