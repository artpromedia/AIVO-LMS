/**
 * Sprint C-16 — contributor-acknowledgement DERIVATION (pure).
 *
 * When a parent approves a brain profile (the honest "your input is now in use"
 * trigger — folding alone isn't; approval is), each contributor whose OWN input
 * was folded learns what it did. This module turns the approved profile's
 * collaborator-sourced decisions into per-role acknowledgement payloads.
 *
 * THE PRIVACY RULE (the sprint's central trust constraint). A payload tells a
 * contributor about THEIR OWN input's use only. The fold stamps every
 * accommodation/tutor decision a collaborator raised with `source:
 * "collaborator:<role>"` and a reasoning snippet that is the contributor's own
 * words about their own observation (`lib/learner/brain-profile.ts`). We group
 * the folded decisions by role and surface ONLY:
 *   - the support/tutor display label ("AAC / communication support"),
 *   - the contributor's own reasoning snippet (their words),
 *   - the learner's FIRST name.
 * We never surface the learner's functioning level, diagnoses, mastery, or any
 * other contributor's content. (Content-safety tested in the .test.ts.)
 *
 * Pure + deterministic: no DB, no fetch — the derivation is unit-tested against
 * a profile-state fixture and reused by the approval write path in repos.ts.
 *
 * IMPORTANT — role granularity. A profile's fold records WHICH ROLE raised what
 * (teacher / caregiver / therapist), not which individual person. With a single
 * seat per teacher/therapist this is unambiguous. Caregivers (2 seats) share a
 * role tag, so a caregiver-sourced fold is attributed to every accepted
 * caregiver on the team — the parent-facing promise this honours is "your
 * caregiver observation shaped X", and the snippet is the caregivers' own
 * (collective) input. The repo layer maps a role to its accepted member(s).
 */
import type {
  ContributionFoldedItem,
  ContributionRole,
  LearnerBrainProfileState,
} from "@/lib/db/types";

const CONTRIBUTION_ROLES: ContributionRole[] = ["teacher", "caregiver", "therapist"];

/** Parse a decision `source` like "collaborator:therapist" into its role, or
 *  null when the decision was not collaborator-sourced (template / parent). */
export function collaboratorRoleFromSource(source: string | undefined): ContributionRole | null {
  if (!source) return null;
  const prefix = "collaborator:";
  if (!source.startsWith(prefix)) return null;
  const role = source.slice(prefix.length).trim().toLowerCase();
  return (CONTRIBUTION_ROLES as string[]).includes(role) ? (role as ContributionRole) : null;
}

/** The first name we may name in a note — a single token of the display name.
 *  Never the full name (which can carry a family surname). */
export function firstNameOf(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return "your learner";
  // Take the first whitespace-delimited token; collapse internal spacing.
  return trimmed.split(/\s+/)[0] ?? "your learner";
}

/** A per-role bundle of the folded items that role raised, derived from the
 *  approved profile. `learnerFirstName` is the only learner datum included. */
export type RoleAcknowledgementPayload = {
  role: ContributionRole;
  learnerFirstName: string;
  foldedItems: ContributionFoldedItem[];
};

/**
 * Derive the per-role acknowledgement payloads from an APPROVED profile's
 * collaborator-sourced decisions. Returns one payload per role that folded at
 * least one item; a role whose input did NOT fold is ABSENT from the result
 * (the negative case the sprint requires — that contributor is acknowledged
 * nothing, and the repo sends them nothing).
 *
 * `learnerFirstName` is taken from the profile's own snapshot (the approved
 * profile already carries the learner's display name); the caller may override
 * it with the canonical learner record's first name.
 */
export function deriveRoleAcknowledgements(
  state: LearnerBrainProfileState,
  learnerFirstNameOverride?: string,
): RoleAcknowledgementPayload[] {
  const learnerFirstName =
    learnerFirstNameOverride && learnerFirstNameOverride.trim().length > 0
      ? learnerFirstNameOverride.trim()
      : firstNameOf(state.learnerProfileSnapshot?.displayName);

  const byRole = new Map<ContributionRole, ContributionFoldedItem[]>();
  const push = (role: ContributionRole, item: ContributionFoldedItem) => {
    const list = byRole.get(role) ?? [];
    // De-dupe by (kind,key) within a role so a re-pinned support isn't listed
    // twice.
    if (!list.some((i) => i.kind === item.kind && i.key === item.key)) list.push(item);
    byRole.set(role, list);
  };

  const xai = state.xaiExplanation;

  for (const dec of xai.accommodationDecisionsDetailed ?? []) {
    const role = collaboratorRoleFromSource(dec.source);
    if (!role) continue;
    push(role, {
      kind: "accommodation",
      key: dec.accommodation,
      label: dec.displayLabel,
      reasoning: dec.reasoning,
    });
  }

  for (const dec of xai.tutorDecisionsDetailed ?? []) {
    const role = collaboratorRoleFromSource(dec.source);
    if (!role) continue;
    push(role, {
      kind: "tutor",
      key: dec.tutorKey,
      label: tutorLabel(dec.tutorKey),
      reasoning: dec.reasoning,
    });
  }

  const payloads: RoleAcknowledgementPayload[] = [];
  for (const role of CONTRIBUTION_ROLES) {
    const items = byRole.get(role);
    if (items && items.length > 0) {
      payloads.push({ role, learnerFirstName, foldedItems: items });
    }
  }
  return payloads;
}

/** Friendly label for a tutor key (the fold stores only the key on tutor
 *  decisions). Falls back to a capitalised key. Privacy-safe — a tutor name
 *  reveals nothing about the learner. */
export function tutorLabel(tutorKey: string): string {
  const k = tutorKey.trim().toLowerCase();
  return TUTOR_LABELS[k] ?? `${k.charAt(0).toUpperCase()}${k.slice(1)}`;
}

const TUTOR_LABELS: Record<string, string> = {
  nova: "Nova (math)",
  sage: "Sage (reading & language)",
  spark: "Spark (science)",
  harmony: "Harmony (social-emotional)",
  echo: "Echo (communication)",
  pixel: "Pixel (visual arts)",
  atlas: "Atlas (social studies)",
};
