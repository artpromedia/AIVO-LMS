"""Tests for the Sprint 1 curriculum grounding pipeline.

Covers:
  * normalize_grade_band — maps noisy grade input to catalogue tokens.
  * load_curriculum_grounding — feature flag gate, ZIP requirement,
    graceful degradation on 4xx/5xx/network failure, happy path.
  * _format_curriculum_grounding_block — empty input returns "", real
    input renders skill anchors with prereqs into the prompt.
  * build_baseline_generation_prompt — when curriculum_grounding is
    provided the system prompt contains the anchor codes verbatim.

Run with:  pytest services/ai-svc/tests/test_curriculum_grounding.py -v
"""
from __future__ import annotations

from typing import Any

import httpx
import pytest

from ai_svc.services import curriculum_client
from ai_svc.services.baseline_generator import (
    _format_curriculum_grounding_block,
    build_baseline_generation_prompt,
)


PARENT = {
    "communicationMode": "verbal",
    "deviceInteraction": "independent",
    "functioningLevel": "STANDARD",
    "attentionSpan": "typical",
    "diagnoses": [],
    "responses": {"pref-1": ["soccer"]},
}


# ── normalize_grade_band ──────────────────────────────────────────────


class TestNormalizeGradeBand:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            (None, None),
            ("", None),
            ("K", "K"),
            ("kindergarten", "K"),
            ("Kinder", "K"),
            ("PK", "PK"),
            ("Pre-K", "PK"),
            ("3", "3"),
            ("3rd", "3"),
            ("Grade 3", "3"),
            ("third", "3"),
            ("12", "12"),
            ("twelfth", "12"),
            (5, "5"),
            ("College", None),
        ],
    )
    def test_normalizes_grade(self, raw: Any, expected: str | None) -> None:
        assert curriculum_client.normalize_grade_band(raw) == expected


# ── load_curriculum_grounding ─────────────────────────────────────────


def _enable_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIVO_FEATURE_CURRICULUM_GROUNDING", "true")


def _disable_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AIVO_FEATURE_CURRICULUM_GROUNDING", raising=False)


def _mock_transport(handler) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


def _patch_async_client(monkeypatch: pytest.MonkeyPatch, transport: httpx.MockTransport) -> None:
    """Force httpx.AsyncClient to use a MockTransport so the curriculum
    client never opens a real socket in tests.
    """
    real_init = httpx.AsyncClient.__init__

    def _wrapped(self, *args, **kwargs):  # type: ignore[no-redef]
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", _wrapped)


class TestLoadCurriculumGrounding:
    @pytest.mark.asyncio
    async def test_flag_off_returns_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _disable_flag(monkeypatch)
        out = await curriculum_client.load_curriculum_grounding(
            zip_code="78701", grade_level="3"
        )
        assert out == {"district": None, "gradeBand": None, "subjects": {}}

    @pytest.mark.asyncio
    async def test_missing_zip_returns_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _enable_flag(monkeypatch)
        out = await curriculum_client.load_curriculum_grounding(
            zip_code=None, grade_level="3"
        )
        assert out["subjects"] == {}

    @pytest.mark.asyncio
    async def test_district_404_returns_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _enable_flag(monkeypatch)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "unknown zip"})

        _patch_async_client(monkeypatch, _mock_transport(handler))
        out = await curriculum_client.load_curriculum_grounding(
            zip_code="99999", grade_level="3"
        )
        assert out["subjects"] == {}
        assert out["district"] is None

    @pytest.mark.asyncio
    async def test_network_error_swallowed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _enable_flag(monkeypatch)

        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("svc down")

        _patch_async_client(monkeypatch, _mock_transport(handler))
        out = await curriculum_client.load_curriculum_grounding(
            zip_code="55101", grade_level="K"
        )
        # Curriculum grounding is enrichment; network failure must NOT
        # raise — the baseline pipeline still has to run.
        assert out["subjects"] == {}

    @pytest.mark.asyncio
    async def test_happy_path_aggregates_subjects(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _enable_flag(monkeypatch)

        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(str(request.url))
            if request.url.path.endswith("/districts/resolve"):
                return httpx.Response(
                    200,
                    json={
                        "zipCode": "55101",
                        "district": {
                            "id": "mn-stpaul-public-schools",
                            "name": "Saint Paul Public Schools",
                            "state": "MN",
                            "zipCodes": ["55101"],
                        },
                    },
                )
            if request.url.path.endswith("/lookup"):
                subject = request.url.params.get("subject")
                if subject == "math":
                    return httpx.Response(
                        200,
                        json={
                            "district": {
                                "id": "mn-stpaul-public-schools",
                                "name": "Saint Paul Public Schools",
                                "state": "MN",
                                "zipCodes": ["55101"],
                            },
                            "skills": [
                                {
                                    "id": "ccss-math.K.CC.A.1",
                                    "subject": "math",
                                    "gradeBand": "K",
                                    "label": "Count to 100 by ones and tens",
                                    "summary": "Rote counting fluency to 100.",
                                    "prerequisites": [],
                                },
                                {
                                    "id": "ccss-math.K.CC.B.4",
                                    "subject": "math",
                                    "gradeBand": "K",
                                    "label": "Count objects 1-1",
                                    "summary": "One-to-one correspondence.",
                                    "prerequisites": ["ccss-math.K.CC.A.1"],
                                },
                            ],
                            "contentPacks": [],
                        },
                    )
                # Subject has no catalogue entries — return empty list.
                return httpx.Response(200, json={"skills": [], "contentPacks": []})
            return httpx.Response(404)

        _patch_async_client(monkeypatch, _mock_transport(handler))
        out = await curriculum_client.load_curriculum_grounding(
            zip_code="55101", grade_level="Kindergarten"
        )
        assert out["district"]["id"] == "mn-stpaul-public-schools"
        assert out["district"]["state"] == "MN"
        assert out["gradeBand"] == "K"
        assert "math" in out["subjects"]
        assert len(out["subjects"]["math"]) == 2
        assert out["subjects"]["math"][0]["id"] == "ccss-math.K.CC.A.1"
        # Subjects without catalogue entries should be absent (not present
        # with empty list) so the prompt block stays focused.
        assert "ela" not in out["subjects"]
        # District resolve called once, then once per fetched subject.
        assert any("/districts/resolve" in c for c in calls)
        assert sum("/lookup" in c for c in calls) >= 1


# ── _format_curriculum_grounding_block ─────────────────────────────────


class TestFormatGroundingBlock:
    def test_empty_input_returns_blank(self) -> None:
        assert _format_curriculum_grounding_block(None) == ""
        assert _format_curriculum_grounding_block({}) == ""
        assert _format_curriculum_grounding_block({"subjects": {}}) == ""
        assert _format_curriculum_grounding_block({"subjects": "garbage"}) == ""

    def test_renders_district_and_anchors(self) -> None:
        grounding = {
            "district": {
                "id": "mn-stpaul-public-schools",
                "name": "Saint Paul Public Schools",
                "state": "MN",
            },
            "gradeBand": "K",
            "subjects": {
                "math": [
                    {
                        "id": "ccss-math.K.CC.A.1",
                        "label": "Count to 100",
                        "summary": "Counts to 100.",
                        "prerequisites": [],
                    },
                    {
                        "id": "ccss-math.K.CC.B.4",
                        "label": "1-1 Correspondence",
                        "summary": "Counts objects.",
                        "prerequisites": ["ccss-math.K.CC.A.1"],
                    },
                ],
            },
        }
        out = _format_curriculum_grounding_block(grounding)
        assert "District-Aligned Curriculum Anchors" in out
        assert "Saint Paul Public Schools" in out
        assert "ccss-math.K.CC.A.1" in out
        assert "ccss-math.K.CC.B.4" in out
        assert "builds on ccss-math.K.CC.A.1" in out
        # Should instruct the LLM to use these specific codes.
        assert "Do NOT invent standard codes" in out


# ── end-to-end prompt integration ─────────────────────────────────────


class TestBaselinePromptWithGrounding:
    def test_grounding_passes_through_to_prompt(self) -> None:
        grounding = {
            "district": {
                "id": "tx-austin-isd",
                "name": "Austin Independent School District",
                "state": "TX",
            },
            "gradeBand": "3",
            "subjects": {
                "math": [
                    {
                        "id": "teks.math.3.4.A",
                        "label": "Solve one- and two-step problems",
                        "summary": "Addition/subtraction within 1000.",
                        "prerequisites": [],
                    },
                ],
            },
        }
        sys, user = build_baseline_generation_prompt(
            PARENT, curriculum_grounding=grounding
        )
        assert "teks.math.3.4.A" in sys
        assert "Austin Independent School District" in sys
        # User prompt unchanged — anchors live in the system prompt so
        # they ride the Anthropic ephemeral cache.
        assert "42 personalized baseline assessment questions" in user

    def test_no_grounding_does_not_emit_anchor_block(self) -> None:
        sys, _ = build_baseline_generation_prompt(PARENT)
        assert "District-Aligned Curriculum Anchors" not in sys
