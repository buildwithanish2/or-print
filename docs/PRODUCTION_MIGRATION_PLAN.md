# Production SQLite migration plan

## Database discovery

The configured workspace `.env` resolves `DATABASE_URL` to `E:\OR PRINT\apps\api\prisma\dev.db` (SQLite). Before the auth migration, it had `PRAGMA quick_check = ok`, zero foreign-key violations, no `_prisma_migrations` table, existing college/guest-print tables, and none of the new auth columns/table. After creating and verifying backup `apps/api/prisma/dev.db.before-auth-contact-20261029-110748.bak`, migration 4 was applied to this local development DB only. Post-migration integrity passed, foreign-key violations remained zero, and the existing order count stayed at 19. The Prisma migration ledger is still absent. This is not evidence about production. Docker Compose separately configures SQLite at `/app/data/printqr.db` inside the persistent `database_data` volume. That production volume/host was not accessible, so its actual path, schema, and migration ledger remain unknown.

The checked-in SQL migrations in dependency order are:

1. `20261028_subscription_payment_attempts/migration.sql`
2. `20261029_college_free_printing/migration.sql`
3. `20261029_guest_shop_id_verification/migration.sql`
4. `20261030_auth_contact_tokens/migration.sql` (new; adds three `User` columns and `AuthActionToken`)

The local DB has migrations 1–3 feature tables/columns but no Prisma migration ledger; the new auth migration has not been applied. Production must be independently inspected for each table/column before applying anything. If production already contains any feature addition without matching schema or the ledger is ambiguous, stop and reconcile manually; do not replay SQL blindly.

## Backup and verification (PowerShell on the production host)

Use an operator-confirmed absolute database path. Stop API writers and the print agent first. Keep the backup outside the live database directory on protected storage. `sqlite3.exe` must be an approved version already installed on the host.

```powershell
$db = 'D:\OR-PRINT-DATA\printqr.db' # replace only after verifying the actual production path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "D:\OR-PRINT-BACKUPS\printqr-$stamp.db"
sqlite3.exe $db ".backup '$backup'"
if ($LASTEXITCODE -ne 0) { throw 'SQLite backup failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath $backup
sqlite3.exe $backup 'PRAGMA quick_check;'
sqlite3.exe $backup 'PRAGMA foreign_key_check;'
```

Record table counts and schema from the backup without printing environment values or customer data. Verify backup location, size, hash, integrity, and a restore rehearsal into a separate temporary path before the maintenance window. Do not use `prisma migrate reset`, `db push`, or overwrite `.env`.

## Apply only after a verified backup and explicit production authorization

Confirm the production schema has the exact current prerequisite state and no migration ledger. Apply only absent migration files, in the listed order, with a transaction-aware SQLite client. The newest migration is explicitly wrapped in `BEGIN IMMEDIATE`/`COMMIT`:

```powershell
$db = 'D:\OR-PRINT-DATA\printqr.db' # independently verified production path
$migration = (Resolve-Path 'apps\api\prisma\migrations\20261030_auth_contact_tokens\migration.sql').Path
sqlite3.exe $db ".read `"$migration`""
if ($LASTEXITCODE -ne 0) { throw 'Auth/contact migration failed; keep traffic stopped and restore the verified backup after investigation' }
sqlite3.exe $db 'PRAGMA quick_check;'
sqlite3.exe $db 'PRAGMA foreign_key_check;'
sqlite3.exe $db 'PRAGMA table_info("User");'
sqlite3.exe $db 'PRAGMA table_info("AuthActionToken");'
```

For production databases missing migrations 1–3, first stage each against a copy of the backup and validate compatibility; do not assume the local state. Record the deployed revision, migration filenames, checksums, before/after counts, and operator. This project currently has no Prisma migration ledger; these SQL files are applied as an explicitly reviewed manual sequence, not via `prisma migrate deploy`.

## Rollback

There is no down migration. On an additive migration failure, keep application writers stopped, preserve the failed database for diagnosis, and restore the verified pre-change SQLite backup as a whole-file recovery operation after operator approval. This rolls back writes made after the backup too, so do not restore over a live database without a reviewed recovery plan. For a successful migration followed by an application rollback, retain the additive schema and run the prior compatible application only if compatibility has been verified. Never delete user, shop, order, payment, or verification data.

No production backup, migration, database replacement, or deployment was performed during this work. The local development migration was applied only after a verified backup; it did not change production.

## Validation performed in this workspace

- The configured local SQLite file was inspected read-only; it is not treated as production. No schema changes were applied to it.
- The new SQL was run against a disposable copy of that file: `PRAGMA quick_check` returned `ok`, `PRAGMA foreign_key_check` returned no rows, and expected auth columns/table were present.
- `npx prisma validate --schema apps/api/prisma/schema.prisma` passed.
- The exact production state remains unverified because the Docker named volume/production host is not available here.
