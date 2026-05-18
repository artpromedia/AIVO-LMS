# Security Policy

## Reporting a Vulnerability

The AIVO Learning team takes security seriously. If you believe you have
found a security vulnerability in this repository or in any AIVO product,
please report it to us **privately** so that we can address it before any
public disclosure.

### How to report

- **Preferred:** Use [GitHub's private vulnerability reporting](https://github.com/artpromedia/aivo-ai-learning/security/advisories/new)
  on this repository.
- **Email:** `security@aivolearning.com` (PGP key on request).

Please include, where possible:

1. A description of the issue and its potential impact.
2. Steps to reproduce, including any proof-of-concept code or scripts.
3. The affected version, commit SHA, or deployment URL.
4. Whether the issue is already public anywhere (e.g. CVE, blog post,
   social media). If so, please share the link.

We will acknowledge your report within **2 business days** and provide
a more detailed response within **7 business days** indicating the next
steps in handling your submission.

### What to expect

- We treat all reports as confidential by default.
- We will keep you informed of the progress toward a fix.
- Once a fix is released, we will credit you (with your permission) in
  the security advisory and release notes.
- We do not currently operate a paid bug-bounty program, but we
  recognise contributors publicly and may offer swag for high-impact
  reports.

### Out of scope

The following are **not** considered security vulnerabilities and will
typically be closed without action:

- Reports generated solely by automated scanners with no demonstrated
  impact (e.g. "missing security header" without an exploit chain).
- Denial-of-service via volumetric request flooding.
- Self-XSS, clickjacking on pages with no sensitive actions, or
  vulnerabilities that require an already-compromised user device.
- Outdated dependencies with no demonstrated path to exploit. (We track
  these via Dependabot — see `.github/dependabot.yml`.)
- Issues affecting unsupported branches. We support the default branch
  and the most recent release tag.

## Reporting Sensitive Data Exposure

If you discover any of the following committed to this repository,
please report it through the channels above **before** opening a public
issue or PR:

- API keys, OAuth client secrets, JWT signing keys, database
  credentials, or any other authentication material.
- Personal data (names, email addresses, phone numbers, student
  records, IP addresses) belonging to real users.
- Internal infrastructure topology that could aid an attacker.

We will rotate exposed credentials, scrub the repository history when
necessary, and audit access logs for misuse.

## Supported Versions

| Version             | Supported          |
| ------------------- | ------------------ |
| `main` (latest)     | :white_check_mark: |
| Most recent release | :white_check_mark: |
| Older releases      | :x:                |

## Coordinated Disclosure

We follow a coordinated-disclosure model. We ask reporters to give us a
reasonable window — typically **90 days** from initial acknowledgment —
to ship a fix before any public disclosure. We are happy to discuss a
shorter window for actively-exploited vulnerabilities, or a longer
window when a fix requires upstream coordination.
