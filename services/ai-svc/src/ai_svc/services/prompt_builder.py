import json
from ..prompts.tutor_personas import TUTOR_PERSONAS, FUNCTIONING_LEVEL_ADAPTATIONS


# BCP-47 base locale → human-readable language name. Used to interpolate a
# clear "Respond in {language}" directive into every persona's system prompt
# so the agentic tutors honour the learner's selected UI locale.
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "hi": "Hindi",
}

DEFAULT_LOCALE = "en"

# English language name → base locale code. Reverse of LANGUAGE_NAMES plus a few
# common aliases so a stored preference like "Spanish" or "Mandarin" (the
# learner record persists free-text language NAMES, not always BCP-47 codes)
# resolves to the right code.
_LANGUAGE_NAME_TO_LOCALE: dict[str, str] = {
    name.lower(): code for code, name in LANGUAGE_NAMES.items()
}
_LANGUAGE_NAME_TO_LOCALE.update(
    {
        "chinese": "zh",
        "mandarin": "zh",
        "simplified chinese": "zh",
        "brazilian portuguese": "pt",
        "portuguese (brazil)": "pt",
        "castilian": "es",
    }
)


def _normalize_locale(locale: str | None) -> str:
    """Normalise a locale string ("es-MX", "ES", " fr_CA ") to a base
    language code ("es", "es", "fr"). Falls back to DEFAULT_LOCALE for
    empty/unknown inputs."""
    if not locale:
        return DEFAULT_LOCALE
    base = str(locale).strip().lower().replace("_", "-").split("-")[0]
    return base if base in LANGUAGE_NAMES else DEFAULT_LOCALE


def _resolve_locale_opt(value: str | None) -> str | None:
    """Resolve a BCP-47 locale code ("es-MX") OR an English language name
    ("Spanish", "Chinese (Simplified)") to a base code in LANGUAGE_NAMES, or
    None when the value is empty/unrecognised. Unlike _resolve_locale this does
    NOT swallow unknown input as English — callers that have a fallback (a
    stored language profile) need to know the value didn't resolve."""
    if not value:
        return None
    raw = str(value).strip().lower()
    if raw in _LANGUAGE_NAME_TO_LOCALE:
        return _LANGUAGE_NAME_TO_LOCALE[raw]
    base = raw.replace("_", "-").split("-")[0]
    return base if base in LANGUAGE_NAMES else None


def _resolve_locale(value: str | None) -> str:
    """Resolve a BCP-47 locale code ("es-MX") OR an English language name
    ("Spanish", "Chinese (Simplified)") to a base code in LANGUAGE_NAMES.
    Falls back to DEFAULT_LOCALE for empty/unknown inputs. This is the
    profile-aware sibling of _normalize_locale: the learner's stored
    instruction language may be a human-readable name, not a code."""
    return _resolve_locale_opt(value) or DEFAULT_LOCALE


def _effective_locale(explicit: str | None, brain_context: dict) -> str:
    """The locale the tutor should actually respond in. An explicit caller
    locale (UI override) wins, BUT only when it resolves to a real language —
    a non-empty typo must not silently revert a learner to English and
    suppress their stored instruction language. Falls back to the learner's
    stored language_profile, then DEFAULT_LOCALE."""
    return (
        _resolve_locale_opt(explicit)
        or _resolve_locale_opt(_locale_from_language_profile(brain_context))
        or DEFAULT_LOCALE
    )


def _locale_from_language_profile(brain_context: dict) -> str | None:
    """Pull the learner's stored instruction language out of brain_context's
    language_profile (as returned by brain-svc /context). Prefers the
    explicit instruction language, then primary, then a Lingua dominant
    language. Returns None when nothing is set."""
    profile = brain_context.get("language_profile") if brain_context else None
    if not isinstance(profile, dict):
        return None
    for key in (
        "preferred_instruction_language",
        "primary_language",
        "dominant_language",
    ):
        value = profile.get(key)
        if value:
            return str(value)
    return None


def _build_language_directive(locale: str) -> str:
    """Return the system-prompt block that pins the tutor's response language
    to the learner's selected locale. Always rendered (even for English) so
    the model can't drift back to its default when the learner switches mid-
    session."""
    language = LANGUAGE_NAMES.get(locale, LANGUAGE_NAMES[DEFAULT_LOCALE])
    lines = [
        "\n## Response Language",
        f"The learner has selected {language} as their interface language.",
        f"Respond entirely in {language}, including all explanations, "
        f"examples, encouragement, hints, and feedback.",
        "Use natural, age-appropriate phrasing for that language. Do not "
        "switch to another language unless the learner writes in one, in "
        "which case you may briefly acknowledge in their language and then "
        f"continue teaching in {language}.",
    ]
    if locale != DEFAULT_LOCALE:
        # Reinforce that subject vocabulary should still be teachable — the
        # model should translate or gloss technical English terms rather than
        # silently keep them in English.
        lines.append(
            "Translate or gloss subject-specific vocabulary so the learner "
            f"sees both the {language} term and, when useful, a short "
            "parenthetical English note (e.g. 'fracción (fraction)')."
        )
    return "\n".join(lines)


def _should_synthesize_language_profile(
    tutor_sku: str,
    language_profile: dict,
    normalized_locale: str,
) -> bool:
    """Lingua's bilingual scaffolding protocol expects a `language_profile`
    in brain_context. When the caller hasn't supplied a `dominant_language`
    but the learner has selected a non-English UI locale, treat that locale
    as the dominant language so the persona's protocol can engage.
    """
    return (
        tutor_sku == "ADDON_TUTOR_LANGUAGES"
        and not language_profile.get("dominant_language")
        and normalized_locale != DEFAULT_LOCALE
    )


def build_tutor_system_prompt(
    tutor_sku: str,
    brain_context: dict,
    functioning_level: str = "STANDARD",
    attempts_on_current_topic: int = 0,
    mastery_trend: str = "stable",
    current_mastery: float | None = None,
    locale: str | None = None,
) -> str:
    persona = TUTOR_PERSONAS.get(tutor_sku, {})
    adaptation = FUNCTIONING_LEVEL_ADAPTATIONS.get(functioning_level, FUNCTIONING_LEVEL_ADAPTATIONS["STANDARD"])

    # An explicit (valid) locale (UI override) wins; otherwise honour the
    # learner's stored instruction language from brain_context so a child
    # enrolled in Spanish gets Spanish lessons even when the caller passes no
    # locale (or an unrecognised one).
    normalized_locale = _effective_locale(locale, brain_context)

    layer1 = persona.get("system_prompt", "You are a helpful AI tutor.")

    sensory_profile = brain_context.get("sensory_profile", {})
    iep_profile = brain_context.get("iep_profile", {})
    accommodations = brain_context.get("active_accommodations", [])
    mastery = brain_context.get("mastery_levels", {})
    curriculum = brain_context.get("curriculum_alignment", {})

    layer2_parts = [
        "\n## Learner Context",
        f"- Functioning Level: {functioning_level}",
        f"- Interaction Mode: {adaptation['interaction_mode']}",
        f"- Session Length: {adaptation['session_length']}",
        f"- Teaching Method: {adaptation['method']}",
    ]

    if mastery:
        subject = persona.get("subject", "")
        subject_mastery = {k: v for k, v in mastery.items() if subject.lower() in k.lower()} if subject else mastery
        if subject_mastery:
            layer2_parts.append(f"- Current Mastery: {json.dumps(subject_mastery)}")

    if accommodations:
        layer2_parts.append(f"- Active Accommodations: {', '.join(accommodations)}")

    if sensory_profile:
        sensory_instructions = _build_sensory_instructions(sensory_profile)
        if sensory_instructions:
            layer2_parts.append(f"\n## Sensory Adjustments\n{sensory_instructions}")

    if iep_profile:
        goals = iep_profile.get("goals", [])
        if goals:
            goals_text = "\n".join(f"  - {g}" for g in goals[:5])
            layer2_parts.append(f"\n## IEP Goals\n{goals_text}")

    if curriculum:
        framework = curriculum.get("framework", "")
        if framework:
            layer2_parts.append(f"\n## Curriculum Alignment: {framework}")

    tutor_domain = brain_context.get("tutor_domain") or {}
    if tutor_domain and isinstance(tutor_domain, dict):
        subjects = tutor_domain.get("subjects") or []
        grade_bands = tutor_domain.get("gradeBands") or []
        skill_graph_refs = tutor_domain.get("skillGraphRefs") or []
        coverage = tutor_domain.get("coverageMatrix") or {}
        scaffold_bands = [
            str(band)
            for band, status in coverage.items()
            if status == "scaffold"
        ] if isinstance(coverage, dict) else []
        domain_lines = [
            "\n## Agentic Domain Guidance Contract",
            "- Guide the learner through open-ended questions and topics within this tutor's domain.",
            f"- Subjects: {', '.join(str(subject) for subject in subjects)}",
            f"- Supported K-12 grade bands: {', '.join(str(band) for band in grade_bands)}",
            f"- Grounding skill graphs: {', '.join(str(ref) for ref in skill_graph_refs)}",
            "- Adapt explanations, examples, questions, and next steps to the learner's grade and functioning level.",
            "- Keep the learner actively reasoning: diagnose understanding, choose a next step, provide a scaffold, and check understanding.",
        ]
        if scaffold_bands:
            domain_lines.append(
                "- Scaffold-guidance bands may be used for explanation and exploration, "
                "but must not be represented as formal mastery evidence or a validated assessment: "
                + ", ".join(scaffold_bands)
            )
        layer2_parts.append("\n".join(domain_lines))

    curriculum_focus = brain_context.get("curriculum_focus") or {}
    if curriculum_focus and isinstance(curriculum_focus, dict):
        focus_lines = ["\n## This Week's Focus (from parent/teacher upload)"]
        title = curriculum_focus.get("title")
        if title:
            focus_lines.append(f"- Title: {title}")
        week_start = curriculum_focus.get("weekStart")
        week_end = curriculum_focus.get("weekEnd")
        if week_start or week_end:
            focus_lines.append(f"- Date range: {week_start or '?'} to {week_end or '?'}")
        topics = curriculum_focus.get("topics") or []
        if topics:
            focus_lines.append("- Topics to anchor on: " + "; ".join(topics[:8]))
        keywords = curriculum_focus.get("keywords") or []
        if keywords:
            focus_lines.append("- Vocabulary the learner will see this week: " + ", ".join(keywords[:15]))
        skills = curriculum_focus.get("skills") or []
        if skills:
            focus_lines.append("- Skills to practice: " + "; ".join(skills[:8]))
        standards = curriculum_focus.get("standards") or []
        if standards:
            focus_lines.append("- Aligned standards: " + ", ".join(standards[:10]))
        summary = curriculum_focus.get("summary")
        if summary:
            focus_lines.append(f"- Summary: {summary}")
        focus_lines.append(
            "Prefer examples, problems, and analogies that reinforce the topics above. "
            "If the learner asks something off-topic, gently bridge back to this focus when natural."
        )
        layer2_parts.append("\n".join(focus_lines))

    dape_block = _build_dape_block(brain_context.get("dape_profile"))
    if dape_block:
        layer2_parts.append(dape_block)

    layer2_parts.append(f"\n## Subject Strategy\n{persona.get('subject_strategy', '')}")

    scaffolding = _build_scaffolding_instructions(
        attempts_on_current_topic, mastery_trend, current_mastery
    )
    if scaffolding:
        layer2_parts.append(scaffolding)

    # Lingua (World Languages) expects a `language_profile` in brain_context
    # to drive its bilingual scaffolding protocol. When the caller hasn't
    # supplied one but we know the learner's UI locale, surface that as the
    # dominant_language so the persona's protocol has something to anchor on.
    language_profile = brain_context.get("language_profile") or {}
    if _should_synthesize_language_profile(tutor_sku, language_profile, normalized_locale):
        language_profile = {
            **language_profile,
            "dominant_language": LANGUAGE_NAMES[normalized_locale],
        }
    if language_profile:
        profile_lines = ["\n## Language Profile"]
        if language_profile.get("dominant_language"):
            profile_lines.append(f"- Dominant language: {language_profile['dominant_language']}")
        if language_profile.get("target_language"):
            profile_lines.append(f"- Target language: {language_profile['target_language']}")
        if len(profile_lines) > 1:
            layer2_parts.append("\n".join(profile_lines))

    # Sprint 03: Surface Tool Protocol. When the tutor surface protocol
    # feature is enabled, instruct the model to return structured surface
    # commands instead of inline HTML/SVG.
    if _surface_tool_protocol_enabled():
        layer2_parts.append(_build_surface_tool_protocol_block())

    # The language directive is appended last so it is the most recent
    # instruction the model sees before generating — this maximises
    # adherence across providers.
    layer2_parts.append(_build_language_directive(normalized_locale))

    return layer1 + "\n".join(layer2_parts)


def _surface_tool_protocol_enabled() -> bool:
    """Return True when the tutor surface protocol flag is on."""
    import os

    raw = os.environ.get("AIVO_FEATURE_TUTOR_SURFACE_PROTOCOL", "")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_surface_tool_protocol_block() -> str:
    """Sprint 03 — Surface Tool Protocol.

    Instructs the tutor to emit structured surface commands (open_scratchpad,
    show_geometry, show_graph, show_number_line, show_manipulative,
    show_reading_annotation, show_science_diagram, collect_answer,
    collect_drawing, highlight_object, update_label, save_snapshot) instead
    of raw HTML or SVG. The block is validated downstream by
    `ai_svc.services.surface_directives.validate_tutor_surface_command`.
    """
    return (
        "\n## Surface Tool Protocol\n"
        "When a learner would benefit from a visual, diagram, scratchpad, "
        "graph, number line, annotation, manipulative, or science diagram, "
        "return structured surface commands. Use structured JSON only. "
        "Never return raw HTML or raw SVG. Always include accessibility alt "
        "text and a keyboard alternative. Choose surfaces based on subject, "
        "task, functioning level, accommodations, and learner process "
        "profile.\n\n"
        "Subject rules:\n"
        "- Geometry requires geometry_workspace.\n"
        "- Computation requiring work requires scratchpad.\n"
        "- Fractions may use number_line, area_model, manipulative, or scratchpad.\n"
        "- Science systems may use science_diagram or classification manipulatives.\n"
        "- Reading comprehension may use reading_annotation.\n"
        "- Coding may use trace table or step workspace.\n\n"
        "Each command must include: id, commandType, surfaceId, reason. "
        "Surfaces must include accessibility.altText and "
        "accessibility.keyboardAlternative=true. Geometry surfaces must "
        "include diagram.shapes with at least one shape. Scratchpad commands "
        "must enable ink capture. Speech-required commands are not permitted "
        "for NON_VERBAL learners. Long typed responses are not permitted for "
        "LOW_VERBAL or PRE_SYMBOLIC learners."
    )


def _build_dape_block(dape_profile) -> str:
    """Render a structured DAPE Track section for Vigor when the learner is on
    the DAPE pathway. Returns "" when DAPE is inactive — the persona narrative
    already covers fitness as the default branch.

    Expected shape (matches @aivo/scoring's DapeProfileSummary):
      {
        "active": true,
        "source": "service" | "goal" | "service+goal",
        "totalMotorGoals": int,
        "categories": [
          {"id": "locomotor", "label": "Locomotor skills",
           "goalCount": 2, "sampleGoal": "..."},
          ...
        ],
      }
    """
    if not isinstance(dape_profile, dict):
        return ""
    if not dape_profile.get("active"):
        return ""

    categories = dape_profile.get("categories") or []
    source = dape_profile.get("source") or "goal"
    total = int(dape_profile.get("totalMotorGoals") or 0)

    source_phrase = {
        "service": "an active Adapted Physical Education service line on the IEP",
        "goal": "active motor IEP goals",
        "service+goal": "both an active DAPE service line and motor IEP goals",
    }.get(source, "active DAPE indicators on the IEP")

    lines = [
        "\n## DAPE Track Active",
        f"This learner has {source_phrase}. Operate in the DAPE track for this "
        f"session — not general fitness.",
    ]
    if total:
        lines.append(f"- Motor goals on file: {total}")
    if categories:
        # Take the top 4 categories by goal count so a single DAPE block
        # doesn't dominate the system prompt.
        top = categories[:4]
        for cat in top:
            label = cat.get("label") or cat.get("id") or "DAPE skill"
            count = cat.get("goalCount") or 0
            sample = cat.get("sampleGoal")
            line = f"- {label} ({count} goal{'s' if count != 1 else ''})"
            if sample:
                snippet = (sample[:120] + "…") if len(sample) > 120 else sample
                line += f" — example: {snippet}"
            lines.append(line)

    lines.append(
        "Lead with one DAPE skill category from the list above. Model the movement "
        "visually (picture sequence or short demo), name the clinical skill in "
        "your adult-facing recap, and end the activity with a regulation break "
        "matched to the learner's sensory profile (seeker → heavy work / "
        "vestibular; avoider → midline crossing / proprioceptive). Track motor-"
        "skill progress separately so the Motor Progress report stays accurate."
    )
    return "\n".join(lines)


def _build_scaffolding_instructions(
    attempts: int,
    trend: str,
    current_mastery: float | None,
) -> str:
    """Return scaffolding / remediation guidance based on attempt count and trend.

    - Attempts <= 2: no scaffolding overhead.
    - Attempts 3-4: micro-step + concrete-before-abstract guidance.
    - Attempts >= 5: significant scaffolding — prerequisites, manipulatives.
    - Trend 'declining': regression-aware language.
    - Trend 'stable' with low mastery (< 0.4): switch teaching approach.
    """
    parts: list[str] = []

    attempts = max(0, int(attempts or 0))
    if attempts >= 5:
        parts.append(
            "\n## Scaffolding Mode (Heavy)\n"
            "This topic requires significant scaffolding. The learner has attempted "
            "this topic 5 or more times. Start with prerequisite skills before "
            "re-introducing the target concept. Use manipulatives, visual models, "
            "and concrete representations. Celebrate small wins explicitly. Avoid "
            "abstract notation until the learner demonstrates fluency with the "
            "concrete form."
        )
    elif attempts >= 3:
        parts.append(
            "\n## Scaffolding Mode (Light)\n"
            "The learner has struggled with this topic across multiple attempts. "
            "Break the concept into smaller steps. Use concrete examples before "
            "abstract concepts. Check understanding at each micro-step before "
            "moving on, and offer a hint before correcting an answer."
        )

    trend_normalized = (trend or "stable").lower()
    if trend_normalized == "declining":
        parts.append(
            "\n## Mastery Trend: Declining\n"
            "The learner's mastery on this topic is declining. This may indicate "
            "confusion, fatigue, or a gap in prerequisite knowledge. Gently assess "
            "what they remember from previous sessions before introducing new "
            "content. Do not push forward — consolidate first."
        )
    elif (
        trend_normalized == "stable"
        and current_mastery is not None
        and current_mastery < 0.4
    ):
        parts.append(
            "\n## Mastery Trend: Stable at Low Level\n"
            "The learner is not making progress with the current teaching approach. "
            "Try a completely different modality (visual instead of verbal, hands-on "
            "instead of explained, story-based instead of procedural). Avoid "
            "repeating the same explanation."
        )

    return "\n".join(parts)


def build_content_generation_prompt(
    subject: str,
    topic: str,
    grade_target: str,
    delivery_level: str,
    functioning_level: str,
    brain_context: dict,
    content_type: str = "LESSON",
    locale: str | None = None,
) -> tuple[str, str]:
    adaptation = FUNCTIONING_LEVEL_ADAPTATIONS.get(functioning_level, FUNCTIONING_LEVEL_ADAPTATIONS["STANDARD"])
    normalized_locale = _normalize_locale(locale)
    language_name = LANGUAGE_NAMES.get(normalized_locale, LANGUAGE_NAMES[DEFAULT_LOCALE])

    system_prompt = f"""You are AIVO's content generation engine. Generate educational content that is:
- Age-appropriate and engaging
- Aligned to {grade_target} grade objectives
- Delivered at {delivery_level} comprehension level
- Adapted for {functioning_level} functioning level ({adaptation['method']})
- Using {adaptation['response_format']} format
- Written entirely in {language_name}

Content must be safe, accurate, and free of bias. Never include violent, sexual, or inappropriate content.
Never reference real children or specific personal situations."""

    sensory_profile = brain_context.get("sensory_profile", {})
    if sensory_profile:
        system_prompt += f"\n\n## Sensory Profile Adjustments\n{_build_sensory_instructions(sensory_profile)}"

    user_prompt_parts = [
        f"Generate a {content_type.lower()} for {subject} on the topic: {topic}",
        f"Grade target: {grade_target}",
        f"Delivery level: {delivery_level}",
    ]

    if content_type == "LESSON":
        user_prompt_parts.append("""
Include in your response as JSON:
{
  "title": "lesson title",
  "objective": "what the learner will understand",
  "introduction": "engaging hook (2-3 sentences)",
  "content": [
    {"type": "explanation", "text": "..."},
    {"type": "example", "text": "..."},
    {"type": "practice", "question": "...", "answer": "...", "hint": "..."}
  ],
  "summary": "key takeaway",
  "vocabulary": [{"term": "...", "definition": "..."}],
  "next_steps": "what to explore next"
}""")
    elif content_type == "PRACTICE":
        user_prompt_parts.append("""
Generate 5 practice problems as JSON:
{
  "title": "practice set title",
  "problems": [
    {"question": "...", "choices": ["A", "B", "C", "D"], "correct": "A", "explanation": "...", "hint": "...", "difficulty": 1-5}
  ]
}""")

    accommodations = brain_context.get("active_accommodations", [])
    if accommodations:
        user_prompt_parts.append(f"Apply these accommodations: {', '.join(accommodations)}")

    return system_prompt, "\n".join(user_prompt_parts)


def _build_sensory_instructions(sensory_profile: dict) -> str:
    instructions = []

    visual = sensory_profile.get("visual", "typical")
    if visual == "hyper":
        instructions.append("- Reduce visual complexity: use muted colors, minimal animations, clean layouts")
    elif visual == "hypo":
        instructions.append("- Increase visual stimulation: use bright colors, bold text, engaging visuals")

    auditory = sensory_profile.get("auditory", "typical")
    if auditory == "hyper":
        instructions.append("- Minimize audio: use soft tones, avoid sudden sounds, provide text alternatives")
    elif auditory == "hypo":
        instructions.append("- Enhance audio: use clear narration, sound effects for engagement")

    tactile = sensory_profile.get("tactile", "typical")
    if tactile == "hyper":
        instructions.append("- Minimize haptic feedback, avoid complex touch interactions")

    return "\n".join(instructions) if instructions else ""
