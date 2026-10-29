# Shop contact verification

## Implemented flow

Public shop registration now requires a configured SMTP delivery provider before subscription checkout can be created. After the server validates any required subscription payment, it creates the shop in `PENDING_CONTACT_VERIFICATION`, leaves the shop QR inactive, and creates an `EMAIL_VERIFY` action token. The raw random token is sent only in the link; the database stores its SHA-256 digest. Tokens expire after 30 minutes and are claimed atomically once. Successful verification sets `User.emailVerifiedAt`, clears `emailVerificationRequired`, activates only the pending shop, and enables its QR. The owner must then sign in normally.

Subscription payment status and contact verification are separate: a valid paid subscription is retained as paid/active according to the existing subscription flow, while shop access and customer printing remain unavailable until the email token is validated. Registration returns no JWT, QR payload, or agent pairing code.

`POST /api/auth/verify-email` accepts `{ token }`. `POST /api/auth/resend-verification` accepts `{ email }` and returns a generic message. Both are rate-limited. Tokens are placed in the URL fragment, so the browser sends them to the SPA but does not include them in the initial page request. Resend invalidates prior unused verification tokens. SMTP failure invalidates the unsent token and leaves the shop pending; no success response claims that email was delivered. Existing accounts remain usable because the new verification-required field defaults to false.

The email link uses `CUSTOMER_PORTAL_URL` (or the existing customer URL configuration) and the delivery configuration is `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Recovery and new shop signup remain unavailable when delivery is not fully configured. Do not put SMTP credentials in Vite variables.

## Operational limitations

- SMTP delivery is implemented through the existing Nodemailer SMTP integration. This workspace has no evidence of a configured provider, verified sender domain, deliverability, or successful real email delivery. Configure a sandbox/test mailbox and verify delivery before production.
- Email ownership proves control of the mailbox, not ownership of the shop or phone number. Phone verification is not implemented.
- Previously created accounts are not forced through email verification. A controlled backfill policy is needed if production requires verifying existing shop owners.
- The signup UI cannot obtain a paid subscription checkout until SMTP variables are configured. Payment verification remains server-side and separate from email verification.

## Verification checklist

1. Configure a test SMTP account and sender in a non-production environment.
2. Start API and portals with the exact customer URL reachable by the test inbox.
3. Complete a free-plan signup and a Razorpay sandbox plan signup.
4. Verify the account cannot sign in or expose active shop QR before link use.
5. Use the link once; confirm a second use fails, then sign in and fetch shop QR.
6. Resend and confirm the older link fails; test expiration, delivery failure, and rate limiting.
7. Confirm no raw token is persisted or logged and the paid subscription is not changed by the email verification operation.

## Code validation performed

- Prisma schema validation passed.
- The new SQL migration was applied only to a disposable copy of the workspace SQLite file; integrity check passed, foreign-key violations were zero, and the new model/columns appeared. The configured workspace DB was not changed by this migration test.
- All 24 existing API core tests passed. They do not exercise live SMTP delivery or a full database-backed signup.
- Customer and shop dashboard type checks and all workspace production builds passed.
