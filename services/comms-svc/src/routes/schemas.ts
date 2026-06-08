/**
 * Per-route Fastify JSON Schema definitions for `comms-svc`.
 * See `services/learning-svc/src/routes/schemas.ts` for the 5.2 reference.
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

// Generic "queued / sent / dev_mode / logged_only / failed" envelope used by
// most send-mail endpoints. Most fields are optional because each handler
// returns a subtly different subset — keeping the response permissive avoids
// blowing up valid responses through Fastify's serializer.
const sendStatusResponse = {
  type: "object",
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    messageId: { type: "string" },
    channel: { type: "string" },
    template: { type: "string" },
    recipient: { type: "string" },
    to: { type: "string" },
    subject: { type: "string" },
    queuedAt: { type: "string", format: "date-time" },
    code: { type: "string" },
  },
} as const;

// ── /api/comms/send + /api/comms/email* + /api/comms/push ───────────────────

export const sendNotificationSchema = {
  tags: ["Comms"],
  operationId: "sendNotification",
  summary: "Send a notification through a channel + template",
  body: {
    type: "object",
    required: ["channel", "recipient", "template"],
    additionalProperties: true,
    properties: {
      channel: { type: "string" },
      recipient: { type: "string" },
      template: { type: "string" },
      data: passthroughObject,
    },
  },
  response: {
    200: sendStatusResponse,
    400: errorResponse,
    401: errorResponse,
    500: errorResponse,
    503: errorResponse,
  },
} as const;

export const sendEmailSchema = {
  tags: ["Comms"],
  operationId: "sendEmail",
  summary: "Send a single transactional email (template optional)",
  body: {
    type: "object",
    required: ["to"],
    additionalProperties: true,
    properties: {
      to: { type: "string" },
      subject: { type: "string" },
      template: { type: "string" },
      data: passthroughObject,
      htmlBody: { type: "string" },
      textBody: { type: "string" },
    },
  },
  response: {
    200: sendStatusResponse,
    400: errorResponse,
    401: errorResponse,
    500: errorResponse,
    503: errorResponse,
  },
} as const;

export const sendBatchEmailSchema = {
  tags: ["Comms"],
  operationId: "sendBatchEmail",
  summary: "Send up to 500 emails in one batch (admin only)",
  body: {
    type: "object",
    required: ["emails"],
    additionalProperties: true,
    properties: {
      emails: {
        type: "array",
        maxItems: 500,
        items: passthroughObject,
      },
    },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    500: errorResponse,
    503: errorResponse,
  },
} as const;

export const sendPushSchema = {
  tags: ["Comms"],
  operationId: "sendPush",
  summary: "Queue a push notification (admin only, currently a stub)",
  body: {
    type: "object",
    required: ["userId", "title"],
    additionalProperties: true,
    properties: {
      userId: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      data: passthroughObject,
    },
  },
  response: {
    200: sendStatusResponse,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

// ── device tokens (push) ──────────────────────────────────────────────────

export const registerDeviceSchema = {
  tags: ["Comms"],
  operationId: "registerDevice",
  summary: "Register or refresh the caller's push device token",
  body: {
    type: "object",
    required: ["token", "kind"],
    additionalProperties: false,
    properties: {
      token: { type: "string", minLength: 1 },
      kind: { type: "string", enum: ["fcm", "apns"] },
      platform: { type: "string", enum: ["ios", "android", "web"] },
      topic: { type: "string" },
    },
  },
  response: {
    200: sendStatusResponse,
    400: errorResponse,
    401: errorResponse,
  },
} as const;

export const deleteDeviceSchema = {
  tags: ["Comms"],
  operationId: "deleteDevice",
  summary: "Unregister one of the caller's push device tokens",
  params: {
    type: "object",
    required: ["token"],
    properties: { token: { type: "string" } },
  },
  response: {
    200: sendStatusResponse,
    401: errorResponse,
    404: errorResponse,
  },
} as const;

// ── preferences ─────────────────────────────────────────────────────────────

export const getPreferencesSchema = {
  tags: ["Comms"],
  operationId: "getNotificationPreferences",
  summary: "Get a user's notification preferences",
  params: {
    type: "object",
    required: ["userId"],
    additionalProperties: true,
    properties: { userId: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const updatePreferencesSchema = {
  tags: ["Comms"],
  operationId: "updateNotificationPreferences",
  summary: "Update a user's notification preferences",
  params: {
    type: "object",
    required: ["userId"],
    additionalProperties: true,
    properties: { userId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

// ── templates ───────────────────────────────────────────────────────────────

export const listTemplatesSchema = {
  tags: ["Comms"],
  operationId: "listEmailTemplates",
  summary: "List available rendered email templates",
  response: {
    200: {
      type: "object",
      required: ["templates"],
      additionalProperties: true,
      properties: {
        templates: { type: "array", items: { type: "string" } },
      },
    },
    401: errorResponse,
  },
} as const;

// ── internal endpoints (x-internal-key) ─────────────────────────────────────

const internalSendBody = {
  type: "object",
  additionalProperties: true,
} as const;

function internalSchema(operationId: string, summary: string) {
  return {
    tags: ["Comms-Internal"],
    operationId,
    summary,
    body: internalSendBody,
    response: {
      200: passthroughObject,
      202: passthroughObject,
      400: errorResponse,
      401: errorResponse,
      500: errorResponse,
    },
  } as const;
}

export const internalMfaCodeSchema = internalSchema(
  "internalSendMfaCode",
  "Internal: deliver an MFA code email",
);
export const internalInAppNotifySchema = internalSchema(
  "internalCreateInAppNotification",
  "Internal: create an in-app notification for a parent",
);
export const internalIepNotifySchema = internalSchema(
  "internalSendIepNotification",
  "Internal: send an IEP-related email to a parent or team member",
);
export const internalTeamInviteSchema = internalSchema(
  "internalSendTeamInvite",
  "Internal: send a learning-team invite email",
);
export const internalPasswordResetSchema = internalSchema(
  "internalSendPasswordReset",
  "Internal: send a password-reset email",
);
export const internalDistrictAdminInviteSchema = internalSchema(
  "internalSendDistrictAdminInvite",
  "Internal: send a district-admin invite email",
);
export const internalParentInviteSchema = internalSchema(
  "internalSendParentInvite",
  "Internal: send a parent invite email (into a district tenant)",
);
export const internalTrialEndingSchema = internalSchema(
  "internalSendTrialEnding",
  "Internal: send a trial-ending reminder (email + in-app)",
);
export const internalSchoolAdminInviteSchema = internalSchema(
  "internalSendSchoolAdminInvite",
  "Internal: send a school-admin invite email",
);
export const internalTeacherInviteSchema = internalSchema(
  "internalSendTeacherInvite",
  "Internal: send a teacher invite email",
);
export const internalStaffCredentialsSchema = internalSchema(
  "internalSendStaffCredentials",
  "Internal: send a staff temp-password welcome email",
);
export const internalTeacherInviteParentSchema = internalSchema(
  "internalSendTeacherInviteParent",
  "Internal: send a teacher → parent invitation email",
);
export const internalAdminAlertSchema = internalSchema(
  "internalSendAdminSafetyAlert",
  "Internal: dispatch an admin safety alert email",
);
export const internalSpeechBuddySafetySchema = internalSchema(
  "internalSendSpeechBuddySafetyAlert",
  "Internal: dispatch a Speech Buddy safety alert (no transcript)",
);
export const internalBillingAlertSchema = internalSchema(
  "internalSendBillingAlert",
  "Internal: dispatch a billing alert (e.g. seat-self-service)",
);
export const internalNewsletterConfirmSchema = internalSchema(
  "internalSendNewsletterConfirm",
  "Internal: send a newsletter subscription confirmation email",
);

// ── in-app notifications (parent dashboard) ─────────────────────────────────

export const listInAppNotificationsSchema = {
  tags: ["Comms"],
  operationId: "listInAppNotifications",
  summary: "List the signed-in parent's in-app notifications",
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: {
      unread: { type: "string" },
      learnerId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["items", "unreadCount"],
      additionalProperties: true,
      properties: {
        items: { type: "array", items: passthroughObject },
        unreadCount: { type: "integer" },
      },
    },
    401: errorResponse,
  },
} as const;

export const markInAppNotificationsReadSchema = {
  tags: ["Comms"],
  operationId: "markInAppNotificationsRead",
  summary: "Mark notifications as read (specific ids or all)",
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      ids: { type: "array", items: { type: "string" } },
      all: { type: "boolean" },
      learnerId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "updated"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        updated: { type: "integer" },
      },
    },
    400: errorResponse,
    401: errorResponse,
  },
} as const;

// ── public ──────────────────────────────────────────────────────────────────

export const publicContactSchema = {
  tags: ["Public"],
  operationId: "submitContactForm",
  summary: "Public website contact form",
  body: {
    type: "object",
    required: ["email", "message"],
    additionalProperties: true,
    properties: {
      name: { type: "string", maxLength: 255 },
      email: { type: "string", format: "email", maxLength: 255 },
      message: { type: "string", maxLength: 5000 },
      source: { type: "string", maxLength: 100 },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["success"],
      additionalProperties: true,
      properties: { success: { type: "boolean" } },
    },
    500: errorResponse,
  },
} as const;

export const publicDemoRequestSchema = {
  tags: ["Public"],
  operationId: "submitDemoRequest",
  summary: "Public website demo request form",
  body: {
    type: "object",
    required: ["email", "name"],
    additionalProperties: true,
    properties: {
      name: { type: "string", maxLength: 255 },
      email: { type: "string", format: "email", maxLength: 255 },
      company: { type: "string", maxLength: 255 },
      role: { type: "string", maxLength: 100 },
      schoolSize: { type: "string", maxLength: 50 },
      message: { type: "string", maxLength: 5000 },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["success"],
      additionalProperties: true,
      properties: { success: { type: "boolean" } },
    },
    500: errorResponse,
  },
} as const;

export const publicNewsletterSchema = {
  tags: ["Public"],
  operationId: "submitNewsletterSignup",
  summary: "Public website newsletter signup",
  body: {
    type: "object",
    required: ["email"],
    additionalProperties: true,
    properties: {
      email: { type: "string", format: "email", maxLength: 255 },
      source: { type: "string", maxLength: 100 },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["success"],
      additionalProperties: true,
      properties: { success: { type: "boolean" } },
    },
    500: errorResponse,
  },
} as const;

// ── status + webhooks ───────────────────────────────────────────────────────

export const commsStatusSchema = {
  tags: ["Comms"],
  operationId: "getCommsStatus",
  summary: "Provider connectivity snapshot for comms-svc backends",
  response: {
    200: {
      type: "object",
      additionalProperties: true,
      properties: {
        postmark: { type: "string" },
        push: { type: "string" },
        sms: { type: "string" },
      },
    },
  },
} as const;

export const emailEventsWebhookSchema = {
  tags: ["Comms-Internal"],
  operationId: "receiveEmailProviderWebhook",
  summary: "Email provider webhook (Postmark / Mailgun / SES) — signature-verified",
  response: {
    200: {
      type: "object",
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        event: passthroughObject,
      },
    },
    202: {
      type: "object",
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        ignored: { type: "boolean" },
      },
    },
    400: errorResponse,
    401: errorResponse,
  },
} as const;

// ── health ──────────────────────────────────────────────────────────────────

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

export const healthRootSchema = {
  tags: ["Health"],
  operationId: "commsHealthRoot",
  summary: "Service health probe (root)",
  response: { 200: healthResponseSchema },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "commsHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;
