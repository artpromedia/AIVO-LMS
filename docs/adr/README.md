# Architecture Decision Records

This directory captures **Architecture Decision Records (ADRs)** for the
AIVO Learning monorepo. ADRs are short documents that record a single
significant technical or product-architecture decision, the context in
which it was made, the alternatives considered, and the consequences
that followed.

We use ADRs (rather than tribal knowledge or scattered design docs) so
that future engineers — and future versions of ourselves — can answer
"_why is it like this?_" without having to reconstruct the discussion
from Slack threads.

## When to write an ADR

Write a new ADR when a change…

- introduces or removes a runtime dependency that is hard to swap out
  later (database engine, message bus, auth provider, LLM vendor);
- changes a security-relevant default (CORS, CSP, auth flow, secret
  storage, network exposure);
- defines a contract that other services or apps will depend on (event
  schema, public API shape, multi-tenant scoping rule);
- represents a deliberate decision _not_ to do something obvious;
- would otherwise leave a reviewer asking "why did we pick X over Y?".

Routine refactors, dependency bumps, and bug fixes do **not** need an
ADR.

## Process

1. Copy [`0000-template.md`](./0000-template.md) to a new file named
   `NNNN-short-kebab-title.md`, where `NNNN` is the next free number.
2. Fill in the `Status`, `Context`, `Decision`, `Consequences`, and
   `Alternatives Considered` sections. Keep it short — one to two pages
   is the sweet spot.
3. Open a PR. The ADR ships in the same PR as the change it describes
   whenever possible.
4. Once merged, ADRs are **immutable**. To revise a decision, write a
   new ADR that supersedes the old one and update the old ADR's status
   to `Superseded by NNNN`.

## Statuses

- `Proposed` — under discussion in a PR.
- `Accepted` — merged and currently in force.
- `Deprecated` — no longer recommended but still partially in effect.
- `Superseded by NNNN` — replaced by a later ADR.

## Index

| ID                                      | Title                                | Status   |
| --------------------------------------- | ------------------------------------ | -------- |
| [0001](./0001-cors-allowlist-policy.md) | CORS allow-list & fail-closed policy | Accepted |
| [0040](./0040-curriculum-source-of-truth.md) | Curriculum source of truth | Accepted |
| [0041](./0041-agentic-boundaries.md) | Agentic boundaries (LLMs never emit standards) | Accepted |

> Keep this table sorted by ID. Add new rows as ADRs land.
