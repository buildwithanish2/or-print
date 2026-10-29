# Password recovery setup

## Current implementation

`POST /api/auth/forgot-password` creates a random 256-bit action token only for an active matching account, stores only its SHA-256 digest, and emails a 30-minute link. The token is in the URL fragment, which is not sent in the initial HTTP page request. The response is generic for existing and unknown addresses. `POST /api/auth/reset-password` atomically consumes a valid, unused token, hashes a 12–128 character password with bcrypt, and increments `User.sessionVersion`; access and refresh tokens issued before reset are rejected. Used and superseded reset tokens cannot be replayed. The raw token is never returned by the API or intentionally logged.

Password recovery stays disabled with HTTP 503 when any required SMTP value is missing. Provider delivery errors do not reveal account existence; the created token is invalidated. Rate limits are five recovery/action requests per IP per hour. If delivery is misconfigured, no browser-side reset can bypass the backend gate.

## Configure email

Set these variables in the API's secret store, using a dedicated provider account and a verified sender address:

```env
SMTP_HOST=mail-provider-host
SMTP_PORT=587
SMTP_USER=provider-user
SMTP_PASS=provider-secret
SMTP_FROM=OR PRINT <no-reply@example.invalid>
CUSTOMER_PORTAL_URL=https://customer.example.invalid
```

The `.invalid` domain above is illustrative; use the actual owned domain. Keep provider credentials server-side. Never use `VITE_*` for secrets. The customer URL must be the externally reachable HTTPS portal so recipients can open the reset link.

## Safe test procedure

Use an SMTP sandbox or test mailbox; do not test with real customer credentials. Confirm generic responses for known/unknown accounts, successful one-time reset, expired/used token rejection, password validation, provider failure, rate limiting, and rejection of old tokens after reset. Inspect redacted logs only. A configured account is not evidence that email delivery has been tested.

## Limits

Refresh tokens are stateless JWTs; session-version checks now revoke them after recovery. Other active session versions are not stored as independent records. There is no account recovery through SMS or administrator-issued reset token.

The recovery page is available at `/reset-password`; shop and admin sign-in screens link to it. Customer-portal route `/verify-email` handles shop email links. Verification/recovery API routes are `/api/auth/verify-email`, `/api/auth/resend-verification`, `/api/auth/forgot-password`, and `/api/auth/reset-password`.

The API test suite passed 24/24, including the no-provider disabled-recovery response and malformed-token rejection. Full database-backed token lifecycle tests and real SMTP sandbox delivery remain unverified because no test mail provider credentials were provided.
