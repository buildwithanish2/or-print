# Payment audit

## Scope and result

Reviewed the Express payment and order routes, React checkout and shop payment settings, Prisma payment models, environment example, and existing API tests. The data store is Prisma with SQLite. SaaS subscription checkout and customer print-order payments are separate paths after the repair.

| Flow | Before repair | Current behavior |
| --- | --- | --- |
| Paid shop registration | Browser could submit a payment reference; server activated the selected plan without a verified payment | Server creates a platform Razorpay order using the database plan price, validates HMAC and fetches captured payment details before registration |
| Print Razorpay | Checkout could fall back to platform credentials or fabricated order/key data | Requires the selected shop's own enabled Razorpay credentials; verifies signature, provider order, captured status, currency, and amount |
| Cash | Payment row could be created after the order, and operator could mark it paid without verifying a payment row | Order and pending cash payment row are created atomically; authorized shop operator records collection via guarded transaction |
| Manual UPI | Platform VPA fallback and unsafe confirmation state were possible | Uses shop-configured UPI only; customer-submitted reference remains pending until an authorized operator reviews it |
| Cashfree / Stripe | Payment event handlers accepted incomplete/unverified events and no working checkout existed | Checkout remains unavailable and webhook routes fail closed with 503 |

## Exact issues and fixes

- `ShopRegisterPage.tsx` and `shop.controller.ts`: checkout could be skipped or payment ID spoofed. Paid registration now requires a server-created attempt, valid Razorpay signature, provider-fetched captured payment, and atomic one-time attempt claim.
- `payment.service.ts` and `payment.controller.ts`: fabricated Razorpay order identifiers / public keys and platform credential fallback. Removed synthetic checkout responses and isolated platform credentials to subscriptions.
- `order.controller.ts`: cash order/payment persistence was not atomic; cash could appear paid without a matching verified cash record. Order creation and counter payment creation now share a transaction; collection is atomic and idempotent.
- `payment.controller.ts`: online payment verification did not independently validate provider capture, amount, currency, or order association. Added provider verification and guarded state transitions.
- Shop payment settings exposed secret fields and stored new secrets in plaintext. API now returns configuration flags and encrypts newly saved secrets using AES-256-GCM.
- UPI reference is not provider proof. Manual UPI remains pending until operator review and records reviewer identity/time.

## Verification against the current local environment (2026-10-29)

- The configured SQLite file was opened read-only. It has no `_prisma_migrations` ledger and does not yet contain `SubscriptionPaymentAttempt`, the verification columns on `Payment`, the order idempotency columns, or the college-print tables.
- `prisma migrate diff` from this database to `schema.prisma` reported exactly those additions. Both repository SQL migrations were applied to a disposable copy of the database; SQLite foreign-key checks returned zero violations. Neither the configured database nor production was migrated.
- The local database contains non-empty shop gateway secrets in legacy plaintext form. `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` is not configured locally. No credential values were read into output. Set a protected key and use the new dry-run-first conversion utility after a verified backup.
- A Razorpay sandbox order-creation request was attempted using the locally configured test-mode credential pair. The provider returned HTTP 401; no payment was captured. This demonstrates the configured pair is not currently accepted, not that all Razorpay integrations are unavailable.
- The platform webhook secret is not configured, so webhook delivery/signature processing could not be verified.

## Known limitations

- No sandbox payment was captured or subscription activated; the sandbox order request was rejected with HTTP 401. Provider Checkout, callback, and webhook delivery remain unverified.
- Shop-specific Razorpay direct merchant checkout is supported only when each shop supplies its own eligible account credentials. Platform marketplace / Route eligibility and split settlements are not configured or claimed.
- Cashfree and Stripe are disabled because a complete verified checkout integration is absent.
- Subscription purchase currently bills the monthly plan amount and starts a one-month period. Renewal automation, prorated upgrades/downgrades, refund automation, and receipt history need a separate product/billing lifecycle implementation.
- Existing plaintext shop gateway secrets remain readable for compatibility until converted. Production startup now requires the encryption key; use the maintenance utility and credential rotation procedure before deployment.
- SQLite migrations were tested on a disposable copy and the payment/college/guest additions were applied to the local development database after a verified backup. No production database was inspected or modified; its path and migration state remain unknown.
- Subscription plan attempts are currently plan/order based; recurring billing, renewal and merchant settlement remain outside the verified implementation.
