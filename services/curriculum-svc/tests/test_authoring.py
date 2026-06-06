"""Authoring / CMS write-path tests (Sprint 4).

Exercises create/update/delete + reload, RBAC rejection, and schema/
referential validation against the in-process mutable store. A gated
integration test additionally runs the Postgres-backed store against a
real database when ``CURRICULUM_DATABASE_URL`` is set (CI / local PG).

Run with:
    CURRICULUM_PERSISTENCE=memory PYTHONPATH=services/curriculum-svc/src \
        pytest services/curriculum-svc/tests/test_authoring.py -v
"""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from curriculum_svc import store
from curriculum_svc.main import app

client = TestClient(app)
SERVICE = {"X-Service-Token": "aivo-internal-dev-token"}


@pytest.fixture(autouse=True)
def memory_store(monkeypatch):
    """Run each authoring test against a fresh in-memory store."""
    monkeypatch.setenv("CURRICULUM_PERSISTENCE", "memory")
    store.reset_store_for_tests()
    yield
    store.reset_store_for_tests()


# ── Happy path: create jurisdiction + skills + pack, serve after reload ──


def test_admin_can_create_jurisdiction_and_serve_after_reload():
    # New Kenyan jurisdiction (KE has a framework registered, no seed data).
    d = client.post(
        "/api/curriculum/admin/districts",
        headers=SERVICE,
        json={"id": "ke-nairobi", "name": "Nairobi County", "country": "KE", "region": "Nairobi"},
    )
    assert d.status_code == 201

    s = client.post(
        "/api/curriculum/admin/skills",
        headers=SERVICE,
        json={
            "id": "ke-cbc.math.g3.numbers",
            "subject": "math",
            "gradeBand": "Grade-3",
            "label": "Numbers to 1000",
            "source": "KICD CBC Grade 3 Mathematics",
        },
    )
    assert s.status_code == 201

    p = client.post(
        "/api/curriculum/admin/packs",
        headers=SERVICE,
        json={
            "id": "ke-nairobi-g3-math",
            "title": "Nairobi Grade 3 Mathematics",
            "subject": "math",
            "gradeBand": "Grade-3",
            "frameworkCode": "KE-CBC",
            "districtIds": ["ke-nairobi"],
            "skillIds": ["ke-cbc.math.g3.numbers"],
        },
    )
    assert p.status_code == 201

    rel = client.post("/api/curriculum/admin/reload", headers=SERVICE)
    assert rel.status_code == 200

    # The new jurisdiction is now served by the lookup path.
    r = client.get(
        "/api/curriculum/lookup",
        headers=SERVICE,
        params={"country": "KE", "region": "Nairobi", "subject": "math", "gradeBand": "Grade-3"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["id"] == "ke-nairobi"
    assert [s["id"] for s in body["skills"]] == ["ke-cbc.math.g3.numbers"]


def test_update_then_delete_skill():
    client.post(
        "/api/curriculum/admin/skills",
        headers=SERVICE,
        json={"id": "x.skill.1", "subject": "math", "gradeBand": "K", "label": "v1"},
    )
    # Update via PUT.
    u = client.put(
        "/api/curriculum/admin/skills/x.skill.1",
        headers=SERVICE,
        json={"id": "x.skill.1", "subject": "math", "gradeBand": "K", "label": "v2"},
    )
    assert u.status_code == 200
    # Delete.
    d = client.delete("/api/curriculum/admin/skills/x.skill.1", headers=SERVICE)
    assert d.status_code == 200
    # Deleting again 404s.
    assert client.delete("/api/curriculum/admin/skills/x.skill.1", headers=SERVICE).status_code == 404


# ── RBAC ──────────────────────────────────────────────────────────────


def test_unauthenticated_write_rejected():
    r = client.post("/api/curriculum/admin/districts", json={"id": "x", "name": "X"})
    assert r.status_code == 401


def test_non_admin_user_forbidden(jwt_public_key_env, sign_token):
    token = sign_token({"role": "parent"})
    r = client.post(
        "/api/curriculum/admin/districts",
        headers={"Authorization": f"Bearer {token}"},
        json={"id": "x", "name": "X"},
    )
    assert r.status_code == 403


def test_admin_role_user_allowed(jwt_public_key_env, sign_token):
    token = sign_token({"role": "district_admin"})
    r = client.post(
        "/api/curriculum/admin/districts",
        headers={"Authorization": f"Bearer {token}"},
        json={"id": "admin-made", "name": "Admin Made"},
    )
    assert r.status_code == 201


# ── Validation ────────────────────────────────────────────────────────


def test_missing_required_field_422():
    # No name on district.
    r = client.post("/api/curriculum/admin/districts", headers=SERVICE, json={"id": "x"})
    assert r.status_code == 422


def test_pack_with_unknown_references_422():
    r = client.post(
        "/api/curriculum/admin/packs",
        headers=SERVICE,
        json={
            "id": "bad-pack",
            "title": "Bad",
            "subject": "math",
            "gradeBand": "K",
            "districtIds": ["does-not-exist"],
            "skillIds": ["nope.1"],
        },
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    fields = {e["field"] for e in detail}
    assert "skillIds" in fields and "districtIds" in fields


def test_path_body_id_mismatch_422():
    r = client.put(
        "/api/curriculum/admin/skills/a",
        headers=SERVICE,
        json={"id": "b", "subject": "math", "gradeBand": "K"},
    )
    assert r.status_code == 422


# ── snapshot mode disables authoring ──────────────────────────────────


def test_authoring_disabled_in_snapshot_mode(monkeypatch):
    monkeypatch.setenv("CURRICULUM_PERSISTENCE", "snapshot")
    store.reset_store_for_tests()
    r = client.post(
        "/api/curriculum/admin/districts",
        headers=SERVICE,
        json={"id": "x", "name": "X"},
    )
    assert r.status_code == 503


# ── Postgres-backed store (real DB, gated on CURRICULUM_DATABASE_URL) ──


@pytest.mark.skipif(
    not os.environ.get("CURRICULUM_DATABASE_URL"),
    reason="CURRICULUM_DATABASE_URL not set — Postgres integration test skipped",
)
def test_postgres_store_roundtrip():
    dsn = os.environ["CURRICULUM_DATABASE_URL"]
    pg = store.PostgresCatalogueStore(dsn)
    pg.upsert("districts", {"id": "pg-d1", "name": "PG District", "country": "KE", "region": "Coast"})
    pg.upsert(
        "skills",
        {"id": "pg.s1", "subject": "math", "gradeBand": "Grade-1", "label": "L", "prerequisites": []},
    )
    pg.upsert(
        "contentPacks",
        {
            "id": "pg.pack1",
            "title": "PG Pack",
            "subject": "math",
            "gradeBand": "Grade-1",
            "frameworkCode": "KE-CBC",
            "districtIds": ["pg-d1"],
            "skillIds": ["pg.s1"],
        },
    )
    # reload re-reads from the DB and the data survives.
    pg.reload()
    cat = pg.to_catalogue()
    assert cat.get_district("pg-d1") is not None
    assert cat.get_skill("pg.s1") is not None
    resolved = cat.resolve_jurisdiction(country="KE", region="Coast")
    assert resolved.district_id == "pg-d1"
    # Cleanup so reruns are idempotent.
    assert pg.delete("contentPacks", "pg.pack1")
    assert pg.delete("skills", "pg.s1")
    assert pg.delete("districts", "pg-d1")
