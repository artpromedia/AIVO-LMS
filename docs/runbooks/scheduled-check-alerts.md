# Scheduled-check Slack alerting

> **TL;DR** Unattended GitHub Actions checks that nobody is watching in
> real time use the `notify-slack-on-failure` composite action to page
> the on-call human in the shared ops/deploys Slack channel when they go
> red, and to announce the first recovery after a failure. Steady-state
> green runs stay silent so we don't get alarm fatigue.

## Why this exists

Several scheduled / push-triggered workflows in this repo protect things
the team would only notice were broken when a customer complains
(custom-domain regressions, restorable backups, schema/migration drift,
leaked secrets, missing locale keys, hard-coded paging URLs in source).
Without a real-time signal these failures sit red in the GitHub Actions
UI for hours or days until somebody happens to look. The pattern below
turns each of those into a real-time Slack page.

## The pattern

The reference implementation is `.github/workflows/marketing-smoke-test.yml`.
The reusable logic now lives in **`.github/actions/notify-slack-on-failure/`**
so the payload-construction logic isn't copy-pasted into every workflow.

The action does three things:

1. **Failure** (`check-status == 'failure'`) → POST a `:rotating_light:`
   alert to `SLACK_WEBHOOK_URL` (the same ops/deploys channel used by
   `health-check.yml` and `mobile-release.yml`). Includes the tail of an
   optional `failure-reason-file` so the on-call human gets the cause
   directly in Slack instead of having to click through to the run.
2. **Recovery** (`check-status == 'success'` AND the previous notify-eligible
   run of the same workflow was a failure) → POST a `:white_check_mark:`
   recovery notice. The previous-run lookup uses `gh run list` with
   `actions: read` and **excludes `pull_request` events**, so a green PR
   run between a red push and a green push doesn't silence the recovery
   ping (PR runs never notify, so they must not affect the recovery
   signal either).
3. **Steady-state success / skipped / cancelled** → stay silent.

The previous-run lookup step uses `continue-on-error: true` so a
transient GitHub API blip can't turn a healthy run into a false outage
page — the failure notification is gated on `check-status`, not on the
lookup's outcome.

If `SLACK_WEBHOOK_URL` is unset (e.g. on a fork or in a fresh clone), the
action logs and exits 0 instead of failing the build.

## Workflows that page Slack on failure

| Workflow                   | Triggers                                                                           | Pages Slack on                                                   |
| -------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `marketing-smoke-test.yml` | `workflow_run` (post-publish) + 30-min schedule + manual                           | All non-PR triggers                                              |
| `db-schema-drift.yml`      | PR + push to `main` (paths-filtered to `packages/db/**`)                           | Push to `main` only — PR failures already block the PR           |
| `paging-url-leaks.yml`     | PR + push to `main`/`develop`                                                      | Push to `main`/`develop` only — PR failures already block the PR |
| `secret-scan.yml`          | PR + push to `main`/`develop`/`master` + weekly Monday 03:00 UTC schedule + manual | Push, schedule, and manual — PR failures already block the PR    |
| `i18n-file-audit.yml`      | PR + push to `main`/`develop` (paths-filtered to locale messages) + manual         | Push and manual — PR failures already block the PR               |
| `backup-verify.yml`        | Monthly schedule (1st of month, 03:00 UTC) + manual                                | Every run (no PR/push triggers exist)                            |
| `health-check.yml`         | Every 5 minutes + manual                                                           | Every non-PR run (no PR triggers exist)                          |

The "PR runs are skipped" decision is consistent across the table:
PR-triggered failures are already visible to the PR author in the merge
queue / branch protection UI and do not need a Slack page. The on-call
problem is failures on `push to main/develop`, on the schedule, and on
manual dispatches that nobody is watching.

## Workflows that intentionally do NOT page Slack

These are the other unattended scheduled / cron-style workflows in
`.github/workflows/`. They are deliberately **not** wired into the
notifier; the reasoning is in each row.

| Workflow                                                                                                                                                                                                                                                                                                                                                                                               | Why it doesn't page                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing-lighthouse.yml`, `marketing-a11y.yml`, `a11y-tests.yml`, `visual-regression.yml`, `zap-baseline.yml`                                                                                                                                                                                                                                                                                        | Quality / perf / a11y / security baselines that produce **reports**, not pass/fail health signals. Their failures are intentionally reviewed in the Actions UI as part of release prep, not paged in real time. |
| `ci.yml`, `migrations.yml`, `e2e-module-gate.yml`, `smoke-tests.yml`, `marketing-deploy*.yml`, `deploy-staging.yml`, `deploy-production.yml`, `deploy-hetzner.yml`, `infra-deploy.yml`, `infra-plan.yml`, `rollback.yml`, `mobile-build.yml`, `mobile-release.yml`, `create-release.yml`, `train-brain.yml`, `load-test.yml`, `i18n-coverage.yml`, `alerts-proxy-deploy-gate.yml`, `security-scan.yml` | All driven by an active human action (PR, push, deploy click, release cut) or only run as part of a deploy. A failure has a person already looking at the screen, so a Slack page would be noise.               |

If you add a new unattended scheduled check, default to wiring it through
the composite action and add a row to the first table above. If you have
a defensible reason to leave it silent, add a row to the second table so
the next person knows it was a deliberate choice and not an oversight.

## Adding the notifier to a new workflow

1. Add `actions: read` to the workflow's `permissions:` block (the
   composite action's previous-run lookup needs it).
2. Capture the failing command's stdout/stderr to a file with `tee` so
   the Slack message can include the cause (see the existing workflows
   for examples — `mkdir -p /tmp/<name>` and `tee /tmp/<name>/output.log`
   is the convention).
3. Add the notifier as the **last** step of the job:

   ```yaml
   - name: Notify Slack on failure / recovery
     if: always() && github.event_name != 'pull_request'
     uses: ./.github/actions/notify-slack-on-failure
     with:
       slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
       github-token: ${{ secrets.GITHUB_TOKEN }}
       check-status: ${{ job.status }}
       check-name: "Human-readable check name"
       workflow-filename: my-workflow.yml
       failure-reason-file: /tmp/myname/output.log # optional
       target: "what was being checked" # optional
   ```

4. Add a row to the first table in this file.

The `if: always() && github.event_name != 'pull_request'` gate is
important — `always()` ensures the notifier still runs when an earlier
step failed, and the event filter keeps PR-triggered failures from
paging the channel.

### Recovery-lookup window

The recovery decision is made by scanning the last `prev-lookup-limit`
completed runs of the same workflow (default **100**). For very chatty
workflows that run on every push (e.g. `paging-url-leaks.yml`), 100
qualifying non-PR runs covers roughly several weeks of activity. If a
sustained outage lasts longer than that, the eventual recovery ping
may be skipped — the failure pings during the outage are unaffected.
For workflows where this matters, pass a larger value:

```yaml
with:
  prev-lookup-limit: "500"
```

For monthly / weekly schedules the default is generous and you can
leave it alone.
