from typing import Optional

# Sprint 03 — baseline items now carry a LearnerSurfaceSpec describing
# which interactive workspace the runtime should mount (multiple_choice,
# scratchpad, geometry_workspace, …). The contract lives in
# baseline_surface_contract; curated exemplars live in
# baseline_item_templates; both are validated by
# baseline_surface_validator before items reach the runtime.
from .baseline_surface_contract import (
    LearnerSurfaceSpec,  # re-exported for type annotations downstream
    render_prompt_section as render_surface_prompt_section,
)
from .baseline_item_templates import render_template_examples


CURRICULUM_FRAMEWORK_GUIDANCE = {
    "CCSS": "Common Core State Standards (math: K-CC, OA, NBT, NF, MD, G; ELA: RL, RI, RF, W, SL, L)",
    "TEKS": "Texas Essential Knowledge and Skills (state-specific TX scope and sequence)",
    "NGSS": "Next Generation Science Standards (DCI / Cross-cutting Concepts / Practices)",
    "FL_BEST": "Florida B.E.S.T. Standards",
    "CA_CCSS": "California Common Core (CA-aligned ELA & math)",
    "NY_NEXT_GEN": "New York Next Generation Learning Standards",
}


def _format_iep_block(iep: Optional[dict]) -> str:
    """Render the learner's IEP context (if uploaded) as prompt-ready text."""
    if not iep:
        return "## IEP Context\nNo IEP on file. Generate based on parent assessment only."

    disability = iep.get("disabilityCategories") or []
    accommodations = iep.get("accommodations") or []
    goals = iep.get("goals") or []
    grade_level = iep.get("gradeLevel") or "not specified"
    comm_system = iep.get("communicationSystem") or "not specified"
    assistive_tech = iep.get("assistiveTechnology") or []
    rec_fl = iep.get("recommendedFunctioningLevel") or "not specified"

    def _fmt_goal(g):
        if isinstance(g, str):
            return f"  - {g}"
        if not isinstance(g, dict):
            return f"  - {str(g)}"
        domain = g.get("domain") or "general"
        desc = g.get("description") or g.get("goalText") or g.get("text") or ""
        target = g.get("target") or g.get("targetCriteria") or ""
        baseline = g.get("baseline") or ""
        parts = [f"[{domain}] {desc}"]
        if baseline:
            parts.append(f"baseline: {baseline}")
        if target:
            parts.append(f"target: {target}")
        return f"  - {' | '.join(parts)}"

    def _fmt_accom(a):
        if isinstance(a, str):
            return f"  - {a}"
        if not isinstance(a, dict):
            return f"  - {str(a)}"
        atype = a.get("type") or "general"
        desc = a.get("description") or a.get("text") or ""
        freq = a.get("frequency") or ""
        suffix = f" ({freq})" if freq else ""
        return f"  - [{atype}] {desc}{suffix}"

    goals_block = "\n".join(_fmt_goal(g) for g in goals[:12]) if goals else "  - (none recorded)"
    accom_block = "\n".join(_fmt_accom(a) for a in accommodations[:10]) if accommodations else "  - (none recorded)"

    return f"""## IEP Context (Individualized Education Program)
- Disability categories: {', '.join(disability) if disability else 'none reported'}
- IEP grade level: {grade_level}
- Communication system: {comm_system}
- Assistive technology: {', '.join(assistive_tech) if assistive_tech else 'none'}
- IEP-recommended functioning level: {rec_fl}

### Active IEP Goals (target these domains explicitly)
{goals_block}

### Required Accommodations (apply to every question/activity)
{accom_block}"""


def _format_caregiver_perspectives_block(perspectives: Optional[list]) -> str:
    """Render caregiver (parent + co-parent) perspectives for the prompt.

    The product requirement is that both perspectives, when present,
    are surfaced to the LLM — the parent and the co-parent may answer
    differently (one says "verbal", one says "minimally verbal") and
    the model should weigh both rather than seeing the last writer
    only. Co-parent input is OPTIONAL: when only one caregiver row
    exists, we render a single perspective and note no second
    caregiver is on file. When zero exist, return an empty string so
    the prompt is unaffected (the surrounding parent_assessment block
    still carries the primary signal).
    """
    if not isinstance(perspectives, list) or len(perspectives) == 0:
        return ""

    def _fmt_one(idx: int, p: dict) -> str:
        if not isinstance(p, dict):
            return ""
        comm = p.get("communicationMode") or "not specified"
        dev = p.get("deviceInteraction") or "not specified"
        resp_method = p.get("responseMethod") or "not specified"
        attn = p.get("attentionSpan") or "not specified"
        dx = p.get("diagnoses") or []
        responses = p.get("responses") or {}
        # Surface only the high-signal answer keys so the prompt does
        # not balloon with a full intake dump per caregiver.
        signal_keys = ["ls-1", "str-1", "ch-1", "ch-2", "fl-5", "fl-7", "pref-1", "ch-5", "se-1"]
        signal_lines = []
        for k in signal_keys:
            if k in responses and responses[k] not in (None, "", []):
                v = responses[k]
                if isinstance(v, list):
                    v = ", ".join(str(x) for x in v[:6])
                signal_lines.append(f"  - {k}: {v}")
        signals_block = "\n".join(signal_lines) if signal_lines else "  - (no detailed responses)"
        return f"""### Caregiver perspective {idx}
- Communication: {comm}
- Device interaction: {dev}
- Response method: {resp_method}
- Attention span: {attn}
- Diagnoses reported: {', '.join(dx) if dx else 'none reported'}
- Key responses:
{signals_block}"""

    rendered = "\n\n".join(_fmt_one(i + 1, p) for i, p in enumerate(perspectives) if isinstance(p, dict))
    if not rendered:
        return ""

    if len(perspectives) == 1:
        header = ("## Caregiver Perspectives (1 caregiver on file — co-parent input is optional)\n"
                  "Only one caregiver has submitted an assessment. Treat their answers as the primary signal.")
    else:
        header = (f"## Caregiver Perspectives ({len(perspectives)} caregivers on file)\n"
                  "Multiple caregivers have submitted assessments. Their answers may DIFFER (e.g., one\n"
                  "may say 'verbal' while another says 'minimally verbal'). When perspectives disagree,\n"
                  "(a) calibrate difficulty to the MORE SUPPORTIVE perspective so the learner is not\n"
                  "over-faced on item one, and (b) include items that probe the disputed area so the\n"
                  "baseline result will resolve the disagreement.")

    return f"""{header}

{rendered}"""


def _format_teacher_block(teacher: Optional[dict]) -> str:
    """Render the (optional) teacher-led intake.

    Teacher input is OPTIONAL: returns an explicit "no teacher input
    on file" line when absent so the prompt is self-describing. When
    present, surfaces classroom-observed strengths/challenges/
    accommodations and any narrative observations.
    """
    if not isinstance(teacher, dict) or not teacher:
        return "## Teacher Input\nNo teacher assessment on file (optional). Generate based on caregiver + IEP signal only."

    role = teacher.get("teacherRole") or "Teacher"
    grade = teacher.get("gradeLevel") or "not specified"
    subject = teacher.get("subjectArea") or "not specified"
    strengths = teacher.get("strengths") or []
    challenges = teacher.get("challenges") or []
    accommodations = teacher.get("accommodations") or []
    observations = (teacher.get("observations") or "").strip()
    focus_areas = teacher.get("recommendedFocusAreas") or []

    def _bullets(items, fallback="(none recorded)"):
        if not items:
            return f"  - {fallback}"
        rendered = []
        for it in items[:10]:
            if isinstance(it, str) and it:
                rendered.append(f"  - {it}")
            elif isinstance(it, dict):
                desc = it.get("description") or it.get("text") or it.get("name") or ""
                if desc:
                    rendered.append(f"  - {desc}")
        return "\n".join(rendered) if rendered else f"  - {fallback}"

    obs_block = observations if observations else "(no narrative provided)"

    return f"""## Teacher Input ({role})
- Grade level (classroom): {grade}
- Subject area: {subject}

### Teacher-observed strengths
{_bullets(strengths)}

### Teacher-observed challenges
{_bullets(challenges)}

### Classroom accommodations the teacher uses or recommends
{_bullets(accommodations)}

### Teacher's recommended focus areas for the baseline
{_bullets(focus_areas, fallback="(no specific focus requested — calibrate broadly)")}

### Classroom observations
{obs_block}"""


def _format_district_block(district: Optional[dict]) -> str:
    """Render the learner's district / curriculum context as prompt-ready text."""
    if not district:
        return "## District & Curriculum Context\nNo district context on file. Use generic age-appropriate content."

    name = district.get("districtName") or "(unnamed district)"
    region = district.get("region") or "unknown region"
    country = district.get("country") or "US"
    grade = district.get("gradeLevel") or "not specified"
    framework = district.get("curriculumFramework") or None
    alignment = district.get("curriculumAlignment") or {}

    framework_guidance = CURRICULUM_FRAMEWORK_GUIDANCE.get(framework or "", "")
    framework_line = f"- Curriculum framework: {framework}" + (f" — {framework_guidance}" if framework_guidance else "") if framework else "- Curriculum framework: not specified"

    alignment_lines = []
    if isinstance(alignment, dict) and alignment:
        for subject, value in list(alignment.items())[:8]:
            alignment_lines.append(f"  - {subject}: {value}")
    alignment_block = "\n".join(alignment_lines) if alignment_lines else "  - (no per-subject alignment recorded)"

    return f"""## District & Curriculum Context
- District: {name} ({region}, {country})
- Enrolled grade level: {grade}
{framework_line}

### Per-Subject Standards Alignment
{alignment_block}

When generating questions, anchor wording, examples, and difficulty to the
framework above for the enrolled grade level. If the IEP grade level differs
from the enrolled grade level, prefer the IEP grade level for difficulty
calibration but keep terminology consistent with the district framework."""


SUBJECTS = [
    {"key": "math", "label": "Math", "emoji": "🔢", "color": "#7C3AED"},
    {"key": "ela", "label": "Reading", "emoji": "📖", "color": "#10B981"},
    {"key": "science", "label": "Science", "emoji": "🔬", "color": "#F59E0B"},
    {"key": "speech", "label": "Speech", "emoji": "🗣️", "color": "#EC4899"},
    {"key": "sel", "label": "SEL", "emoji": "💛", "color": "#F43F5E"},
    {"key": "life_skills", "label": "Life Skills", "emoji": "🏠", "color": "#14B8A6"},
    {"key": "executive_function", "label": "Executive Function", "emoji": "🧠", "color": "#6366F1"},
]

ADVENTURE_CHAPTERS = [
    {
        "id": "sage_story_garden",
        "title": "Sage's Story Garden",
        "subtitle": "Reading & Language",
        "domain": "ela",
        "tutorKey": "sage",
        "bgGradient": "from-emerald-900 via-teal-800 to-slate-900",
        "sceneDescription": "An illustrated garden where words grow on trees, sentences bloom as flowers, and stories hide in magical books.",
        "landmark": {"emoji": "🌳", "label": "Story Garden"},
        "transitionLine": "Your story garden is growing beautifully! Let me introduce you to my friend.",
    },
    {
        "id": "nova_number_galaxy",
        "title": "Nova's Number Galaxy",
        "subtitle": "Mathematics",
        "domain": "math",
        "tutorKey": "nova",
        "bgGradient": "from-indigo-950 via-purple-900 to-slate-900",
        "sceneDescription": "A cosmic scene with planets, stars, and gently floating asteroids. Warm and wonder-filled, not cold sci-fi.",
        "landmark": {"emoji": "⭐", "label": "Number Galaxy"},
        "transitionLine": "You are a star navigator! Someone else wants to show you their world.",
    },
    {
        "id": "spark_discovery_lab",
        "title": "Spark's Discovery Lab",
        "subtitle": "Science",
        "domain": "science",
        "tutorKey": "spark",
        "bgGradient": "from-amber-900 via-orange-800 to-slate-900",
        "sceneDescription": "A colorful laboratory with bubbling beakers, a terrarium with plants, a window showing weather, and a microscope.",
        "landmark": {"emoji": "🧪", "label": "Discovery Lab"},
        "transitionLine": "Science is all around us! Let's visit someone very special next.",
    },
    {
        "id": "harmony_feelings_treehouse",
        "title": "Harmony's Feelings Treehouse",
        "subtitle": "Social-Emotional Learning",
        "domain": "sel",
        "tutorKey": "harmony",
        "bgGradient": "from-violet-900 via-purple-800 to-slate-900",
        "sceneDescription": "A warm, cozy treehouse with soft lighting, cushions, and a window showing the outside world.",
        "landmark": {"emoji": "🏡", "label": "Feelings Treehouse"},
        "transitionLine": "You are so kind and thoughtful! One more friend wants to meet you.",
    },
    {
        "id": "echo_sound_studio",
        "title": "Echo's Sound Studio",
        "subtitle": "Speech & Language",
        "domain": "speech",
        "tutorKey": "echo",
        "bgGradient": "from-pink-900 via-rose-800 to-slate-900",
        "sceneDescription": "A friendly recording studio with microphones, sound waves, and musical notes floating around.",
        "landmark": {"emoji": "🎵", "label": "Sound Studio"},
        "transitionLine": "Your voice is music to my ears! Time for one last adventure.",
    },
    {
        "id": "pixel_puzzle_palace",
        "title": "Pixel's Puzzle Palace",
        "subtitle": "Executive Function & Problem Solving",
        "domain": "executive_function",
        "tutorKey": "pixel",
        "bgGradient": "from-cyan-900 via-sky-800 to-slate-900",
        "sceneDescription": "A colorful puzzle room where logic rules and patterns create the environment. Crystal formations and shifting tiles.",
        "landmark": {"emoji": "🔮", "label": "Puzzle Palace"},
        "transitionLine": "You solved every puzzle! What an amazing adventure.",
    },
]


def build_discovery_adventure_prompt(
    parent_assessment: dict,
    chapter: dict,
    iep: Optional[dict] = None,
    district: Optional[dict] = None,
    interest_profile: Optional[dict] = None,
    caregiver_perspectives: Optional[list] = None,
    teacher_assessment: Optional[dict] = None,
) -> tuple[str, str]:
    responses = parent_assessment.get("responses", {})
    communication_mode = parent_assessment.get("communicationMode", "verbal")
    device_interaction = parent_assessment.get("deviceInteraction", "independent")
    functioning_level = parent_assessment.get("functioningLevel", "STANDARD")
    attention_span = parent_assessment.get("attentionSpan", "typical")
    diagnoses = parent_assessment.get("diagnoses", [])

    learning_style = responses.get("ls-1", "")
    strengths_raw = responses.get("str-1", [])
    strengths = strengths_raw if isinstance(strengths_raw, list) else []
    challenges_raw = responses.get("ch-1", [])
    challenges = challenges_raw if isinstance(challenges_raw, list) else []
    diagnosed = responses.get("ch-2", "")
    reading_level = responses.get("fl-5", "")
    dev_level = responses.get("fl-7", "")
    interests_raw = responses.get("pref-1", [])
    interests = interests_raw if isinstance(interests_raw, list) else []
    # Merge in *scored* deep interests from the special-interest engine
    # (caregiver intake / engagement / IEP signals). The persisted top
    # interest is treated as a primary theme, not a distraction.
    deep_interests: list[str] = []
    primary_theme: Optional[str] = None
    if isinstance(interest_profile, dict):
        scored = interest_profile.get("topInterests") or []
        if isinstance(scored, list):
            for s in scored:
                if isinstance(s, dict) and isinstance(s.get("slug"), str):
                    deep_interests.append(s["slug"])
            if deep_interests:
                primary_theme = deep_interests[0]
    # Promote scored interests to the front so prompts foreground them.
    if deep_interests:
        seen: set[str] = set()
        merged: list[str] = []
        for x in [*deep_interests, *interests]:
            if isinstance(x, str) and x and x not in seen:
                seen.add(x)
                merged.append(x)
        interests = merged
    frustrations = responses.get("ch-5", "")
    focus_rating = responses.get("ls-3", 3)
    confidence = responses.get("se-1", 3)

    fl_config = {
        "STANDARD": {"activities": 4, "choices": 4, "interaction_types": "tap_image, tap_word, drag_sort, sequence, pattern_fill, memory", "complexity": "age-appropriate"},
        "SUPPORTED": {"activities": 3, "choices": 3, "interaction_types": "tap_image, tap_word, drag_sort, sequence", "complexity": "simplified language, clearer options"},
        "LOW_VERBAL": {"activities": 2, "choices": 2, "interaction_types": "tap_image, emotion_pick", "complexity": "simple, visual-heavy, no text in choices"},
        "NON_VERBAL": {"activities": 2, "choices": 2, "interaction_types": "tap_image", "complexity": "picture-only choices, very simple"},
        "PRE_SYMBOLIC": {"activities": 0, "choices": 0, "interaction_types": "observational", "complexity": "parent/caregiver observational"},
    }
    fl = fl_config.get(functioning_level, fl_config["STANDARD"])

    system_prompt = f"""You are AIVO's Discovery Adventure generator. You create immersive, narrative-driven baseline assessment activities for learners. Each activity is part of a themed adventure chapter, NOT a traditional test.

## Learner Profile
- Communication Mode: {communication_mode}
- Device Interaction: {device_interaction}
- Functioning Level: {functioning_level}
- Attention Span: {attention_span}
- Diagnoses: {', '.join(diagnoses) if diagnoses else 'None reported'}
- Learning Style: {learning_style}
- Reading Level: {reading_level}
- Developmental Level: {dev_level}
- Strengths: {', '.join(strengths) if strengths else 'Not specified'}
- Challenges: {', '.join(challenges) if challenges else 'Not specified'}
- Diagnosed Conditions: {diagnosed}
- Interests: {', '.join(interests) if interests else 'Not specified'}
- What Frustrates Them: {frustrations or 'Not specified'}
- Focus Rating (1-5): {focus_rating}
- Self-Confidence (1-5): {confidence}

{_format_iep_block(iep)}

{_format_caregiver_perspectives_block(caregiver_perspectives)}

{_format_teacher_block(teacher_assessment)}

{_format_district_block(district)}

## Current Chapter
- Chapter: {chapter['title']}
- Domain: {chapter['domain']}
- Scene: {chapter['sceneDescription']}
- Tutor: {chapter['tutorKey']}

## Functioning Level Adaptations
- Number of activities: {fl['activities']}
- Choices per activity: {fl['choices']}
- Allowed interaction types: {fl['interaction_types']}
- Complexity: {fl['complexity']}

## Activity Design Rules
1. Each activity must feel like part of an ADVENTURE, not a test
2. The tutor character speaks in first person, warmly and encouragingly
3. {('Build the activity AROUND "' + primary_theme + '" as the primary theme — the engine, not a sprinkle. Set scenes, characters, and word problems in this world.') if primary_theme else "Activities should incorporate the learner's interests when possible"}
4. Getting something wrong should feel like the adventure taking an interesting turn, never punishing
5. Generate activities at 3 difficulty tiers: easy, medium, hard (the adaptive engine selects which to use)
6. Each tier should have {fl['activities']} activities
7. Visual elements use emoji as placeholders for rich illustrations
8. For LOW_VERBAL/NON_VERBAL: no text in choice labels, use emoji only
9. Activity narration should be the tutor telling a mini-story that leads naturally to the interaction
10. Each activity title should be a fun, thematic name (e.g., "The Word Garden", "Star Counting")
11. Content must be safe, age-appropriate, and culturally neutral
12. Brain measures should specify what cognitive/academic skills each activity assesses"""

    user_prompt = f"""Generate discovery adventure activities for "{chapter['title']}" ({chapter['domain']} domain).

Generate {fl['activities']} activities at each of 3 difficulty tiers (easy, medium, hard).

Return ONLY valid JSON in this exact format:
{{
  "activities": {{
    "easy": [
      {{
        "id": "{chapter['domain']}_easy_1",
        "title": "The Word Garden",
        "narration": "Welcome to my garden! These trees grow words. Can you help me pick the right ones?",
        "tutorLine": "Which word tells us what the dog is doing?",
        "interaction": "tap_image",
        "choices": [
          {{"id": "a", "label": "Running", "emoji": "🏃", "isCorrect": true}},
          {{"id": "b", "label": "Sleeping", "emoji": "😴", "isCorrect": false}},
          {{"id": "c", "label": "Eating", "emoji": "🍽️", "isCorrect": false}}
        ],
        "sceneEmoji": "🌳",
        "difficulty": "easy",
        "brainMeasures": ["vocabulary level", "reading recognition speed"]
      }}
    ],
    "medium": [...],
    "hard": [...]
  }}
}}

Interaction types to use (pick appropriate ones for this domain):
- "tap_image": Child taps one of several picture/emoji cards (general purpose)
- "tap_word": Child taps a word from options (reading-focused)
- "drag_sort": Child drags items into categories (classification, sorting)
- "sequence": Child puts items in correct order (sequencing, story order)
- "pattern_fill": Child fills in missing pattern element (patterns, logic)
- "memory": Child recalls items from a briefly shown sequence (working memory)
- "emotion_pick": Child identifies emotions from scenes (SEL-specific)
- "observation": Child observes a scene and answers about it (science, inference)

IMPORTANT:
- Each choice MUST have an emoji field
- Exactly ONE choice per activity must have isCorrect: true
- For LOW_VERBAL/NON_VERBAL: use emoji-only labels (no words)
- Personalize themes using learner interests: {', '.join(interests) if interests else 'general themes'}
- ID format: {chapter['domain']}_[easy/medium/hard]_[number]
- Return ONLY the JSON object, no markdown or code blocks"""

    return system_prompt, user_prompt


def build_baseline_generation_prompt(
    parent_assessment: dict,
    iep: Optional[dict] = None,
    district: Optional[dict] = None,
    interest_profile: Optional[dict] = None,
    caregiver_perspectives: Optional[list] = None,
    teacher_assessment: Optional[dict] = None,
) -> tuple[str, str]:
    responses = parent_assessment.get("responses", {})
    communication_mode = parent_assessment.get("communicationMode", "verbal")
    device_interaction = parent_assessment.get("deviceInteraction", "independent")
    functioning_level = parent_assessment.get("functioningLevel", "STANDARD")
    attention_span = parent_assessment.get("attentionSpan", "typical")
    diagnoses = parent_assessment.get("diagnoses", [])

    learning_style = responses.get("ls-1", "")
    strengths_raw = responses.get("str-1", [])
    strengths = strengths_raw if isinstance(strengths_raw, list) else []
    challenges_raw = responses.get("ch-1", [])
    challenges = challenges_raw if isinstance(challenges_raw, list) else []
    diagnosed = responses.get("ch-2", "")
    reading_level = responses.get("fl-5", "")
    dev_level = responses.get("fl-7", "")
    interests_raw = responses.get("pref-1", [])
    interests = interests_raw if isinstance(interests_raw, list) else []
    # Same scored-interest merge as the discovery prompt: surface the
    # learner's deep interests as the *engine* for question themes.
    deep_interests: list[str] = []
    primary_theme: Optional[str] = None
    if isinstance(interest_profile, dict):
        scored = interest_profile.get("topInterests") or []
        if isinstance(scored, list):
            for s in scored:
                if isinstance(s, dict) and isinstance(s.get("slug"), str):
                    deep_interests.append(s["slug"])
            if deep_interests:
                primary_theme = deep_interests[0]
    if deep_interests:
        seen: set[str] = set()
        merged: list[str] = []
        for x in [*deep_interests, *interests]:
            if isinstance(x, str) and x and x not in seen:
                seen.add(x)
                merged.append(x)
        interests = merged
    frustrations = responses.get("ch-5", "")
    engagement_type = responses.get("pref-3", "")
    focus_rating = responses.get("ls-3", 3)
    confidence = responses.get("se-1", 3)

    system_prompt = f"""You are AIVO's adaptive assessment generator. You create personalized baseline assessment questions for learners based on their parent's profile input.

## Learner Profile
- Communication Mode: {communication_mode}
- Device Interaction: {device_interaction}
- Functioning Level: {functioning_level}
- Attention Span: {attention_span}
- Diagnoses: {', '.join(diagnoses) if diagnoses else 'None reported'}
- Learning Style: {learning_style}
- Reading Level: {reading_level}
- Developmental Level: {dev_level}
- Strengths: {', '.join(strengths) if strengths else 'Not specified'}
- Challenges: {', '.join(challenges) if challenges else 'Not specified'}
- Diagnosed Conditions: {diagnosed}
- Interests: {', '.join(interests) if interests else 'Not specified'}
- What Frustrates Them: {frustrations or 'Not specified'}
- Engagement Preference: {engagement_type or 'Not specified'}
- Focus Rating (1-5): {focus_rating}
- Self-Confidence (1-5): {confidence}

{_format_iep_block(iep)}

{_format_caregiver_perspectives_block(caregiver_perspectives)}

{_format_teacher_block(teacher_assessment)}

{_format_district_block(district)}

## Rules
1. Generate EXACTLY 6 questions per subject for these 7 subjects: math, ela, science, speech, sel, life_skills, executive_function (42 questions total)
2. Each question MUST have exactly 4 answer options
3. Adapt difficulty based on the learner's functioning level and developmental level:
   - STANDARD: Age-appropriate grade-level questions
   - SUPPORTED: Slightly below grade level, clearer language
   - LOW_VERBAL: Simple vocabulary, concrete concepts, visual cues in text
   - NON_VERBAL: Picture-describable choices, very simple language
   - PRE_SYMBOLIC: Object-level choices, cause-and-effect, basic matching
4. {('Build questions AROUND "' + primary_theme + '" as a primary recurring theme — math word problems, reading passages, and science prompts should be set in this world the learner already loves. Treat the interest as the engine, not as a sprinkle.') if primary_theme else "Incorporate the learner's INTERESTS into question themes when possible (e.g., if they like animals, use animal-themed math problems)"}
5. Avoid content related to their CHALLENGES in early questions to build confidence first, then gently assess those areas
6. For learners with LOW confidence, start each subject with an easier question
7. For learners with SHORT attention span, keep questions concise (under 15 words)
8. Questions should feel fun and game-like, not test-like
9. Each question must have one clearly correct answer
10. Content must be safe, age-appropriate, and culturally neutral
11. For speech questions: test phonological awareness, vocabulary, grammar, pragmatic language, and comprehension
12. For SEL questions: test emotional recognition, regulation strategies, empathy, social skills, and conflict resolution
13. For life_skills questions: test safety awareness, daily routines, money concepts, hygiene, and self-care
14. For executive_function questions: test planning, organization, working memory, flexible thinking, impulse control, and task initiation"""

    user_prompt = f"""Generate 42 personalized baseline assessment questions (6 per subject) for this learner.

Return ONLY valid JSON in this exact format:
{{
  "questions": [
    {{
      "id": "m1",
      "subject": "math",
      "questionText": "...",
      "options": [
        {{"label": "...", "value": "a"}},
        {{"label": "...", "value": "b"}},
        {{"label": "...", "value": "c"}},
        {{"label": "...", "value": "d"}}
      ],
      "correctAnswer": "b",
      "difficulty": 1
    }}
  ]
}}

ID format: m1-m6 for math, e1-e6 for ela, s1-s6 for science, sp1-sp6 for speech, sel1-sel6 for sel, ls1-ls6 for life_skills, ef1-ef6 for executive_function.
difficulty: 1 (easy) or 2 (moderate) — start each subject with difficulty 1.
Personalize based on the learner's interests ({', '.join(interests) if interests else 'general'}), strengths, and challenges.
Return ONLY the JSON object, no markdown formatting or code blocks."""

    # Sprint 03 — append the surface contract to the user prompt so items
    # arrive with a LearnerSurfaceSpec. The math section explicitly
    # mentions scratchpad; the geometry/math sections mention
    # geometry_workspace; everything else may default to multiple_choice.
    surface_addendum = "\n\n" + render_surface_prompt_section("math") + "\n\n"
    surface_addendum += "### Curated math / geometry templates (use as exemplars)\n"
    surface_addendum += render_template_examples("math") + "\n\n"
    surface_addendum += render_template_examples("geometry") + "\n"
    user_prompt = user_prompt + surface_addendum

    return system_prompt, user_prompt
