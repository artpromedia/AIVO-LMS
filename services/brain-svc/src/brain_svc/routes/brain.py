import os
import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.database import get_db
from brain_svc.models.schemas import BrainCloneRequest, BrainRollbackRequest, BrainApproveRequest, BrainAmendRequest, BrainDeclineRequest
from brain_svc.services.clone_pipeline import clone_brain
from brain_svc.audit import emit_brain_audit
from brain_svc.auth import AuthClaims, require_auth

LEARNING_SVC_URL = os.environ.get("LEARNING_SVC_URL", "http://localhost:3005")
RECOMMENDATION_SVC_URL = os.environ.get(
    "RECOMMENDATION_SVC_URL", "http://localhost:3066"
)

router = APIRouter()


def _profile_recommendations_v2_enabled() -> bool:
    """Sprint 07 flag check."""
    raw = os.environ.get("AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2", "")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def _maybe_emit_regression_candidates(
    learner_id: str, regressions: list[dict]
) -> None:
    """Sprint 07 hook: push regression-check signals to recommendation-svc.

    Each regression entry becomes a `regression_check`-source signal that
    can trigger a `mastery_adjustment` recommendation when correlated
    with other evidence. Fire-and-forget.
    """
    if not _profile_recommendations_v2_enabled():
        return
    if not regressions:
        return
    import httpx

    signals = []
    for reg in regressions:
        delta = reg.get("delta") or reg.get("change") or 0
        signals.append(
            {
                "source": "regression_check",
                "metric": "mastery_signal",
                "value": float(abs(delta)),
                "summary": (
                    f"Regression in {reg.get('domain', 'domain')}: "
                    f"{reg.get('previous')} -> {reg.get('current')}"
                ),
            }
        )
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                f"{RECOMMENDATION_SVC_URL}/api/recommendations/candidates",
                json={
                    "learnerId": learner_id,
                    "signals": signals,
                    "currentProfile": {},
                },
            )
    except Exception:  # pragma: no cover — fire-and-forget
        return

def _snake_to_camel(name: str) -> str:
    components = name.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def _to_camel_case(data: dict) -> dict:
    result = {}
    for key, value in data.items():
        camel_key = _snake_to_camel(key)
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                pass
        result[camel_key] = value
    return result

@router.post("/clone")
async def clone_brain_endpoint(request: BrainCloneRequest, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, request.learner_id)

    completed_pa = db.execute(
        text("""SELECT id FROM parent_assessments WHERE learner_id = :lid
                AND completed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1"""),
        {"lid": request.learner_id}
    ).first()
    if not completed_pa:
        raise HTTPException(status_code=403, detail="Parent assessment must be completed before building a Brain")

    completed_baseline = db.execute(
        text("""SELECT id FROM assessment_attempts
                WHERE learner_id = :lid AND type = 'discovery_adventure' AND status = 'COMPLETED'
                ORDER BY created_at DESC LIMIT 1"""),
        {"lid": request.learner_id}
    ).first()
    if not completed_baseline:
        raise HTTPException(status_code=403, detail="Baseline assessment must be completed before building a Brain")

    if not request.tenant_id:
        learner = db.execute(
            text("SELECT tenant_id, functioning_level FROM learners WHERE id = :lid"),
            {"lid": request.learner_id}
        ).mappings().first()
        if not learner:
            raise HTTPException(status_code=404, detail="Learner not found")
        request.tenant_id = learner["tenant_id"]
        if not request.functioning_level or request.functioning_level == "STANDARD":
            request.functioning_level = learner.get("functioning_level") or "STANDARD"

    if not request.discovery_results:
        attempt = db.execute(
            text("""SELECT id, domain_scores, metadata FROM assessment_attempts
                    WHERE learner_id = :lid AND type = 'discovery_adventure' AND status = 'COMPLETED'
                    ORDER BY created_at DESC LIMIT 1"""),
            {"lid": request.learner_id}
        ).mappings().first()
        if attempt:
            request.assessment_id = attempt["id"]
            ds = attempt.get("domain_scores", {})
            if isinstance(ds, str):
                try: ds = json.loads(ds)
                except: ds = {}
            meta = attempt.get("metadata", {})
            if isinstance(meta, str):
                try: meta = json.loads(meta)
                except: meta = {}
            chapter_results = meta.get("chapterResults", [])
            from brain_svc.models.schemas import DiscoveryResults
            request.discovery_results = DiscoveryResults(
                chapterResults=chapter_results,
                totalCorrect=meta.get("totalCorrect", 0),
                totalAttempts=meta.get("totalAttempts", 0),
                xpEarned=meta.get("xpEarned", 0),
                responseLatencies=meta.get("responseLatencies", []),
            )

    if not request.parent_assessment_data:
        pa = db.execute(
            text("""SELECT * FROM parent_assessments WHERE learner_id = :lid
                    AND completed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1"""),
            {"lid": request.learner_id}
        ).mappings().first()
        if pa:
            request.parent_assessment_id = pa["id"]
            from brain_svc.models.schemas import ParentAssessmentData
            diagnoses = pa.get("diagnoses", [])
            if isinstance(diagnoses, str):
                try: diagnoses = json.loads(diagnoses)
                except: diagnoses = []
            responses = pa.get("responses", {})
            if isinstance(responses, str):
                try: responses = json.loads(responses)
                except: responses = {}
            request.parent_assessment_data = ParentAssessmentData(
                communicationMode=pa.get("communication_mode"),
                deviceInteraction=pa.get("device_interaction"),
                responseMethod=pa.get("response_method"),
                attentionSpan=pa.get("attention_span"),
                diagnoses=diagnoses,
                responses=responses,
            )

    result = clone_brain(db, request)

    await emit_brain_audit(
        event_type="BRAIN_CLONED",
        tenant_id=getattr(auth, "tenant_id", None),
        learner_id=request.learner_id,
        resource_id=str(result.get("id")) if isinstance(result, dict) else None,
        actor_user_id=getattr(auth, "user_id", None) or getattr(auth, "sub", None),
        actor_role=getattr(auth, "role", None),
        details={
            "version": (result.get("version") if isinstance(result, dict) else None),
        },
    )

    return result

@router.get("/{learner_id}")
async def get_brain_state(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    result = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    if not result:
        raise HTTPException(status_code=404, detail="Brain state not found")

    return _to_camel_case(dict(result))

def _verify_parent_access(db: Session, auth: AuthClaims, learner_id: str, allow_self_learner: bool = False):
    if auth.role in ("admin", "service", "PLATFORM_ADMIN"):
        return
    if auth.role == "PARENT":
        learner = db.execute(
            text("SELECT parent_id FROM learners WHERE id = :lid"),
            {"lid": learner_id}
        ).first()
        if not learner or str(learner[0]) != auth.sub:
            raise HTTPException(status_code=403, detail="Not authorized for this learner")
        return
    if allow_self_learner and auth.role == "LEARNER" and auth.sub == learner_id:
        return
    raise HTTPException(status_code=403, detail="Only parents can review brain clones")


@router.get("/{learner_id}/pre-clone-data")
async def get_pre_clone_data(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id)

    learner = db.execute(
        text("SELECT id, name, grade_level, functioning_level, communication_mode, diagnoses FROM learners WHERE id = :lid"),
        {"lid": learner_id}
    ).mappings().first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    parent_assessment = db.execute(
        text("""SELECT * FROM parent_assessments WHERE learner_id = :lid
                ORDER BY created_at DESC LIMIT 1"""),
        {"lid": learner_id}
    ).mappings().first()

    assessment_attempt = db.execute(
        text("""SELECT * FROM assessment_attempts
                WHERE learner_id = :lid AND type = 'discovery_adventure' AND status = 'COMPLETED'
                ORDER BY created_at DESC LIMIT 1"""),
        {"lid": learner_id}
    ).mappings().first()

    brain_exists = db.execute(
        text("SELECT id, approval_status FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    pa_data = None
    if parent_assessment:
        pa_dict = dict(parent_assessment)
        for field in ["responses", "diagnoses"]:
            val = pa_dict.get(field)
            if isinstance(val, str):
                try: pa_dict[field] = json.loads(val)
                except: pass
        pa_data = pa_dict

    aa_data = None
    if assessment_attempt:
        aa_dict = dict(assessment_attempt)
        for field in ["domain_scores", "metadata"]:
            val = aa_dict.get(field)
            if isinstance(val, str):
                try: aa_dict[field] = json.loads(val)
                except: pass
        aa_data = aa_dict

    l_dict = dict(learner)
    if isinstance(l_dict.get("diagnoses"), str):
        try: l_dict["diagnoses"] = json.loads(l_dict["diagnoses"])
        except: pass

    from brain_svc.services.clone_pipeline import SEED_TEMPLATES
    fl = l_dict.get("functioning_level", "STANDARD") or "STANDARD"
    template = SEED_TEMPLATES.get(fl, SEED_TEMPLATES["STANDARD"])

    return {
        "learner": l_dict,
        "parent_assessment": pa_data,
        "baseline_assessment": aa_data,
        "brain_exists": brain_exists is not None,
        "brain_status": dict(brain_exists).get("approval_status") if brain_exists else None,
        "template_preview": {
            "functioning_level": fl,
            "accommodations": template["active_accommodations"],
            "tutors": template["active_tutors"],
            "domains": list(template["mastery_levels"].keys()),
        },
    }


@router.get("/{learner_id}/review")
async def get_brain_review(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id)

    result = db.execute(
        text("""SELECT bs.*, l.name as learner_name, l.grade_level, l.functioning_level,
                       l.communication_mode, l.diagnoses
                FROM brain_states bs
                JOIN learners l ON l.id = bs.learner_id
                WHERE bs.learner_id = :lid
                ORDER BY bs.version DESC LIMIT 1"""),
        {"lid": learner_id}
    ).mappings().first()

    if not result:
        raise HTTPException(status_code=404, detail="Brain state not found")

    data = dict(result)
    for field in ["mastery_levels", "disability_signals", "functioning_level_profile",
                  "active_accommodations", "active_tutors", "xai_explanation",
                  "episodic_memory", "curriculum_alignment", "functional_curriculum",
                  "iep_profile", "sensory_profile", "visual_identity"]:
        val = data.get(field)
        if isinstance(val, str):
            try:
                data[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                pass

    if isinstance(data.get("diagnoses"), str):
        try:
            data["diagnoses"] = json.loads(data["diagnoses"])
        except:
            pass

    return data

@router.post("/{learner_id}/approve")
async def approve_brain(learner_id: str, request: BrainApproveRequest, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id)

    if not request.consent_given:
        raise HTTPException(status_code=400, detail="COPPA consent is required before approving the brain clone")

    # Sprint A4: Responsible-AI disclosures must be explicitly
    # acknowledged. The frontend gate (Sprint A4 frontend) disables
    # the Approve button until the parent expands the RAI panel and
    # checks the consent box; this is the server-side defense-in-depth
    # guard so a misbehaving client cannot bypass it.
    if not request.rai_acknowledged:
        raise HTTPException(
            status_code=400,
            detail="Responsible-AI disclosures must be acknowledged before approving the brain clone",
        )

    current = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()
    if not current:
        raise HTTPException(status_code=404, detail="Brain state not found")
    if current.get("approval_status") not in ("pending_parent_review", None):
        raise HTTPException(status_code=400, detail=f"Brain already {current.get('approval_status')}")

    now = datetime.utcnow()
    new_version = (current["version"] or 1) + 1

    mastery = current.get("mastery_levels", {})
    if isinstance(mastery, str):
        try: mastery = json.loads(mastery)
        except: mastery = {}

    accommodations = current.get("active_accommodations", [])
    if isinstance(accommodations, str):
        try: accommodations = json.loads(accommodations)
        except: accommodations = []

    tutors = current.get("active_tutors", [])
    if isinstance(tutors, str):
        try: tutors = json.loads(tutors)
        except: tutors = []

    xai = current.get("xai_explanation", {})
    if isinstance(xai, str):
        try: xai = json.loads(xai)
        except: xai = {}
    if not isinstance(xai, dict):
        xai = {}

    parent_mods_record = []
    if request.parent_modifications:
        for mod in request.parent_modifications:
            mod_entry = {
                "field": mod.field,
                "original_value": mod.original_value,
                "parent_value": mod.parent_value,
                "parent_note": mod.parent_note,
                "modified_at": mod.modified_at or now.isoformat(),
            }
            parent_mods_record.append(mod_entry)

            if mod.field.startswith("mastery_levels."):
                domain = mod.field.split(".", 1)[1]
                if domain in mastery and mod.parent_value is not None:
                    mastery[domain] = float(mod.parent_value)
            elif mod.field.startswith("accommodation."):
                acc_name = mod.field.split(".", 1)[1]
                if mod.parent_value is True and acc_name not in accommodations:
                    accommodations.append(acc_name)
                elif mod.parent_value is False and acc_name in accommodations:
                    accommodations.remove(acc_name)
            elif mod.field.startswith("tutor."):
                tutor_key = mod.field.split(".", 1)[1]
                if mod.parent_value is True and tutor_key not in tutors:
                    tutors.append(tutor_key)
                elif mod.parent_value is False and tutor_key in tutors:
                    tutors.remove(tutor_key)

        xai["parent_modifications"] = parent_mods_record

    consent_record = {
        "consent_given": True,
        "consent_version": request.consent_version,
        "consent_timestamp": now.isoformat(),
        "parent_id": auth.sub,
    }
    xai["coppa_consent"] = consent_record

    # Sprint A4: persist the RAI acknowledgement alongside the COPPA
    # consent. `rai_version` defaults to the brain-state version the
    # parent reviewed when the client doesn't pin it explicitly — that
    # way a later re-clone (which bumps `version`) means a stale
    # acknowledgement won't satisfy a future approval round.
    rai_acknowledgement = {
        "rai_acknowledged": True,
        "rai_version": request.rai_version or str(current.get("version") or 1),
        "rai_timestamp": now.isoformat(),
        "parent_id": auth.sub,
    }
    xai["rai_acknowledgement"] = rai_acknowledgement

    db.execute(
        text("""UPDATE brain_states
                SET approval_status = 'approved', parent_notes = :notes,
                    mastery_levels = :ml, active_accommodations = :aa,
                    active_tutors = :at, xai_explanation = :xai,
                    version = :v, updated_at = :now
                WHERE id = :id"""),
        {
            "notes": request.parent_notes,
            "ml": json.dumps(mastery),
            "aa": json.dumps(accommodations),
            "at": json.dumps(tutors),
            "xai": json.dumps(xai),
            "v": new_version,
            "now": now,
            "id": current["id"],
        }
    )

    snap_id = str(uuid.uuid4())
    snap_data = {}
    for field in ["disability_signals", "functioning_level_profile",
                  "iep_profile", "sensory_profile",
                  "functional_curriculum", "episodic_memory",
                  "visual_identity"]:
        val = current.get(field)
        if isinstance(val, str):
            try: val = json.loads(val)
            except: pass
        snap_data[field] = val
    snap_data["mastery_levels"] = mastery
    snap_data["active_accommodations"] = accommodations
    snap_data["active_tutors"] = tutors

    db.execute(
        text("""INSERT INTO brain_state_snapshots
                (id, brain_state_id, learner_id, version, trigger, snapshot, created_at)
                VALUES (:id, :bsid, :lid, :v, 'parent_approved', :snap, :now)"""),
        {"id": snap_id, "bsid": current["id"], "lid": learner_id, "v": new_version,
         "snap": json.dumps(snap_data), "now": now}
    )

    db.commit()

    try:
        import httpx
        fl = current.get("functioning_level_profile", {})
        if isinstance(fl, str):
            fl = json.loads(fl)
        internal_token = os.environ.get("INTERNAL_SERVICE_TOKEN") or (
            "" if os.environ.get("NODE_ENV") == "production" else "aivo-internal-dev-token"
        )
        headers = {
            "x-internal-service": "brain-svc",
            "x-service-token": internal_token,
        }
        for subject in list(mastery.keys()):
            httpx.post(
                f"{LEARNING_SVC_URL}/api/learning/path/{learner_id}/{subject}/init",
                json={"functioning_level": fl.get("level", "STANDARD")},
                headers=headers,
                timeout=5.0,
            )
    except Exception:
        pass

    return {
        "status": "approved",
        "version": new_version,
        "snapshot_id": snap_id,
        "consent": consent_record,
        "rai_acknowledgement": rai_acknowledgement,
    }

@router.post("/{learner_id}/amend")
async def amend_brain(learner_id: str, request: BrainAmendRequest, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id)

    current = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()
    if not current:
        raise HTTPException(status_code=404, detail="Brain state not found")
    if current.get("approval_status") not in ("pending_parent_review", None):
        raise HTTPException(status_code=400, detail=f"Brain already {current.get('approval_status')}")

    now = datetime.utcnow()
    new_version = (current["version"] or 1) + 1

    episodic = current.get("episodic_memory", [])
    if isinstance(episodic, str):
        try: episodic = json.loads(episodic)
        except: episodic = []
    if not isinstance(episodic, list):
        episodic = []

    episodic.append({
        "type": "parent_amendment",
        "timestamp": now.isoformat(),
        "notes": request.parent_notes,
        "context": request.context_additions or {},
    })

    xai = current.get("xai_explanation", {})
    if isinstance(xai, str):
        try: xai = json.loads(xai)
        except: xai = {}
    if not isinstance(xai, dict):
        xai = {}
    if "amendments" not in xai:
        xai["amendments"] = []
    xai["amendments"].append({
        "timestamp": now.isoformat(),
        "notes": request.parent_notes,
        "context": request.context_additions or {},
    })

    db.execute(
        text("""UPDATE brain_states
                SET approval_status = 'amended', parent_notes = :notes,
                    episodic_memory = :em, xai_explanation = :xai,
                    version = :v, updated_at = :now
                WHERE id = :id"""),
        {"notes": request.parent_notes, "em": json.dumps(episodic),
         "xai": json.dumps(xai), "v": new_version, "now": now, "id": current["id"]}
    )

    snap_data = {}
    for field in ["mastery_levels", "disability_signals", "functioning_level_profile",
                  "iep_profile", "sensory_profile", "active_accommodations",
                  "active_tutors", "functional_curriculum", "visual_identity"]:
        val = current.get(field)
        if isinstance(val, str):
            try: val = json.loads(val)
            except: pass
        snap_data[field] = val
    snap_data["episodic_memory"] = episodic

    snap_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO brain_state_snapshots
                (id, brain_state_id, learner_id, version, trigger, snapshot, created_at)
                VALUES (:id, :bsid, :lid, :v, 'parent_amended', :snap, :now)"""),
        {"id": snap_id, "bsid": current["id"], "lid": learner_id, "v": new_version,
         "snap": json.dumps(snap_data), "now": now}
    )

    db.commit()

    try:
        import httpx
        mastery = current.get("mastery_levels", {})
        if isinstance(mastery, str):
            mastery = json.loads(mastery)
        fl = current.get("functioning_level_profile", {})
        if isinstance(fl, str):
            fl = json.loads(fl)
        internal_token = os.environ.get("INTERNAL_SERVICE_TOKEN") or (
            "" if os.environ.get("NODE_ENV") == "production" else "aivo-internal-dev-token"
        )
        headers = {
            "x-internal-service": "brain-svc",
            "x-service-token": internal_token,
        }
        for subject in list(mastery.keys()):
            httpx.post(
                f"{LEARNING_SVC_URL}/api/learning/path/{learner_id}/{subject}/init",
                json={"functioning_level": fl.get("level", "STANDARD")},
                headers=headers,
                timeout=5.0,
            )
    except Exception:
        pass

    return {"status": "amended", "version": new_version, "snapshot_id": snap_id}

@router.post("/{learner_id}/decline")
async def decline_brain(learner_id: str, request: BrainDeclineRequest, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id)

    current = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()
    if not current:
        raise HTTPException(status_code=404, detail="Brain state not found")
    if current.get("approval_status") not in ("pending_parent_review", None):
        raise HTTPException(status_code=400, detail=f"Brain already {current.get('approval_status')}")

    db.execute(text("DELETE FROM brain_state_snapshots WHERE brain_state_id = :bsid"), {"bsid": current["id"]})
    db.execute(text("DELETE FROM brain_states WHERE id = :id"), {"id": current["id"]})

    db.execute(
        text("""DELETE FROM assessment_attempts
                WHERE learner_id = :lid AND type = 'discovery_adventure'"""),
        {"lid": learner_id}
    )

    db.commit()

    return {"status": "declined", "reason": request.reason, "message": "Brain clone removed. Learner can retake the baseline assessment."}

@router.get("/{learner_id}/history")
async def get_brain_history(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    results = db.execute(
        text("SELECT * FROM brain_state_snapshots WHERE learner_id = :lid ORDER BY version DESC"),
        {"lid": learner_id}
    ).mappings().all()
    return [dict(r) for r in results]

@router.post("/{learner_id}/rollback")
async def rollback_brain(learner_id: str, request: BrainRollbackRequest, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    snapshot = db.execute(
        text("SELECT * FROM brain_state_snapshots WHERE id = :sid AND learner_id = :lid"),
        {"sid": request.snapshot_id, "lid": learner_id}
    ).mappings().first()

    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    snapshot_data = snapshot["snapshot"]
    if isinstance(snapshot_data, str):
        snapshot_data = json.loads(snapshot_data)

    current = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    new_version = (current["version"] if current else 0) + 1

    db.execute(
        text("""UPDATE brain_states SET
            mastery_levels = :ml, disability_signals = :ds, functioning_level_profile = :flp,
            iep_profile = :ip, sensory_profile = :sp, active_accommodations = :aa,
            active_tutors = :at, version = :v, updated_at = :now
            WHERE learner_id = :lid AND id = :bsid"""),
        {
            "ml": json.dumps(snapshot_data.get("mastery_levels", {})),
            "ds": json.dumps(snapshot_data.get("disability_signals", {})),
            "flp": json.dumps(snapshot_data.get("functioning_level_profile", {})),
            "ip": json.dumps(snapshot_data.get("iep_profile", {})),
            "sp": json.dumps(snapshot_data.get("sensory_profile", {})),
            "aa": json.dumps(snapshot_data.get("active_accommodations", [])),
            "at": json.dumps(snapshot_data.get("active_tutors", [])),
            "v": new_version,
            "now": datetime.utcnow(),
            "lid": learner_id,
            "bsid": current["id"] if current else None,
        }
    )

    new_snap_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO brain_state_snapshots
            (id, brain_state_id, learner_id, version, trigger, snapshot, created_at)
            VALUES (:id, :bsid, :lid, :v, 'rebaseline', :snap, :now)"""),
        {
            "id": new_snap_id,
            "bsid": current["id"] if current else None,
            "lid": learner_id,
            "v": new_version,
            "snap": json.dumps(snapshot_data),
            "now": datetime.utcnow(),
        }
    )

    db.commit()
    return {"status": "rolled_back", "version": new_version, "snapshot_id": new_snap_id}

@router.get("/{learner_id}/context")
async def get_brain_context(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    brain = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain state not found")

    sensory = db.execute(
        text("SELECT * FROM sensory_profiles WHERE learner_id = :lid ORDER BY created_at DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    iep = db.execute(
        text("SELECT * FROM iep_profiles WHERE learner_id = :lid ORDER BY created_at DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    iep_goals = db.execute(
        text("SELECT * FROM iep_goals WHERE learner_id = :lid AND status = 'active'"),
        {"lid": learner_id}
    ).mappings().all()

    functioning = db.execute(
        text("SELECT * FROM learner_functioning_levels WHERE learner_id = :lid ORDER BY created_at DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    milestones = db.execute(
        text("SELECT * FROM functional_milestones WHERE learner_id = :lid"),
        {"lid": learner_id}
    ).mappings().all()

    learner = db.execute(
        text("SELECT name, grade_level, communication_mode, diagnoses, curriculum_framework FROM learners WHERE id = :lid"),
        {"lid": learner_id}
    ).mappings().first()

    lang_profile = db.execute(
        text("SELECT * FROM language_profiles WHERE learner_id = :lid ORDER BY created_at DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    brain_dict = dict(brain)
    return {
        "learner": dict(learner) if learner else {},
        "brainState": brain_dict,
        "sensoryProfile": dict(sensory) if sensory else None,
        "iepProfile": dict(iep) if iep else None,
        "iepGoals": [dict(g) for g in iep_goals],
        "functioningLevel": dict(functioning) if functioning else None,
        "functionalMilestones": [dict(m) for m in milestones],
        "languageProfile": dict(lang_profile) if lang_profile else None,
        "activeTutors": brain_dict.get("active_tutors", []),
        "activeAccommodations": brain_dict.get("active_accommodations", []),
        "masteryLevels": brain_dict.get("mastery_levels", {}),
        "episodicMemory": brain_dict.get("episodic_memory", []),
    }


@router.post("/{learner_id}/regression-check")
async def check_regression(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    brain = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain state not found")

    mastery = brain.get("mastery_levels", {})
    if isinstance(mastery, str):
        mastery = json.loads(mastery)

    snapshots = db.execute(
        text("""SELECT snapshot FROM brain_state_snapshots
                WHERE learner_id = :lid
                ORDER BY created_at DESC LIMIT 5"""),
        {"lid": learner_id}
    ).mappings().all()

    regressions = []
    if snapshots:
        prev_snap = snapshots[0]["snapshot"]
        if isinstance(prev_snap, str):
            prev_snap = json.loads(prev_snap)
        prev_mastery = prev_snap.get("mastery_levels", {})

        for domain, current_val in mastery.items():
            if isinstance(current_val, dict):
                current_score = current_val.get("score", 0)
            else:
                current_score = float(current_val) if current_val else 0

            prev_val = prev_mastery.get(domain)
            if prev_val is None:
                continue
            if isinstance(prev_val, dict):
                prev_score = prev_val.get("score", 0)
            else:
                prev_score = float(prev_val) if prev_val else 0

            if prev_score > 0 and (prev_score - current_score) / prev_score >= 0.15:
                drop = prev_score - current_score

                events = db.execute(
                    text("""SELECT * FROM parent_reported_events
                            WHERE learner_id = :lid
                            ORDER BY occurred_at DESC LIMIT 5"""),
                    {"lid": learner_id}
                ).mappings().all()

                factors = []
                for ev in events:
                    factors.append({
                        "type": "parent_reported_event",
                        "eventType": ev["event_type"],
                        "description": ev.get("description"),
                        "occurredAt": ev["occurred_at"].isoformat() if ev.get("occurred_at") else None,
                    })

                analysis_id = str(uuid.uuid4())
                hypothesis = f"Mastery in {domain} dropped by {drop:.1%} (from {prev_score:.2f} to {current_score:.2f})."
                if factors:
                    hypothesis += f" {len(factors)} recent parent-reported event(s) may be correlated."

                db.execute(
                    text("""INSERT INTO causal_analyses
                        (id, learner_id, domain, mastery_drop, previous_mastery, current_mastery,
                         correlated_factors, hypothesis, confidence, status, created_at)
                        VALUES (:id, :lid, :domain, :drop, :prev, :curr, :factors, :hyp, :conf, 'DETECTED', :now)"""),
                    {
                        "id": analysis_id,
                        "lid": learner_id,
                        "domain": domain,
                        "drop": drop,
                        "prev": prev_score,
                        "curr": current_score,
                        "factors": json.dumps(factors),
                        "hyp": hypothesis,
                        "conf": 0.6 if factors else 0.3,
                        "now": datetime.utcnow(),
                    }
                )

                regressions.append({
                    "domain": domain,
                    "drop": round(drop, 4),
                    "previousMastery": round(prev_score, 4),
                    "currentMastery": round(current_score, 4),
                    "correlatedFactors": factors,
                    "hypothesis": hypothesis,
                    "analysisId": analysis_id,
                })

    if regressions:
        db.commit()
        # Sprint 07: fire-and-forget recommendation candidate emission.
        await _maybe_emit_regression_candidates(learner_id, regressions)

    return {
        "learnerId": learner_id,
        "regressionsDetected": len(regressions),
        "regressions": regressions,
    }


@router.post("/{learner_id}/engagement")
async def update_engagement_profile(learner_id: str, request: dict = None, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    import json as json_mod

    if auth.sub != learner_id and auth.role not in ("admin", "teacher", "service"):
        raise HTTPException(status_code=403, detail="Not authorized to update engagement for this learner")

    current = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    if not current:
        return {"status": "no_brain_state", "learner_id": learner_id}

    engagement_data = {}
    if request and isinstance(request, dict):
        engagement_data = request.get("engagement", {})

    episodic = current.get("episodic_memory", [])
    if isinstance(episodic, str):
        episodic = json_mod.loads(episodic)
    if not isinstance(episodic, list):
        episodic = []

    episodic.append({
        "type": "engagement_sync",
        "timestamp": datetime.utcnow().isoformat(),
        "totalXp": engagement_data.get("totalXp"),
        "level": engagement_data.get("level"),
        "eventType": engagement_data.get("eventType"),
        "newBadges": engagement_data.get("newBadges", []),
    })

    if len(episodic) > 100:
        episodic = episodic[-100:]

    db.execute(
        text("UPDATE brain_states SET episodic_memory = :em, updated_at = :now WHERE id = :id"),
        {
            "em": json_mod.dumps(episodic),
            "now": datetime.utcnow(),
            "id": current["id"],
        }
    )
    db.commit()

    return {"status": "engagement_synced", "learner_id": learner_id}


@router.get("/{learner_id}/next-action")
async def get_next_action(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id, allow_self_learner=True)

    brain = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    tutors_catalog = {
        "nova": {"name": "Nova", "domain": "Mathematics", "icon": "🔢", "color": "#7C3AED"},
        "sage": {"name": "Sage", "domain": "English Language Arts", "icon": "📚", "color": "#10B981"},
        "spark": {"name": "Spark", "domain": "Science", "icon": "🔬", "color": "#F59E0B"},
        "chrono": {"name": "Chrono", "domain": "History & Social Studies", "icon": "🏛️", "color": "#6366F1"},
        "pixel": {"name": "Pixel", "domain": "Coding", "icon": "💻", "color": "#06B6D4"},
        "echo": {"name": "Echo", "domain": "Speech & Language", "icon": "🗣️", "color": "#EC4899"},
        "harmony": {"name": "Harmony", "domain": "Social-Emotional Learning", "icon": "💜", "color": "#8B5CF6"},
        "atlas": {"name": "Atlas", "domain": "Geography", "icon": "🌍", "color": "#14B8A6"},
        "cadence": {"name": "Cadence", "domain": "Music & Rhythm", "icon": "🎵", "color": "#D946EF"},
        "vigor": {"name": "Vigor", "domain": "Physical Education", "icon": "🏃", "color": "#22C55E"},
        "lingua": {"name": "Lingua", "domain": "World Languages", "icon": "🌐", "color": "#0EA5E9"},
        "forge": {"name": "Forge", "domain": "STEM & Engineering", "icon": "⚙️", "color": "#EF4444"},
        "compass": {"name": "Compass", "domain": "Life Skills", "icon": "🧭", "color": "#F97316"},
        "muse": {"name": "Muse", "domain": "Creative Arts", "icon": "🎨", "color": "#A855F7"},
    }

    domain_to_tutor = {
        "math": "nova", "mathematics": "nova",
        "ela": "sage", "english": "sage", "reading": "sage",
        "science": "spark",
        "history": "chrono", "social_studies": "chrono",
        "coding": "pixel", "executive_function": "pixel", "programming": "pixel",
        "speech": "echo", "language": "echo",
        "sel": "harmony", "social_emotional": "harmony",
        "geography": "atlas",
        "music": "cadence",
        "pe": "vigor", "physical_education": "vigor",
        "languages": "lingua", "world_languages": "lingua",
        "stem": "forge", "engineering": "forge",
        "life_skills": "compass",
        "creative_arts": "muse", "art": "muse",
    }

    if not brain:
        default_tutor = "nova"
        info = tutors_catalog[default_tutor]
        return {
            "type": "lesson",
            "tutorKey": default_tutor,
            "tutorName": info["name"],
            "tutorColor": info["color"],
            "tutorIcon": info["icon"],
            "title": f"Start learning with {info['name']}",
            "subtitle": info["domain"],
        }

    mastery = brain.get("mastery_scores") or brain.get("mastery_levels")
    if isinstance(mastery, str):
        try:
            mastery = json.loads(mastery)
        except (json.JSONDecodeError, TypeError):
            mastery = {}

    if not mastery or not isinstance(mastery, dict):
        mastery = {}

    weakest_tutor = None
    lowest_score = 999
    for domain_key, score_data in mastery.items():
        score = score_data if isinstance(score_data, (int, float)) else (score_data.get("score", 50) if isinstance(score_data, dict) else 50)
        tutor_key = domain_to_tutor.get(domain_key.lower(), domain_key)
        if tutor_key in tutors_catalog and score < lowest_score:
            lowest_score = score
            weakest_tutor = tutor_key

    if not weakest_tutor:
        weakest_tutor = "nova"

    info = tutors_catalog[weakest_tutor]
    return {
        "type": "lesson",
        "tutorKey": weakest_tutor,
        "tutorName": info["name"],
        "tutorColor": info["color"],
        "tutorIcon": info["icon"],
        "title": f"Continue with {info['name']} → {info['domain']}",
        "subtitle": f"Practice {info['domain'].lower()}",
    }


FL_CSS_PROFILES = {
    "STANDARD": {
        "--learner-base-font": "16px",
        "--learner-hit-target": "48px",
        "--learner-motion-ms": "300",
        "--learner-saturation": "1",
        "--learner-max-concurrent-anim": "10",
        "--learner-max-choices": "4",
        "--learner-text-weight": "normal",
    },
    "SUPPORTED": {
        "--learner-base-font": "18px",
        "--learner-hit-target": "56px",
        "--learner-motion-ms": "200",
        "--learner-saturation": "0.85",
        "--learner-max-concurrent-anim": "3",
        "--learner-max-choices": "3",
        "--learner-text-weight": "normal",
    },
    "LOW_VERBAL": {
        "--learner-base-font": "20px",
        "--learner-hit-target": "64px",
        "--learner-motion-ms": "150",
        "--learner-saturation": "0.7",
        "--learner-max-concurrent-anim": "0",
        "--learner-max-choices": "2",
        "--learner-text-weight": "bold",
    },
    "NON_VERBAL": {
        "--learner-base-font": "24px",
        "--learner-hit-target": "72px",
        "--learner-motion-ms": "100",
        "--learner-saturation": "0.6",
        "--learner-max-concurrent-anim": "0",
        "--learner-max-choices": "2",
        "--learner-text-weight": "bold",
    },
    "PRE_SYMBOLIC": {
        "--learner-base-font": "28px",
        "--learner-hit-target": "80px",
        "--learner-motion-ms": "0",
        "--learner-saturation": "0.5",
        "--learner-max-concurrent-anim": "0",
        "--learner-max-choices": "2",
        "--learner-text-weight": "bold",
    },
}


@router.get("/{learner_id}/sensory-css-vars")
async def get_sensory_css_vars(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    _verify_parent_access(db, auth, learner_id)

    brain = db.execute(
        text("SELECT functioning_level_profile, sensory_profile FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    fl = "STANDARD"
    if brain:
        fl_profile = brain.get("functioning_level_profile")
        raw_fl = brain.get("functioning_level")
        if isinstance(fl_profile, str):
            try:
                fl_data = json.loads(fl_profile)
                if isinstance(fl_data, dict) and fl_data.get("level"):
                    fl = str(fl_data["level"]).upper().replace(" ", "_")
            except (json.JSONDecodeError, TypeError):
                pass
        if fl == "STANDARD" and raw_fl and isinstance(raw_fl, str):
            fl = raw_fl.upper().replace(" ", "_")

    css_vars = dict(FL_CSS_PROFILES.get(fl, FL_CSS_PROFILES["STANDARD"]))

    if brain:
        profile = brain.get("sensory_profile")
        if isinstance(profile, str):
            try:
                profile = json.loads(profile)
            except (json.JSONDecodeError, TypeError):
                profile = None
        if isinstance(profile, dict):
            if profile.get("reducedMotion"):
                css_vars["--learner-motion-ms"] = "0"
                css_vars["--learner-max-concurrent-anim"] = "0"
            if profile.get("highContrast"):
                css_vars["--learner-saturation"] = "1.2"
            if profile.get("largerText"):
                current_size = int(css_vars["--learner-base-font"].replace("px", ""))
                css_vars["--learner-base-font"] = f"{current_size + 4}px"

    return {
        "functioningLevel": fl,
        "cssVars": css_vars,
    }
