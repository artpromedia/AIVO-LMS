/**
 * Sprint 12.7 — LIS (LTI) -> AIVO role mapping.
 *
 * IMS Global publishes the role vocabulary at
 * https://purl.imsglobal.org/spec/lti/v1p3/users/. Platforms typically
 * include both a short form (`Instructor`) and the full URI in the
 * `https://purl.imsglobal.org/spec/lti/claim/roles` claim. We accept
 * either.
 *
 * Mapping rules (most-privileged-wins):
 *   - Administrator / SysAdmin                          -> DISTRICT_ADMIN
 *   - Instructor / TeachingAssistant / ContentDeveloper -> TEACHER
 *   - Learner / Student                                 -> LEARNER (mapped to a
 *                                                          STUDENT shadow user)
 *   - Mentor / Parent / Guardian                        -> CAREGIVER
 *   - anything else                                     -> LEARNER (least-priv)
 */

export type AivoRole = "DISTRICT_ADMIN" | "TEACHER" | "CAREGIVER" | "LEARNER";

const ADMIN_VOCAB = [
  "Administrator",
  "SysAdmin",
  "AccountAdmin",
  "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator",
  "http://purl.imsglobal.org/vocab/lis/v2/system/person#SysAdmin",
];

const TEACHER_VOCAB = [
  "Instructor",
  "TeachingAssistant",
  "ContentDeveloper",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper",
];

const LEARNER_VOCAB = [
  "Learner",
  "Student",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
];

const CAREGIVER_VOCAB = [
  "Mentor",
  "Parent",
  "Guardian",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor",
];

function any(haystack: string[], needles: string[]): boolean {
  for (const h of haystack) {
    for (const n of needles) {
      if (h === n) return true;
      // Some platforms send `urn:lti:role:ims/lis/Instructor`. We treat
      // a substring match on the short form as authoritative provided
      // the substring is a complete URL path segment.
      if (h.endsWith(`#${n}`) || h.endsWith(`/${n}`)) return true;
    }
  }
  return false;
}

export function mapLisRolesToAivoRole(roles: string[] | undefined): AivoRole {
  const safe = roles ?? [];
  if (any(safe, ADMIN_VOCAB)) return "DISTRICT_ADMIN";
  if (any(safe, TEACHER_VOCAB)) return "TEACHER";
  if (any(safe, CAREGIVER_VOCAB)) return "CAREGIVER";
  if (any(safe, LEARNER_VOCAB)) return "LEARNER";
  return "LEARNER";
}
