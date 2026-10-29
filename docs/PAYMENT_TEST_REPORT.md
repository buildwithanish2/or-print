# Payment test report

## Executed checks — 2026-10-29

- `npm test --workspace=@printqr/api` — passed, 16 tests, including cash state eligibility and owning-shop/admin authorization, manual UPI proof/amount checks, Razorpay HMAC signatures, idempotency validation, AES-256-GCM encryption/decryption, and re-encryption under a rotated key.
- `npm run type-check` — passed across all workspaces.
- `npm run build` — passed across API and admin, customer, and shop production builds, plus shared packages.
- `npx prisma validate --schema apps/api/prisma/schema.prisma` — passed.
- `docker compose config --quiet` — passed.
- Both additive SQLite SQL migrations were executed on a disposable copy of the configured database. `PRAGMA foreign_key_check` returned zero violations and all expected tables/columns were present. The configured database was opened read-only and not changed.
- A Razorpay sandbox order-creation request was attempted with the configured test-mode credentials. Razorpay returned HTTP 401. No captured payment or settlement was created. The test credential pair therefore remains unverified/invalid for this request.

## Cash, UPI, and database limits

Cash and manual UPI endpoint handlers use conditional order/payment updates within database transactions. Tests cover their state predicates, amount matching, reviewer authorization predicate, duplicate-state rejection logic, and order idempotency schema validation. The current test suite does not run HTTP integration tests against a fully migrated and seeded SQLite copy, so end-to-end database concurrency and UI outcomes have not been independently exercised in this pass.

The migration diff from the configured local database to Prisma schema consisted of additions present in the two checked-in SQL files: payment verification fields, order idempotency fields/index, subscription attempt, file ownership and college-free-print tables/indexes. There is no `_prisma_migrations` table in this installation. Follow [PAYMENT_SETUP.md](PAYMENT_SETUP.md) for an offline backup and explicit one-time SQL application procedure. No migration was applied to the configured database.

## Provider, hardware, and production verification not completed

- Razorpay sandbox order creation was rejected with HTTP 401. Captured payment verification, subscription activation, return callbacks, and webhook delivery were not tested. The webhook secret is not configured locally.
- Shop gateway credential values in the local SQLite file include legacy plaintext values. They were counted without reading or logging values. The encryption key is unset; the credential conversion utility was not applied.
- Cash collection and manual UPI confirmation were not exercised through a running HTTP API/dashboard connected to a migrated isolated database.
- Cashfree and Stripe are not implemented for checkout; their webhook endpoints fail closed.
- No shop settlement, refund, marketplace transfer, real cash handoff, physical print, or .NET print-agent test was performed.
