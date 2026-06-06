import { createCounter, createLogger } from "@aivo/observability";

const logger = createLogger("identity-svc.district-onboarding");

const invitesCreated = createCounter("identity_district_invites_created_total", ["source"]);
const invitesAccepted = createCounter("identity_district_invites_accepted_total", ["role"]);
const invitesRevoked = createCounter("identity_district_invites_revoked_total", ["source"]);

export function recordDistrictInviteCreated(input: {
  inviteId: string;
  tenantId: string;
  source: "platform" | "district";
}) {
  invitesCreated.increment(1, { source: input.source });
  logger.info("district invite created", input);
}

export function recordDistrictInviteAccepted(input: {
  inviteId: string;
  tenantId: string;
  role: string;
}) {
  invitesAccepted.increment(1, { role: input.role });
  logger.info("district invite accepted", input);
}

export function recordDistrictInviteRevoked(input: {
  inviteId: string;
  tenantId: string;
  source: "platform" | "district";
}) {
  invitesRevoked.increment(1, { source: input.source });
  logger.info("district invite revoked", input);
}
