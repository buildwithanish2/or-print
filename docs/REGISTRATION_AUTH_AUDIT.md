# Registration and authentication audit

Audit date: 2026-10-29. Scope: customer, shop, and admin Vite applications; Express routes/controllers/middleware; Prisma user and institution-verification records; seed and provisioning scripts.

## Registration and account creation paths

| Entry point | Access and behavior | Finding |
| --- | --- | --- |
| Customer QR page `/print/:shopSlug` | `apps/customer-web/src/pages/CustomerLandingPage.tsx`; guest document upload/order creation is supported. | Regular guest checkout remains. Student/Teacher applicants can submit a college ID photo without signing in or creating an account. |
| `POST /api/auth/register` | `apps/api/src/routes/auth.routes.ts` → `AuthController.register`. | Previously created `CUSTOMER` accounts. Now returns `403 PUBLIC_REGISTRATION_DISABLED` for every payload, independent of requested role. |
| Public shop page `/shop/register` | `apps/customer-web/src/pages/ShopRegisterPage.tsx` → `POST /api/shops/register`. | Kept as the only public account registration. Server validates a strict shop-onboarding schema and assigns `SHOP_OWNER`; the request cannot choose a role. Route is limited to five attempts per IP per hour. Paid plans require server verification of the platform Razorpay payment attempt/signature/status before account activation. |
| Admin dashboard Add Shop | `POST /api/admin/shops/create` in `apps/api/src/routes/admin.routes.ts`. | Protected by `authenticate` and `requireAdmin`; creates a `SHOP_OWNER`, not an admin. |
| Shop staff dashboard | `POST /api/shops/staff`. | Authenticated shop route. Now only shop owner/admin can create staff, server assigns `SHOP_STAFF`, and role choices are limited to operator/manager/cashier. Update/delete are scoped to the actor's shop. |
| Admin seed/bootstrap | `apps/api/prisma/seed.ts`, `apps/api/scripts/provision-initial-admin.ts`. | The former seed-created hardcoded Super Admin was removed. Initial admin setup is a one-time operator command that requires supplied secrets and refuses if any admin or matching account already exists. |

No OAuth/social login or public student/teacher signup route was found. Public plan listing and subscription-payment order endpoints do not create accounts. The staff and agent pairing flows are separate from public owner registration. Admin registration is absent; admin-created shops remain behind admin middleware.

## Login, recovery, and role assignment

| Flow | Implementation and controls |
| --- | --- |
| Common login | `POST /api/auth/login`, max 10 attempts per 15 minutes. Password hash and active status are checked; role is loaded from the database and never accepted from login input. |
| Shop portal | `apps/shop-dashboard/src/pages/LoginPage.tsx`; accepts only `SHOP_OWNER` and `SHOP_STAFF` before storing the access token. APIs remain server-authorized. |
| Admin portal | `apps/admin-web/src/pages/LoginPage.tsx`; accepts only `ADMIN` and `SUPER_ADMIN`; admin APIs independently require the same server-side role. |
| Legacy account-bound free-print review | Existing authenticated users may still use `/api/free-print/verification`, with admin review. New guests use the shop-owner photo review workflow below; neither UI role selection nor a request payload alone grants eligibility. |
| Password reset | `POST /api/auth/forgot-password` and `/reset-password` are rate limited. The old handler did not send email, claimed delivery, returned the token in development, and issued reusable tokens. Both endpoints now return `503 PASSWORD_RECOVERY_UNAVAILABLE` without looking up an account or returning a token. Recovery must remain unavailable until secure one-time email recovery is implemented. |
| Contact verification | Shop welcome email is informational and not an email/phone ownership verification. No general OTP or verified-contact workflow was found. |
| Refresh/logout | Refresh tokens are signed JWTs accepted at `/api/auth/refresh`; no server-side refresh-token registry/revocation or logout endpoint was found. Clients clear local tokens on logout. |

Passwords are stored as bcrypt hashes. New shop and staff passwords use 12 rounds and a 12-character minimum. Existing credentials are not rewritten. JWT access tokens last one day and refresh tokens seven days. Current portals keep tokens in browser local storage; production must use HTTPS and strict origin controls. Production secrets are validated at startup.

## College free-print identity workflow

The legacy `POST /api/free-print/verification` route requires authentication and admin review. The new account-free route `POST /api/free-print/guest-verification` accepts a private JPEG/PNG ID photo and returns an opaque application token; `/api/free-print/guest-verification/status` returns only that token's status. The selected shop owner reviews at `/api/free-print/shop/verifications/:id/evidence` and decides at `/api/free-print/shop/verifications/:id`. On approval the owner submits the ID number; the server stores only a keyed HMAC of the normalized number, scoped to institution. The token scopes guest uploads and free orders to that shop. Quotas are shared by the keyed identity across shops. The QR checkout checks approval, institution, policy, shop participation, printer capabilities, file-session ownership, and reserved usage.

The guest flow does not create a student/teacher account. A camera capture hint is not a liveness check; shop owners visually review the image and number, and should compare the card with the person at the counter when needed. Approved identity hashes—not raw numbers—key quota records across shops. Keep `COLLEGE_ID_HASH_SECRET` stable and backed up: changing it without a migration would reset identity matching and usage keys. Shop owners cannot change the institution directory or global policy.

## Access-control findings and fixes

- Shop staff mutation endpoints previously used staff record IDs without a shop-scoped lookup and permitted staff to manage other staff. Owner/admin-only checks and shop-scoped update/delete were added.
- Public shop welcome-email resend previously lacked owner authorization. It now requires authenticated shop access and checks target shop ownership; missing pairing codes are no longer replaced with a demo code.
- Demo credentials and the seed-created predictable Super Admin were removed. Initial admin provisioning is explicit and refuses duplicate administrator creation.
- A shop-specific password field previously used text input; it is now masked. Demo login defaults were removed from shop and admin portals.
- The API's production CORS wildcard fallback was removed; startup now requires explicit HTTPS public API and portal URLs and explicit HTTPS CORS origins.
- Web portal production bundles previously used localhost fallback URLs in Docker. Docker build arguments now carry API, socket, customer, and shop portal URLs; remaining localhost values are development defaults only.
- Free-print options had a catch-path null dereference after eligibility lookup failure; it now reports unavailable eligibility without throwing a second runtime error.

## Remaining security and readiness concerns

1. Implement actual one-time email recovery, a reset UI, token invalidation, and session revocation before re-enabling password recovery.
2. Add persistent refresh-token rotation/revocation and a server-side logout/session control if long-lived sessions are required.
3. Train shop owners to review ID images and compare the card to the applicant where needed; there is no automated liveness or institution-issued verification integration.
4. Shop registration currently does not verify email/phone ownership. Enable actual contact verification before relying on contact details for recovery.
5. Validate production configuration, back up the ID HMAC key, run a recovery drill, and verify provider credentials/webhooks before launch. See [production deployment checklist](PRODUCTION_DEPLOYMENT_CHECKLIST.md).

