# Runbook — Admin Break-Glass Access

**Audience:** Platform on-call · **Severity:** P1 · **Last reviewed:** Sprint 11

Use this runbook when *every* PLATFORM_ADMIN account is locked out
(MFA hardware lost, SSO IdP outage, mass credential reset) and an
incident requires immediate platform-admin action.

## Pre-conditions

- You are listed in the `BREAK_GLASS_RESPONDERS` group in 1Password.
- An incident bridge exists (Statuspage incident or Slack `#oncall-active`).
- A second responder is on the bridge to witness — break-glass is a
  two-person procedure.

## Procedure

1. **Open the bridge.** Both responders must be on the call. Announce
   "Beginning admin break-glass procedure for AIVO" and state your
   names.

2. **Retrieve the sealed credential.** From 1Password, open the
   `AIVO · Break-Glass · Platform Admin` item. The witness reads the
   timestamp on the seal aloud; the operator unseals.

3. **Disable normal MFA enforcement for the break-glass account.**
   Run from the production bastion:

   ```bash
   psql "$DATABASE_URL" <<'SQL'
   UPDATE users
      SET mfa_required_at = NULL,
          mfa_locked_until = NULL,
          mfa_failed_attempts = 0
    WHERE email = 'breakglass@aivolearning.com';
   SQL
   ```

4. **Login.** Use the unsealed password at `https://admin.aivolearning.com/login`.
   The IP allow-list permits the bastion egress IP only — no other
   network can reach this account.

5. **Take the minimum action.** Resolve only the immediate incident
   (e.g. unlock another admin's MFA, disable a runaway feature flag).
   Every action you take is logged to `admin_audit_log` and counted as
   a SOC 2 finding if not justified.

6. **Re-seal.** Once the incident is resolved:

   - Rotate the break-glass password (1Password generates + reseals).
   - Re-enable MFA on the break-glass account:

     ```bash
     psql "$DATABASE_URL" <<'SQL'
     UPDATE users
        SET mfa_required_at = now()
      WHERE email = 'breakglass@aivolearning.com';
     SQL
     ```

   - Both responders sign off the incident write-up. The next nightly
     SOC 2 evidence bundle (`/dashboard/admin/compliance/evidence`)
     captures the audit trail for auditors.

## After-action

- File a postmortem within 24h.
- The `EVIDENCE_GENERATED` audit row produced after step 6 is the
  control evidence — link it from the postmortem.
- Run `pnpm --filter @aivo/admin-svc test:audit-chain` to confirm the
  audit chain remained intact across the incident window.

## Failure modes

- **Bastion unreachable.** Use the secondary bastion in `us-west-2`.
  If both are down, page #infra-platform-leads.
- **`mfa_required_at` cannot be cleared.** The append-only trigger on
  `users` does not block this column — if it errors, the database is
  in a degraded state; escalate to a P0.
