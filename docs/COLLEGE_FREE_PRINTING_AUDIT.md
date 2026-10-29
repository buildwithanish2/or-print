# College Free Printing audit and implementation notes

## Existing architecture found

- API: Express 4 and TypeScript, Prisma 5 with SQLite.
- Portals: React/Vite customer, shop dashboard, and admin dashboard.
- Existing print workflow: `Order`, `OrderItem`, `PrintJob`, online `Printer` capability flags, Socket.IO delivery to the .NET 8 Windows print agent, and agent status callbacks.
- Existing price calculation: `PricingEngineService`, including shop/global rules. Existing users had no institution verification, student/teacher workflow, or free-print policy.
- Public customer/student/teacher registration is disabled; public shop registration assigns `SHOP_OWNER` server-side.
- Uploaded customer print files use the existing print-file storage. ID evidence uses a separate private persistent volume, has JPEG/PNG magic-byte and size checks, is visible only to the owner of the selected shop while pending, and is deleted after review or 30-day expiry.

## Delivery

Added an account-free guest verification record and events, institution directory, persistent global policy, shop participation, SQLite-compatible daily/monthly reservation counters, order-attributed reservations, and guest file-session binding. The customer submits a camera photo and receives an opaque, high-entropy access token. Only the selected shop owner can view/review it. On approval, the reviewer enters the card number; the server stores a keyed HMAC scoped to institution, never the raw number. Limits share this identity hash across shops. Routes under `/api/free-print`, shop review UI, customer verification UX, free-price calculation, atomic reservation, and agent reconciliation are implemented. Free orders do not create payments or gateway transactions.

## Precedence and limitations

Global policy, institution status, shop-owner-approved ID, matching application token, shop participation, and printer capabilities are all required. Shop settings cannot raise limits. Limits count accepted requested page impressions (`selected pages × copies`) and copies, not verified physical sheet output. Asia/Kolkata calendar periods are used. The camera capture attribute is a browser hint, not a liveness guarantee; staff should compare the card with the person at the counter where assurance matters.

The print agent does not send page-counter data and has no cancellation protocol. It cannot substantiate exact physical page/sheet totals or cancel a dispatched job. The implementation reports request-derived impressions and agent job completion as separate facts. Failed jobs release allowance only after all jobs fail; a new order is required after reconciliation. Exact partial-output accounting and cancellation are not claimed.

The migration `20261029_guest_shop_id_verification` is additive to the current Prisma schema. It has been applied to the local development database only after a verified local backup; production database path/schema remain unknown and no production database was changed. The global policy defaults disabled and limits default to zero; an administrator must configure policy, eligible institutions, and participating shops before free printing can be used. Production must set and securely back up `COLLEGE_ID_HASH_SECRET`; changing it without a controlled identity migration would reset identity matching and usage buckets.
