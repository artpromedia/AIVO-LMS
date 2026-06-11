"""Wave E (S7) — agent-turn prompt assembly.

Deliberately separate from ``services/prompt_builder.py`` (the chat
path is untouched by the agent track). The caller (tutor-svc) owns the
persona/brain context assembly and hands it over as text; this module
adds the strict reply protocol, the allowed action schemas, the tool
schemas, and the observation."""
from __future__ import annotations

import json

_ACTION_BRIEFS: dict[str, str] = {
    "advance": '{"kind":"advance","encouragement?":"short praise (<=300 chars)"} — the learner is ready for the next beat.',
    "remediate": '{"kind":"remediate","focus":"what to re-teach","approach":"worked_example|simpler_item|manipulative|re_explain"} — re-teach before moving on.',
    "switch_modality": '{"kind":"switch_modality","modality":"visual|auditory|kinesthetic|reading"} — same content, different channel.',
    "insert_scaffold": '{"kind":"insert_scaffold","scaffold":"one concrete support step"} — add support, do not advance.',
    "offer_break": '{"kind":"offer_break","reason":"frustration|fatigue|pacing|learner_request","duration_seconds":15..600} — regulation first.',
    "end_early": '{"kind":"end_early","reason":"why stopping now protects the learner"} — end the session kindly.',
    "present_surface": '{"kind":"present_surface","surface_type":"<registry type>","spec":{...}} — put an interactive surface on stage.',
    "say": '{"kind":"say","text":"<=600 chars, warm, concrete, calm"} — speak to the learner.',
}


def build_turn_prompts(
    *,
    persona_context: str,
    observation: dict,
    allowed_actions: list[str],
    allowed_tools: list[dict],
    history_digest: str = "",
    tool_results: list[dict] | None = None,
    validation_feedback: str | None = None,
) -> tuple[str, str]:
    """Return ``(system_prompt, user_prompt)`` for one agent turn."""
    action_lines = [
        f"- {_ACTION_BRIEFS[a]}" for a in allowed_actions if a in _ACTION_BRIEFS
    ]
    tool_lines = [
        f"- {t.get('name')}: {t.get('description', '')} parameters={json.dumps(t.get('parameters', {}))}"
        for t in allowed_tools
    ]

    system = "\n".join(
        [
            persona_context.strip(),
            "",
            "You are acting as this learner's tutor AGENT for one decision turn.",
            "Decide the single best next move from the ALLOWED ACTIONS, or call a",
            "tool first when you need information you do not have.",
            "",
            "Reply with EXACTLY one JSON object and nothing else — no prose, no",
            "markdown fences. Either:",
            '  {"action": {<one allowed action>}, "rationale": "<=500 chars, for the audit trail"}',
            "or:",
            '  {"tool_calls": [{"name": "<allowed tool>", "arguments": {...}}], "rationale": "..."}',
            "",
            "ALLOWED ACTIONS:",
            *action_lines,
            "",
            "TOOLS:" if tool_lines else "TOOLS: none — you must reply with an action.",
            *tool_lines,
            "",
            "Hard rules: never invent curriculum standards or skills; respect the",
            "learner's functioning level; regulation (break) beats instruction when",
            "frustration signals fire; keep every learner-visible word warm,",
            "concrete, and calm.",
        ]
    )

    user_parts = []
    if history_digest.strip():
        user_parts.append(f"SESSION SO FAR:\n{history_digest.strip()}")
    user_parts.append(f"OBSERVATION:\n{json.dumps(observation, ensure_ascii=False)}")
    if tool_results:
        user_parts.append(
            "TOOL RESULTS (from your previous tool_calls):\n"
            + json.dumps(tool_results, ensure_ascii=False)
        )
    if validation_feedback:
        user_parts.append(
            "YOUR PREVIOUS REPLY WAS REJECTED:\n"
            + validation_feedback
            + "\nReply again with ONE valid JSON object."
        )
    return system, "\n\n".join(user_parts)
