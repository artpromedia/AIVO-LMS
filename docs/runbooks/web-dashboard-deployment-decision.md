# Web Dashboard (`apps/web`) — Production Deployment Decision

_Status: **decided** (not yet implemented), 2026-04-28._

| Field | Value |
| --- | --- |
| Owner (cutover lead) | _TBD — assign on the platform / devops team_ |
| Cutover target date | _TBD — fill in once the Hetzner cluster is reachable from the build pipeline_ |
| Status transitions | `decided` → `in-progress` (when image build CI lands) → `implemented` (after smoke test passes on `app.aivolearning.com`) |

> **Maintenance note:** When the rollout below completes, flip the status above to **implemented**, link the PRs that built the image, added the Helm values, and changed Cloudflare DNS, and prune the rollout plan to reflect what actually shipped (image tag, ingress IP, cookie / WebAuthn origin list).

## Decision

**The `apps/web` dashboard will ship to production on the Hetzner K3s cluster, not on a second Replit autoscale deployment.**

The Replit autoscale deployment in `.replit` stays exclusively dedicated to the marketing site (`apps/marketing` → `aivolearning.com`).

## Context

- The Replit autoscale deployment is currently configured to build and run only `apps/marketing` and serve `aivolearning.com` (see `.replit` `[deployment]` block and `replit.md` → "Production Deployment (Replit Autoscale)").
- `apps/web` is the signed-in dashboard (Next.js 15, role-based dashboards for learner / parent / teacher / district / admin / etc.). It depends on a fleet of backend services — `identity-svc`, `assessment-svc`, `learning-svc`, `tutor-svc`, `family-svc`, `engagement-svc`, `billing-svc`, `comms-svc`, `i18n-svc`, `integrations-svc`, `admin-svc`, `status-page-svc`, `research-svc`, plus the Python `ai-svc` and `brain-svc`.
- Hetzner K3s is already the planned production home for the whole platform. See `HETZNER_DEPLOYMENT_GUIDE.md` (4-server topology in HEL1) and the existing manifests in `infra/k8s/overlays/hetzner/`:
  - `web-ingress.yaml` already terminates `app.aivolearning.com`, `parent.aivolearning.com`, `teacher.aivolearning.com`, `admin.aivolearning.com`, `district.aivolearning.com`, `author.aivolearning.com`, `creator.aivolearning.com`, `docs.aivolearning.com` against role-specific Services (`web-learner`, `web-teacher`, `web-parent`, `web-platform-admin`, `web-district`, `web-author`, `web-creator`, `web-dev-portal`).
  - `kustomization.yaml` already maps each of those Deployments to images in GHCR (`ghcr.io/artpromedia/aivo-web-*`).
  - `infra/helm/aivo-service/` is the per-service Helm chart used to render the same Deployments/Services consistently across staging and Hetzner production.

## Why not a second Replit autoscale deployment

1. **Backend coupling.** `apps/web` cannot run alone — it speaks to ~14 backend services. The Replit autoscale target runs a single process, so a second repl would either (a) need to fork the entire monorepo and run the full backend fleet inside one container (which already exhausts the Replit container's process budget on a fresh boot — see `scripts/start-services.sh` and `replit.md` → "Backend Boot Ordering"), or (b) call back across the public internet to backends that are about to be hosted on Hetzner anyway. Both are strictly worse than co-locating the dashboard pod with `identity-svc` on the K3s cluster's vSwitch (<1ms intra-cluster latency).
2. **Ops surface.** Helm/K3s, Cloudflare TLS, NGINX Ingress, ModSecurity/OWASP CRS, secrets via External Secrets / Vault, and Prometheus/Grafana are all being set up on Hetzner. Running the dashboard on a second Replit deployment means maintaining two production runtimes, two log/metric stacks, and two release pipelines for one product.
3. **Auth & cookie coupling.** WebAuthn requires every origin to be in `WEBAUTHN_ORIGINS`, and JWT/refresh-token cookies are cleanest when the dashboard and backend share the same parent domain on the same edge (Cloudflare → ingress-nginx → service). With everything behind the same Hetzner ingress, `app.aivolearning.com` and the API hosts live under one cookie / CORS / CSP story (see `infra/k8s/overlays/hetzner/ingress.yaml` `cors-allow-origin` already lists `https://app.aivolearning.com`).
4. **Cost & duplication.** Hetzner App Primary/Secondary already have 128 GB RAM each and host the backend pods anyway — the dashboard pod is a marginal-cost addition. A second Replit autoscale deployment is a recurring line item that would have to be torn down once Hetzner is live.
5. **Marketing site stays simple.** Keeping the Replit deployment scoped to `apps/marketing` matches the constraints recorded in `replit.md` (no root `pyproject.toml`, no service fleet) and is already green. Bolting the dashboard onto it would require re-introducing all the backend setup that was deliberately removed from that build.

## Why the Hetzner overlay is the right home

- `app.aivolearning.com` is **already** declared in `infra/k8s/overlays/hetzner/web-ingress.yaml` (host rule routes to a `web-learner` Service on port 3000) and the matching TLS host is in the `tls.hosts` list.
- The image slot is already reserved in `infra/k8s/overlays/hetzner/kustomization.yaml`: `aivo/web-learner` → `ghcr.io/artpromedia/aivo-web-learner:<tag>`.
- The same pattern is reused for the other role surfaces (`web-parent`, `web-teacher`, `web-platform-admin`, `web-district`, `web-author`, `web-creator`). Today these are all the same `apps/web` Next.js app routed by host/role inside the app — the rollout plan below treats them as one image with multiple Service aliases until/if they ever genuinely diverge.
- The cluster network keeps dashboard ↔ identity-svc traffic on the private vSwitch, which is the latency profile WebAuthn / refresh-token loops were designed for.

## Rollout plan

This decision document only owns step 1 — the rest is execution work that belongs to the Hetzner cutover effort and needs cluster + DNS access this environment does not have.

1. **Decision recorded** (this file). `apps/web` is **not** going to a second Replit deployment. _(Done.)_
2. **CI image build for `apps/web`.** Add a workflow in `.github/workflows/` that builds and pushes `ghcr.io/artpromedia/aivo-web-learner:<git-sha>` (and the other `web-*` aliases for now — same image, different tag) on every merge to `main`. Build target = the `apps/web` Next.js standalone output.
3. **Helm release values for `web-learner`.** Add a `web-learner` release under `infra/helm/values/hetzner.yaml` (or a dedicated values file) wiring:
   - `image.repository: ghcr.io/artpromedia/aivo-web-learner`
   - `service.port: 3000`
   - env: `IDENTITY_SVC_URL=http://identity-svc:3001`, all other `*_SVC_URL` → in-cluster service DNS, `NODE_ENV=production`, `WEBAUTHN_ORIGINS=https://app.aivolearning.com,https://aivolearning.com,...` (extend the existing list).
   - `replicas: 2` (already patched in `kustomization.yaml`).
4. **Apply the existing overlay.** `kubectl apply -k infra/k8s/overlays/hetzner` once GHCR has the image — the `aivo-web-ingress` Ingress + `web-learner` Service/Deployment then become live.
5. **DNS.** In Cloudflare, point `app.aivolearning.com` (and the other role subdomains as they come online) to the Hetzner ingress IP. SSL mode stays "Full" against the existing `cloudflare-origin-tls` secret already referenced in `web-ingress.yaml`.
6. **Cutover smoke test.** From a clean browser, hit `https://app.aivolearning.com`, sign in via Google OAuth + WebAuthn, and verify a parent / learner / teacher path each render. If WebAuthn fails, the most likely cause is `WEBAUTHN_ORIGINS` missing the new host — fix the env var on `identity-svc` and roll the pod.

## What this changes in `.replit`

Nothing. The `[deployment]` block continues to build/run only `apps/marketing`. Do not re-point it at `apps/web` — that path was tried previously and never worked (per the task brief), and the decision above replaces it with the Hetzner path.

## Revisit conditions

Reopen this decision only if **all** of the following become true:

- The Hetzner cutover is abandoned or indefinitely delayed, **and**
- `apps/web` needs a public production URL before Hetzner is ready, **and**
- Replit autoscale is acceptable for a stateful, multi-service product (it currently is not — the backend fleet does not fit the autoscale single-process model).

A short-term workaround that does **not** require reopening this decision: leave `apps/web` accessible only via the Replit dev domain (`$REPLIT_DEV_DOMAIN`) for internal demos until the Hetzner endpoint is live.
