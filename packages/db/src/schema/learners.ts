import { pgTable, uuid, varchar, timestamp, integer, jsonb, text, real, uniqueIndex } from "drizzle-orm/pg-core";
import { functioningLevelEnum } from "./enums.js";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const learners = pgTable("learners", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  parentId: uuid("parent_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  gradeLevel: varchar("grade_level", { length: 20 }),
  functioningLevel: functioningLevelEnum("functioning_level").default("STANDARD"),
  communicationMode: varchar("communication_mode", { length: 50 }),
  diagnoses: jsonb("diagnoses").default([]),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 10 }).default("US"),
  region: varchar("region", { length: 100 }),
  districtId: varchar("district_id", { length: 100 }),
  districtName: varchar("district_name", { length: 255 }),
  curriculumFramework: varchar("curriculum_framework", { length: 100 }),
  curriculumAlignment: jsonb("curriculum_alignment").default({}),
  schoolId: uuid("school_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sensoryProfiles = pgTable("sensory_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  visual: varchar("visual", { length: 20 }).default("typical"),
  auditory: varchar("auditory", { length: 20 }).default("typical"),
  tactile: varchar("tactile", { length: 20 }).default("typical"),
  vestibular: varchar("vestibular", { length: 20 }).default("typical"),
  proprioceptive: varchar("proprioceptive", { length: 20 }).default("typical"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iepDocuments = pgTable("iep_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url"),
  parsedData: jsonb("parsed_data"),
  status: varchar("status", { length: 20 }).default("uploaded"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const iepProfiles = pgTable("iep_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  disabilityCategories: jsonb("disability_categories").default([]),
  accommodations: jsonb("accommodations").default([]),
  goals: jsonb("goals").default([]),
  gradeLevel: varchar("grade_level", { length: 20 }),
  communicationSystem: varchar("communication_system", { length: 100 }),
  assistiveTechnology: jsonb("assistive_technology").default([]),
  recommendedFunctioningLevel: functioningLevelEnum("recommended_functioning_level"),
  reviewDate: timestamp("review_date"),
  // Authoring lifecycle. `uploaded` rows come from PDF parse; `authored` rows are
  // drafted inside AIVO. Lifecycle moves draft → in_review → finalised → archived.
  source: varchar("source", { length: 20 }).default("uploaded").notNull(),
  lifecycleState: varchar("lifecycle_state", { length: 20 }).default("finalised").notNull(),
  authoredByUserId: uuid("authored_by_user_id").references(() => users.id),
  fromEvaluationId: uuid("from_evaluation_id"),
  // Set the first time a parent "in_review" notification is dispatched so
  // repeated notify-in-review calls don't spam the family.
  inReviewNotifiedAt: timestamp("in_review_notified_at"),
  placement: varchar("placement", { length: 100 }),
  // Bumped each time an amendment is acknowledged + merged. Downstream
  // signature workflows watch this so they know affected sections
  // need to be re-signed.
  revisionCounter: integer("revision_counter").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iepPresentLevels = pgTable("iep_present_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id")
    .references(() => iepProfiles.id, { onDelete: "cascade" }).notNull(),
  area: varchar("area", { length: 30 }).notNull(),
  narrative: text("narrative"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iepServices = pgTable("iep_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id")
    .references(() => iepProfiles.id, { onDelete: "cascade" }).notNull(),
  serviceType: varchar("service_type", { length: 60 }).notNull(),
  providerRole: varchar("provider_role", { length: 60 }),
  minutesPerWeek: integer("minutes_per_week"),
  frequency: varchar("frequency", { length: 60 }),
  location: varchar("location", { length: 60 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iepGoals = pgTable("iep_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  iepProfileId: uuid("iep_profile_id")
    .references(() => iepProfiles.id, { onDelete: "cascade" }),
  goalText: text("goal_text").notNull(),
  domain: varchar("domain", { length: 100 }),
  baseline: varchar("baseline", { length: 255 }),
  targetCriteria: varchar("target_criteria", { length: 255 }),
  currentProgress: integer("current_progress").default(0),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iepEvaluations = pgTable("iep_evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  initiatedByUserId: uuid("initiated_by_user_id").references(() => users.id).notNull(),
  // Widened from 20 → 40 to fit "eligibility_determined" (23 chars). The
  // 0009 migration created this as varchar(20); 0012 widens it in place so
  // the decision handler can actually persist the terminal status.
  status: varchar("status", { length: 40 }).default("draft").notNull(),
  referralReason: text("referral_reason"),
  assessmentAreas: jsonb("assessment_areas").default([]),
  observations: text("observations"),
  parentInput: text("parent_input"),
  aiSuggestion: jsonb("ai_suggestion"),
  decisionEligible: varchar("decision_eligible", { length: 20 }),
  decisionCategories: jsonb("decision_categories").default([]),
  decisionRationale: text("decision_rationale"),
  decidedAt: timestamp("decided_at"),
  decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  // Set the first time the parent + district admins are notified that this
  // evaluation moved from draft → submitted. Used as the idempotency latch
  // so a retry storm cannot dispatch duplicate alerts.
  submitNotifiedAt: timestamp("submit_notified_at"),
  // Set the first time the parent is notified that an eligibility decision
  // has been recorded. Same idempotency contract.
  decisionNotifiedAt: timestamp("decision_notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const learnerFunctioningLevels = pgTable("learner_functioning_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  level: functioningLevelEnum("level").notNull(),
  determinedBy: varchar("determined_by", { length: 50 }).notNull(),
  parentSignals: jsonb("parent_signals").default({}),
  iepSignals: jsonb("iep_signals").default({}),
  confidence: integer("confidence").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transitionPlans = pgTable("transition_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  vocationalInterests: jsonb("vocational_interests").default([]),
  vocationalAptitude: jsonb("vocational_aptitude").default({}),
  independentLiving: jsonb("independent_living").default({}),
  communityParticipation: jsonb("community_participation").default({}),
  selfAdvocacy: jsonb("self_advocacy").default({}),
  postSecondaryPlanning: jsonb("post_secondary_planning").default({}),
  annualGoals: jsonb("annual_goals").default([]),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  startAge: integer("start_age"),
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const languageProfiles = pgTable("language_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  primaryLanguage: varchar("primary_language", { length: 50 }).notNull(),
  secondaryLanguages: jsonb("secondary_languages").default([]),
  dominanceByDomain: jsonb("dominance_by_domain").default({}),
  processingSpeed: jsonb("processing_speed").default({}),
  codeSwitchingFrequency: real("code_switching_frequency"),
  preferredInstructionLanguage: varchar("preferred_instruction_language", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Phase C: IEP team collaboration & e-signatures.
export const iepTeamMembers = pgTable("iep_team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 30 }).notNull(),
  addedBy: uuid("added_by").references(() => users.id).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => ({
  unique: uniqueIndex("iep_team_members_profile_user_role_uidx")
    .on(t.iepProfileId, t.userId, t.role),
}));

export const iepComments = pgTable("iep_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  section: varchar("section", { length: 30 }).notNull(),
  goalId: uuid("goal_id"),
  authorId: uuid("author_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  mentions: jsonb("mentions").default([]),
  parentCommentId: uuid("parent_comment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const iepRevisions = pgTable("iep_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  section: varchar("section", { length: 30 }).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  authorId: uuid("author_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Phase D: parent sharing & ongoing IEP communication.
// Progress notes are short updates from teachers/therapists scoped to a goal
// or section, with a visibility flag so internal-team chatter stays away from
// parents. Reports are quarterly summaries that move through draft → sent.
// Amendments propose post-finalisation changes parents must acknowledge.
// Preferences gate parent notifications per category. ReviewReminders give
// the cron job an idempotency key per (profile, threshold).
export const iepProgressNotes = pgTable("iep_progress_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  goalId: uuid("goal_id"),
  authorId: uuid("author_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  // 'parent' visible to family in the timeline; 'team' restricted to IEP
  // team members; 'internal' for case-manager private working notes.
  visibility: varchar("visibility", { length: 20 }).default("parent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const iepProgressReports = pgTable("iep_progress_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  period: varchar("period", { length: 30 }).notNull(),
  narrative: text("narrative"),
  aiSummary: jsonb("ai_summary"),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  sentBy: uuid("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iepAmendments = pgTable("iep_amendments", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  summary: text("summary").notNull(),
  proposedChanges: jsonb("proposed_changes").default({}).notNull(),
  // proposed → acknowledged → merged, or proposed → objected.
  status: varchar("status", { length: 20 }).default("proposed").notNull(),
  proposedBy: uuid("proposed_by").references(() => users.id).notNull(),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  parentResponse: text("parent_response"),
  revisionCounter: integer("revision_counter").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parentNotificationPreferences = pgTable("parent_notification_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id").references(() => users.id).notNull(),
  // Per-category prefs: { progress_notes: {email,inApp}, reports:..., amendments:..., reminders:... }
  // Defaults are opt-in for legally significant items (reports, amendments,
  // reminders); parents can mute progress_notes only.
  prefs: jsonb("prefs").default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  unique: uniqueIndex("parent_notification_preferences_parent_uidx").on(t.parentId),
}));

// In-app notifications for parents. Created alongside (or instead of)
// emails when a parent has `inApp: true` for the relevant category in
// their notification preferences. Read by the parent dashboard to show
// an unread badge; marked-read when the parent opens the Updates tab.
export const parentInAppNotifications = pgTable("parent_in_app_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id").references(() => users.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id),
  // One of the keys in DEFAULT_PREFS in iep-updates.ts
  // (progress_notes | reports | amendments | reminders).
  category: varchar("category", { length: 30 }).notNull(),
  // The same template id we use for emails so renderers/observability stay aligned.
  template: varchar("template", { length: 60 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 1024 }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const iepReviewReminders = pgTable("iep_review_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  // Days-out threshold the reminder is for: 90, 60, 30.
  threshold: integer("threshold").notNull(),
  reviewDate: timestamp("review_date").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (t) => ({
  unique: uniqueIndex("iep_review_reminders_profile_threshold_uidx")
    .on(t.iepProfileId, t.threshold),
}));

// Phase D — Parent share links for finalised IEPs.
// Parents sometimes need to share the finalised IEP with someone outside
// the AIVO platform (a private tutor, a non-custodial parent who isn't on
// the team, an outside therapist). A signed share token gives that
// recipient a read-only parent-summary view of the IEP without granting
// them an account in the system.
//
// Tokens are scoped to the IEP profile, expire (default 14 days), and
// store the issuer + revocation flag so the case manager / parent can
// kill access if a recipient should no longer have the link. The token
// itself is hashed before storage so leaking the table doesn't leak the
// shareable URL.
export const iepParentShareLinks = pgTable("iep_parent_share_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id")
    .references(() => iepProfiles.id, { onDelete: "cascade" }).notNull(),
  // Sha-256 of the random token. The plaintext token is shown to the
  // issuer once at creation time and never persisted server-side.
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  // Optional human label so the parent can recognise which link they're
  // revoking ("Tutor — Mrs. Reyes"). Free-form, not used for auth.
  label: varchar("label", { length: 120 }),
  issuedByUserId: uuid("issued_by_user_id").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  // Last successful redemption — surfaced in the issuer's UI so parents
  // can tell whether anyone has actually opened the link.
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueTokenHash: uniqueIndex("iep_parent_share_links_token_hash_uidx").on(t.tokenHash),
}));

export const iepSignatures = pgTable("iep_signatures", {
  id: uuid("id").defaultRandom().primaryKey(),
  iepProfileId: uuid("iep_profile_id").references(() => iepProfiles.id).notNull(),
  signerUserId: uuid("signer_user_id").references(() => users.id).notNull(),
  signerRole: varchar("signer_role", { length: 30 }).notNull(),
  typedName: varchar("typed_name", { length: 255 }).notNull(),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipHash: varchar("ip_hash", { length: 64 }),
  status: varchar("status", { length: 20 }).default("signed").notNull(),
}, (t) => ({
  // One active signature per (profile, user, role) — guards against duplicate
  // signs racing past the in-app idempotency check.
  unique: uniqueIndex("iep_signatures_profile_user_role_uidx")
    .on(t.iepProfileId, t.signerUserId, t.signerRole),
}));


/**
 * Learner special-interest signals — caregiver intake, IEP signals, self-
 * report, passive engagement, and system inference. Strategic backdrop:
 * autistic kids often have deep, focused interests (Minecraft, trains,
 * dinosaurs, weather). Treating these as the engine instead of a
 * distraction is a category-shifting move; the agent generates math
 * word problems set in Minecraft, reading passages about volcanoes,
 * etc. The schema here matches `LearnerInterestSignal` in
 * `@aivo/special-interest-engine` so the engine can score directly.
 */
export const learnerInterestSignals = pgTable("learner_interest_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id, { onDelete: "cascade" }).notNull(),
  /** Slug from the engine's catalog (e.g. "minecraft", "dinosaurs"). */
  slug: varchar("slug", { length: 64 }).notNull(),
  /** caregiver_intake | iep_signal | self_report | engagement | system. */
  source: varchar("source", { length: 32 }).notNull(),
  /** +1 = like / -1 = avoid. */
  polarity: integer("polarity").notNull(),
  /** 0…1 confidence in the signal. */
  confidence: real("confidence").notNull().default(1),
  observedAt: timestamp("observed_at").defaultNow().notNull(),
  /** Optional free-text note (e.g. "talks about minecraft for hours"). */
  note: text("note"),
  /** Optional caregiver/clinician/system actor that supplied the signal. */
  recordedBy: uuid("recorded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Executive-function partner: persisted task breakdowns. Each row is a
 * weighted micro-step plan (read → restate → do → check) emitted by
 * `@aivo/executive-function::breakDownTask`. ADHD is fundamentally an
 * EF challenge; the agent quietly carries the planning load that
 * crushes ADHD kids.
 */
export const efTaskBreakdowns = pgTable("ef_task_breakdowns", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id, { onDelete: "cascade" }).notNull(),
  /** Free-form id of the parent task (lesson id, homework id, etc.). */
  taskId: varchar("task_id", { length: 128 }).notNull(),
  /** Human-readable task title. */
  title: varchar("title", { length: 255 }).notNull(),
  /** Sum of step weights (computed at write time for fast reads). */
  totalWeight: integer("total_weight").notNull(),
  /** Ordered MicroStep[] from the EF package. */
  steps: jsonb("steps").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Per-step completion record. Append-only — completion timestamps
 * carry the data the parent dashboard's "what's working" panel needs
 * (which steps clicked vs. which tripped the learner).
 */
export const efTaskStepProgress = pgTable("ef_task_step_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  breakdownId: uuid("breakdown_id").references(() => efTaskBreakdowns.id, { onDelete: "cascade" }).notNull(),
  stepId: varchar("step_id", { length: 64 }).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  /** Optional ms the learner spent on this step before completing. */
  dwellMs: integer("dwell_ms"),
});

/**
 * Time-of-day session outcome ledger. Powers `TimeOfDayMemory` — the
 * agent remembers what worked yesterday morning vs. afternoon — and
 * also feeds the parent-dashboard "what's working" view directly. The
 * row carries everything the EF + analytics modules need without
 * either having to crawl the full session log.
 */
export const efSessionOutcomes = pgTable("ef_session_outcomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id, { onDelete: "cascade" }).notNull(),
  /** Wall-clock start of the session (TZ-aware ISO from the host). */
  startedAt: timestamp("started_at").notNull(),
  /** "early-morning" | "morning" | "midday" | "afternoon" | "evening". */
  timeOfDay: varchar("time_of_day", { length: 16 }).notNull(),
  subject: varchar("subject", { length: 64 }),
  modality: varchar("modality", { length: 16 }),
  /** 0…1 accuracy in the session. */
  accuracy: real("accuracy").notNull(),
  /** 0…1 frustration rate in the session. */
  frustrationRate: real("frustration_rate").notNull().default(0),
  /** Minutes the learner sustained engagement before disengaging. */
  attentionMinutes: integer("attention_minutes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
