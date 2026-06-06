"""Tests for the Jurisdiction model (Sprint 2).

Covers US ZIP resolution, international resolution (NG/AE/GB), the
critical no-silent-US-fallback guarantee for unseeded and unknown
countries, and malformed input — at both the catalogue/unit level and the
HTTP route level.

Run with:
    PYTHONPATH=services/curriculum-svc/src pytest services/curriculum-svc/tests/test_jurisdiction.py -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from curriculum_svc import jurisdiction
from curriculum_svc.catalogue import get_catalogue, load_catalogue_from_dict
from curriculum_svc.frameworks import get_framework
from curriculum_svc.main import app

client = TestClient(app)
DEV = {"X-Service-Token": "aivo-internal-dev-token"}
_RESOLVE = "/api/curriculum/jurisdictions/resolve"


# ── Framework registry ────────────────────────────────────────────────


def test_framework_registry_is_single_source():
    assert get_framework("NG").standards_code == "NG-NERDC"
    assert get_framework("AE").standards_code == "UAE-MOE"
    assert get_framework("GB").standards_code == "UK-NC"
    # Case-insensitive.
    assert get_framework("us").standards_code == "US-CCSS"
    # Unknown country → no framework.
    assert get_framework("ZZ") is None


# ── US path (unchanged behaviour) ─────────────────────────────────────


def test_resolve_us_by_zip():
    cat = get_catalogue()
    r = cat.resolve_jurisdiction(country="US", postal_code="55104")
    assert r.country == "US"
    assert r.district_id == "mn-stpaul-public-schools"
    assert r.framework_code == "US-CCSS"
    assert r.grade_band_scheme == "US-K12"


def test_resolve_us_by_district_id():
    cat = get_catalogue()
    r = cat.resolve_jurisdiction(country="US", district_id="wa-tacoma-public-schools")
    assert r.district_id == "wa-tacoma-public-schools"


def test_resolve_us_unmapped_zip_is_not_seeded():
    cat = get_catalogue()
    with pytest.raises(jurisdiction.JurisdictionNotSeededError):
        cat.resolve_jurisdiction(country="US", postal_code="00000")


def test_resolve_us_without_postal_or_district_is_malformed():
    cat = get_catalogue()
    with pytest.raises(jurisdiction.MalformedJurisdictionError):
        cat.resolve_jurisdiction(country="US")


def test_resolve_us_bad_zip_is_malformed():
    cat = get_catalogue()
    with pytest.raises(jurisdiction.MalformedJurisdictionError):
        cat.resolve_jurisdiction(country="US", postal_code="abc")


# ── International: resolves to its OWN framework, never US ─────────────


def test_resolve_ng_lagos_returns_nerdc_not_us():
    cat = get_catalogue()
    r = cat.resolve_jurisdiction(country="NG", region="Lagos")
    assert r.country == "NG"
    assert r.district_id == "ng-lagos-state"
    assert r.framework_code == "NG-NERDC"
    assert r.grade_band_scheme == "NG-BASIC"


def test_resolve_ae_emirates_return_uae_moe():
    cat = get_catalogue()
    for region, district in (("Dubai", "ae-dubai"), ("Abu Dhabi", "ae-abu-dhabi")):
        r = cat.resolve_jurisdiction(country="AE", region=region)
        assert r.district_id == district
        assert r.framework_code == "UAE-MOE"


def test_resolve_gb_country_only_returns_uk_nc():
    cat = get_catalogue()
    r = cat.resolve_jurisdiction(country="GB")
    assert r.district_id == "gb-england"
    assert r.framework_code == "UK-NC"


def test_resolve_known_but_unseeded_country_is_not_seeded_not_us():
    # AU has a registered framework (ACARA) but no seeded content yet.
    # It must raise NotSeeded — never fall back to US/CCSS.
    cat = get_catalogue()
    with pytest.raises(jurisdiction.JurisdictionNotSeededError) as exc:
        cat.resolve_jurisdiction(country="AU")
    assert "AU" in str(exc.value)


def test_resolve_unknown_country_is_unknown_not_us():
    cat = get_catalogue()
    with pytest.raises(jurisdiction.UnknownJurisdictionError):
        cat.resolve_jurisdiction(country="ZZ", region="Nowhere")


def test_resolve_missing_country_is_malformed():
    cat = get_catalogue()
    with pytest.raises(jurisdiction.MalformedJurisdictionError):
        cat.resolve_jurisdiction(country="")


def test_module_level_resolve_convenience():
    # jurisdiction.resolve() delegates to the process-wide catalogue.
    r = jurisdiction.resolve(country="US", postal_code="98405")
    assert r.district_id == "wa-tacoma-public-schools"
    with pytest.raises(jurisdiction.UnknownJurisdictionError):
        jurisdiction.resolve(country="ZZ")


# ── International happy path (with seeded data) ────────────────────────


def test_resolve_intl_with_seeded_data():
    # Mirrors what Sprint 3 will seed: an NG district + pack. Proves the
    # intl resolution path returns the right framework, not US.
    cat = load_catalogue_from_dict(
        {
            "schemaVersion": 2,
            "districts": [
                {
                    "id": "ng-lagos-state",
                    "name": "Lagos State",
                    "state": "",
                    "country": "NG",
                    "region": "Lagos",
                    "zipCodes": [],
                }
            ],
            "skills": [
                {
                    "id": "ng-nerdc.math.p3.num.1",
                    "subject": "math",
                    "gradeBand": "Primary-3",
                    "label": "Whole numbers to 999",
                    "summary": "",
                    "prerequisites": [],
                }
            ],
            "contentPacks": [
                {
                    "id": "ng-lagos-p3-math",
                    "subject": "math",
                    "gradeBand": "Primary-3",
                    "districtIds": ["ng-lagos-state"],
                    "skillIds": ["ng-nerdc.math.p3.num.1"],
                    "frameworkCode": "NG-NERDC",
                }
            ],
        }
    )
    r = cat.resolve_jurisdiction(country="NG", region="Lagos")
    assert r.country == "NG"
    assert r.district_id == "ng-lagos-state"
    assert r.framework_code == "NG-NERDC"
    assert r.grade_band_scheme == "NG-BASIC"


# ── HTTP route ────────────────────────────────────────────────────────


def test_route_resolve_us_zip():
    r = client.get(_RESOLVE, params={"country": "US", "postalCode": "55104"}, headers=DEV)
    assert r.status_code == 200
    body = r.json()
    assert body["districtId"] == "mn-stpaul-public-schools"
    assert body["frameworkCode"] == "US-CCSS"


def test_route_resolve_ng_lagos_200():
    r = client.get(_RESOLVE, params={"country": "NG", "region": "Lagos"}, headers=DEV)
    assert r.status_code == 200
    assert r.json()["frameworkCode"] == "NG-NERDC"


def test_route_resolve_known_but_unseeded_country_404():
    r = client.get(_RESOLVE, params={"country": "AU"}, headers=DEV)
    assert r.status_code == 404
    assert "AU" in r.json()["detail"]


def test_route_resolve_unknown_country_404():
    r = client.get(_RESOLVE, params={"country": "ZZ"}, headers=DEV)
    assert r.status_code == 404


def test_route_resolve_us_missing_location_400():
    r = client.get(_RESOLVE, params={"country": "US"}, headers=DEV)
    assert r.status_code == 400


def test_route_resolve_requires_auth():
    r = client.get(_RESOLVE, params={"country": "US", "postalCode": "55104"})
    assert r.status_code == 401


# ── Lookup route internationalization ─────────────────────────────────


def test_lookup_ng_returns_real_nerdc_not_us_content():
    r = client.get(
        "/api/curriculum/lookup",
        params={"country": "NG", "region": "Lagos", "subject": "math", "gradeBand": "Primary-3"},
        headers=DEV,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["id"] == "ng-lagos-state"
    skill_ids = [s["id"] for s in body["skills"]]
    assert "ng-nerdc.math.p3.number.whole-numbers" in skill_ids
    # Each skill cites its NERDC source.
    assert all(s["source"].startswith("NERDC") for s in body["skills"])
    # Never US content.
    assert "mn-stpaul" not in r.text and "wa-tacoma" not in r.text and "ccss" not in r.text


def test_lookup_known_but_unseeded_country_404():
    r = client.get(
        "/api/curriculum/lookup",
        params={"country": "AU", "subject": "math"},
        headers=DEV,
    )
    assert r.status_code == 404


def test_lookup_unknown_country_404():
    r = client.get(
        "/api/curriculum/lookup",
        params={"country": "ZZ", "subject": "math"},
        headers=DEV,
    )
    assert r.status_code == 404
