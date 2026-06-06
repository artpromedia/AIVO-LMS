"""Tests for the whole-term syllabus parser (Sprint 6).

Covers the deterministic heuristic parse of a realistic multi-week term
document, chunking large documents without truncation, the LLM path
(mocked at the generate_completion boundary), and the heuristic fallback.

Run with:  pytest services/ai-svc/tests/test_term_syllabus_parser.py -v
"""
from __future__ import annotations

import pytest

from ai_svc.services import term_syllabus_parser as tsp


def _build_term_doc(weeks: int = 12) -> str:
    """A realistic, multi-page Grade-3 math term syllabus."""
    topics = [
        "Place value to 1,000",
        "Rounding to the nearest 10 and 100",
        "Addition with regrouping",
        "Subtraction with regrouping",
        "Multiplication facts 0-5",
        "Multiplication facts 6-9",
        "Division as equal groups",
        "Fractions on a number line",
        "Comparing fractions",
        "Area and perimeter",
        "Telling time to the minute",
        "Bar graphs and data",
    ]
    std = [
        "3.NBT.A.1", "3.NBT.A.1", "3.NBT.A.2", "3.NBT.A.2",
        "3.OA.C.7", "3.OA.C.7", "3.OA.A.2", "3.NF.A.2",
        "3.NF.A.3", "3.MD.C.7", "3.MD.A.1", "3.MD.B.3",
    ]
    parts = ["Grade 3 Mathematics — Fall Term Syllabus\nTeacher: Ms. Rivera\n\n"]
    for i in range(weeks):
        parts.append(
            f"Week {i + 1}: {topics[i % len(topics)]}\n"
            f"  Students will master {topics[i % len(topics)].lower()}.\n"
            f"  - Warm-up review\n  - Guided practice\n  - Independent work\n"
            f"Standards: {std[i % len(std)]}\n"
            f"Vocabulary: digit, value, regroup\n\n"
        )
    return "".join(parts)


class TestHeuristicParse:
    def test_twelve_week_doc_yields_twelve_units(self):
        scope = tsp.parse_term_syllabus_heuristic(_build_term_doc(12), subject="math")
        units = [u for t in scope["terms"] for u in t["units"]]
        assert len(units) == 12
        assert scope["subject"] == "math"
        assert scope["source"] == "uploaded_term_syllabus"
        # First unit carries the right title, standard, vocab, objective.
        u0 = units[0]
        assert "Place value" in u0["title"]
        assert "3.NBT.A.1" in u0["standards_addressed"]
        assert "digit" in u0["key_vocabulary"]
        assert any("students will" in o.lower() for o in u0["learning_objectives"])

    def test_split_across_three_terms(self):
        scope = tsp.parse_term_syllabus_heuristic(_build_term_doc(12), subject="math", term_count=3)
        assert scope["total_terms"] == 3
        per_term = [len(t["units"]) for t in scope["terms"]]
        assert sum(per_term) == 12
        assert per_term == [4, 4, 4]

    def test_no_headings_falls_back_to_single_unit(self):
        scope = tsp.parse_term_syllabus_heuristic(
            "Loose notes about fractions and place value. Standards: 3.NF.A.1",
            subject="math",
        )
        units = [u for t in scope["terms"] for u in t["units"]]
        assert len(units) == 1
        assert "3.NF.A.1" in units[0]["standards_addressed"]

    def test_empty_text_yields_no_terms(self):
        scope = tsp.parse_term_syllabus_heuristic("   ", subject="math")
        assert scope["terms"] == []


class TestChunkingNoTruncation:
    def test_large_doc_chunks_without_dropping_text(self):
        # ~40 KB document, well over the old 16 KB cap.
        doc = _build_term_doc(12) + ("\nFiller line of curriculum notes." * 1500)
        assert len(doc) > 32 * 1024
        chunks = tsp.split_into_chunks(doc, max_chars=8000)
        assert len(chunks) > 1
        assert all(len(c) <= 8000 for c in chunks)
        # No text is lost: concatenation reproduces the input exactly.
        assert "".join(chunks) == tsp._normalize(doc)

    def test_large_doc_still_parses_all_weeks(self):
        doc = _build_term_doc(12) + ("\nExtra notes." * 4000)
        assert len(doc) > 32 * 1024
        scope = tsp.parse_term_syllabus_heuristic(doc, subject="math")
        units = [u for t in scope["terms"] for u in t["units"]]
        assert len(units) == 12  # nothing truncated away


class TestLLMPath:
    @pytest.mark.asyncio
    async def test_llm_units_are_used_and_merged_across_chunks(self):
        calls = {"n": 0}

        async def fake_completion(*, system_prompt, user_prompt, **kwargs):
            calls["n"] += 1
            n = calls["n"]
            return {
                "content": (
                    '{"units": [{"title": "LLM Unit %d", "duration_weeks": 1, '
                    '"topics": ["t"], "learning_objectives": [], '
                    '"standards_addressed": ["3.OA.A.1"], "key_vocabulary": []}]}' % n
                )
            }

        # Force >1 chunk so we prove per-chunk merge.
        doc = _build_term_doc(12) + ("\nfiller" * 4000)
        scope = await tsp.parse_term_syllabus(
            doc, subject="math", generate_completion=fake_completion, max_chars_per_chunk=6000
        )
        units = [u for t in scope["terms"] for u in t["units"]]
        assert calls["n"] >= 2
        assert len(units) == calls["n"]
        assert units[0]["title"].startswith("LLM Unit")

    @pytest.mark.asyncio
    async def test_llm_error_falls_back_to_heuristic(self):
        async def boom(**kwargs):
            raise RuntimeError("model down")

        scope = await tsp.parse_term_syllabus(
            _build_term_doc(12), subject="math", generate_completion=boom
        )
        units = [u for t in scope["terms"] for u in t["units"]]
        assert len(units) == 12  # heuristic fallback ran

    @pytest.mark.asyncio
    async def test_use_llm_false_runs_heuristic(self):
        scope = await tsp.parse_term_syllabus(_build_term_doc(5), subject="math", use_llm=False)
        units = [u for t in scope["terms"] for u in t["units"]]
        assert len(units) == 5
