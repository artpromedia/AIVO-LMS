# Runbook: Git history rewrite & MinIO credential rotation

> **Owner:** Platform / SecOps
> **Severity precondition:** any commit containing committed credentials,
> internal hostnames, learner PII, or other material that must not remain
> in the public clone — even on stale branches or in tags.
> **Last reviewed:** 2026-05-07

This runbook is the canonical procedure for two related operations that
the Phase 1 enterprise-readiness review identified as deferred:

1. **Rewriting Git history** to expunge committed sensitive content from
   every reachable ref.
2. **Rotating the corresponding MinIO credentials** that were exposed
   while the repository was public.

The two are paired because the threat model assumes that anything
committed to `main` was visible to anyone who cloned the repo before the
rewrite — including any S3/MinIO key referenced in those commits.

## When to run this

- A `gitleaks` / `trufflehog` finding on `main` confirms a _real_ secret
  (not a placeholder, not a fixture value, not an `EXAMPLE_KEY=` line).
- Code review caught a credential that was force-pushed earlier and is
  no longer on the tip of the branch but still reachable via tags or
  fork branches.
- A retired environment's MinIO root credentials were once committed,
  even if they have since been changed in deployed config.

If the only thing in history is an _example_ value, prefer adding it to
`.gitleaks.toml` allowlist instead — see "Decision tree" below.

## Pre-flight (do not skip)

1. **Confirm a real secret.** Open the offending commit and the value.
   - Test it: does it actually authenticate against the MinIO endpoint?
     If yes → proceed. If no → it's a placeholder; allowlist it instead.
2. **Get explicit written approval** from the on-call security lead. A
   history rewrite is a destructive, repo-wide event; it must be logged.
3. **Freeze writes.** Disable branch protection bypass and ask all
   contributors to push outstanding work and stop pushing for the
   maintenance window. Pin the freeze in `#eng-announce`.
4. **Snapshot the repo.** Take a full mirror clone:
   ```bash
   git clone --mirror git@github.com:artpromedia/aivo-ai-learning.git \
     aivo-ai-learning.pre-rewrite.bak
   ```
   Store the tarball with the security team for at least 90 days.
5. **List every consumer** of the leaked MinIO credential. Grep
   deployments, secret managers, runbooks, and Terraform state. You
   will need the list for Phase B.

## Phase A — Rotate MinIO credentials _first_

> Rotate **before** rewriting history. The rewrite is loud; the moment
> the force-push lands, every fork operator and historical clone holder
> will know there was something worth looking at. The credential must
> already be invalid by then.

This repo's MinIO instance lives on Hetzner Server 3 (i7-8700) on the
dedicated 1 TB NVMe (`/data/extra/minio` → `/data/minio`); see
`HETZNER_DEPLOYMENT_GUIDE.md` Phase 9 for the full topology.

1. **Generate a new root key pair** (use a CSPRNG, not the keyboard):
   ```bash
   NEW_ACCESS_KEY=$(openssl rand -hex 12)
   NEW_SECRET_KEY=$(openssl rand -base64 36 | tr -d '/+=' | head -c 40)
   ```
   Record both in the secret manager (1Password / Vault / SSM) under a
   new version; do **not** overwrite the old version yet.
2. **Update the running MinIO** with the new root creds:
   ```bash
   ssh server3
   # Set the new root credentials in the systemd unit / docker-compose
   # env file used by MinIO (do NOT echo to shell history):
   sudo -e /etc/default/minio   # MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
   sudo systemctl restart minio
   mc alias set aivo-prod https://minio.internal "$NEW_ACCESS_KEY" "$NEW_SECRET_KEY"
   mc admin info aivo-prod    # smoke test
   ```
3. **Cut new service-scoped keys** for each downstream consumer
   (admin-svc SOC2 evidence bucket, identity-svc avatar bucket, backup
   mirror, etc.) using `mc admin user svcacct add`. Service accounts
   limit blast radius the next time something leaks.
4. **Roll the keys into Kubernetes / systemd secrets:**
   - `kubectl create secret generic minio-credentials --from-literal=...`
     `--dry-run=client -o yaml | kubectl apply -f -` per namespace.
   - `helm upgrade` each chart that mounts MinIO creds, or restart pods
     so they pick up the rotated secret.
5. **Verify each service** (admin-svc, identity-svc, backup job) can
   read & write to MinIO with the new credentials. Tail logs for
   `SignatureDoesNotMatch` or `InvalidAccessKeyId` for at least 30
   minutes.
6. **Revoke the old credentials** _only after_ all consumers are happy:
   ```bash
   mc admin user remove aivo-prod <OLD_ACCESS_KEY>
   ```
7. **Audit MinIO access logs** for any use of the old key in the last
   30 days that was not from one of our IP ranges. File a SIRT ticket
   for any anomaly.

At this point, even if a fork operator extracts the leaked secret from
the soon-to-be-rewritten history, it authenticates against nothing.

## Phase B — Rewrite Git history

We use [`git-filter-repo`](https://github.com/newren/git-filter-repo)
(NOT `git filter-branch` — it is deprecated and slower by an order of
magnitude). BFG is acceptable for very large blobs but `filter-repo` is
the documented default here.

### B.1 Install the tool

```bash
pip install --user git-filter-repo
git filter-repo --version   # smoke test
```

### B.2 Prepare a fresh mirror clone

Always operate on a **fresh** mirror, never on a working clone:

```bash
git clone --mirror git@github.com:artpromedia/aivo-ai-learning.git \
  aivo-ai-learning.rewrite
cd aivo-ai-learning.rewrite
```

### B.3 Build the redaction list

Create `replacements.txt` with the literal secret(s) to scrub:

```text
literal:OLD_MINIO_ACCESS_KEY==>***REMOVED***
literal:OLD_MINIO_SECRET_KEY==>***REMOVED***
```

For full-file removal (e.g. an `.env` that was committed once), prefer
`--invert-paths --path path/to/leaked.env`.

### B.4 Dry run, then rewrite

```bash
# 1. Dry run with a copy
cp -a . ../rewrite-dry && cd ../rewrite-dry
git filter-repo --replace-text replacements.txt --force
git log --all -S OLD_MINIO_ACCESS_KEY    # MUST return nothing
cd - && rm -rf ../rewrite-dry

# 2. Real run on the mirror
git filter-repo --replace-text replacements.txt --force
```

`git filter-repo` rewrites every commit on every branch and every tag.
Note that **commit SHAs change**, breaking PR / commit links. Capture
an old→new SHA mapping with:

```bash
git filter-repo --replace-text replacements.txt --force \
  --commit-callback "print(commit.original_id.decode(), commit.id_to_be().decode() if hasattr(commit,'id_to_be') else '')" \
  > ../sha-map.txt
```

### B.5 Push the rewrite

```bash
# Re-attach the remote (filter-repo strips it intentionally)
git remote add origin git@github.com:artpromedia/aivo-ai-learning.git
git push --force --mirror origin
```

`--mirror` force-pushes every ref including tags. **There is no undo
once this lands.** This is why the snapshot from Pre-flight step 4 is
non-negotiable.

### B.6 GitHub-side cleanup

GitHub keeps unreferenced commits accessible for ~90 days. Open a
support ticket asking GitHub to expire the old objects and to clear the
`pull/<n>/head` refs that still reference rewritten SHAs. Provide the
secret value (or its prefix) so they can confirm.

While waiting, you can also:

1. **Delete and recreate forks** that the team controls. Forks keep the
   old history independently.
2. **Invalidate cached views** by closing/reopening any open PRs or
   tagging a new release on top of the rewritten `main`.

## Phase C — Local-clone remediation

Every contributor must re-base or re-clone, otherwise their next push
re-introduces the rewritten commits.

### Recommended (clean) path

```bash
cd /your/work/aivo-ai-learning
git fetch --all --prune
git checkout main
git reset --hard origin/main          # or: git rebase origin/main
git for-each-ref --format='%(refname:short)' refs/heads | \
  while read b; do git branch -D "$b" 2>/dev/null; done
```

For long-lived feature branches, `git rebase --onto origin/main
<old-main-sha>` is the safest cherry-pick path.

### Nuclear path

`rm -rf` the local clone and `git clone` afresh. Always works. Always
correct. Loses uncommitted work.

Announce both options in `#eng-announce` along with the new SHA of
`main` HEAD so contributors can verify they're on the rewritten tree.

## Phase D — Post-incident

1. **Update `.gitleaks.toml`** with the redacted secret pattern in the
   `[allowlist]` block, _not_ the value, so the scanner knows to ignore
   `***REMOVED***` and any test fixtures that resemble the format.
2. **File a SIRT post-mortem**: how did the secret land in a commit,
   why did pre-commit/CI not catch it, what guardrail are we adding?
3. **Add a regression test** if the leak was caused by a code path
   (e.g. logging that printed creds). Preventing future leaks is the
   only ROI on an event this expensive.
4. **Confirm the fix in CodeQL & Gitleaks** by re-running both
   workflows on the rewritten `main`.

## Decision tree

```
Found a secret-shaped string in history.
│
├─ Is the value a real, working credential?
│  ├─ No  → add to .gitleaks.toml allowlist; do NOT rewrite history.
│  └─ Yes ┐
│         │
│         ├─ Is it already revoked everywhere?
│         │  ├─ Yes → rewrite history (Phase B+C); skip Phase A.
│         │  └─ No  → execute the full runbook (A → B → C → D).
```

## References

- Hetzner deployment topology: `HETZNER_DEPLOYMENT_GUIDE.md` (Phase 9
  for MinIO, Phase 11.4 for Cloudflare R2 boundary).
- `git-filter-repo` docs: <https://github.com/newren/git-filter-repo>.
- GitHub: ["Removing sensitive data from a repository"](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
- ADR-0001 (CORS allow-list & fail-closed) — sister doc covering the
  defence-in-depth posture this runbook supports.
