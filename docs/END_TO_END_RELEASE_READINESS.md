# PrintQ End-to-End Verification and Release Readiness

Date: 2026-10-30
Branch: `codex/reference-replication`

This report separates source-level tracing and automated tests from behavior that requires deployed services, an authorized test shop, or Windows printer hardware. No production customer records were accessed or changed, no production deployment was performed, and no Windows Agent release was published.

## Workflow map and verification status

| Workflow step | Frontend / entry point | API route and controller | Data / service | Status and evidence |
|---|---|---|---|---|
| QR and shop page | Customer Web `App.tsx`, `CustomerLandingPage.tsx` | `GET /api/shops/public/:slug` → `ShopController.getShopBySlug` | `Shop` | **Automated/source verified.** Slug is encoded and the response slug is checked against the requested slug. No production shop data was queried. |
| Document upload | `FileUploader.tsx` | `POST /api/files/upload` → `FileController.uploadFile` | `FileRecord`, storage service | **Automated/source verified.** Upload route uses validation/limits and protected storage path; real customer document upload was not performed. |
| Pricing | `PrintConfigPanel.tsx`, `PriceBreakdownBar.tsx`, `CustomerLandingPage.tsx` | `POST /api/pricing/calculate` → `PricingController.calculatePrice` | `PricingRule`, `InstitutionPricingRule`, `PricingEngineService`, free-print policy | **Automated/source verified.** Server calculates totals; client-submitted totals are not authoritative. |
| Order creation | `CheckoutModal.tsx`, `CustomerLandingPage.tsx` | `POST /api/orders/create` → `OrderController.createOrder` | `Order`, `OrderItem`, `Payment`, `PrintJob`, `FreePrintReservation` | **Automated/source verified.** Creation uses server-side price/eligibility checks and idempotency; response contains canonical tracking reference/token. No production order was created. |
| Online payment | `OrderTrackingPage.tsx` | `POST /api/payments/create`, `POST /api/payments/verify`, `GET /api/payments/:orderNumber/status` → `PaymentController` | `Payment`, `Order`; gateway services | **Automated/mocked only.** Server amount and verification are authoritative. No sandbox or live charge was run. |
| Manual UPI | `OrderTrackingPage.tsx` proof submission; `LiveQueuePage.tsx` review | `POST /api/payments/upi/submit-proof`, `POST /api/payments/shop/verify-upi` → `PaymentController.submitUpiProof` / `verifyShopUpiPayment` | `Payment`, `Order`, shop access middleware | **Automated/source verified.** UTR submission sets a submitted/pending state; only authorized shop verification changes it to paid and queues printing. No real UPI transfer was verified. |
| Cash at counter | `CheckoutModal.tsx`, `LiveQueuePage.tsx` | `POST /api/orders/:orderId/mark-paid` → `OrderController.markOrderAsPaid` | `Order`, `Payment`, `PrintJob`; `requireShopAccess` | **Automated/source verified.** Selecting cash leaves `CASH_ON_COUNTER`; authorized collection is a separate transition. No real cash collection was performed. |
| College free print | `CustomerLandingPage.tsx`, `OrderTrackingPage.tsx` | `GET /api/free-print/options/:slug`, `POST /api/free-print/guest-verification`, order creation → `FreePrintController`, `OrderController` | `GuestInstitutionVerification`, verification events, `FreePrintReservation`, `Order` | **Automated/source verified.** Review and allowance checks occur server-side; eligible orders use `NOT_REQUIRED` and zero amount. No real ID evidence or customer records were used. |
| Shop queue and retry | `LiveQueuePage.tsx` | `GET /api/orders` and `POST /api/orders/jobs/:jobId/retry` → `OrderController` | `PrintJob`, `Order`, `Printer` | **Automated test verified.** Retry now writes the new attempt idempotency key transactionally, shared by WebSocket and polling delivery. Concurrent stale retry is rejected. Operator confirmation is required because prior physical output may be unknown. |
| Agent pairing and heartbeat | Shop Dashboard `PrintAgentPage.tsx`; Windows Agent pairing/settings UI | `POST /api/shops/agent/pairing-code`, `POST /api/agents/pair`, `POST /api/agents/heartbeat` → `ShopController`, `AgentController` | `PrinterAgent`; DPAPI-backed agent configuration | **Automated/mock verified.** Code is short-lived and consumed atomically; agent must receive backend confirmation. No production device was paired. |
| Job delivery and file access | Windows Agent `WebSocketClientService.cs` | `POST /api/agents/jobs/poll`, `GET /api/agents/jobs/:jobId/file`, `POST /api/agents/jobs/:jobId/status` → `AgentController` | `PrintJob`, `Order`, `OrderItem`, `FileRecord`; persistent `OfflineQueueService` | **Automated/source verified.** Agent authorization is shop-scoped; dispatch requires paid or `NOT_REQUIRED` order. Polling and socket delivery exist. No deployed agent session was exercised. |
| Stale claim recovery | Windows Agent reconnect/poll; Shop Dashboard queue | `POST /api/agents/jobs/poll` → `AgentController.pollPrintJobs` | `PrintJob`, `Order`; stale-claim cutoff helper | **Automated/source verified.** Stale `DOWNLOADING` / `PRINTING` / `SENT_TO_SPOOLER` claims become failed for operator inspection; they are not automatically requeued, avoiding silent duplicate physical output. |
| Printer discovery and selection | Windows Agent `MainWindow.xaml.cs` | `POST /api/agents/printers/sync` → `AgentController.syncPrinters` | `Printer`, `PrintSpoolerService.GetInstalledPrinters`, `WebSocketClientService` | **Automated tests cover selection logic only.** Source enumerates installed Windows queues and filters physical printers for physical-order selection. Actual USB/network printer enumeration and simultaneous physical queues were not available to test here. |
| Spooler and tracking | Windows Agent `PrintSpoolerService.cs`; Customer Web `OrderTrackingPage.tsx` | Agent reports `PRINTING` / `SENT_TO_SPOOLER`; customer reads `GET /api/orders/track/:orderNumber?token=...` | `PrintJob`, `Order`; `OrderController.getOrderByNumber` | **Source/mock verified only.** `SENT_TO_SPOOLER` is not represented as confirmed physical completion. No physical print was performed; tracking was not checked against production. |

## Confirmed fix in this verification pass

Before the fix, the manual retry endpoint generated a new idempotency key only in the immediate WebSocket payload. The persisted `PrintJob` retained its prior key. If the agent was offline during the socket event and received the retry later through durable polling, its persistent at-most-once ledger rejected the old key as already processed. The dashboard also offered a generic “Print Now” action for non-pending orders even though the backend retry operation only accepts eligible failed jobs.

The retry now uses a compare-and-set transaction on the failed job, current attempt count, eligible order/payment state, and online shop printer. It increments attempts, persists a deterministic per-attempt idempotency key, resets the job timestamps, and updates the order state atomically. The same stored key is sent over WebSocket and returned by polling. The dashboard exposes retry only for failed jobs with attempts remaining and asks the operator to inspect output before retrying.

This behavior is covered by API tests for the persisted key and both delivery path consistency, missing physical-output confirmation, and concurrent stale retry rejection; an agent test confirms a new explicit attempt key can pass its persistent at-most-once ledger after restart.

## Automated checks executed

| Check | Result |
|---|---|
| `npm test --workspace=apps/api` | **Passed** — 58 tests, including the two retry regressions |
| `npm test --workspace=apps/customer-web` | **Passed** — 14 tests |
| `npm test --workspace=apps/shop-dashboard` | **Passed** — 14 tests |
| `npm test --workspace=apps/admin-web` | **Passed** — 10 tests |
| `dotnet test apps/print-agent/tests/PrintQRAgent.Tests.csproj --no-restore` | **Passed** — 27 tests |
| `npm run type-check --workspace=apps/api` | **Passed** |
| `npm run type-check --workspace=apps/customer-web` | **Passed** |
| `npm run type-check --workspace=apps/shop-dashboard` | **Passed** |
| `npm run type-check --workspace=apps/admin-web` | **Passed** |
| `npm run build --workspace=apps/api` | **Passed** |
| `npm run build --workspace=apps/customer-web` | **Passed** |
| `npm run build --workspace=apps/shop-dashboard` | **Passed** |
| `npm run build --workspace=apps/admin-web` | **Passed** |
| `npx prisma validate --schema apps/api/prisma/schema.prisma` | **Passed** — schema valid; no migration was applied |
| `git diff --check` | **Passed** |

These are local automated checks; they do not verify a live gateway, deployed API, Windows installation, physical printer, or actual paper output.

## Release readiness and remaining blockers

- Payment-to-print rules are guarded in source and exercised by automated tests. Real Razorpay/Cashfree credentials and sandbox flows were not used in this verification.
- Manual UPI remains manual: UTR submission is not proof of payment, and printing waits for shop-side verification.
- Cash collection and print completion are distinct states.
- Print job handoff and state reporting are covered by source/tests, but pairing against a deployed test shop was not performed.
- Multiple installed Windows printer selection and actual spooler behavior require a Windows test machine with at least two printers. Physical completion is not claimed based on spooler acceptance.
- The Windows Agent remains unsigned and is not released or deployed by this task.
- No production database, files, payment records, Docker volumes, or configuration were accessed or modified.
- No production deployment was performed.
