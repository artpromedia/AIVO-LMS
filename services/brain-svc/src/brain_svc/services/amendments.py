"""
Parent-modification fold (P6).

Shared, pure logic for applying a parent's amendments to a brain's mastery / accommodations / tutors.
Until P6 the standalone `/amend` endpoint recorded the parent's note but NEVER applied the amended
values (it hardcoded `modifications=[]`), so an amendment changed nothing that gets taught. This
extracts the same fold `approve_brain` performs so `/amend` actually mutates the brain, and makes it
unit-testable without a database.

Field grammar (matches the approve path):
  - ``mastery_levels.<domain>``  parent_value = new float
  - ``accommodation.<name>``     parent_value = True (add) / False (remove)
  - ``tutor.<key>``              parent_value = True (add) / False (remove)
"""
from __future__ import annotations


def _attr(mod, name):
    if isinstance(mod, dict):
        return mod.get(name)
    return getattr(mod, name, None)


def apply_parent_modifications(
    mastery: dict, accommodations: list, tutors: list, mods
) -> tuple[dict, list, list, list]:
    """Return (mastery, accommodations, tutors, records) with the parent's amendments applied.
    Inputs are copied, not mutated. `records` is the audit trail of what changed."""
    mastery = dict(mastery or {})
    accommodations = list(accommodations or [])
    tutors = list(tutors or [])
    records: list[dict] = []

    for mod in mods or []:
        field = _attr(mod, "field")
        parent_value = _attr(mod, "parent_value")
        if not field:
            continue
        records.append({
            "field": field,
            "original_value": _attr(mod, "original_value"),
            "parent_value": parent_value,
            "parent_note": _attr(mod, "parent_note"),
            "modified_at": _attr(mod, "modified_at"),
        })

        if field.startswith("mastery_levels."):
            domain = field.split(".", 1)[1]
            if domain in mastery and parent_value is not None:
                mastery[domain] = float(parent_value)
        elif field.startswith("accommodation."):
            name = field.split(".", 1)[1]
            if parent_value is True and name not in accommodations:
                accommodations.append(name)
            elif parent_value is False and name in accommodations:
                accommodations.remove(name)
        elif field.startswith("tutor."):
            key = field.split(".", 1)[1]
            if parent_value is True and key not in tutors:
                tutors.append(key)
            elif parent_value is False and key in tutors:
                tutors.remove(key)

    return mastery, accommodations, tutors, records
