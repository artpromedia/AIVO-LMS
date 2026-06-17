/**
 * Per-route Fastify JSON Schema definitions for `engagement-svc`.
 * See `services/learning-svc/src/routes/schemas.ts` for the 5.2 reference.
 *
 * Response payloads are passthrough objects (`additionalProperties: true`)
 * because handlers return drizzle row shapes that vary across queries.
 * Capturing every column per route would explode the file without
 * meaningfully improving client typing.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

const passthroughObject = {
  type: "object",
  additionalProperties: true,
} as const;

const passthroughArray = {
  type: "array",
  items: passthroughObject,
} as const;

const healthResponseSchema = {
  type: "object",
  required: ["status", "service", "timestamp"],
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "engagementHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

// Second route (/health) needs its own operationId so the OpenAPI spec
// stays valid (operationIds must be unique) and the generated client
// has distinct accessors for the two probe paths.
export const probeHealthSchema = {
  tags: ["Health"],
  operationId: "engagementHealthProbe",
  summary: "Service health probe (root liveness/readiness path)",
  response: { 200: healthResponseSchema },
} as const;

export const challengesCreateSchema = {
  tags: ["Engagement"],
  operationId: "challengesCreate",
  summary: "POST /api/engagement/challenges/create",
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const challengesJoinSchema = {
  tags: ["Engagement"],
  operationId: "challengesJoin",
  summary: "POST /api/engagement/challenges/join",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const challengesByChallengeIdAnswerSchema = {
  tags: ["Engagement"],
  operationId: "challengesByChallengeIdAnswer",
  summary: "POST /api/engagement/challenges/:challengeId/answer",
  params: {
    type: "object",
    required: ["challengeId"],
    additionalProperties: true,
    properties: { challengeId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getChallengesByChallengeIdSchema = {
  tags: ["Engagement"],
  operationId: "getChallengesByChallengeId",
  summary: "GET /api/engagement/challenges/:challengeId",
  params: {
    type: "object",
    required: ["challengeId"],
    additionalProperties: true,
    properties: { challengeId: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getChallengesLearnerByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getChallengesLearnerByLearnerId",
  summary: "GET /api/engagement/challenges/learner/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray },
} as const;

export const lessonPlansCreateSchema = {
  tags: ["Engagement"],
  operationId: "lessonPlansCreate",
  summary: "POST /api/engagement/lesson-plans/create",
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const lessonPlansGenerateSchema = {
  tags: ["Engagement"],
  operationId: "lessonPlansGenerate",
  summary: "POST /api/engagement/lesson-plans/generate",
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getLessonPlansTeacherSchema = {
  tags: ["Engagement"],
  operationId: "getLessonPlansTeacher",
  summary: "GET /api/engagement/lesson-plans/teacher",
  response: { 200: passthroughArray },
} as const;

export const getLessonPlansLearnerByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getLessonPlansLearnerByLearnerId",
  summary: "GET /api/engagement/lesson-plans/learner/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray },
} as const;

export const getLessonPlansByPlanIdSchema = {
  tags: ["Engagement"],
  operationId: "getLessonPlansByPlanId",
  summary: "GET /api/engagement/lesson-plans/:planId",
  params: {
    type: "object",
    required: ["planId"],
    additionalProperties: true,
    properties: { planId: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const updateLessonPlansByPlanIdSchema = {
  tags: ["Engagement"],
  operationId: "updateLessonPlansByPlanId",
  summary: "PUT /api/engagement/lesson-plans/:planId",
  params: {
    type: "object",
    required: ["planId"],
    additionalProperties: true,
    properties: { planId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getQuestsWorldsSchema = {
  tags: ["Engagement"],
  operationId: "getQuestsWorlds",
  summary: "GET /api/engagement/quests/worlds",
  response: { 200: passthroughArray },
} as const;

export const getQuestsWorldBySlugSchema = {
  tags: ["Engagement"],
  operationId: "getQuestsWorldBySlug",
  summary: "GET /api/engagement/quests/worlds/:slug",
  params: {
    type: "object",
    required: ["slug"],
    additionalProperties: true,
    properties: { slug: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getQuestsByWorldKeySchema = {
  tags: ["Engagement"],
  operationId: "getQuestsByWorldKey",
  summary: "GET /api/engagement/quests/:worldKey",
  params: {
    type: "object",
    required: ["worldKey"],
    additionalProperties: true,
    properties: { worldKey: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getQuestsChapterByQuestIdSchema = {
  tags: ["Engagement"],
  operationId: "getQuestsChapterByQuestId",
  summary: "GET /api/engagement/quests/chapter/:questId",
  params: {
    type: "object",
    required: ["questId"],
    additionalProperties: true,
    properties: { questId: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getQuestsProgressByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getQuestsProgressByLearnerId",
  summary: "GET /api/engagement/quests/progress/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray },
} as const;

export const questsStartSchema = {
  tags: ["Engagement"],
  operationId: "questsStart",
  summary: "POST /api/engagement/quests/start",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const questsCompleteSchema = {
  tags: ["Engagement"],
  operationId: "questsComplete",
  summary: "POST /api/engagement/quests/complete",
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const selCheckinSchema = {
  tags: ["Engagement"],
  operationId: "selCheckin",
  summary: "POST /api/engagement/sel/checkin",
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getSelCheckinsByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getSelCheckinsByLearnerId",
  summary: "GET /api/engagement/sel/checkins/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const getSelExercisesByEmotionSchema = {
  tags: ["Engagement"],
  operationId: "getSelExercisesByEmotion",
  summary: "GET /api/engagement/sel/exercises/:emotion",
  params: {
    type: "object",
    required: ["emotion"],
    additionalProperties: true,
    properties: { emotion: { type: "string" } },
  },
  response: { 200: passthroughArray },
} as const;

export const getBreaksCatalogSchema = {
  tags: ["Engagement"],
  operationId: "getBreaksCatalog",
  summary: "GET /api/engagement/breaks/catalog",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughArray },
} as const;

export const breakLogSchema = {
  tags: ["Engagement"],
  operationId: "breakLog",
  summary: "POST /api/engagement/break/log",
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getBreaksByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getBreaksByLearnerId",
  summary: "GET /api/engagement/breaks/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const getShopItemsSchema = {
  tags: ["Engagement"],
  operationId: "getShopItems",
  summary: "GET /api/engagement/shop/items",
  response: { 200: passthroughArray },
} as const;

export const getShopInventoryByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getShopInventoryByLearnerId",
  summary: "GET /api/engagement/shop/inventory/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const shopPurchaseSchema = {
  tags: ["Engagement"],
  operationId: "shopPurchase",
  summary: "POST /api/engagement/shop/purchase",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const shopEquipSchema = {
  tags: ["Engagement"],
  operationId: "shopEquip",
  summary: "POST /api/engagement/shop/equip",
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const siblingsLinkSchema = {
  tags: ["Engagement"],
  operationId: "siblingsLink",
  summary: "POST /api/engagement/siblings/link",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse },
} as const;

export const getSiblingsByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getSiblingsByLearnerId",
  summary: "GET /api/engagement/siblings/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getSiblingsByLearnerIdLeaderboardSchema = {
  tags: ["Engagement"],
  operationId: "getSiblingsByLearnerIdLeaderboard",
  summary: "GET /api/engagement/siblings/:learnerId/leaderboard",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const deleteSiblingsUnlinkSchema = {
  tags: ["Engagement"],
  operationId: "deleteSiblingsUnlink",
  summary: "DELETE /api/engagement/siblings/unlink",
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const xpAwardSchema = {
  tags: ["Engagement"],
  operationId: "xpAward",
  summary: "POST /api/engagement/xp/award",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse },
} as const;

export const getProfileByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getProfileByLearnerId",
  summary: "GET /api/engagement/profile/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const streakUpdateSchema = {
  tags: ["Engagement"],
  operationId: "streakUpdate",
  summary: "POST /api/engagement/streak/update",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const streakFreezeSchema = {
  tags: ["Engagement"],
  operationId: "streakFreeze",
  summary: "POST /api/engagement/streak/freeze",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const badgeAwardSchema = {
  tags: ["Engagement"],
  operationId: "badgeAward",
  summary: "POST /api/engagement/badge/award",
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const getLeaderboardByScopeSchema = {
  tags: ["Engagement"],
  operationId: "getLeaderboardByScope",
  summary: "GET /api/engagement/leaderboard/:scope",
  params: {
    type: "object",
    required: ["scope"],
    additionalProperties: true,
    properties: { scope: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughArray, 400: errorResponse, 403: errorResponse },
} as const;

export const getCurrencyByLearnerIdSchema = {
  tags: ["Engagement"],
  operationId: "getCurrencyByLearnerId",
  summary: "GET /api/engagement/currency/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;
