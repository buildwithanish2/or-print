# Payment setup

## Platform subscription checkout

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to the OR PRINT platform merchant's credentials. Configure the matching platform webhook secret in `RAZORPAY_WEBHOOK_SECRET` and register the API's `/api/payments/razorpay/webhook` endpoint for captured-payment events. Use sandbox credentials for development and separate live credentials in production. The key ID is public checkout configuration; the secret and webhook secret must remain server-side.

## Shop print payments

Shop owners configure Cash, manual UPI, or their own Razorpay merchant under Shop Dashboard → Payment Settings. Razorpay requires that shop's merchant key ID and secret. The platform does not route customer print money through its subscription merchant and no marketplace/split settlement setup is included. UPI VPA format is checked but ownership is not verified; operators must confirm payments manually. Cash is recorded only when an authorized shop operator confirms collection.

Configure `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` as a unique 32-byte key encoded as 64 hex characters before saving shop secrets. Keep it in deployment secret storage and back it up through that secret manager. The API rejects malformed keys at startup and requires a key in production. Never commit `.env` or put secrets in frontend variables.

### Existing plaintext shop credentials and key rotation

The credential API encrypts new secret writes with AES-256-GCM (`enc:v1`) and never returns secret values. Legacy plaintext rows remain readable for compatibility, so deploying the code alone does **not** encrypt old rows. Back up the database, set the new key in the process environment, stop payment traffic, and run this workspace command first without `--apply` to preview the number of fields. Then repeat with `--apply`. It updates only non-empty plaintext `apiSecret` and `webhookSecret` values in one database transaction; it never prints credential contents. Confirm shop gateway health after restart.

```powershell
npm run payments:encrypt-credentials --workspace=apps/api
npm run payments:encrypt-credentials --workspace=apps/api -- --apply
```

For a later key rotation, set `PAYMENT_CREDENTIALS_OLD_KEY` to the current key and `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` to the new key in the maintenance process environment. Run a dry run, then add `--apply --rotate`. Keep the API stopped until every encrypted credential has been converted and the new key is deployed. The utility decrypts and re-encrypts inside the maintenance process, and a wrong old key aborts before any writes. Retain a protected backup of the old key until the database backup retention period expires. If a key is lost, the ciphertext cannot be recovered; rotate affected merchant credentials at their provider and save them again.

The local development database has legacy plaintext credentials. Do not point the maintenance command at production until its own backup is verified and the new encryption key has been installed in that environment.

## Database and deployment

The API uses SQLite (`DATABASE_URL` in `.env`). The repository has no `_prisma_migrations` ledger or baseline migration, so do not use `prisma migrate deploy` for the existing installation. The additive SQL files are `apps/api/prisma/migrations/20261028_subscription_payment_attempts/migration.sql`, `apps/api/prisma/migrations/20261029_college_free_printing/migration.sql`, and `apps/api/prisma/migrations/20261029_guest_shop_id_verification/migration.sql`. A read-only inspection on 2026-10-29 confirmed the local `apps/api/prisma/dev.db` contains all payment, institution, guest-verification, and free-print tables but no migration ledger. Do not infer production schema state from this local database; production database path and migration state remain unverified. Local development backups and migration status are recorded in `docs/COLLEGE_FREE_PRINTING_SETUP.md`.

Before migrating an existing database, stop the API and print agent, identify the actual SQLite file from the deployment's `DATABASE_URL`, and make a timestamped copy on the same protected volume. For the repository's current `.env.example` URL (`file:./dev.db`, resolved beside `schema.prisma`), the exact PowerShell commands are:

```powershell
$db = (Resolve-Path '.\apps\api\prisma\dev.db').Path
$backup = "$db.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $db -Destination $backup
Get-FileHash -Algorithm SHA256 -LiteralPath $db, $backup
```

Confirm both hashes match, then apply each SQL file once to the configured database (Prisma CLI reads `DATABASE_URL` from the environment / `.env`):

```powershell
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261028_subscription_payment_attempts/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261029_college_free_printing/migration.sql
npx prisma db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/migrations/20261029_guest_shop_id_verification/migration.sql
npx prisma validate --schema apps/api/prisma/schema.prisma
```

These SQL files are not idempotent. Confirm the new tables and columns are absent before applying; do not rerun a file after partial success. If either command fails, stop, preserve the database and logs, and restore only from the verified backup under an approved recovery procedure. For a non-default URL, replace the backup source with that exact SQLite file and ensure Prisma receives that same `DATABASE_URL`; do not expose a production URL in a shared terminal or report. Do not use `db push` or reset as a substitute for this controlled existing-database migration.

## Unsupported integrations

Cashfree and Stripe are not enabled for checkout. Their webhook routes return 503 and must not be configured with a provider until a full verified integration is implemented. Refund processing, recurring subscription renewals, marketplace transfers, and automated UPI verification are not currently available.
