# Production deployment checklist

Status: **not ready to deploy** until all blocking items below are resolved and the production database path/schema are verified. This is a preparation checklist, not authorization to deploy or modify production data.

## Registration and identity

- [ ] Confirm `POST /api/auth/register` returns 403 and there is no customer/student/teacher/admin signup UI.
- [ ] Verify the only public signup is `/shop/register`; run an end-to-end shop signup using a Razorpay sandbox plan and confirm paid activation is impossible without server-verified payment.
- [ ] Provision the first administrator through the one-time command only if no authorized administrator exists. Keep credentials in a deployment secret manager and remove the one-time values immediately.
- [ ] Apply the guest shop-review migration after a verified backup. Configure a stable `COLLEGE_ID_HASH_SECRET` in secret storage, back it up, and keep it unchanged unless a reviewed identity migration is prepared.
- [ ] Train shop owners to inspect the ID photo and number and compare the card with the person at the counter when assurance matters; browser camera capture is not liveness detection.
- [ ] Configure SMTP and verify shop-owner contact verification and password-recovery links with a test mailbox before enabling production signup/recovery. Without complete SMTP configuration, these flows intentionally return unavailable and do not claim delivery.
- [ ] Apply the new additive `20261030_auth_contact_tokens` migration to production only after the production schema has been independently inspected and backed up; it has been applied to the local development database only. Follow [PRODUCTION_MIGRATION_PLAN.md](PRODUCTION_MIGRATION_PLAN.md).

## Database and migration safety

- [ ] Obtain the production host, resolved SQLite file path, current schema, deployment revision, and operator-approved maintenance window. The production `DATABASE_URL` has not been inspected in this audit.
- [ ] Stop API writers and the Windows print agent before taking a consistent backup/migration snapshot.
- [ ] Create a timestamped SQLite backup on protected storage; verify the backup's SHA-256 and read-only SQLite integrity. For a SQLite online backup, also compare key table counts; byte equality is not expected from the online backup API.
- [ ] Inspect table/column presence and foreign-key state before applying anything. The configured local development DB has no Prisma migration ledger; production ledger status is unknown. Do not run `prisma migrate deploy`, `db push`, `migrate reset`, or a database reset as a shortcut.
- [ ] Apply the SQL migration files in order, once each, after confirming their additions are absent. The final guest-review migration rebuilds usage/reservation tables to make account association optional; it preserves rows and is not a pure create-table-only migration:
  1. `apps/api/prisma/migrations/20261028_subscription_payment_attempts/migration.sql`
  2. `apps/api/prisma/migrations/20261029_college_free_printing/migration.sql`
  3. `apps/api/prisma/migrations/20261029_guest_shop_id_verification/migration.sql`
- [ ] Local development database `apps/api/prisma/dev.db` has the three college/payment feature migrations and `20261030_auth_contact_tokens` applied, with no `_prisma_migrations` ledger. The auth migration had a verified backup at `apps/api/prisma/dev.db.before-auth-contact-20261029-110748.bak`; integrity and row count were verified, with zero FK violations. Production remains unknown.
- [ ] Exact PowerShell backup and migration procedure is documented in [PAYMENT_SETUP.md](PAYMENT_SETUP.md). Replace the development file path with the verified production path and direct Prisma to the same exact database; do not print production URLs or credentials. Verify integrity, `PRAGMA foreign_key_check`, and application smoke tests before reopening traffic.

## Secrets, origins, and container configuration

- [ ] Use unique, random `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars, different values) and a unique `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` (32 random bytes, 64 hex characters) in a secret manager.
- [ ] Back up and rotate existing plaintext shop payment credentials using [PAYMENT_SETUP.md](PAYMENT_SETUP.md). First dry-run the maintenance script against the verified production backup; do not enable payment writes until encryption status and gateway health are confirmed.
- [ ] Set platform Razorpay sandbox credentials first. Configure `RAZORPAY_WEBHOOK_SECRET` and HTTPS webhook URL; only switch to live keys after merchant ownership, webhook, payment, and receipt tests pass. Shop printing Razorpay credentials are separate; platform subscription merchant credentials must not receive customer shop funds.
- [ ] Cashfree is not integrated; do not advertise it. Marketplace/split settlement, refunds, recurring subscription renewal, and automated UPI verification are not available.
- [ ] Set `PUBLIC_API_URL`, `CUSTOMER_PORTAL_URL`, `SHOP_PORTAL_URL`, `ADMIN_PORTAL_URL` and all `VITE_*` build variables to the public HTTPS URLs. Rebuild portal images after URL changes; Vite values are compiled into bundles.
- [ ] Set `CORS_ORIGIN` to an explicit comma-separated list of HTTPS origins only. Production API startup rejects wildcard, missing, or non-HTTPS URLs.
- [ ] Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and the correct customer portal URL through secret storage. These are required for shop contact verification and password recovery.
- [ ] Configure upload and database volumes as persistent, access-controlled storage; restrict public file access, retention, and backups. Do not expose the API or database file directly to the Internet.

## Network, runtime, and operational controls

- [ ] Terminate TLS at a maintained reverse proxy; expose only required HTTPS endpoints. Restrict direct ports `5000`, `5173`, `5174`, and `5175` to the proxy/network as appropriate.
- [ ] Run `docker compose config --quiet` with production variables present, build all images, inspect image configuration for accidental secrets, and verify API health checks.
- [ ] Confirm `NODE_ENV=production`, least-privilege filesystem mounts, resource limits, restart behavior, and graceful shutdown. Maintain SQLite backup/restore runbooks and test a restore before launch.
- [ ] Configure centralized redacted logs, alerting, disk/volume monitoring, and health checks. Avoid logging tokens, file content, UPI proof, identity documents, or gateway secrets.
- [ ] Pair each Windows print agent using a unique expiring pairing code; confirm its token is protected, printer capabilities match, and it can reconnect after restart. Verify with a physical test print and real agent completion signal before representing a job as printed.
- [ ] Verify upload directory permissions, document expiry/shredding behavior, and private verification-evidence storage.
- [ ] Run API tests, all workspace type checks, Prisma validation, production builds, Docker Compose validation, shop/customer/admin role smoke tests, guest print checkout, cash collection authorization, manual UPI review, and payment sandbox tests.
- [ ] Review actual webhook delivery and event idempotency, payment/order reconciliation, audit logs, and operator permissions. Never infer payment or print success from a browser response.

## Current blockers

1. Production database path and current schema/migration state are not known; no production migration was run.
2. Production database path, schema and migration ledger are unknown. The local development DB has no Prisma migration ledger; its additive auth migration has been applied.
3. SMTP has not been verified with real provider credentials; shop signup and recovery intentionally remain unavailable until configured.
4. Platform Razorpay sandbox/live verification and physical printer-agent completion cannot be claimed without configured credentials and hardware evidence.

