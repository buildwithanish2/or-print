# SMTP Email Setup

The API uses Nodemailer with authenticated SMTP for shop-owner verification, password recovery, welcome messages, and password-change notices. SMTP credentials are read only by the API process. Do not add them to Vercel frontend environment variables or any `VITE_*` setting.

## API environment

Configure these values in the private environment of the API host (for this deployment, the EC2/Docker Compose host):

| Variable | Required | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | Yes for email | SMTP server hostname from the chosen provider |
| `SMTP_PORT` | Yes for email | Provider's SMTP port; typically 465 or 587 |
| `SMTP_SECURE` | Optional | `true` for implicit TLS (usually port 465); `false` for STARTTLS (usually port 587). If omitted, port 465 enables TLS. |
| `SMTP_USER` | Yes for email | SMTP account username |
| `SMTP_PASS` | Yes for email | SMTP password or provider-issued app password |
| `SMTP_FROM_EMAIL` | Yes for email | Verified sender address |
| `SMTP_FROM_NAME` | Optional | Sender display name; defaults to `AnishNova Print` |
| `SMTP_FROM` | Legacy only | Existing single-field sender format; use the split sender fields for new configuration |
| `SHOP_PORTAL_URL` | Required in production | Public shop dashboard URL used for verification and reset links |
| `APP_PUBLIC_URL` | Optional | Fallback public app URL when `SHOP_PORTAL_URL` is not set |
| `CUSTOMER_PORTAL_URL` | Required in production | Customer portal URL used to link to the shop's print page |
| `PUBLIC_API_URL` | Existing required setting | Public API URL; `API_PUBLIC_URL` is accepted as an alias |

Production application URLs must use HTTPS. Set SMTP credentials only on the API host. Use the SMTP provider's own setup page to create a dedicated sender and app-specific credential; never use a personal account password where the provider supports app passwords.

Example placeholder configuration (replace values only in the API host's private environment):

```dotenv
SMTP_HOST="smtp.provider.example"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="mailer@example.com"
SMTP_PASS="replace-with-provider-app-password"
SMTP_FROM_EMAIL="no-reply@example.com"
SMTP_FROM_NAME="AnishNova Print"
SHOP_PORTAL_URL="https://shop-dashboard-one-eosin.vercel.app"
CUSTOMER_PORTAL_URL="https://customer-web-six-livid.vercel.app"
PUBLIC_API_URL="https://api.anishnova.com"
```

The example host and credential are placeholders, not a working SMTP account.

## Docker Compose

The API service in the repository's `docker-compose.yml` explicitly passes SMTP variables into the API container. Compose reads `${NAME}` substitutions from the shell or its project `.env`; the Node API's `dotenv` loader does not automatically read a host file from inside a container. Keep the production `.env` beside `docker-compose.yml`, limit file permissions to the deployment operator, and do not commit it.

After setting SMTP variables on EC2, validate the Compose configuration without printing its resolved values:

```sh
docker compose config --quiet
```

Then recreate only the API service so it receives the updated environment:

```sh
docker compose up -d --no-deps --build api
docker compose ps api
docker compose logs --tail=100 api
```

Review logs for application errors, but do not enable shell tracing or dump the resolved Compose configuration because it contains secrets. This change does not require deleting or recreating database volumes.

## Behavior and security

- Shop-owner signup creates the account and one-time verification token first. Verification and welcome email delivery happen only after the database transaction succeeds.
- Verification and recovery links contain random tokens in the URL fragment; only a SHA-256 digest is stored in SQLite. Tokens expire after 30 minutes and are single-use.
- Password recovery has a generic response for known and unknown email addresses, an IP rate limit, and a per-account 60-second resend cooldown. If SMTP is unavailable, recovery stays disabled or the generic request completes without activating a token.
- Shop dashboard password recovery lives at `/forgot-password`; successful email links return to `/reset-password`. Shop account verification returns to `/verify-email`.
- Password login remains email plus password. Login OTP is not part of the existing authentication flow and has not been enabled.
- A successful password reset increments the user's `sessionVersion`, invalidating existing access and refresh tokens, then sends a best-effort security notice.
- Welcome delivery is deduplicated per user with `User.welcomeEmailSentAt`. Concurrent sends are claimed atomically; after a confirmed SMTP failure, the claim is released so an authorized shop operator can retry using the existing welcome-email action. SMTP itself cannot offer exactly-once delivery if the connection fails after the provider accepted a message.
- Mail errors are logged without email addresses, tokens, SMTP credentials, or message contents.

## Database migration

The additive migration `apps/api/prisma/migrations/20261031_shop_welcome_email_dedupe/migration.sql` adds a nullable `User.welcomeEmailSentAt` column. It preserves existing rows and does not touch existing verification or payment records. Do not run it against production until the database path, migration ledger, and verified backup have been checked. For the production backup and migration procedure, follow `docs/PRODUCTION_MIGRATION_PLAN.md`.

Generate the Prisma client and validate the schema during deployment/build:

```sh
npm run db:generate --workspace=apps/api
npx prisma validate --schema apps/api/prisma/schema.prisma
```

Do not use `prisma db push` or reset commands as a production migration procedure.

## Verification without sending mail

The API test suite uses an injected fake Nodemailer transport. Tests do not connect to an SMTP provider or send real messages. A deployment operator should use the provider's sandbox/test account or a controlled mailbox to validate delivery, sender authentication (SPF/DKIM/DMARC), link reachability, and spam-folder behavior before enabling production signup and recovery.
