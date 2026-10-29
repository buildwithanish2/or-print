# College Free Printing test report

Date: 2026-10-29 (Asia/Kolkata)

## Completed checks

- `npm run test --workspace=apps/api` — **24 passed, 0 failed**. Includes guest ID HMAC normalization, token hashing, shop-owner-only review scope, registration and payment regressions, free-print allowance boundaries, and Kolkata period keys. These are unit/controller-logic tests; no live DB HTTP integration test was run.
- `npm run type-check` — **passed** for all workspaces.
- `npm run build` — **passed** for API, customer portal, shop dashboard, admin portal, and shared packages.
- `npx prisma validate --schema apps/api/prisma/schema.prisma` — **passed**.
- The guest SQLite migration was first tested on a temporary copy, preserving existing rows and producing zero foreign-key violations. It was then applied to the configured local development DB only, after creating and verifying `apps/api/prisma/dev.db.before-guest-migration-20261029-010607.bak`. User/Shop/Order/Payment/usage counts match the backup, SQLite integrity is `ok`, and `PRAGMA foreign_key_check` reports zero violations. No production database was inspected or modified.
- Docker Compose configuration validation passed using temporary example HTTPS values; no credentials were stored.

## Not verified

- Prisma Client generation was attempted but Windows returned `EPERM` replacing `query_engine-windows.dll.node`, likely because an API process has the engine loaded. Existing generated client supported type-check/build. Regenerate after stopping the API process before deployment.
- The guest migration was replayed in order against a disposable copy of the pre-migration local backup; all guest tables/columns were created and `PRAGMA foreign_key_check` returned zero violations. The configured local database was not modified during this replay.
- No browser-based end-to-end test was run for camera selection, owner image preview, approval polling, or order submission.
- No isolated DB integration test exercised simultaneous duplicate approvals or allowance reservations. The database uniqueness and transactional update provide protection, but real concurrency testing remains outstanding.
- No liveness detection is implemented: mobile `capture` is only a browser hint. Shop owners must visually review the photo and ID number; staff should compare the card to the applicant in person when needed.
- No real gateway payment, .NET agent, or physical printer test was run. Agent status is not a physical page/sheet counter.
- No production migration was applied. Production database path/schema and `COLLEGE_ID_HASH_SECRET` configuration still need operator verification.
- No lint script exists in package scripts.
