# Runbook — Audit Incident Response

How to investigate a suspected breach or audit-integrity alert. See ADR 0032
for the architecture.

## 0. Triage

- **Source:** chain-verification alert (`/events/verify` reported a break),
  an anchor mismatch, or a human report (suspicious admin action).
- **Severity:** any confirmed chain break or anchor mismatch is **SEV-1**
  (possible tampering) — page the platform on-call + security lead.
- **Preserve evidence first.** Do not run migrations, restores, or
  partition maintenance on `audit_events` until evidence is captured.

## 1. Verify the chain

```
GET /events/verify        # audit-svc; { intact: false, break: {...} } on tamper
```

- `reason: "hash-mismatch"` → a row's payload was altered in place.
- `reason: "prev-hash-mismatch"` → a row was inserted, deleted, or
  reordered. The `id`/`index` localizes the first break.

Cross-check against the external anchor: pull the latest `audit_anchors`
row and compare `head_hash` + `event_count` to the WORM/object-lock copy.
If the table verifies internally but disagrees with the WORM anchor, the
whole table was rewritten — treat the DB as compromised.

## 2. Scope the blast radius

Around the break window, query the feed (platform scope) to bound what was
touched:

```
GET /events?from=<T-1h>&to=<T+1h>
GET /events?actorId=<suspect>            # all actions by an actor
GET /events?action=identity.idp.update  # sensitive config changes
GET /events?q=<entityId>                 # free-text on details
```

Export the window for offline analysis (constant-memory stream):

```
GET /export?format=ndjson&from=...&to=...
```

## 3. Identify the actor & method

For each suspect event use the detail/proof view (`GET /events/:id`):

- `actor.id`, `actor.role`, `actor.ip`, `actor.ua`, `request_id` — pivot on
  `request_id` to correlate with service logs and the reverse proxy.
- `outcome: "failure"` clusters often precede a successful breach (probing).
- Compare the recomputed hash to the stored hash to confirm whether _this_
  row was the tampered one or a downstream victim of a reorder.

## 4. Contain

- Revoke the suspect actor's sessions + rotate their credentials
  (identity-svc); if a service token, rotate it and the relevant secrets.
- If SIS/IdP config was altered, disable the connector/IdP and restore the
  intended config from the last known-good audit event's `details`.
- If the DB itself is suspect, fail over to a read replica taken **before**
  the break window and freeze writes pending forensics.

## 5. Restore integrity

- The hot table is append-only; never "fix" hashes in place. Restore from a
  backup predating the break, then **replay** legitimate events captured
  after that point from service logs / the WORM export.
- After restore, re-run `/events/verify` and re-anchor.

## 6. Evidence package (SOC 2 / FERPA)

Collect: the `verify` output + break locator, the WORM anchor vs table
comparison, the exported window (ndjson), correlated proxy/service logs by
`request_id`, and a timeline. Retain per the tenant's
`audit_retention_policy` (≥ FERPA 7y). File the post-incident review and
link it from the security register.

## Notes

- Producers emit best-effort (a failed emit never blocks a user action), so
  a gap in the feed is not by itself tampering — corroborate with the chain
  and anchors before declaring an incident.
- Hash-chain proof is visible to platform + district admins only; school
  admins see events but not the proof (RBAC, ADR 0032).
