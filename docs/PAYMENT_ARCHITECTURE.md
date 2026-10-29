# Payment architecture

## Payment domains

### OR PRINT subscriptions

The public subscription-order endpoint accepts a plan ID only. The API reads the price from `SubscriptionPlan`, creates a platform Razorpay order, and records a short-lived `SubscriptionPaymentAttempt`. Browser checkout receives only the public key/order/amount. Registration verifies the callback HMAC and fetches payment status from Razorpay, then atomically consumes the attempt and creates the shop's active subscription. A verified webhook can mark the attempt paid, but it cannot register a shop on its own.

### Customer print orders

Print orders store their own `Payment` row and link to the selected shop/order. Cash is pending until an authorized operator records collection. Manual UPI is pending until an operator confirms the exact amount. Razorpay is available only when the selected shop has enabled its own merchant credentials. Platform Razorpay credentials are never used for print orders.

No marketplace split/transfer is implemented. This deployment therefore requires direct shop merchant accounts for online print payments. Provider Route/marketplace eligibility is account-specific and remains unverified.

## State and integrity

- Order creation accepts an idempotency key and request hash; identical retries return the existing order and changed payloads conflict.
- Cash order and payment are created in one database transaction.
- Payment/order transitions use conditional updates and transaction records; duplicate collection or callbacks do not create an additional payment transaction.
- Payment verification checks provider-captured state, expected gateway order, amount, and INR currency.
- Payment attempt and transaction tables remain in SQLite-compatible Prisma models; migrations are additive.
- Webhook handlers for unsupported providers fail closed. Razorpay webhook validation uses the unmodified request body and a timing-safe HMAC comparison.

## Shop credential storage

New shop gateway secrets are AES-256-GCM encrypted at rest with `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`; shop API responses return only configured flags. Production requires a valid key at API startup. Legacy plaintext secrets remain readable for a controlled transition. `apps/api/scripts/encrypt-payment-credentials.ts` has a no-write dry run by default; its explicit `--apply` mode converts plaintext fields atomically. For ciphertext key rotation, provide old and new keys through the maintenance process environment and use `--rotate`; the API remains stopped until the operation completes. Both modes require a verified SQLite backup and never print credential values.
