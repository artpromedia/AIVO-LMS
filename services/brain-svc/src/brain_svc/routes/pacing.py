"""Phase 2 — calendar-driven weekly pacing routes.

Generates a dated, week-by-week pacing plan for a learner from the AI
scope-&-sequence (curriculum_engine) laid onto a school calendar, persists it to
the shared Postgres pacing tables, and serves "this week's plan" so the tutor
can teach the right topics each week.
"""

import json
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from brain_svc.auth import AuthClaims, require_auth
from brain_svc.models.database import get_db
from brain_svc.services.access_control import safe_json_parse, verify_learner_access
from brain_svc.services.curriculum_engine import generate_scope_sequence
from brain_svc.services.next_grade import fetch_next_grade_units
from brain_svc.services.pacing_engine import (
    SCOPE_SOURCE_AI,
    SCOPE_SOURCE_UPLOADED_TERM,
    build_holiday_prep,
    build_pacing_weeks,
    build_summer_bridge,
    next_grade_band,
    normalize_uploaded_scope,
    validate_calendar_payload,
)

logger = logging.getLogger("brain-svc.pacing")

router = APIRouter()


class TermInput(BaseModel):
    term_number: int = Field(..., ge=1, le=12)
    title: str | None = None
    start_date: str
    end_date: str


class BreakInput(BaseModel):
    name: str | None = None
    kind: str = Field(default="break", max_length=16)
    start_date: str
    end_date: str


class CalendarInput(BaseModel):
    name: str | None = None
    academic_year: str | None = None
    timezone: str = Field(default="America/Chicago", max_length=64)
    terms: list[TermInput] = []
    breaks: list[BreakInput] = []


class GeneratePacingRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=64)
    term_count: int = Field(default=4, ge=1, le=8)
    plan_start: str  # ISO date (YYYY-MM-DD) — typically the first day of term 1
    calendar: CalendarInput | None = None
    # Scope source. Default is AI-generated scope-&-sequence; set to
    # "uploaded_term_syllabus" and provide term_scope_sequence (from
    # ai-svc /parse-term) to pace an uploaded whole-term syllabus instead.
    source: str = Field(default=SCOPE_SOURCE_AI, max_length=48)
    term_scope_sequence: dict | None = None


def _require_iso_date(value: str, field: str) -> str:
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"{field} must be an ISO date (YYYY-MM-DD)")


def _insert_calendar(db: Session, tenant_id, learner_id: str, calendar: CalendarInput):
    """Persist a calendar + its terms/breaks; returns the new calendar id.

    Calendars are append-only (the latest row is current) so a re-save never
    mutates a calendar an existing pacing plan points at.
    """
    problems = validate_calendar_payload(
        [t.model_dump() for t in calendar.terms],
        [b.model_dump() for b in calendar.breaks],
    )
    if problems:
        raise HTTPException(status_code=422, detail="; ".join(problems))

    cal_row = db.execute(
        text(
            """INSERT INTO school_calendars
                   (tenant_id, learner_id, name, academic_year, timezone)
               VALUES (:tid, :lid, :name, :ay, :tz)
               RETURNING id"""
        ),
        {
            "tid": tenant_id,
            "lid": learner_id,
            "name": calendar.name,
            "ay": calendar.academic_year,
            "tz": calendar.timezone,
        },
    ).first()
    calendar_id = cal_row[0]
    for term in calendar.terms:
        db.execute(
            text(
                """INSERT INTO school_calendar_terms
                       (calendar_id, term_number, title, start_date, end_date)
                   VALUES (:cid, :tn, :title, :sd, :ed)"""
            ),
            {
                "cid": calendar_id,
                "tn": term.term_number,
                "title": term.title,
                "sd": _require_iso_date(term.start_date, "term.start_date"),
                "ed": _require_iso_date(term.end_date, "term.end_date"),
            },
        )
    for br in calendar.breaks:
        db.execute(
            text(
                """INSERT INTO school_calendar_breaks
                       (calendar_id, kind, name, start_date, end_date)
                   VALUES (:cid, :kind, :name, :sd, :ed)"""
            ),
            {
                "cid": calendar_id,
                "kind": br.kind,
                "name": br.name,
                "sd": _require_iso_date(br.start_date, "break.start_date"),
                "ed": _require_iso_date(br.end_date, "break.end_date"),
            },
        )
    return calendar_id


def _iso(v) -> str | None:
    return v.isoformat() if hasattr(v, "isoformat") else v


def _load_latest_calendar(db: Session, learner_id: str) -> dict | None:
    """Load the learner's current (latest) calendar with terms + breaks."""
    cal = db.execute(
        text(
            """SELECT id, name, academic_year, timezone, created_at
               FROM school_calendars WHERE learner_id = :lid
               ORDER BY created_at DESC LIMIT 1"""
        ),
        {"lid": learner_id},
    ).mappings().first()
    if not cal:
        return None
    terms = db.execute(
        text(
            """SELECT term_number, title, start_date, end_date
               FROM school_calendar_terms WHERE calendar_id = :cid
               ORDER BY term_number ASC"""
        ),
        {"cid": cal["id"]},
    ).mappings().all()
    breaks = db.execute(
        text(
            """SELECT kind, name, start_date, end_date
               FROM school_calendar_breaks WHERE calendar_id = :cid
               ORDER BY start_date ASC"""
        ),
        {"cid": cal["id"]},
    ).mappings().all()
    return {
        "id": str(cal["id"]),
        "name": cal["name"],
        "academicYear": cal["academic_year"],
        "timezone": cal["timezone"],
        "terms": [
            {
                "termNumber": t["term_number"],
                "title": t["title"],
                "startDate": _iso(t["start_date"]),
                "endDate": _iso(t["end_date"]),
            }
            for t in terms
        ],
        "breaks": [
            {
                "kind": b["kind"],
                "name": b["name"],
                "startDate": _iso(b["start_date"]),
                "endDate": _iso(b["end_date"]),
            }
            for b in breaks
        ],
    }


@router.get("/{learner_id}/calendar")
async def get_school_calendar(
    learner_id: str,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    """Current school calendar (latest saved) for the learner, or null."""
    verify_learner_access(db, auth, learner_id)
    return {"learnerId": learner_id, "calendar": _load_latest_calendar(db, learner_id)}


@router.put("/{learner_id}/calendar")
async def put_school_calendar(
    learner_id: str,
    calendar: CalendarInput,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    """Save the learner's school calendar (terms + holiday/summer breaks).

    Wave B: the parent/teacher calendar surface writes through here; pacing
    generation then reuses the stored calendar when the request carries none,
    so automated pacing + holiday-prep activate without re-entering dates.
    """
    verify_learner_access(db, auth, learner_id)
    learner = db.execute(
        text("SELECT tenant_id FROM learners WHERE id = :lid"), {"lid": learner_id}
    ).mappings().first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    _insert_calendar(db, learner.get("tenant_id"), learner_id, calendar)
    db.commit()
    saved = _load_latest_calendar(db, learner_id)
    logger.info(
        "school calendar saved learner=%s terms=%d breaks=%d",
        learner_id,
        len(calendar.terms),
        len(calendar.breaks),
    )
    return {"learnerId": learner_id, "calendar": saved}


@router.post("/{learner_id}/pacing-plan/generate")
async def generate_pacing_plan(
    learner_id: str,
    request: GeneratePacingRequest,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    verify_learner_access(db, auth, learner_id)
    plan_start = _require_iso_date(request.plan_start, "plan_start")

    learner = db.execute(
        text(
            """SELECT tenant_id, curriculum_framework, curriculum_alignment,
                      grade_level, functioning_level
               FROM learners WHERE id = :lid"""
        ),
        {"lid": learner_id},
    ).mappings().first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    # Framework + grade are needed for persistence regardless of scope source.
    curriculum_alignment = safe_json_parse(learner.get("curriculum_alignment"))
    framework = learner.get("curriculum_framework") or curriculum_alignment.get(
        "framework", "Common Core State Standards"
    )
    grade_level = learner.get("grade_level") or "3"

    if request.source == SCOPE_SOURCE_UPLOADED_TERM:
        # Pace an uploaded whole-term syllabus (from ai-svc /parse-term) as
        # the authoritative scope — no AI guessing, no brain-state required.
        if request.term_scope_sequence is None:
            raise HTTPException(
                status_code=422,
                detail="term_scope_sequence is required when source=uploaded_term_syllabus",
            )
        try:
            scope = normalize_uploaded_scope(request.term_scope_sequence)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        scope_source = SCOPE_SOURCE_UPLOADED_TERM
    else:
        brain = db.execute(
            text(
                """SELECT mastery_levels, active_accommodations, functioning_level_profile
                   FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"""
            ),
            {"lid": learner_id},
        ).mappings().first()
        if not brain:
            raise HTTPException(status_code=404, detail="Brain state not found — clone brain first")

        mastery_levels = safe_json_parse(brain.get("mastery_levels"))
        accommodations = safe_json_parse(brain.get("active_accommodations"), [])
        flp = safe_json_parse(brain.get("functioning_level_profile"))
        functioning_level = flp.get("level", "STANDARD")

        try:
            scope = await generate_scope_sequence(
                framework=framework,
                subject=request.subject,
                grade_level=grade_level,
                mastery_levels=mastery_levels,
                functioning_level=functioning_level,
                accommodations=accommodations if isinstance(accommodations, list) else [],
                term_count=request.term_count,
            )
        except Exception as e:
            logger.error(f"Scope & sequence generation failed for {learner_id}: {e}")
            raise HTTPException(status_code=503, detail="Scope and sequence generation temporarily unavailable")

        if isinstance(scope, dict) and ("error" in scope or "parse_error" in scope):
            raise HTTPException(status_code=502, detail="Failed to generate scope and sequence from AI")
        scope_source = SCOPE_SOURCE_AI

    # Record scope provenance on the persisted scope-&-sequence.
    if isinstance(scope, dict):
        scope["source"] = scope_source

    tenant_id = learner.get("tenant_id")

    # Calendar resolution (Wave B): an inline calendar wins (and is persisted
    # as the new current calendar); otherwise the learner's STORED calendar —
    # saved via PUT /{learner_id}/calendar — drives the break-aware walk, so
    # a parent sets dates once and every later plan stays break-aware.
    calendar_id = None
    if request.calendar is not None:
        breaks = [b.model_dump() for b in request.calendar.breaks]
    else:
        stored = _load_latest_calendar(db, learner_id)
        if stored:
            calendar_id = stored["id"]
            breaks = [
                {
                    "kind": b["kind"],
                    "name": b["name"],
                    "start_date": b["startDate"],
                    "end_date": b["endDate"],
                }
                for b in stored["breaks"]
            ]
        else:
            breaks = []

    weeks = build_pacing_weeks(scope, breaks, plan_start)
    if not weeks:
        raise HTTPException(status_code=422, detail="Scope and sequence produced no instructional weeks")

    # Persist atomically: optional calendar, archive prior active plan, new plan + weeks.
    if request.calendar is not None:
        calendar_id = _insert_calendar(db, tenant_id, learner_id, request.calendar)

    db.execute(
        text(
            """UPDATE learner_pacing_plans SET status = 'archived', updated_at = NOW()
               WHERE learner_id = :lid AND subject = :subj AND status = 'active'"""
        ),
        {"lid": learner_id, "subj": request.subject},
    )

    plan_row = db.execute(
        text(
            """INSERT INTO learner_pacing_plans
                   (tenant_id, learner_id, calendar_id, subject, framework, grade_level,
                    status, plan_start, source_scope_sequence, pacing_rationale,
                    opt_in_summer_bridge)
               VALUES (:tid, :lid, :cid, :subj, :fw, :grade, 'active', :ps, :scope, :rationale,
                       :bridge)
               RETURNING id"""
        ),
        {
            "tid": tenant_id,
            "lid": learner_id,
            "cid": calendar_id,
            "subj": request.subject,
            "fw": framework,
            "grade": grade_level,
            "ps": plan_start,
            "scope": json.dumps(scope),
            "rationale": scope.get("pacing_rationale") if isinstance(scope, dict) else None,
            # Wave D (G6): new plans inherit the learner-level opt-in so a
            # parent's choice survives plan regeneration.
            "bridge": curriculum_alignment.get("summer_bridge_opt_in") is True,
        },
    ).first()
    plan_id = plan_row[0]

    for w in weeks:
        db.execute(
            text(
                """INSERT INTO learner_pacing_weeks
                       (pacing_plan_id, week_index, week_start, week_end, kind, term_number,
                        unit_title, topics, standards, objectives, vocabulary, status)
                   VALUES (:pid, :wi, :ws, :we, :kind, :tn, :unit,
                           :topics, :standards, :objectives, :vocab, 'planned')"""
            ),
            {
                "pid": plan_id,
                "wi": w["week_index"],
                "ws": w["week_start"],
                "we": w["week_end"],
                "kind": w["kind"],
                "tn": w["term_number"],
                "unit": w["unit_title"],
                "topics": json.dumps(w["topics"]),
                "standards": json.dumps(w["standards"]),
                "objectives": json.dumps(w["objectives"]),
                "vocab": json.dumps(w["vocabulary"]),
            },
        )
    db.commit()

    instruction_weeks = sum(1 for w in weeks if w["kind"] == "instruction")
    return {
        "learnerId": learner_id,
        "subject": request.subject,
        "planId": str(plan_id),
        "calendarId": str(calendar_id) if calendar_id else None,
        "planStart": plan_start,
        "weekCount": len(weeks),
        "instructionWeeks": instruction_weeks,
        "pacingRationale": scope.get("pacing_rationale") if isinstance(scope, dict) else None,
        "weeks": weeks,
    }


def _serialize_week(row) -> dict:
    return {
        "weekIndex": row["week_index"],
        "weekStart": row["week_start"].isoformat() if hasattr(row["week_start"], "isoformat") else row["week_start"],
        "weekEnd": row["week_end"].isoformat() if hasattr(row["week_end"], "isoformat") else row["week_end"],
        "kind": row["kind"],
        "termNumber": row["term_number"],
        "unitTitle": row["unit_title"],
        "topics": safe_json_parse(row["topics"], []),
        "standards": safe_json_parse(row["standards"], []),
        "objectives": safe_json_parse(row["objectives"], []),
        "vocabulary": safe_json_parse(row["vocabulary"], []),
        "status": row["status"],
    }


def _active_plan(db: Session, learner_id: str, subject: str):
    return db.execute(
        text(
            """SELECT id, plan_start, framework, grade_level, calendar_id,
                      opt_in_summer_bridge
               FROM learner_pacing_plans
               WHERE learner_id = :lid AND subject = :subj AND status = 'active'
               ORDER BY created_at DESC LIMIT 1"""
        ),
        {"lid": learner_id, "subj": subject},
    ).mappings().first()


def _break_kind_on(db: Session, calendar_id, on_date: str) -> str | None:
    """Kind of the calendar break containing ``on_date`` ('summer' wins
    when several overlap), or None when the calendar has no break there."""
    if not calendar_id:
        return None
    rows = db.execute(
        text(
            """SELECT kind FROM school_calendar_breaks
               WHERE calendar_id = :cid AND start_date <= :on AND end_date >= :on"""
        ),
        {"cid": calendar_id, "on": on_date},
    ).mappings().all()
    kinds = [r["kind"] for r in rows]
    if "summer" in kinds:
        return "summer"
    return kinds[0] if kinds else None


@router.get("/{learner_id}/pacing/current")
async def get_current_pacing_week(
    learner_id: str,
    subject: str,
    on: str | None = None,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    verify_learner_access(db, auth, learner_id)
    on_date = _require_iso_date(on, "on") if on else date.today().isoformat()

    plan = _active_plan(db, learner_id, subject)
    if not plan:
        return {"learnerId": learner_id, "subject": subject, "current": None, "next": None}

    current = db.execute(
        text(
            """SELECT * FROM learner_pacing_weeks
               WHERE pacing_plan_id = :pid AND week_start <= :on AND week_end >= :on
               ORDER BY week_index ASC LIMIT 1"""
        ),
        {"pid": plan["id"], "on": on_date},
    ).mappings().first()

    nxt = db.execute(
        text(
            """SELECT * FROM learner_pacing_weeks
               WHERE pacing_plan_id = :pid AND week_start > :on
               ORDER BY week_index ASC LIMIT 1"""
        ),
        {"pid": plan["id"], "on": on_date},
    ).mappings().first()

    # When the current week is a break, build a holiday-prep payload (review the
    # prior units + preview the next) so the learner stays ready for resumption.
    # Wave D (G6): during a SUMMER break, an opted-in learner instead gets a
    # summer-bridge payload — closing-grade review + the NEXT grade band's
    # opening units fetched from the authoritative catalogue. No units (8th
    # grade ceiling, unseeded jurisdiction, catalogue down) → holiday prep.
    holiday_prep = None
    summer_bridge = None
    if current and current["kind"] in ("break", "holiday_prep"):
        all_weeks = db.execute(
            text(
                """SELECT week_index, kind, unit_title, topics, standards, vocabulary
                   FROM learner_pacing_weeks
                   WHERE pacing_plan_id = :pid ORDER BY week_index ASC"""
            ),
            {"pid": plan["id"]},
        ).mappings().all()
        ordered = [
            {
                "week_index": w["week_index"],
                "kind": w["kind"],
                "unit_title": w["unit_title"],
                "topics": safe_json_parse(w["topics"], []),
                "standards": safe_json_parse(w["standards"], []),
                "vocabulary": safe_json_parse(w["vocabulary"], []),
            }
            for w in all_weeks
        ]
        holiday_prep = build_holiday_prep(ordered, current["week_index"])

        if plan.get("opt_in_summer_bridge") and _break_kind_on(
            db, plan.get("calendar_id"), on_date
        ) == "summer":
            target_band = next_grade_band(plan.get("grade_level"))
            if target_band:
                learner_row = db.execute(
                    text("SELECT zip_code FROM learners WHERE id = :lid"),
                    {"lid": learner_id},
                ).mappings().first()
                units = await fetch_next_grade_units(
                    subject,
                    target_band,
                    zip_code=(learner_row or {}).get("zip_code"),
                )
                summer_bridge = build_summer_bridge(
                    ordered, current["week_index"], units
                )

    return {
        "learnerId": learner_id,
        "subject": subject,
        "planId": str(plan["id"]),
        "on": on_date,
        "current": _serialize_week(current) if current else None,
        "next": _serialize_week(nxt) if nxt else None,
        "holidayPrep": holiday_prep,
        "summerBridge": summer_bridge,
    }


class SummerBridgeOptIn(BaseModel):
    optIn: bool


@router.get("/{learner_id}/pacing/summer-bridge")
async def get_summer_bridge_opt_in(
    learner_id: str,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    """Current summer-bridge opt-in state: true when any active plan (or
    the learner-level default on curriculum_alignment) has opted in."""
    verify_learner_access(db, auth, learner_id)
    plan_row = db.execute(
        text(
            """SELECT bool_or(opt_in_summer_bridge) AS opted
               FROM learner_pacing_plans
               WHERE learner_id = :lid AND status = 'active'"""
        ),
        {"lid": learner_id},
    ).mappings().first()
    learner = db.execute(
        text("SELECT curriculum_alignment FROM learners WHERE id = :lid"),
        {"lid": learner_id},
    ).mappings().first()
    alignment = safe_json_parse((learner or {}).get("curriculum_alignment"))
    opted = bool((plan_row or {}).get("opted")) or alignment.get("summer_bridge_opt_in") is True
    return {"learnerId": learner_id, "optIn": opted}


@router.patch("/{learner_id}/pacing/summer-bridge")
async def set_summer_bridge_opt_in(
    learner_id: str,
    body: SummerBridgeOptIn,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    """Parent opt-in/out of next-grade summer preparation (Wave D, G6).

    Applies to every ACTIVE pacing plan and is remembered as a
    learner-level default (curriculum_alignment.summer_bridge_opt_in) so
    plans generated later inherit it without re-asking.
    """
    verify_learner_access(db, auth, learner_id)
    result = db.execute(
        text(
            """UPDATE learner_pacing_plans
               SET opt_in_summer_bridge = :opt, updated_at = NOW()
               WHERE learner_id = :lid AND status = 'active'"""
        ),
        {"lid": learner_id, "opt": body.optIn},
    )
    db.execute(
        text(
            """UPDATE learners
               SET curriculum_alignment =
                     COALESCE(curriculum_alignment, '{}'::jsonb)
                     || jsonb_build_object('summer_bridge_opt_in', CAST(:opt AS boolean)),
                   updated_at = NOW()
               WHERE id = :lid"""
        ),
        {"lid": learner_id, "opt": body.optIn},
    )
    db.commit()
    logger.info(
        "summer-bridge opt-in set learner=%s optIn=%s plans=%s",
        learner_id,
        body.optIn,
        result.rowcount,
    )
    return {"learnerId": learner_id, "optIn": body.optIn, "plansUpdated": result.rowcount}


@router.get("/{learner_id}/pacing/plan")
async def get_pacing_plan(
    learner_id: str,
    subject: str,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    verify_learner_access(db, auth, learner_id)
    plan = _active_plan(db, learner_id, subject)
    if not plan:
        raise HTTPException(status_code=404, detail="No active pacing plan for this subject")

    weeks = db.execute(
        text(
            """SELECT * FROM learner_pacing_weeks
               WHERE pacing_plan_id = :pid ORDER BY week_index ASC"""
        ),
        {"pid": plan["id"]},
    ).mappings().all()

    return {
        "learnerId": learner_id,
        "subject": subject,
        "planId": str(plan["id"]),
        "planStart": plan["plan_start"].isoformat()
        if hasattr(plan["plan_start"], "isoformat")
        else plan["plan_start"],
        "framework": plan["framework"],
        "gradeLevel": plan["grade_level"],
        "weeks": [_serialize_week(w) for w in weeks],
    }
