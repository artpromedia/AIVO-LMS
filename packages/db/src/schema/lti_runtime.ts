import {
  pgTable,
  uuid,
  text,
  timestamp,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Sprint 12.7 — LTI 1.3 runtime tables. Migrated via 0045_lti_13_runtime.sql.
 */

export const ltiPlatforms = pgTable(
  "lti_platforms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    jwksUrl: text("jwks_url").notNull(),
    authTokenUrl: text("auth_token_url").notNull(),
    authLoginUrl: text("auth_login_url").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    issuerClient: uniqueIndex("lti_platforms_issuer_client_idx").on(t.issuer, t.clientId),
  }),
);

export const ltiDeployments = pgTable(
  "lti_deployments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    platformId: uuid("platform_id")
      .notNull()
      .references(() => ltiPlatforms.id, { onDelete: "cascade" }),
    deploymentId: text("deployment_id").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    platformDeployment: uniqueIndex("lti_deployments_unique_idx").on(t.platformId, t.deploymentId),
  }),
);

export const ltiContexts = pgTable(
  "lti_contexts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => ltiDeployments.id, { onDelete: "cascade" }),
    ltiContextId: text("lti_context_id").notNull(),
    label: text("label"),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byDeployment: index("lti_contexts_by_deployment").on(t.deploymentId),
    deploymentContext: uniqueIndex("lti_contexts_unique_idx").on(t.deploymentId, t.ltiContextId),
  }),
);

export const ltiResourceLinks = pgTable(
  "lti_resource_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contextId: uuid("context_id")
      .notNull()
      .references(() => ltiContexts.id, { onDelete: "cascade" }),
    resourceLinkId: text("resource_link_id").notNull(),
    title: text("title"),
    targetLinkUri: text("target_link_uri"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byContext: index("lti_resource_links_by_context").on(t.contextId),
    contextLink: uniqueIndex("lti_resource_links_unique_idx").on(t.contextId, t.resourceLinkId),
  }),
);

export const ltiAgsLineitems = pgTable(
  "lti_ags_lineitems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceLinkId: uuid("resource_link_id")
      .notNull()
      .references(() => ltiResourceLinks.id, { onDelete: "cascade" }),
    lineitemUrl: text("lineitem_url").notNull(),
    label: text("label"),
    scoreMaximum: doublePrecision("score_maximum").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byResource: index("lti_ags_by_resource").on(t.resourceLinkId),
  }),
);
