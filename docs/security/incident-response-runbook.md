# Incident Response Runbook

Sprint 16. Owners: Security on-call, SRE on-call, Engineering Lead.
This is the operational sibling of `docs/security/incident-response.md`
(which is a higher-level policy summary).

## 0. Purpose

Provide a step-by-step procedure for AIVO on-call to detect, classify,
contain, eradicate, recover from, and learn from a security incident.
This runbook satisfies SOC 2 CC7.3 / CC7.4 and is referenced from
`docs/security/soc2-control-matrix.md`.

## 1. Detection

Incidents are detected through one or more of:

| Channel                  | Source                                                       | Owner             |
| ------------------------ | ------------------------------------------------------------ | ----------------- |
| PagerDuty alert          | Sprint 14 `services/alerts-proxy-svc/` dispatch              | Security on-call  |
| Grafana alert            | Sprint 12-Finish dashboards / alert rules                    | SRE on-call       |
| Customer-reported        | `security@aivo.dev`, status-page Contact, district admin     | Support → on-call |
| Internal report          | Slack `#sec-incidents`, internal staff                       | Security on-call  |
| Vendor notice            | Vendor security email; sub-processor breach notification     | Security lead     |
| Audit log anomaly        | `packages/security/src/audit-chain.ts` hash chain mismatch   | Security on-call  |

On-call MUST acknowledge any of the above within **15 minutes** during
business hours, **30 minutes** otherwise.

## 2. Severity classification

Pick the highest matching severity. When in doubt, escalate up.

| Severity | Criteria                                                                                                                | Initial response SLA |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------- |
| SEV0     | Confirmed data exfiltration of learner/teacher PII OR full production outage > 30 min OR ransomware                     | 15 min, full team    |
| SEV1     | Suspected data exfiltration OR auth bypass OR widespread service degradation (> 25% of traffic erroring)                | 30 min, IR team      |
| SEV2     | Single-tenant compromise OR single-service outage OR sensitive misconfiguration (e.g. role leakage) without confirmed exposure | 1 h, on-call         |
| SEV3     | Suspicious activity needing investigation; non-public CVE in third-party dependency without active exploitation         | Next business day    |

Promotion rules:
- New evidence of data exfiltration → bump to SEV0
- Vendor confirms sub-processor breach affecting our data → at least SEV1
- Counsel determines regulator notification likely → at least SEV1

## 3. Initial response

1. **Acknowledge** the page (PagerDuty / Slack thread). Reply
   `ACK <handle> on call` in `#sec-incidents`.
2. **Triage** — gather initial scope: which service? which tenants?
   when did it start? evidence available?
3. **Declare** — use the `/incident declare <sev>` Slack workflow
   (or post `INCIDENT-<YYYYMMDD-N> SEV<n>: <one-line summary>`).
4. **War room** — open Zoom bridge listed in PagerDuty runbook URL;
   pin to `#sec-incidents` thread.
5. **Assign roles**:
   - Incident Commander (IC) — drives the response, escalates, decides.
   - Communications Lead — internal + external comms.
   - Operations Lead — executes containment/recovery commands.
   - Scribe — keeps the timeline ledger (next section).
6. **Open timeline** — fresh doc under `docs/runbooks/post-mortems/INC-<id>.md`
   (create the dir if needed). Every command, observation, and
   decision is timestamped.

## 4. Communications

| Audience          | Channel                                | SEV0 timing            | SEV1            | SEV2            |
| ----------------- | -------------------------------------- | ---------------------- | --------------- | --------------- |
| Internal eng      | Slack `#sec-incidents`                 | T+0                    | T+0             | T+0             |
| Internal exec     | Slack `#exec-incidents`                | T+15 min               | T+1 h           | Daily digest    |
| Customer (public) | Status page (`services/status-page-svc`) | T+30 min               | T+1 h           | Optional        |
| Customer (direct) | Email to district admins               | T+1 h                  | T+4 h           | Post-resolution |
| Regulators        | Per `breach-notification-runbook.md`   | Within statutory timer | Per timer       | Usually n/a     |
| Press             | Comms team only, never engineering     | At exec discretion     | At exec disc.   | n/a             |

Templates: see `breach-notification-runbook.md` § Templates.

## 5. Containment / Eradication / Recovery

### 5.1 Credential leak (API key, JWT signing key, service password)

**Contain:**
1. Rotate the credential immediately via `packages/security/src/secrets-client.ts`
   (`secretsClient.rotate(name)`).
2. Revoke any issued tokens — for JWT signing keys this means
   bumping `JWT_KEY_GENERATION` env to force a re-key on next boot.
3. Block the offending IP at edge (Cloudflare) if applicable.

**Eradicate:**
1. Search git history + secret-scan workflow output for additional
   exposures: `gh workflow run secret-scan.yml`.
2. Audit access logs for the rotated credential's last 7 days of use.
3. Force re-authentication for all sessions:
   `services/identity-svc` admin endpoint `POST /api/admin/sessions/revoke-all`.

**Recover:**
1. Confirm new credential issued and propagated.
2. Confirm no further auth failures in logs.
3. Notify dependent services that may have cached the old credential.

### 5.2 Prompt injection succeeded (AI provider tricked into unsafe output)

**Contain:**
1. Toggle `AI_PROVIDER=safety-fallback` via `services/ai-svc` config
   reload — every generation goes through the validated fallback.
2. Pull the offending prompt+response into a quarantine table
   `quarantined_ai_outputs` for analysis.

**Eradicate:**
1. Update `packages/ai-validation/` policy to detect the bypass pattern.
2. Add a regression test under `packages/ai-validation/tests/`.
3. Re-enable normal provider.

**Recover:** monitor `ai_output_blocked` audit events for 24 h.

### 5.3 Data exfiltration suspected

**Contain:**
1. Rotate ALL credentials for affected services (see 5.1).
2. Block the suspected exfiltration egress at edge.
3. Snapshot DB + object storage for forensics (`scripts/dr/backup-restore-drill.sh --target staging-shadow`
   produces a read-only forensic image).
4. Disable any compromised user accounts via
   `POST /api/admin/users/:id/disable` (requires step-up auth).

**Eradicate:**
1. Patch the vulnerability that allowed exfiltration.
2. Reissue any leaked secrets to affected customers.
3. Engage external forensics if SEV0 (engagement contact in offline
   runbook).

**Recover:**
1. Restore from PITR if data tampered (see `docs/deploy/dr-runbook.md`).
2. Replay audit chain to detect tampered events.
3. Trigger breach notification per
   `docs/security/breach-notification-runbook.md`.

### 5.4 Ransomware

**Contain:**
1. Isolate affected nodes — k8s `kubectl cordon` + `drain`.
2. Disable outbound egress at edge for the affected namespace.
3. Snapshot encrypted disks BEFORE restoring (forensics).

**Eradicate:**
1. Rebuild from clean container images (CI artifacts are immutable
   per `docker/` image policy).
2. Restore PostgreSQL from PITR (RPO < 5 min).
3. Verify integrity of object storage via SHA-256 manifest in
   `scripts/dr/results/*.json`.

**Recover:**
1. Bring services up one tenant at a time, validating audit chain.
2. Customer comms: status page + direct email per SEV0 timing.
3. Mandatory regulator + law enforcement notification (FBI IC3,
   state AGs).

### 5.5 Vendor breach

**Contain:**
1. Identify which AIVO data the vendor processed
   (`services/data-governance-svc/src/services/dpa-store.ts` →
   `dpa_subprocessors` table).
2. Rotate any shared secrets / API keys with that vendor.
3. Pause integrations: feature-flag the vendor off via the
   integration health switch.

**Eradicate:**
1. Demand vendor's incident report; review their containment.
2. Evaluate alternative vendor; document in `docs/dpa-management.md`.

**Recover:**
1. Notify customers per
   `docs/security/breach-notification-runbook.md` § Sub-processor.
2. Update DPA store with breach record.

## 6. Post-mortem

Within **5 business days** of resolution, the IC publishes a
post-mortem under `docs/runbooks/post-mortems/INC-<id>.md`.

### Template

```markdown
# INC-<YYYYMMDD-N>: <short title>

- Severity: SEV<n>
- Detected at (UTC): <ts>
- Resolved at (UTC): <ts>
- Duration: <hh:mm>
- IC: <name>
- Authors: <names>

## Summary
One paragraph describing what happened in plain language.

## Impact
- Customers affected: <count or list>
- Data affected: <PII? IEP? audit chain?>
- Regulatory notification triggered: yes/no (cite jurisdiction)

## Timeline (UTC)
- T+0:  detection event
- T+5:  acknowledged by <name>
- T+20: containment action <X>
- T+45: root cause confirmed
- T+90: resolved

## Root cause
Single paragraph. Use the 5-Whys.

## What went well
- ...

## What went poorly
- ...

## Action items
| # | Action | Owner | Due | Tracking |
| - | ------ | ----- | --- | -------- |
| 1 | ...    |       |     | LMS-####  |

## Lessons learned
Free-form. What changes to the runbook / monitoring / code does this incident motivate?
```

## 7. Retention

- Post-mortems: indefinite (kept in `docs/runbooks/post-mortems/`).
- Incident artifacts (logs, snapshots): 1 year minimum, longer when
  regulator engagement is open.
- Timeline ledgers: archived to S3 immutable storage at the close of
  each incident.

## 8. Quarterly drill

Once per quarter, IC + Comms Lead + Ops Lead run a tabletop exercise
against one of scenarios 5.1–5.5. Output: a dry-run post-mortem +
runbook delta. Schedule in `docs/security/annual-review-calendar.md`.
