# Feature Status

Status is based on code paths inspected on 2026-10-28, not the README feature list.

| Feature | Status | Notes |
|---|---|---|
| Customer shop QR landing | Implemented | Routes by shop slug; generated shop QR points to customer landing page. |
| Upload PDF/images | Partial | Server supports configured PDF, image, and Office MIME types. Basic signature checks reject obvious spoofing; Office files are not converted for printer-safe preview. |
| Document preview | Partial | PDF browser preview and image metadata; no Office rendering. |
| Page range / copies / paper / color / duplex | Implemented | Shared validation and server-side price calculation. Check printer capability at dispatch remains important. |
| Pricing | Partial | Shop/global rules, discounts, GST, and service fee. Float-based arithmetic and weak page-range semantics need follow-up. |
| Order creation | Implemented | Database transaction for order and items; no idempotency key supplied by customer, so duplicate submissions remain possible. |
| Tracking | Implemented | Polling and Socket.IO; token now required to read/subscribe. |
| UPI | Partial | Intent/QR and manual UTR review. No bank API reconciliation. |
| Razorpay | Partial | SDK order creation and signed verification/webhook support; customer checkout UI and full payment lifecycle require integration verification. |
| Agent pairing | Implemented with controls | Temporary pairing code and token; demo/slugs no longer bypass pairing. |
| Printer discovery and queue | Partial | Windows agent supports spooler workflow, retry/offline queue. Physical completion cannot be independently confirmed. |
| Order history | Missing | No customer account/order history identified. Shop order lists are present. |
| Receipts | Partial | Tracking data exists; no complete downloadable receipt generation found. |
| Admin/shop operations | Partial | Broad screens and routes exist; comprehensive authorization review remains open. |
| Automated tests | Minimal | Four Node built-in tests cover page-range counting and request validation; integration/security workflow coverage is still missing. |

