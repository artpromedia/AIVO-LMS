import os
import uuid
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.schemas import BrainCloneRequest

LEARNING_SVC_URL = os.environ.get("LEARNING_SVC_URL", "http://localhost:3005")


def _utcnow() -> datetime:
    """Naive UTC now — drop-in for the deprecated ``datetime.utcnow()``."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


SEED_TEMPLATES = {
    "STANDARD": {
        "mastery_levels": {"math": 0.0, "ela": 0.0, "science": 0.0, "history": 0.0, "coding": 0.0},
        "active_accommodations": [],
        "active_tutors": ["nova", "sage", "spark", "chrono", "pixel", "echo", "harmony"],
        "functional_curriculum": {},
    },
    "SUPPORTED": {
        "mastery_levels": {"math": 0.0, "ela": 0.0, "science": 0.0, "history": 0.0},
        "active_accommodations": ["extended_time", "text_to_speech", "simplified_language"],
        "active_tutors": ["nova", "sage", "spark", "echo", "harmony"],
        "functional_curriculum": {},
    },
    "LOW_VERBAL": {
        "mastery_levels": {"math": 0.0, "ela": 0.0, "science": 0.0},
        "active_accommodations": ["picture_supports", "reduced_text", "visual_schedules", "choice_boards"],
        "active_tutors": ["nova", "sage", "echo", "harmony"],
        "functional_curriculum": {"focus": "academic_modified"},
    },
    "NON_VERBAL": {
        "mastery_levels": {"communication": 0.0, "daily_living": 0.0, "social": 0.0},
        "active_accommodations": ["switch_scanning", "aac_integration", "visual_supports", "partner_assisted"],
        "active_tutors": ["echo", "harmony", "compass"],
        "functional_curriculum": {"focus": "functional_academic"},
    },
    "PRE_SYMBOLIC": {
        "mastery_levels": {"cause_effect": 0.0, "sensory_engagement": 0.0, "social_awareness": 0.0},
        "active_accommodations": ["cause_effect_activities", "sensory_stimulation", "partner_assisted_scanning", "microswitches"],
        "active_tutors": ["echo", "harmony"],
        "functional_curriculum": {"focus": "developmental"},
    },
}

DOMAIN_TO_MASTERY = {
    "ela": "ela",
    "math": "math",
    "science": "science",
    "sel": "social",
    "speech": "communication",
    "executive_function": "coding",
}

VALID_FUNCTIONING_LEVELS = {
    "STANDARD",
    "SUPPORTED",
    "LOW_VERBAL",
    "NON_VERBAL",
    "PRE_SYMBOLIC",
}


def derive_functioning_level(parent_data, requested_level):
    """Resolve the functioning level used to seed the brain.

    The level is normally determined by assessment-svc when the parent
    assessment is submitted (services/assessment-svc level-router.ts) and
    persisted on ``learners.functioning_level`` — and an explicit non-STANDARD
    value is always trusted here. But the clone can run while that column is
    still the ``STANDARD`` default (e.g. the parent assessment was recorded
    through a path that never ran the router). In that case we back-stop by
    deriving the level from the parent assessment signals using the SAME rules
    as level-router.ts, so a learner with clear support needs never silently
    gets a STANDARD brain.

    Returns ``(level, source)`` where ``source`` explains the decision for the
    XAI/transparency record.
    """
    if requested_level and requested_level != "STANDARD":
        level = requested_level if requested_level in VALID_FUNCTIONING_LEVELS else "STANDARD"
        return level, "explicit"

    if not parent_data:
        return (requested_level or "STANDARD"), "default"

    comm = (parent_data.communicationMode or "")
    device = (parent_data.deviceInteraction or "")
    response = (parent_data.responseMethod or "")

    if comm == "pre_symbolic" or device == "partner_assisted":
        return "PRE_SYMBOLIC", "parent_assessment_derivation"
    if comm == "non_verbal" or device == "eye_gaze":
        return "NON_VERBAL", "parent_assessment_derivation"
    if comm == "limited_verbal" or device == "switch_access" or response == "switch_scan":
        return "LOW_VERBAL", "parent_assessment_derivation"
    if comm in ("aac_device", "sign_language") or device == "guided":
        return "SUPPORTED", "parent_assessment_derivation"

    return "STANDARD", "default"

DIFFICULTY_MULTIPLIER = {
    "easy": 0.8,
    "medium": 1.0,
    "hard": 1.2,
}

# Collaborator-insight folding (parity with web-v2 buildBrainProfile, Sprint 4).
# A perspective contributed by an accepted teacher / caregiver / therapist
# (stored in brain_insights, domain-tagged) raises the matching accommodation
# and keeps a coordinating tutor active. Slugs mirror web-v2 so the two stacks
# name accommodations consistently.
INSIGHT_DOMAIN_ACCOMMODATION = {
    "communication": ("aac_communication_support", "AAC / communication support"),
    "aac": ("aac_communication_support", "AAC / communication support"),
    "speech": ("aac_communication_support", "AAC / communication support"),
    "sensory": ("sensory_breaks", "Sensory breaks"),
    "attention": ("visual_schedules", "Visual schedules"),
    "focus": ("visual_schedules", "Visual schedules"),
    "reading": ("read_aloud", "Read-aloud"),
    "literacy": ("read_aloud", "Read-aloud"),
    "writing": ("speech_to_text", "Speech-to-text"),
    "motor": ("speech_to_text", "Speech-to-text"),
}

INSIGHT_DOMAIN_TUTOR = {
    "communication": "echo",
    "aac": "echo",
    "speech": "echo",
    "sensory": "harmony",
    "attention": "harmony",
    "focus": "harmony",
    "reading": "sage",
    "literacy": "sage",
    "writing": "sage",
    "math": "nova",
}


def _load_collaborator_insights(db: Session, learner_id: str) -> list:
    """Accepted-collaborator insights for the learner (best-effort).

    Reads the brain_insights surface (author_role + domain + text). Returns []
    on any error so a clone never fails because the table/column is absent in
    an older database — the fold is supplementary, never load-bearing.
    """
    try:
        rows = db.execute(
            text(
                "SELECT author_role, domain, insight_text FROM brain_insights "
                "WHERE learner_id = :lid ORDER BY created_at"
            ),
            {"lid": learner_id},
        ).fetchall()
        return [
            {"author_role": r[0], "domain": r[1], "insight_text": r[2]}
            for r in rows
        ]
    except Exception:
        return []


def _fold_collaborator_insights(insights: list, accommodations: list, tutors: list, xai_explanation: dict):
    """Fold collaborator insights into accommodations + tutors + the XAI record.

    Mirrors web-v2: a therapist communication insight raises AAC/communication
    support and pins it non-removable (a clinician flagged it); a teacher /
    caregiver insight raises the same support but leaves it removable. Returns
    the (possibly extended) accommodations + tutors; mutates xai in place.
    """
    accommodations = list(accommodations)
    tutors = list(tutors)
    acc_decisions = xai_explanation.setdefault("accommodation_decisions", [])
    tutor_decisions = xai_explanation.setdefault("tutor_decisions", [])
    seen_acc = {d.get("accommodation") for d in acc_decisions}
    for ins in insights:
        domain = (ins.get("domain") or "").strip().lower()
        role = ins.get("author_role") or "collaborator"
        mapping = INSIGHT_DOMAIN_ACCOMMODATION.get(domain)
        if not mapping:
            continue
        acc, label = mapping
        removable = role != "therapist"
        snippet = " ".join((ins.get("insight_text") or "").split())[:140]
        if acc not in accommodations:
            accommodations.append(acc)
        if acc not in seen_acc:
            seen_acc.add(acc)
            acc_decisions.append({
                "accommodation": acc,
                "display_label": label,
                "reasoning": f"{role} insight ({domain}): {snippet}",
                "source": f"collaborator:{role}",
                "removable": removable,
            })
        elif not removable:
            for d in acc_decisions:
                if d.get("accommodation") == acc:
                    d["removable"] = False
        tutor = INSIGHT_DOMAIN_TUTOR.get(domain)
        if tutor and tutor not in tutors:
            tutors.append(tutor)
            tutor_decisions.append({
                "tutor_key": tutor,
                "reasoning": f"Kept active to coordinate with a {role}'s {domain} insight.",
                "source": f"collaborator:{role}",
            })
    return accommodations, tutors

def _compute_mastery_from_discovery(discovery_results, template_mastery: dict) -> dict:
    mastery = dict(template_mastery)
    for ch in discovery_results.chapterResults:
        if ch.total <= 0:
            continue
        raw_score = ch.correct / ch.total
        multiplier = DIFFICULTY_MULTIPLIER.get(ch.difficulty, 1.0)
        adjusted = min(1.0, raw_score * multiplier)

        mastery_key = DOMAIN_TO_MASTERY.get(ch.domain, ch.domain)
        if mastery_key in mastery:
            mastery[mastery_key] = round(adjusted, 3)
        else:
            for key in mastery:
                if ch.domain in key or key in ch.domain:
                    mastery[key] = round(adjusted, 3)
                    break
    return mastery

def _build_disability_signals(parent_data) -> dict:
    signals = {}
    if parent_data:
        if parent_data.communicationMode and parent_data.communicationMode != "verbal":
            signals["communication_needs"] = parent_data.communicationMode
        if parent_data.deviceInteraction and parent_data.deviceInteraction != "independent":
            signals["device_access"] = parent_data.deviceInteraction
        if parent_data.attentionSpan and parent_data.attentionSpan not in ("typical", "age_appropriate"):
            signals["attention"] = parent_data.attentionSpan
        if parent_data.diagnoses:
            signals["diagnoses"] = parent_data.diagnoses
        if parent_data.responseMethod and parent_data.responseMethod != "typing":
            signals["preferred_response"] = parent_data.responseMethod
    return signals

def _build_xai_explanation(mastery_levels: dict, disability_signals: dict, template: dict, discovery_results, parent_data, functioning_level: str) -> dict:
    explanation = {
        "summary": f"Brain clone created based on Discovery Adventure performance and parent-provided context for a {functioning_level.replace('_', ' ').title()} functioning level learner.",
        "rai_compliance": {
            "data_sources": [],
            "bias_mitigations": [
                "Mastery scores derived from learner's own performance, not demographic data",
                "Accommodations selected from evidence-based templates, not assumptions",
                "Parent context treated as supplementary—never overrides learner-demonstrated ability",
            ],
            "transparency": "All decisions below include the reasoning and source data that informed them.",
            "human_oversight": "This brain clone requires parent approval before activation.",
        },
        "mastery_decisions": [],
        "accommodation_decisions": [],
        "tutor_decisions": [],
        "signal_decisions": [],
    }

    if discovery_results:
        explanation["rai_compliance"]["data_sources"].append("Learner Discovery Adventure (baseline assessment)")
    if parent_data:
        explanation["rai_compliance"]["data_sources"].append("Parent/caregiver assessment questionnaire")
    explanation["rai_compliance"]["data_sources"].append(f"Seed template for {functioning_level} functioning level")

    for domain, score in mastery_levels.items():
        decision = {
            "domain": domain,
            "score": score,
            "display_label": domain.replace("_", " ").title(),
            "reasoning": "",
        }
        if discovery_results:
            ch_match = None
            for ch in discovery_results.chapterResults:
                mapped = DOMAIN_TO_MASTERY.get(ch.domain, ch.domain)
                if mapped == domain:
                    ch_match = ch
                    break
            if ch_match:
                raw = ch_match.correct / ch_match.total if ch_match.total > 0 else 0
                mult = DIFFICULTY_MULTIPLIER.get(ch_match.difficulty, 1.0)
                decision["reasoning"] = (
                    f"Scored {ch_match.correct}/{ch_match.total} ({raw:.0%}) on {ch_match.difficulty} difficulty. "
                    f"Difficulty multiplier of {mult}x applied → mastery {score:.1%}."
                )
                decision["source"] = "discovery_adventure"
                decision["raw_score"] = f"{ch_match.correct}/{ch_match.total}"
                decision["difficulty"] = ch_match.difficulty
            else:
                decision["reasoning"] = f"No direct assessment data. Set to template default ({score:.1%}) for {functioning_level} level."
                decision["source"] = "template_default"
        else:
            decision["reasoning"] = f"Template default for {functioning_level} level."
            decision["source"] = "template_default"
        explanation["mastery_decisions"].append(decision)

    for acc in template["active_accommodations"]:
        decision = {
            "accommodation": acc,
            "display_label": acc.replace("_", " ").title(),
            "reasoning": f"Standard accommodation for {functioning_level.replace('_', ' ')} functioning level learners based on evidence-based practice.",
            "source": "functioning_level_template",
            "removable": True,
        }
        explanation["accommodation_decisions"].append(decision)

    for tutor_key in template["active_tutors"]:
        decision = {
            "tutor_key": tutor_key,
            "reasoning": f"Included in the {functioning_level.replace('_', ' ')} curriculum template as appropriate for this functioning level.",
            "source": "functioning_level_template",
        }
        explanation["tutor_decisions"].append(decision)

    for signal_key, signal_val in disability_signals.items():
        labels = {
            "communication_needs": "Communication Support",
            "device_access": "Device Interaction",
            "attention": "Attention Profile",
            "diagnoses": "Diagnosis Information",
            "preferred_response": "Response Method",
        }
        decision = {
            "signal": signal_key,
            "value": signal_val if not isinstance(signal_val, list) else ", ".join(signal_val),
            "display_label": labels.get(signal_key, signal_key.replace("_", " ").title()),
            "reasoning": "Reported by parent/caregiver during intake assessment. Used to personalize interactions, not to limit learning expectations.",
            "source": "parent_assessment",
        }
        explanation["signal_decisions"].append(decision)

    return explanation


DOMAIN_HUE_MAP = {
    "ela": "#10B981",
    "math": "#7C3AED",
    "science": "#F59E0B",
    "sel": "#8B5CF6",
    "speech": "#EC4899",
    "executive_function": "#06B6D4",
    "social": "#8B5CF6",
    "communication": "#EC4899",
    "coding": "#06B6D4",
    "history": "#6366F1",
    "daily_living": "#F97316",
    "cause_effect": "#14B8A6",
    "sensory_engagement": "#A855F7",
    "social_awareness": "#D946EF",
}


def _compute_visual_identity(mastery_levels: dict, discovery_results=None) -> dict:
    scored = sorted(mastery_levels.items(), key=lambda x: x[1], reverse=True)
    primary_domain = scored[0][0] if scored else "math"
    primary_hue = DOMAIN_HUE_MAP.get(primary_domain, "#7C3AED")
    secondary_hues = [DOMAIN_HUE_MAP.get(d, "#6366F1") for d, _ in scored[1:4]]

    avg_mastery = sum(mastery_levels.values()) / max(1, len(mastery_levels))
    pulse_rate = 0.8 + avg_mastery * 0.4

    growth_particles = []
    for domain, score in scored[:3]:
        if score > 0.5:
            growth_particles.append({
                "domain": domain,
                "color": DOMAIN_HUE_MAP.get(domain, "#7C3AED"),
                "intensity": round(score, 2),
            })

    memory_bank = []
    if discovery_results:
        for ch in discovery_results.chapterResults:
            if ch.total > 0 and ch.correct / ch.total >= 0.5:
                memory_bank.append({
                    "domain": ch.domain,
                    "type": "discovery_highlight",
                    "score": round(ch.correct / ch.total, 2),
                })

    return {
        "primaryHue": primary_hue,
        "secondaryHues": secondary_hues,
        "pulseRate": round(pulse_rate, 2),
        "growthParticles": growth_particles,
        "memoryBank": memory_bank[:5],
    }


def _build_initial_episodic(discovery_results, parent_data) -> list:
    events = []
    now = _utcnow().isoformat()
    if parent_data:
        events.append({
            "type": "parent_assessment_completed",
            "timestamp": now,
            "communicationMode": parent_data.communicationMode,
            "attentionSpan": parent_data.attentionSpan,
            "diagnoses": parent_data.diagnoses or [],
        })
    if discovery_results:
        avg_latency = 0
        if discovery_results.responseLatencies:
            avg_latency = round(sum(discovery_results.responseLatencies) / len(discovery_results.responseLatencies))
        events.append({
            "type": "discovery_adventure_completed",
            "timestamp": now,
            "totalCorrect": discovery_results.totalCorrect,
            "totalAttempts": discovery_results.totalAttempts,
            "xpEarned": discovery_results.xpEarned,
            "avgLatencyMs": avg_latency,
            "chapters": [
                {
                    "domain": ch.domain,
                    "correct": ch.correct,
                    "total": ch.total,
                    "difficulty": ch.difficulty,
                    "avgLatencyMs": round(ch.avgLatencyMs),
                }
                for ch in discovery_results.chapterResults
            ],
        })
    return events


def clone_brain(db: Session, request: BrainCloneRequest) -> dict:
    existing = db.execute(
        text("SELECT id FROM brain_states WHERE learner_id = :lid"),
        {"lid": request.learner_id}
    ).first()

    if existing:
        return {"error": "Brain state already exists", "brain_state_id": existing[0]}

    # Resolve the functioning level: trust an explicit non-STANDARD value,
    # otherwise back-stop by deriving from the parent assessment signals so a
    # learner with clear support needs never gets a STANDARD brain by default.
    functioning_level, functioning_level_source = derive_functioning_level(
        request.parent_assessment_data, request.functioning_level
    )
    request.functioning_level = functioning_level

    template = SEED_TEMPLATES.get(functioning_level, SEED_TEMPLATES["STANDARD"])

    brain_state_id = str(uuid.uuid4())
    now = _utcnow()

    learner_row = db.execute(
        text("SELECT curriculum_alignment, curriculum_framework, district_name, district_id, zip_code, country FROM learners WHERE id = :lid"),
        {"lid": request.learner_id}
    ).first()

    # Accepted-collaborator perspectives (best-effort) — folded below so the
    # pre-build invite step measurably shapes the brain.
    collaborator_insights = _load_collaborator_insights(db, request.learner_id)

    curriculum_alignment = {}
    if learner_row and learner_row[0]:
        try:
            curriculum_alignment = learner_row[0] if isinstance(learner_row[0], dict) else json.loads(learner_row[0])
        except (json.JSONDecodeError, TypeError):
            curriculum_alignment = {}

    mastery_levels = dict(template["mastery_levels"])
    if request.discovery_results:
        mastery_levels = _compute_mastery_from_discovery(request.discovery_results, mastery_levels)

    disability_signals = {}
    if request.parent_assessment_data:
        disability_signals = _build_disability_signals(request.parent_assessment_data)

    episodic_memory = _build_initial_episodic(request.discovery_results, request.parent_assessment_data)

    xai_explanation = _build_xai_explanation(
        mastery_levels, disability_signals, template,
        request.discovery_results, request.parent_assessment_data,
        request.functioning_level
    )

    # Fold accepted-collaborator insights into the template accommodations +
    # tutors and the XAI record (parity with web-v2 buildBrainProfile).
    active_accommodations, active_tutors = _fold_collaborator_insights(
        collaborator_insights,
        template["active_accommodations"],
        template["active_tutors"],
        xai_explanation,
    )
    if collaborator_insights:
        xai_explanation["rai_compliance"]["data_sources"].append("Accepted collaborator insights")
        xai_explanation["summary"] += (
            f" Incorporated {len(collaborator_insights)} collaborator insight(s)."
        )

    visual_identity = _compute_visual_identity(mastery_levels, request.discovery_results)

    brain_data = {
        "mastery_levels": mastery_levels,
        "disability_signals": disability_signals,
        "functioning_level_profile": {
            "level": functioning_level,
            "determined_at": now.isoformat(),
            "source": functioning_level_source,
        },
        "iep_profile": {},
        "sensory_profile": {},
        "active_accommodations": active_accommodations,
        "curriculum_alignment": curriculum_alignment,
        "active_tutors": active_tutors,
        "functional_curriculum": template.get("functional_curriculum", {}),
        "episodic_memory": episodic_memory,
        "visual_identity": visual_identity,
    }

    db.execute(
        text("""INSERT INTO brain_states
            (id, tenant_id, learner_id, mastery_levels, disability_signals,
             functioning_level_profile, iep_profile, sensory_profile,
             active_accommodations, curriculum_alignment, active_tutors,
             functional_curriculum, episodic_memory, visual_identity,
             approval_status, xai_explanation, version, created_at, updated_at)
            VALUES (:id, :tid, :lid, :ml, :ds, :flp, :ip, :sp, :aa, :ca, :at, :fc, :em, :vi,
                    'pending_parent_review', :xai, 1, :now, :now)"""),
        {
            "id": brain_state_id,
            "tid": request.tenant_id,
            "lid": request.learner_id,
            "ml": json.dumps(brain_data["mastery_levels"]),
            "ds": json.dumps(brain_data["disability_signals"]),
            "flp": json.dumps(brain_data["functioning_level_profile"]),
            "ip": json.dumps(brain_data["iep_profile"]),
            "sp": json.dumps(brain_data["sensory_profile"]),
            "aa": json.dumps(brain_data["active_accommodations"]),
            "ca": json.dumps(brain_data["curriculum_alignment"]),
            "at": json.dumps(brain_data["active_tutors"]),
            "fc": json.dumps(brain_data["functional_curriculum"]),
            "em": json.dumps(brain_data["episodic_memory"]),
            "vi": json.dumps(visual_identity),
            "xai": json.dumps(xai_explanation),
            "now": now,
        }
    )

    snapshot_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO brain_state_snapshots
            (id, brain_state_id, learner_id, version, trigger, snapshot, created_at)
            VALUES (:id, :bsid, :lid, 1, 'initial_clone', :snap, :now)"""),
        {
            "id": snapshot_id,
            "bsid": brain_state_id,
            "lid": request.learner_id,
            "snap": json.dumps(brain_data),
            "now": now,
        }
    )

    db.commit()

    try:
        import httpx
        subjects = list(brain_data["mastery_levels"].keys())
        internal_token = os.environ.get("INTERNAL_SERVICE_TOKEN") or (
            "" if os.environ.get("NODE_ENV") == "production" else "aivo-internal-dev-token"
        )
        headers = {
            "x-internal-service": "brain-svc",
            "x-service-token": internal_token,
        }
        for subject in subjects:
            httpx.post(
                f"{LEARNING_SVC_URL}/api/learning/path/{request.learner_id}/{subject}/init",
                json={"functioning_level": request.functioning_level},
                headers=headers,
                timeout=5.0,
            )
    except Exception:
        pass

    return {
        "brain_state_id": brain_state_id,
        "snapshot_id": snapshot_id,
        "version": 1,
        "functioning_level": request.functioning_level,
        "active_tutors": brain_data["active_tutors"],
        "active_accommodations": brain_data["active_accommodations"],
        "visual_identity": visual_identity,
    }
