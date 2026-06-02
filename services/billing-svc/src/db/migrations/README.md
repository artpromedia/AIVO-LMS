# billing-svc migrations

Sprint 4 added the district seat-pooling tables: `seat_pools`,
`seat_allocations`, `seat_allocation_history`, and `invoices_cache`.

These tables live in the shared Drizzle schema (`@aivo/db`,
`packages/db/src/schema/billing.ts`) because billing-svc, identity-svc, and the
web BFF all read them. The **canonical, applied** migration is therefore the
Drizzle one:

    packages/db/drizzle/0058_seat_pooling.sql

which is run by `pnpm --filter @aivo/db run db:migrate` (the same command
`pnpm --filter @aivo/billing-svc run test` invokes before the suite).

`0001_seat_pooling.sql` in this directory is a byte-for-byte copy kept here so
the service owns a readable record of the schema it depends on. It is **not**
applied independently — do not run it directly against a shared database or you
will double-apply. Edit the Drizzle copy and re-sync this one if the schema
changes.
