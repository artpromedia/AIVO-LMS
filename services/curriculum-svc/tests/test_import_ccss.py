"""Wave D (G3) — the deterministic CCSS importer.

Two layers:
  1. Pure mapping rules on a fixture slice (notation→id, label derivation,
     skip rules, intra-domain prerequisite ordering).
  2. The REAL vendored sources: the acceptance counts the school-alignment
     promise depends on (≥300 math, ≥250 ELA, every K-8 band present) and
     byte-determinism of the committed artifact (--check semantics).
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "services" / "curriculum-svc" / "scripts" / "import_ccss.py"

spec = importlib.util.spec_from_file_location("import_ccss", _SCRIPT)
import_ccss = importlib.util.module_from_spec(spec)
sys.modules["import_ccss"] = import_ccss
spec.loader.exec_module(import_ccss)


# ── 1. Pure mapping rules ────────────────────────────────────────────────────

def test_notation_to_skill_id_canonicalises_official_codes():
    f = import_ccss.notation_to_skill_id
    assert f("CCSS.Math.Content.3.NF.A.1", "math") == "ccss.math.3.nf.a.1"
    assert f("CCSS.Math.Content.K.CC.B.4a", "math") == "ccss.math.k.cc.b.4a"
    assert f("CCSS.ELA-Literacy.RF.K.1", "ela") == "ccss.ela.rf.k.1"
    assert f("CCSS.ELA-Literacy.L.3.1a", "ela") == "ccss.ela.l.3.1a"


def test_notation_to_skill_id_skips_practice_anchors_and_content_area_strands():
    f = import_ccss.notation_to_skill_id
    assert f("CCSS.Math.Practice.MP1", "math") is None
    assert f("CCSS.ELA-Literacy.CCRA.R.1", "ela") is None
    assert f("CCSS.ELA-Literacy.RH.6-8.1", "ela") is None
    assert f("CCSS.ELA-Literacy.WHST.6-8.2", "ela") is None
    assert f(None, "math") is None


def test_derive_label_takes_first_sentence_capped_at_word_boundary():
    short = import_ccss.derive_label("Count to 100 by ones and by tens. Extra sentence.")
    assert short == "Count to 100 by ones and by tens"
    long = import_ccss.derive_label(
        "Understand a fraction as the quantity formed by one part when a whole is "
        "partitioned into equal parts in every possible configuration imaginable"
    )
    assert len(long) <= 81 and long.endswith("…")


def test_build_prerequisites_orders_within_domain():
    rows = []
    for skill_id in [
        "ccss.math.3.nf.a.1",
        "ccss.math.3.nf.a.1a",
        "ccss.math.3.nf.a.2",
        "ccss.math.3.nf.b.3",  # CCSS numbering continues across clusters
    ]:
        rows.append(
            {
                "id": skill_id,
                "gradeBand": "3",
                "prerequisites": [],
                "_parts": import_ccss.parse_code_parts(skill_id, "math"),
            }
        )
    import_ccss.build_prerequisites(rows, "math")
    by_id = {r["id"]: r["prerequisites"] for r in rows}
    assert by_id["ccss.math.3.nf.a.1"] == []
    assert by_id["ccss.math.3.nf.a.1a"] == ["ccss.math.3.nf.a.1"]   # sub ← parent
    assert by_id["ccss.math.3.nf.a.2"] == ["ccss.math.3.nf.a.1"]    # N ← N-1
    assert by_id["ccss.math.3.nf.b.3"] == ["ccss.math.3.nf.a.2"]    # cluster chain


# ── 2. The real vendored sources ─────────────────────────────────────────────

def test_real_import_meets_acceptance_counts_and_is_deterministic():
    payload = import_ccss.compile_imported()
    skills = payload["skills"]
    math = [s for s in skills if s["subject"] == "math"]
    ela = [s for s in skills if s["subject"] == "ela"]
    assert len(math) >= 300, f"math skills {len(math)} < 300"
    assert len(ela) >= 250, f"ela skills {len(ela)} < 250"
    bands = {s["gradeBand"] for s in skills}
    assert bands >= {"K", "1", "2", "3", "4", "5", "6", "7", "8"}

    # Every skill carries official provenance and a non-empty description.
    assert all(s["source"].startswith("CCSS.") for s in skills)
    assert all(s["summary"] for s in skills)
    # No dangling prerequisites.
    ids = {s["id"] for s in skills}
    assert all(p in ids for s in skills for p in s["prerequisites"])

    # 18 packs (2 subjects × K-8), each covering every catalogue district.
    packs = payload["contentPacks"]
    assert len(packs) == 18
    assert all(len(p["skillIds"]) >= 15 for p in packs)

    # Determinism: a second compile renders byte-identically, and the
    # committed artifact matches (the --check contract).
    assert import_ccss.render(payload) == import_ccss.render(import_ccss.compile_imported())
    committed = (import_ccss._OUT_PATH).read_text(encoding="utf-8")
    assert committed == import_ccss.render(payload), (
        "catalogue.imported.json is stale — run import_ccss.py and commit"
    )


def test_snapshot_includes_the_import():
    snapshot = json.loads(
        (
            _REPO_ROOT
            / "services/curriculum-svc/src/curriculum_svc/data/skill_graphs.json"
        ).read_text(encoding="utf-8")
    )
    ids = {s["id"] for s in snapshot["skills"]}
    assert "ccss.math.3.nf.a.1" in ids
    assert "ccss.ela.rf.k.1" in ids
    assert len(snapshot["districts"]) >= 100
