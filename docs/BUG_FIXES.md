# Bug Fixes

## Changes in this pass

- Removed unsafe agent pairing fallback codes and shop slug/phone pairing. Pairing now requires an unexpired generated code.
- Required a registered agent token for printer sync, heartbeat, and job updates; scoped updates to the agent's shop, validated status/progress, and rejected updates after terminal status.
- Updated the Windows agent to include its paired token when reporting completion/failure.
- Required Razorpay payment signature validation before marking payment paid. Webhook signature verification now requires a configured secret and uses captured raw JSON bytes with constant-time comparison.
- Added actual Razorpay order creation through the existing Razorpay SDK and rejected checkout when credentials are absent. Unsupported customer gateway choices are rejected.
- Added order tracking token authorization to tracking, UPI payment initiation/status/proof, and Socket.IO order room membership. The tracking payload no longer includes document storage keys or raw payment payloads.
- Scoped shop order/action APIs to the authenticated shop; restricted counter marking to counter orders and retry to failed jobs with retries remaining.
- Made counter-payment confirmation an atomic, one-time transition that also records the payment and transaction, preventing duplicate dispatch after repeated requests.
- Restricted uploads to configured MIME types and recognizable file signatures. Rejected expired files and files bound to a different shop during order creation.
- Added route-specific rate limits for authentication, pairing, and uploads; increased tracking-token entropy to 256 bits.
- Removed hardcoded JWT fallback secrets; required environment configuration.
- Reconciled Compose with the schema's SQLite provider, added persistent database storage, removed unused Postgres/Redis containers, and replaced embedded Compose credentials with environment interpolation.

## Known issues still requiring work

- Socket.IO shop rooms are not yet protected by authenticated dashboard identity and shop membership.
- Public file download remains based on an opaque storage key; use expiring authorized download grants before multi-tenant production use.
- Razorpay webhook event amount/currency validation and event-ID idempotency remain to be added.
- Customer checkout does not yet invoke the Razorpay SDK flow end-to-end. UPI proof is manually reconciled by shop staff.
- There is no customer order history or fully generated downloadable receipt.
- No customer order idempotency key is enforced. Concurrent duplicate submissions can create multiple orders.
- No automated test suite exists in the project scripts.

