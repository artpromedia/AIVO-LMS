# Standalone Admin Web Routing

## Production topology

`admin.aivolearning.com` and `district.aivolearning.com` are served by the
single `web-admin` Next.js deployment. Role-specific entry points are routes
inside that application:

- platform and internal staff: `/platform`
- district administrators: `/district`
- school administrators: `/school`
- all admin roles: `/login` and `/login/mfa`

The consumer `web-v2` application retains legacy `/admin/*` routes for local
and embedded compatibility, but production middleware forwards those routes
to the standalone admin host.

## June 6, 2026 finding

Live checks showed `admin.aivolearning.com/login` and
`district.aivolearning.com/login` rendering the consumer `web-v2` login.
`admin.aivolearning.com/platform` returned the `web-v2` "Page not found"
screen. The active Hetzner workflow built and deployed backend services but
did not build or deploy `web-admin`, and its ingress rules still targeted
legacy per-role service names.

## Deployment contract

The Hetzner pipeline now:

1. Builds and pushes `ghcr.io/artpromedia/web-admin:latest` with
   `docker/Dockerfile.webapp --build-arg APP_NAME=web-admin`.
2. Deploys the image as the `web-admin` service.
3. Requires the `web-admin` rollout and service endpoints to be ready.
4. Reconciles only the `/` ingress rules for `admin.aivolearning.com` and
   `district.aivolearning.com` to that service.
5. Verifies both hosts return the `web-admin` health marker and login page,
   and verifies unauthenticated `/platform` redirects to `/login`.

If host reconciliation fails because an ingress rule is missing or ambiguous,
the deployment fails rather than leaving an admin host on the consumer app.
