# Runbook — SIS Roster Sync

Operational guide for the SIS roster-sync pipeline (`integration-svc`).
See ADR 0031 for the architecture.

## At a glance

- **Schedules:** full sync nightly 02:00 tenant-local; delta every 4 hours;
  manual on demand from the district SIS UI.
- **Status UI:** `/admin/district/sis` (district) and `/admin/platform/sis`
  (platform overview).
- **Safety rails:** soft-delete only; 10% mutation cap (pauses the run);
  dry-run preview.

## Paused runs (mutation cap exceeded)

A run **pauses and writes nothing** when it would mutate more than the
connector's `maxMutationRatio` (default 10%) of the tenant population. This
is the guard against a bad upstream export wiping a roster.

1. Open the connector detail page → the latest run shows `PAUSED` with the
   reason (e.g. "would mutate 240 rows (20%), exceeding the 10% cap").
2. Investigate the cause:
   - Did the SIS roll over the school year (legitimately large delta)?
   - Did the provider return a partial/empty export (outage — see below)?
   - Did the `external_id` scheme change (would look like mass add+remove)?
3. Resolve:
   - **Legitimate large change:** re-run with platform-admin override
     (`overrideCap`) — only a platform admin may approve.
   - **Bad export / id change:** do NOT override. Fix the upstream feed or
     the `sync_mappings`, then re-run a normal sync.
4. Raising the cap permanently: edit the connector config
   (`maxMutationRatio`); record why in the change audit.

## Credential rotation

SIS credentials are stored **KMS envelope-encrypted at rest** and never
appear in logs or the UI (only a masked hint like `client_id ····a1b2`).

1. Obtain new credentials from the district / provider console
   (OneRoster OAuth2 client id+secret, Clever district token, or ClassLink
   client id+secret).
2. Update them via the connector config editor (or the
   `PUT /sync/{tenantId}/config` API). The new secret is re-encrypted on
   write; the old envelope is overwritten.
3. Trigger a **dry-run** to confirm authentication succeeds and the diff
   looks sane before the next scheduled run.
4. Rotation is audited (`sis.connector.update`). If a rotation leaks a
   secret into a log by mistake, treat it as an incident and rotate again.

## Provider outage handling

1. Symptom: runs fail at extract, or reconcile reports `suspectedOutage`
   for one or more entity kinds (incoming payload empty while we have a
   known population).
2. The pipeline **refuses to orphan a whole population** on an empty
   payload, so a transient outage will not soft-delete every user — the
   affected kinds are skipped and flagged for review.
3. Action:
   - Confirm provider status (Clever / ClassLink / vendor status page).
   - Leave the connector enabled; delta retries every 4h. Per-row failures
     retry with exponential backoff (`sync.row`).
   - If the outage is prolonged, pause the schedule from the config editor
     to stop noisy failed runs; re-enable when the provider recovers.
4. After recovery, run a **full** sync (not just delta) so any rows missed
   during the outage are reconciled.

## Stuck / interrupted run (worker crash)

Runs checkpoint progress per batch. A worker killed mid-run resumes from
the last checkpoint on the next pickup — writes are idempotent
(`(provider, external_id)` upserts), so no duplicates are created. If a run
is wedged in `running` with no progress, mark it failed from the platform
overview and re-trigger; the next run diffs against current state and only
applies the remaining delta.

## Escalation

- Roster data integrity / mass-change suspicion → platform admin (cap
  override authority) + the district's data owner.
- Repeated auth failures after rotation → provider support with the
  connector id and the masked credential hint (never the secret).
