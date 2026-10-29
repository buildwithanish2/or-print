# Security Audit

Audit date: 2026-10-28. `.env` values were not copied into this report.

## Fixed

- Removed hardcoded JWT fallbacks; missing secrets prevent API authentication modules from starting.
- Public order tracking and customer payment status/proof operations require the random per-order tracking token. Socket.IO order subscriptions check the same token.
- Razorpay browser verification requires a matching gateway order ID and valid HMAC signature. Razorpay webhook requests require the configured webhook secret and raw-body signature validation.
- Agent REST status and printer synchronization require the paired agent token. Job reports are restricted to the agent's shop and validated against status/progress rules.
- Pairing no longer accepts predictable demo codes or shop slugs/phone numbers.
- Shop action authorization checks ownership for order payment and retry endpoints.
- Upload MIME types and basic file signatures are validated before persistence; upload size and count are limited.
- Login/register/token recovery endpoints are limited to 10 requests per 15 minutes per IP; agent pairing is limited to 5, and uploads to 20.
- Compose no longer embeds JWT or gateway secrets.

## Remaining risks

- Shop-room joins now require a valid dashboard JWT and matching shop ownership/staff membership for private shop IDs. Public shop slug rooms remain available for non-sensitive public shop updates.
- **High:** File download endpoint is unauthenticated. UUID filenames are difficult to guess but behave as bearer links and are exposed through order/job flows. Add scoped, expiring signed download grants for customers/agents.
- **High:** Full authorization review of all controller methods is incomplete. Admin and shop routes should be tested for IDOR and role scope before deployment.
- **Medium:** Razorpay webhook handling needs amount/currency checks and durable event-ID idempotency. Credentials and webhook configuration must be set before enabling it.
- **Medium:** Global API rate limit is generous (1000 requests per 15 minutes). Login, pairing, and upload now have tighter limits; payment-proof and payment-init endpoints still need dedicated limits, and proxies must configure Express trusted-proxy behavior correctly.
- **Medium:** `.env` exists locally and has sample-looking JWT values. It is gitignored and was not modified. Replace local credentials before any deployment; use unique random secrets.
- **Medium:** Customer tracking token is placed in the query string and therefore may appear in browser history/referrer logs. Use a fragment or short-lived exchange/session token if tracking links are shared broadly.
- **Medium:** SQLite is appropriate for a single API instance; concurrent multi-instance deployments need a planned PostgreSQL migration and migration history.
- **Medium:** No automated security/dependency scan or penetration tests are defined in the project.

## Dependency audit

`npm audit --omit=dev` after safe `npm audit fix` reported 11 advisories in the production dependency tree: 3 moderate, 6 high, and 2 critical. Affected packages include `@mapbox/node-pre-gyp`/`tar`, `dompurify` through `jspdf`, `express`/`qs`, `nodemailer`, `pdfjs-dist`, `sharp`, `uuid`, and `zod`. The remaining remediations offered by npm require major-version changes for packages that affect document rendering, image processing, email, or validation. Those were not forced without compatibility testing. Re-run `npm audit` after planning those upgrades.

## Not found in inspected paths

No payment API keys were copied into generated documentation. The API uses Prisma parameterized queries. CORS defaults to wildcard origins while enabling credentials; production must set an explicit `CORS_ORIGIN` allowlist. Error logs may include request errors and should be reviewed for sensitive payloads before production logging.

