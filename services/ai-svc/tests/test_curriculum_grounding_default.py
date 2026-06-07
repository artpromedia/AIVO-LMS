"""Sprint 3: curriculum grounding is ON by default, and non-US learners
(NG/AE/GB) resolve to their own jurisdiction's anchors.

Run with:  pytest services/ai-svc/tests/test_curriculum_grounding_default.py -v
"""
from __future__ import annotations

import httpx
import pytest

from ai_svc.services import curriculum_client


# ── default-on behaviour ──────────────────────────────────────────────


class TestGroundingEnabledByDefault:
    def test_unset_flag_is_enabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AIVO_FEATURE_CURRICULUM_GROUNDING", raising=False)
        assert curriculum_client.curriculum_grounding_enabled() is True

    def test_empty_flag_is_enabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AIVO_FEATURE_CURRICULUM_GROUNDING", "")
        assert curriculum_client.curriculum_grounding_enabled() is True

    @pytest.mark.parametrize("val", ["0", "false", "no", "off", "FALSE", "Off"])
    def test_explicit_falsey_disables(self, monkeypatch: pytest.MonkeyPatch, val: str) -> None:
        monkeypatch.setenv("AIVO_FEATURE_CURRICULUM_GROUNDING", val)
        assert curriculum_client.curriculum_grounding_enabled() is False


def _patch_async_client(monkeypatch, transport: httpx.MockTransport) -> None:
    real_init = httpx.AsyncClient.__init__

    def _wrapped(self, *args, **kwargs):
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", _wrapped)


# ── international grounding (NG / AE / GB) ─────────────────────────────


def _intl_handler(country: str, district_id: str, framework: str, skill_id: str):
    """Build a MockTransport handler emulating curriculum-svc for a country."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/jurisdictions/resolve"):
            assert request.url.params.get("country") == country
            return httpx.Response(
                200,
                json={
                    "country": country,
                    "region": request.url.params.get("region"),
                    "districtId": district_id,
                    "districtName": f"{country} district",
                    "frameworkCode": framework,
                    "frameworkName": framework,
                    "gradeBandScheme": "scheme",
                },
            )
        if request.url.path.endswith("/lookup"):
            # Must carry the country locator, never a US zipCode.
            assert request.url.params.get("country") == country
            assert "zipCode" not in request.url.params
            if request.url.params.get("subject") == "math":
                return httpx.Response(
                    200,
                    json={
                        "district": {"id": district_id},
                        "skills": [
                            {
                                "id": skill_id,
                                "subject": "math",
                                "label": "Real skill",
                                "summary": "From the national framework.",
                                "prerequisites": [],
                                "source": f"{framework} ref",
                            }
                        ],
                        "contentPacks": [],
                    },
                )
            return httpx.Response(200, json={"skills": [], "contentPacks": []})
        return httpx.Response(404)

    return handler


class TestInternationalGrounding:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "country,region,district,framework,skill,grade",
        [
            ("NG", "Lagos", "ng-lagos-state", "NG-NERDC", "ng-nerdc.math.p3.number.addition", "Primary-3"),
            ("AE", "Dubai", "ae-dubai", "UAE-MOE", "uae-moe.math.g1.numbers-to-20", "Grade-1"),
            ("GB", None, "gb-england", "UK-NC", "uk-nc.math.y1.number-to-100", "Year-1"),
        ],
    )
    async def test_non_us_country_returns_its_own_anchors(
        self, monkeypatch, country, region, district, framework, skill, grade
    ):
        # Flag unset → grounding on by default.
        monkeypatch.delenv("AIVO_FEATURE_CURRICULUM_GROUNDING", raising=False)
        _patch_async_client(
            monkeypatch, httpx.MockTransport(_intl_handler(country, district, framework, skill))
        )
        out = await curriculum_client.load_curriculum_grounding(
            country=country, region=region, grade_level=grade
        )
        assert out["district"]["id"] == district
        assert out["gradeBand"] == grade
        assert "math" in out["subjects"]
        assert out["subjects"]["math"][0]["id"] == skill

    @pytest.mark.asyncio
    async def test_unseeded_country_grounds_empty_not_us(self, monkeypatch):
        monkeypatch.delenv("AIVO_FEATURE_CURRICULUM_GROUNDING", raising=False)

        def handler(request: httpx.Request) -> httpx.Response:
            # Known-but-unseeded country → 404 from curriculum-svc.
            return httpx.Response(404, json={"detail": "no curriculum seeded for AU"})

        _patch_async_client(monkeypatch, httpx.MockTransport(handler))
        out = await curriculum_client.load_curriculum_grounding(
            country="AU", grade_level="Year-1"
        )
        # Empty, never a US fallback.
        assert out == {"district": None, "gradeBand": None, "subjects": {}}
