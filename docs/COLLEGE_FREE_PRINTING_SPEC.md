# College Free Printing

## Approved policy

Only Student or Teacher applicants whose college ID has been approved by the selected shop owner may request free printing without creating an account. The global admin policy must be active, the institution must be active and eligible, and the selected shop must participate. Black & white and color are separately controlled by global policy and printer capabilities. Regular customers retain the shop's paid checkout.

Limits are configured separately for Students and Teachers: daily/monthly page impressions and daily/monthly copies. A page impression is selected document pages multiplied by copies; it is not a physical sheet count. Dates use Asia/Kolkata (`Asia/Kolkata`) calendar boundaries. Shop participation can only enable/disable a shop under the global restrictions and cannot change the global limits.

## Workflow

1. At `/print/:shopSlug`, a customer chooses Student or Teacher and submits a camera photo of a college ID and an eligible institution. No account, email, phone, or signup form is required. The browser's camera-capture hint is not liveness detection.
2. The photo is stored in a private persistent directory, limited to JPG/PNG and 5 MB, and bound to a high-entropy access token held by the applicant's browser. The token scopes status, file uploads, and free-print requests to that shop's verification application.
3. The selected shop owner can view only that shop's pending photos in Shop Dashboard → College Free Printing. The owner compares the card and enters the card ID number to approve. The server stores only a keyed HMAC of the normalized number plus institution; it does not store the raw number. Rejection requires a reason.
4. Approval is recorded with reviewer and shop, and the photo is deleted. Pending photos are deleted and applications expire after 30 days. The ID hash prevents repeat approvals at the same shop and keys daily/monthly limits across shops for the same institution/card number.
5. At checkout the server verifies the opaque access token, approval, institution, global policy, shop participation, printer capability, file-session ownership, and selected options. It calculates page impressions and atomically reserves daily/monthly pages and copies before accepting the order.
6. Eligible orders are recorded at ₹0.00 with `COLLEGE_FREE` / `NOT_REQUIRED`, no `Payment` or gateway transaction, and a `FreePrintReservation`. The normal print-job queue and Windows agent dispatch path is used.
7. Agent job status reconciles allowance: all failed jobs release the reservation; completed jobs consume the requested allowance. Mixed completed/failed work consumes the full reservation conservatively. A reconciled failed free order cannot be retried; a new order rechecks limits.

## Policy precedence

Effective eligibility is the intersection of the global policy, active/eligible institution, shop-owner-approved ID, shop participation, and the selected online printer's capabilities. Any global denial wins. Daily/monthly usage is keyed by a stable keyed hash of the college ID scoped to institution, shared across participating shops. Shop owners cannot change global policy or limits.

## Usage and hardware limitation

Usage caps are enforced against accepted page impressions and copies, with in-progress work reserved atomically. The agent currently reports job status but not reliable physical page or sheet counters. Therefore dashboard completed impression figures are derived from accepted order requests whose jobs reached the agent's `COMPLETED` state; they are not represented as verified physical page counts. Reservations and quotas are conservative when partial output cannot be measured.

## Implementation plan and status

- Reuse existing users, shops, online printer capability data, orders, print jobs, APIs, and agent dispatch: implemented.
- Add private institution review, persistent policy, shop opt-in, usage reservation/reconciliation, and audit history: implemented with additive SQLite migration.
- Add account-free camera-photo application, shop-owner review, private photo preview, ID-number HMAC duplicate prevention, and zero-price order submission: implemented.
- Add admin policy/institution/review/shop controls and shop operational dashboard: implemented.
- Automated physical printer confirmation/cancellation and exact page/sheet usage: unsupported by current agent protocol and remains a limitation.
