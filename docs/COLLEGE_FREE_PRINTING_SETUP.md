# College Free Printing setup

## Environment and private evidence storage

- Set `COLLEGE_ID_HASH_SECRET` to a unique random secret of at least 32 characters in the production secret manager. It is used as an HMAC key; the raw ID number is not stored. Back it up securely and keep it stable. If it is lost or rotated, existing IDs cannot be rematched because raw IDs are intentionally discarded; suspend free printing until identities and usage are reconciled.
- Set `COLLEGE_EVIDENCE_DIR` to a private, persistent directory separate from public uploads. Docker Compose mounts `/app/private-college-evidence` as the `evidence_data` volume. Restrict filesystem access to the API service. Never map this directory through static hosting.
- ID photos accept JPEG/PNG only, up to 5 MB. Pending photos expire and are deleted after 30 days; photos are deleted immediately after the shop owner records approve/reject. Identity hash, reviewer, decision, and audit history remain.
- Mobile browser `capture="environment"` asks for the rear camera where supported but does not prove liveness. Shop owners should compare the card to the person at the counter when needed.

## Database migration

The guest-review migration is `apps/api/prisma/migrations/20261029_guest_shop_id_verification/migration.sql`. It adds guest verification tables and rebuilds the usage/reservation tables to support guest identities while preserving existing rows. Apply migrations in order only after inspecting the target SQLite file. Do not apply them automatically to production, and do not use `db push`, reset, or `migrate deploy` for this existing database without a migration ledger.

College-specific paid pricing is added by `apps/api/prisma/migrations/20261101_institution_pricing_rules/migration.sql`. It creates an additive table keyed by institution, paper size, and color mode; it does not rewrite existing shop/platform rates. Apply it after the five earlier SQL migrations below. Until it is applied, the API keeps existing rates active and the admin page reports that College Pricing Control is waiting for the migration.

Before migration, stop API writers and the print agent. For a host-side SQLite file, create and hash-verify a backup:

```powershell
$db = (Resolve-Path '.\apps\api\prisma\dev.db').Path
$backup = "$db.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $db -Destination $backup
Get-FileHash -Algorithm SHA256 -LiteralPath $backup
python -c "import sqlite3,sys; c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); print(c.execute('PRAGMA integrity_check').fetchone()[0]); c.close()" $backup
```

For a live database, stop API writers and the print agent first and confirm no SQLite `-wal` file contains uncheckpointed data. A byte-for-byte hash comparison is appropriate only for a direct file copy of a quiescent database; a SQLite online backup may be byte-different, so verify its integrity and key table counts instead.

Those commands show the known local development file, not production. For production, set `$db` to the SQLite file resolved from the actual deployment `DATABASE_URL`, and ensure Prisma CLI runs against that same file. Confirm the new tables/columns are absent, then apply in sequence:

```powershell
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261028_subscription_payment_attempts/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261029_college_free_printing/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261029_guest_shop_id_verification/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261030_auth_contact_tokens/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261031_shop_welcome_email_dedupe/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261101_institution_pricing_rules/migration.sql
npx prisma validate --schema apps/api/prisma/schema.prisma
```

These SQL files are not idempotent. Run each only once, in order. Afterward check SQLite integrity and `PRAGMA foreign_key_check`, verify row counts for users/shops/orders/payments/previous usage, then start the API and test the dashboard. If the URL or database path is ambiguous, stop before writing anything. See `docs/PAYMENT_SETUP.md` for the existing-database backup and recovery notes.

The local development database `apps/api/prisma/dev.db` contained the first two migration additions and has no `_prisma_migrations` ledger. The third migration has now been applied to that local development file after creating and verifying `apps/api/prisma/dev.db.before-guest-migration-20261029-010607.bak`; integrity and key row counts were verified, and `PRAGMA foreign_key_check` returned zero violations. This is local development evidence only. Production schema and path remain unknown, and no production database was changed.

## Admin and shop operations

1. Admin opens **College Free Printing**, adds eligible institutions, configures Student/Teacher daily and monthly impression/copy limits, enables permitted B&W/Color modes, activates the global policy, and approves participating shops.
2. At `/print/:shopSlug`, a customer selects Student or Teacher, chooses the institution, and submits a live camera photo of the college ID. No account is created and no email/phone OTP is required. The application token is retained in that browser for the selected shop.
3. The selected shop owner opens **Shop Dashboard → College Free Printing → ID photo review**, previews the private ID photo, enters the card number exactly as shown, then approves or rejects with a reason. The server hashes the normalized number using HMAC and checks duplicates. Same identity usage is shared across participating shops.
4. After approval, the customer can upload print documents in the same browser/shop session, choose supported settings, and submit a server-validated free order. Existing regular paid checkout remains available during review or when policy/limits do not allow free printing.

Shop staff can view general program status but cannot view or approve ID photos. One shop cannot view another shop's verification requests. Shop owners cannot increase policy limits or change institution eligibility.

## Hardware and accounting

Free orders use the existing queue and Windows agent. Page impressions are selected pages multiplied by copies; physical sheets are not inferred. Current agent completion status does not provide verified page/sheet counters or physical cancellation. Dashboard totals must continue to be described as requested impressions and agent job status, not device-confirmed printed quantities.
