"""
Mutable catalogue store — the write target for the authoring/CMS path.

The bundled ``skill_graphs.json`` snapshot is a read-only, build-time
artifact. To let admins maintain the catalogue at scale (Sprint 4) the
service can instead read from a mutable store and accept create/update/
delete writes against it.

``CURRICULUM_PERSISTENCE`` selects the backend:

- ``snapshot`` (default) — read-only bundled snapshot; authoring disabled.
- ``memory``   — in-process mutable store seeded from the snapshot. Real
  and fully functional (used in dev and tests); state is per-process.
- ``postgres`` — durable store backed by the ``curriculum_*`` tables
  (Drizzle schema + migration 0047/0067). Requires ``CURRICULUM_DATABASE_URL``.

Both stores expose the same interface and build the same immutable
:class:`~curriculum_svc.catalogue.Catalogue` read model via
``load_catalogue_from_dict``, so the read path is identical regardless of
backend. Writes invalidate a cached read model; ``reload()`` rebuilds it
from the backing store.
"""
from __future__ import annotations

import copy
import os
import threading
from importlib import resources
from typing import Protocol

from curriculum_svc.catalogue import Catalogue, load_catalogue_from_dict


def persistence_mode() -> str:
    return (os.environ.get("CURRICULUM_PERSISTENCE", "snapshot").strip().lower()) or "snapshot"


def store_enabled() -> bool:
    """True when reads/writes go through a mutable store rather than the
    immutable bundled snapshot."""
    return persistence_mode() in {"memory", "postgres"}


def _bundled_raw() -> dict:
    import json

    pkg = resources.files("curriculum_svc.data")
    return json.loads((pkg / "skill_graphs.json").read_text(encoding="utf-8"))


# Entity kinds the authoring path can mutate.
ENTITY_KINDS = ("districts", "skills", "contentPacks")


class CatalogueStore(Protocol):
    """Common interface for catalogue backends."""

    def to_catalogue(self) -> Catalogue: ...

    def upsert(self, kind: str, record: dict) -> None: ...

    def delete(self, kind: str, record_id: str) -> bool: ...

    def reload(self) -> None: ...


class _BaseStore:
    """Shared raw-dict bookkeeping + cached read model. Subclasses provide
    how the raw dict is loaded and persisted."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._raw: dict = {"districts": [], "skills": [], "contentPacks": []}
        self._cache: Catalogue | None = None

    # -- read model --
    def to_catalogue(self) -> Catalogue:
        with self._lock:
            if self._cache is None:
                self._cache = load_catalogue_from_dict(copy.deepcopy(self._raw))
            return self._cache

    def _invalidate(self) -> None:
        self._cache = None

    @staticmethod
    def _id_of(kind: str, record: dict) -> str:
        rid = record.get("id")
        if not isinstance(rid, str) or not rid:
            raise ValueError(f"{kind} record requires a non-empty 'id'")
        return rid

    # -- mutations on the in-memory raw dict (subclasses persist + invalidate) --
    def _apply_upsert(self, kind: str, record: dict) -> None:
        items = self._raw[kind]
        rid = self._id_of(kind, record)
        for i, existing in enumerate(items):
            if existing.get("id") == rid:
                items[i] = record
                return
        items.append(record)

    def _apply_delete(self, kind: str, record_id: str) -> bool:
        items = self._raw[kind]
        for i, existing in enumerate(items):
            if existing.get("id") == record_id:
                del items[i]
                return True
        return False


class InMemoryCatalogueStore(_BaseStore):
    """A real, fully-functional in-process store seeded from the snapshot."""

    def __init__(self, seed: dict | None = None) -> None:
        super().__init__()
        raw = copy.deepcopy(seed if seed is not None else _bundled_raw())
        self._raw = {k: list(raw.get(k, [])) for k in ENTITY_KINDS}

    def upsert(self, kind: str, record: dict) -> None:
        if kind not in ENTITY_KINDS:
            raise ValueError(f"unknown entity kind: {kind}")
        with self._lock:
            self._apply_upsert(kind, record)
            self._invalidate()

    def delete(self, kind: str, record_id: str) -> bool:
        if kind not in ENTITY_KINDS:
            raise ValueError(f"unknown entity kind: {kind}")
        with self._lock:
            removed = self._apply_delete(kind, record_id)
            if removed:
                self._invalidate()
            return removed

    def reload(self) -> None:
        # The in-memory raw dict IS the source of truth — reload just rebuilds
        # the cached read model from current (authored) state. (Re-seeding from
        # the snapshot would discard writes; that is `reset_to_snapshot`.)
        with self._lock:
            self._invalidate()

    def reset_to_snapshot(self) -> None:
        with self._lock:
            raw = _bundled_raw()
            self._raw = {k: list(raw.get(k, [])) for k in ENTITY_KINDS}
            self._invalidate()


class PostgresCatalogueStore(_BaseStore):
    """Durable store backed by the ``curriculum_*`` tables. Writes go to
    Postgres; the read model is rebuilt from the DB on :meth:`reload` and
    after each write."""

    def __init__(self, dsn: str) -> None:
        super().__init__()
        import psycopg  # imported here so the module loads without psycopg

        self._psycopg = psycopg
        self._dsn = dsn
        self.reload()

    def _connect(self):
        return self._psycopg.connect(self._dsn)

    # -- load DB -> raw dict --
    def reload(self) -> None:
        with self._lock, self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, state, country, region, zip_codes "
                "FROM curriculum_jurisdictions"
            )
            districts = [
                {
                    "id": r[0],
                    "name": r[1],
                    "state": r[2] or "",
                    "country": r[3] or "US",
                    "region": r[4],
                    "zipCodes": list(r[5] or []),
                }
                for r in cur.fetchall()
            ]

            cur.execute(
                "SELECT id, subject, grade_band, label, summary, source FROM curriculum_skills"
            )
            skill_rows = cur.fetchall()
            cur.execute("SELECT skill_id, prereq_skill_id FROM curriculum_skill_prereqs")
            prereqs: dict[str, list[str]] = {}
            for skill_id, prereq_id in cur.fetchall():
                prereqs.setdefault(skill_id, []).append(prereq_id)
            skills = [
                {
                    "id": r[0],
                    "subject": r[1],
                    "gradeBand": r[2],
                    "label": r[3] or "",
                    "summary": r[4] or "",
                    "source": r[5] or "",
                    "prerequisites": sorted(prereqs.get(r[0], [])),
                }
                for r in skill_rows
            ]

            cur.execute(
                "SELECT id, title, subject, grade_band, framework_code, district_ids, skill_ids "
                "FROM curriculum_content_packs"
            )
            packs = [
                {
                    "id": r[0],
                    "title": r[1] or r[0],
                    "subject": r[2],
                    "gradeBand": r[3],
                    "frameworkCode": r[4] or "",
                    "districtIds": list(r[5] or []),
                    "skillIds": list(r[6] or []),
                }
                for r in cur.fetchall()
            ]

            self._raw = {"districts": districts, "skills": skills, "contentPacks": packs}
            self._invalidate()

    def upsert(self, kind: str, record: dict) -> None:
        if kind not in ENTITY_KINDS:
            raise ValueError(f"unknown entity kind: {kind}")
        with self._lock, self._connect() as conn, conn.cursor() as cur:
            if kind == "districts":
                self._upsert_district(cur, record)
            elif kind == "skills":
                self._upsert_skill(cur, record)
            else:
                self._upsert_pack(cur, record)
            conn.commit()
        self.reload()

    def delete(self, kind: str, record_id: str) -> bool:
        if kind not in ENTITY_KINDS:
            raise ValueError(f"unknown entity kind: {kind}")
        table = {
            "districts": "curriculum_jurisdictions",
            "skills": "curriculum_skills",
            "contentPacks": "curriculum_content_packs",
        }[kind]
        with self._lock, self._connect() as conn, conn.cursor() as cur:
            if kind == "skills":
                cur.execute(
                    "DELETE FROM curriculum_skill_prereqs WHERE skill_id = %s OR prereq_skill_id = %s",
                    (record_id, record_id),
                )
            cur.execute(f"DELETE FROM {table} WHERE id = %s", (record_id,))  # noqa: S608 (table from fixed map)
            removed = cur.rowcount > 0
            conn.commit()
        if removed:
            self.reload()
        return removed

    # -- per-entity SQL (psycopg adapts list -> array/jsonb) --
    @staticmethod
    def _upsert_district(cur, d: dict) -> None:
        from psycopg.types.json import Json

        cur.execute(
            "INSERT INTO curriculum_jurisdictions (id, name, state, country, region, zip_codes) "
            "VALUES (%s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state, "
            "country = EXCLUDED.country, region = EXCLUDED.region, zip_codes = EXCLUDED.zip_codes",
            (
                d["id"],
                d.get("name", d["id"]),
                d.get("state", ""),
                (d.get("country") or "US").upper(),
                d.get("region"),
                Json(list(d.get("zipCodes", []))),
            ),
        )

    @staticmethod
    def _upsert_skill(cur, s: dict) -> None:
        cur.execute(
            "INSERT INTO curriculum_skills (id, subject, grade_band, label, summary, source) "
            "VALUES (%s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, "
            "grade_band = EXCLUDED.grade_band, label = EXCLUDED.label, "
            "summary = EXCLUDED.summary, source = EXCLUDED.source",
            (
                s["id"],
                s["subject"],
                s["gradeBand"],
                s.get("label", ""),
                s.get("summary", ""),
                s.get("source", ""),
            ),
        )
        cur.execute("DELETE FROM curriculum_skill_prereqs WHERE skill_id = %s", (s["id"],))
        for prereq in s.get("prerequisites", []):
            cur.execute(
                "INSERT INTO curriculum_skill_prereqs (skill_id, prereq_skill_id) VALUES (%s, %s) "
                "ON CONFLICT DO NOTHING",
                (s["id"], prereq),
            )

    @staticmethod
    def _upsert_pack(cur, p: dict) -> None:
        from psycopg.types.json import Json

        cur.execute(
            "INSERT INTO curriculum_content_packs "
            "(id, title, subject, grade_band, framework_code, district_ids, skill_ids) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, subject = EXCLUDED.subject, "
            "grade_band = EXCLUDED.grade_band, framework_code = EXCLUDED.framework_code, "
            "district_ids = EXCLUDED.district_ids, skill_ids = EXCLUDED.skill_ids",
            (
                p["id"],
                p.get("title", p["id"]),
                p["subject"],
                p["gradeBand"],
                p.get("frameworkCode", ""),
                Json(list(p.get("districtIds", []))),
                Json(list(p.get("skillIds", []))),
            ),
        )


# ── Process-wide store singleton ──────────────────────────────────────

_store_lock = threading.Lock()
_store: CatalogueStore | None = None


def get_store() -> CatalogueStore:
    """Return the process-wide store for the configured persistence mode.

    Raises ``RuntimeError`` in ``snapshot`` mode (authoring disabled) and
    when ``postgres`` mode is selected without ``CURRICULUM_DATABASE_URL``.
    """
    global _store
    with _store_lock:
        if _store is not None:
            return _store
        mode = persistence_mode()
        if mode == "memory":
            _store = InMemoryCatalogueStore()
        elif mode == "postgres":
            dsn = os.environ.get("CURRICULUM_DATABASE_URL")
            if not dsn:
                raise RuntimeError(
                    "CURRICULUM_PERSISTENCE=postgres requires CURRICULUM_DATABASE_URL"
                )
            _store = PostgresCatalogueStore(dsn)
        else:
            raise RuntimeError(
                f"authoring is disabled in persistence mode '{mode}'; "
                "set CURRICULUM_PERSISTENCE=memory or postgres"
            )
        return _store


def reset_store_for_tests() -> None:
    """Drop the cached singleton so the next ``get_store`` re-reads env."""
    global _store
    with _store_lock:
        _store = None
