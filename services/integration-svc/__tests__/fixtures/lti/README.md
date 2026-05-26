# LTI launch JWT fixtures

Recorded fixtures from Canvas, Schoology, and Moodle reference platforms. Each `.json` file contains:

- `description` — what platform / scenario the fixture captures
- `platform_jwks` — the JWKS that the platform served at the time of recording
- `id_token` — a real signed JWT (the keys above verify it)
- `issuer`, `audience`, `deployment_id`, `nonce`, `roles` — extracted claims for assertions

When regenerating: include the **public** key only in `platform_jwks`. Never commit a platform's private signing material.
