"""Tests for the curriculum validator (ADR 0041) and its integration into
the curriculum engine.

Proves the core agentic-safety guarantee: brain-svc cannot emit a standard
code that is absent from the curriculum-svc catalogue. A hallucinated code
(``NG-FAKE.9.99``) is dropped; a real catalogue code passes.

Run with:  PYTHONPATH=services/brain-svc/src pytest services/brain-svc/tests/test_curriculum_validator.py -v
"""
from __future__ import annotations

import json

import httpx
import pytest

from brain_svc.services import curriculum_engine, curriculum_validator


# ── Pure validation ───────────────────────────────────────────────────


class TestValidateNodes:
    def test_drops_hallucinated_code_keeps_real(self):
        proposed = [
            {"code": "ng-nerdc.math.p3.number.addition", "description": "Add 3-digit numbers"},
            {"code": "NG-FAKE.9.99", "description": "A standard the model invented"},
        ]
        valid = {"ng-nerdc.math.p3.number.addition", "ng-nerdc.math.p3.number.fractions"}
        result = curriculum_validator.validate_nodes(proposed, valid)
        accepted_codes = [n["code"] for n in result.accepted]
        rejected_codes = [r["code"] for r in result.rejected]
        assert accepted_codes == ["ng-nerdc.math.p3.number.addition"]
        assert rejected_codes == ["NG-FAKE.9.99"]
        assert result.rejected[0]["reason"] == "not_in_catalogue"

    def test_no_fuzzy_matching(self):
        # A near-miss is still rejected — we never "round" to a real code.
        proposed = [{"code": "ng-nerdc.math.p3.number.addition "}]  # trailing space stripped
        valid = {"ng-nerdc.math.p3.number.addition"}
        assert len(curriculum_validator.validate_nodes(proposed, valid).accepted) == 1
        proposed2 = [{"code": "ng-nerdc.math.p3.number.add"}]  # truncated
        assert curriculum_validator.validate_nodes(proposed2, valid).accepted == []

    def test_missing_code_rejected(self):
        result = curriculum_validator.validate_nodes([{"description": "no code"}], {"x"})
        assert result.accepted == []
        assert result.rejected[0]["reason"] == "missing_code"

    def test_accepts_id_or_code_key(self):
        valid = {"real.1"}
        assert len(curriculum_validator.validate_nodes([{"id": "real.1"}], valid).accepted) == 1


# ── fetch_valid_codes (mocked transport) ──────────────────────────────


def _patch_async_client(monkeypatch, transport: httpx.MockTransport) -> None:
    real_init = httpx.AsyncClient.__init__

    def _wrapped(self, *args, **kwargs):
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", _wrapped)


class TestFetchValidCodes:
    @pytest.mark.asyncio
    async def test_returns_skill_ids_on_200(self, monkeypatch):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"skills": [{"id": "ng-nerdc.math.p3.number.addition"}, {"id": "x.2"}]},
            )

        _patch_async_client(monkeypatch, httpx.MockTransport(handler))
        codes = await curriculum_validator.fetch_valid_codes(subject="math", grade_band="Primary-3")
        assert codes == {"ng-nerdc.math.p3.number.addition", "x.2"}

    @pytest.mark.asyncio
    async def test_returns_none_on_non_200(self, monkeypatch):
        _patch_async_client(monkeypatch, httpx.MockTransport(lambda r: httpx.Response(404)))
        codes = await curriculum_validator.fetch_valid_codes(subject="math", grade_band="K")
        assert codes is None

    @pytest.mark.asyncio
    async def test_returns_none_on_transport_error(self, monkeypatch):
        def boom(request):
            raise httpx.ConnectError("svc down")

        _patch_async_client(monkeypatch, httpx.MockTransport(boom))
        assert await curriculum_validator.fetch_valid_codes(subject="math", grade_band="K") is None

    @pytest.mark.asyncio
    async def test_refuses_unscoped_lookup(self):
        # Without subject/gradeBand there is nothing to scope by.
        assert await curriculum_validator.fetch_valid_codes() is None


class TestValidateAgainstCatalogue:
    @pytest.mark.asyncio
    async def test_unavailable_catalogue_emits_nothing(self, monkeypatch):
        async def _none(**kwargs):
            return None

        monkeypatch.setattr(curriculum_validator, "fetch_valid_codes", _none)
        result = await curriculum_validator.validate_against_catalogue(
            [{"code": "anything"}], subject="math", grade_band="K"
        )
        assert result.catalogue_available is False
        assert result.accepted == []


# ── Engine integration (real litellm import; LLM call mocked) ──────────


class TestEngineRejectsHallucinatedCodes:
    @pytest.mark.asyncio
    async def test_extract_drops_codes_absent_from_catalogue(self, monkeypatch):
        async def fake_completion(**kwargs):
            return {
                "content": json.dumps(
                    {
                        "standards": [
                            {"code": "ng-nerdc.math.p3.number.addition", "description": "Add"},
                            {"code": "NG-FAKE.9.99", "description": "Invented"},
                        ]
                    }
                )
            }

        async def fake_valid_codes(**kwargs):
            return {"ng-nerdc.math.p3.number.addition"}

        # Mock the LLM call boundary and the catalogue fetch — NOT litellm.
        monkeypatch.setattr(curriculum_engine, "generate_completion", fake_completion)
        monkeypatch.setattr(curriculum_engine, "fetch_valid_codes", fake_valid_codes)

        out = await curriculum_engine.extract_curriculum_standards(
            framework="NG-NERDC",
            standards_code="NG-NERDC",
            subject="math",
            grade_level="Primary-3",
            country="NG",
            region="Lagos",
        )
        codes = [s["code"] for s in out["standards"]]
        assert codes == ["ng-nerdc.math.p3.number.addition"]
        assert out["validation"]["catalogue_available"] is True
        assert [r["code"] for r in out["validation"]["rejected"]] == ["NG-FAKE.9.99"]

    @pytest.mark.asyncio
    async def test_extract_emits_nothing_when_catalogue_unavailable(self, monkeypatch):
        async def fake_completion(**kwargs):
            return {"content": json.dumps({"standards": [{"code": "ccss.math.k.cc.a.1"}]})}

        async def no_codes(**kwargs):
            return None

        monkeypatch.setattr(curriculum_engine, "generate_completion", fake_completion)
        monkeypatch.setattr(curriculum_engine, "fetch_valid_codes", no_codes)

        out = await curriculum_engine.extract_curriculum_standards(
            framework="US-CCSS", standards_code="CCSS", subject="math", grade_level="K"
        )
        assert out["standards"] == []
        assert out["validation"]["catalogue_available"] is False
