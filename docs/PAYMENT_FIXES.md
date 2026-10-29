# Payment fixes

- Removed browser-only paid subscription activation and the fallback that registered a paid plan when Razorpay Checkout failed to load.
- Added server-priced, platform-merchant Razorpay subscription orders and provider-side payment fetch before activation.
- Added one-time subscription attempt claiming and captured-payment webhook handling.
- Removed fabricated gateway order IDs, fake Razorpay public keys, global UPI fallback, and platform-merchant fallback for customer print orders.
- Restricted print Razorpay checkout to the selected shop's own configured credentials and added amount/currency/order/capture checks.
- Created counter-cash payment records atomically with orders; collection now requires shop authorization, correct order/payment state, and exact amount.
- Added customer order idempotency keys and one-time manual UPI proof review with reviewer audit fields.
- Encrypted newly entered shop gateway secrets and removed secret values from shop gateway API responses.
- Added fail-fast payment encryption key validation, production key requirement, and a dry-run-first plaintext conversion / ciphertext rotation utility. Shop payment authorization now shares an explicit tested shop-ownership predicate.
- Disabled incomplete Cashfree and Stripe webhook acceptance with explicit 503 responses.
- Updated customer checkout/tracking and shop settings to reflect cash, manual UPI, and shop-owned Razorpay availability accurately.
