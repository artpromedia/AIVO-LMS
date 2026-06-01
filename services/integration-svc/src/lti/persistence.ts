import { and, eq } from "drizzle-orm";
import {
  ltiPlatforms,
  ltiDeployments,
  ltiContexts,
  ltiResourceLinks,
  ltiAgsLineitems,
  type Database,
} from "@aivo/db";

/**
 * Sprint 1 (production readiness) — LTI 1.3 runtime persistence.
 *
 * Closes the migration-0045 gap: the launch route now writes the launch
 * structure into lti_contexts / lti_resource_links / lti_ags_lineitems so
 * resource-link reuse and AGS score write-back work across launches.
 *
 * All upserts are idempotent (keyed on the platform's natural LTI
 * identifiers) so a repeat launch of the same context/link reuses the
 * existing rows instead of duplicating them.
 */

export type LtiDb = Database;

/** Raised when a launch arrives for a platform AIVO is not registered against. */
export class UnregisteredPlatformError extends Error {
  constructor(issuer: string, clientId: string) {
    super(`LTI platform not registered: issuer=${issuer} client_id=${clientId}`);
    this.name = "UnregisteredPlatformError";
  }
}

export interface LaunchPersistInput {
  issuer: string;
  /** The `aud` of the id_token — the OAuth client_id AIVO was issued. */
  clientId: string;
  deploymentId: string;
  context?: { id?: string; label?: string; title?: string };
  resourceLink?: { id?: string; title?: string };
  targetLinkUri?: string;
}

export interface LaunchPersistResult {
  platformId: string;
  deploymentRowId: string;
  contextRowId: string | null;
  resourceLinkRowId: string | null;
}

/**
 * Resolve the registered platform, then upsert deployment → context →
 * resource-link. Throws {@link UnregisteredPlatformError} when the
 * (issuer, client_id) pair has no lti_platforms row.
 */
export async function persistLaunch(
  db: LtiDb,
  input: LaunchPersistInput,
): Promise<LaunchPersistResult> {
  const [platform] = await db
    .select({ id: ltiPlatforms.id })
    .from(ltiPlatforms)
    .where(and(eq(ltiPlatforms.issuer, input.issuer), eq(ltiPlatforms.clientId, input.clientId)))
    .limit(1);
  if (!platform) {
    throw new UnregisteredPlatformError(input.issuer, input.clientId);
  }

  const [deployment] = await db
    .insert(ltiDeployments)
    .values({ platformId: platform.id, deploymentId: input.deploymentId })
    .onConflictDoUpdate({
      target: [ltiDeployments.platformId, ltiDeployments.deploymentId],
      // No-op-style update so the row is always returned even on conflict.
      set: { deploymentId: input.deploymentId },
    })
    .returning({ id: ltiDeployments.id });

  let contextRowId: string | null = null;
  if (input.context?.id) {
    const [ctx] = await db
      .insert(ltiContexts)
      .values({
        deploymentId: deployment.id,
        ltiContextId: input.context.id,
        label: input.context.label ?? null,
        title: input.context.title ?? null,
      })
      .onConflictDoUpdate({
        target: [ltiContexts.deploymentId, ltiContexts.ltiContextId],
        set: { label: input.context.label ?? null, title: input.context.title ?? null },
      })
      .returning({ id: ltiContexts.id });
    contextRowId = ctx.id;
  }

  // A resource link belongs to a context (context_id is NOT NULL), so we can
  // only persist it when the launch carried a context.
  let resourceLinkRowId: string | null = null;
  if (contextRowId && input.resourceLink?.id) {
    const [link] = await db
      .insert(ltiResourceLinks)
      .values({
        contextId: contextRowId,
        resourceLinkId: input.resourceLink.id,
        title: input.resourceLink.title ?? null,
        targetLinkUri: input.targetLinkUri ?? null,
      })
      .onConflictDoUpdate({
        target: [ltiResourceLinks.contextId, ltiResourceLinks.resourceLinkId],
        set: {
          title: input.resourceLink.title ?? null,
          targetLinkUri: input.targetLinkUri ?? null,
        },
      })
      .returning({ id: ltiResourceLinks.id });
    resourceLinkRowId = link.id;
  }

  return {
    platformId: platform.id,
    deploymentRowId: deployment.id,
    contextRowId,
    resourceLinkRowId,
  };
}

/**
 * Record (or refresh) an AGS line item under a resource link. There is no
 * unique constraint on lti_ags_lineitems, so we de-dup on
 * (resource_link_id, lineitem_url) by hand. Returns the row id.
 *
 * Called from the score write-back path, where the maximum score is known.
 */
export async function upsertAgsLineitem(
  db: LtiDb,
  input: { resourceLinkRowId: string; lineitemUrl: string; scoreMaximum: number; label?: string },
): Promise<string> {
  const [existing] = await db
    .select({ id: ltiAgsLineitems.id })
    .from(ltiAgsLineitems)
    .where(
      and(
        eq(ltiAgsLineitems.resourceLinkId, input.resourceLinkRowId),
        eq(ltiAgsLineitems.lineitemUrl, input.lineitemUrl),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(ltiAgsLineitems)
      .set({ scoreMaximum: input.scoreMaximum, label: input.label ?? null })
      .where(eq(ltiAgsLineitems.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(ltiAgsLineitems)
    .values({
      resourceLinkId: input.resourceLinkRowId,
      lineitemUrl: input.lineitemUrl,
      scoreMaximum: input.scoreMaximum,
      label: input.label ?? null,
    })
    .returning({ id: ltiAgsLineitems.id });
  return inserted.id;
}
