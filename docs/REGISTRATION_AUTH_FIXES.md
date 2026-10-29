# Registration and authentication fixes

## Implemented

- Disabled legacy public customer account creation at `POST /api/auth/register`; it rejects arbitrary and privileged role payloads with a stable 403 response.
- Kept `/shop/register` and `POST /api/shops/register` as the only public account-creation flow. Registration accepts an explicit plan and validated shop details, rejects unexpected fields, assigns `SHOP_OWNER` on the server, and is rate limited to five requests/hour.
- Preserved Razorpay subscription verification in shop registration; paid shop activation remains contingent on the server verifying the signed payment attempt, order, amount, and gateway state.
- Removed customer registration UI and added account-free Student/Teacher ID photo submission on the QR route while preserving guest checkout for regular customers.
- Added shop-owner-only private ID photo review; approval requires the card number, which is stored only as a stable, institution-scoped HMAC used for deduplication and shared usage limits.
- Removed prefilled demo credentials from Admin and Shop login pages and removed a plaintext demo password from Shop settings.
- Made Admin and Shop frontends reject users whose database role does not match the portal. Backend route middleware remains the authorization boundary.
- Removed hardcoded Super Admin creation from the seed. Added a one-time admin provisioning script using operator-supplied environment secrets; it refuses to run when an administrator exists or the email is already in use.
- Restricted shop staff creation and management to shop owners/admins, constrained staff roles/permissions, increased new staff password minimum to 12 characters, and scoped mutation to the current shop.
- Restricted pairing-code welcome email resend to the shop owner/admin for that shop and removed sample pairing-code fallback/logging.
- Removed JWT secret fallback constants from shop/admin controller code in favor of validated secrets.
- Disabled the fake password-reset endpoints: they previously claimed email delivery, exposed reset tokens in development, and did not enforce one-time use. Both now return the same non-enumerating 503 until secure emailed recovery is implemented.
- Added production HTTPS/CORS configuration validation and Docker build-time portal URL configuration. Added development URL entries to `.env.example`.
- Added regression coverage for public registration denial, role tampering on shop signup, login role handling, and admin route authorization in `apps/api/tests/core.test.ts`.

## Account lifecycle choices

Existing customer accounts are retained. No public student/teacher signup is exposed. New applicants can submit an ID photo without an account through shop review. Existing admins and shop owners continue to use the normal login route. No user rows or shop/order/payment/verification history were deleted or modified by this work.

The one-time admin command is:

```powershell
$env:INITIAL_ADMIN_EMAIL = 'admin@your-domain.example'
$env:INITIAL_ADMIN_NAME = 'Platform Administrator'
$env:INITIAL_ADMIN_PASSWORD = '<unique secret from your secret manager, 24+ characters>'
npm run admin:provision-initial --workspace=apps/api
Remove-Item Env:INITIAL_ADMIN_EMAIL, Env:INITIAL_ADMIN_NAME, Env:INITIAL_ADMIN_PASSWORD
```

Run only against the intended initialized database, through a controlled operator session. Do not put the password into shell history, logs, a committed file, or a shared transcript. Existing installations with an admin account should not run this command.

## Known incomplete items

- Password recovery is unavailable (503) until an actual one-time emailed token flow, reset page, token invalidation, and session revocation are implemented and tested.
- Shop contact ownership is not verified by the current registration flow.
- The camera capture hint is not liveness detection; shop review remains manual and should compare the card to the person at the counter where required.
- Back up `COLLEGE_ID_HASH_SECRET` securely and keep it stable; raw ID numbers are discarded, so identity hashes cannot be rebuilt after key loss/rotation.
- Refresh tokens are stateless and cannot be revoked server-side; no logout API exists.
- Contact verification and email delivery depend on SMTP configuration, which is optional in development and is not proof of account ownership today.

## Verification performed

- `npm run test --workspace=apps/api` — 24 passed, 0 failed. Includes controller-level registration denial, password-recovery disablement, role-tampering, shop-owner review scope, ID HMAC normalization, payment regressions, and free-print allowance checks.
- `npm run type-check` — all workspaces passed.
- `npm run build` — API, customer, shop, admin, and shared package builds passed.
- `npx prisma validate --schema apps/api/prisma/schema.prisma` — passed.
- Guest-verification migration tested against a temporary copy of local SQLite: existing row counts preserved and zero foreign-key violations.
- `docker compose config --quiet` — passed using temporary HTTPS example values; these were not real credentials and were not saved.
- No lint script is defined in the package scripts. No Docker image build, live gateway payment, production database migration, or physical print test was run.

