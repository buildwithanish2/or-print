# OR PRINT Project Audit

Audit date: 2026-10-28

## Executive summary

OR PRINT is a JavaScript/TypeScript npm-workspaces monorepo. It contains an Express and Prisma API, three React/Vite web clients, shared types/configuration/validation packages, and a .NET 8 Windows print agent. The API schema uses SQLite. The included Docker deployment has been aligned to that actual database and now persists it in a named volume.

The project has a broad implemented workflow, but several README claims exceed what the code currently does. In particular, customer payment confirmation is not an integrated card checkout, customer account/order history is absent, supported-file conversion is not implemented, and actual completion depends on a Windows agent and physical printer. UPI payment proof is manually reviewed by shop staff.

## Architecture

- `apps/api`: Express 4 REST API, Socket.IO, Prisma 5, SQLite, local file storage, Razorpay SDK dependency, PDF/image metadata libraries.
- `apps/customer-web`, `apps/shop-dashboard`, `apps/admin-web`: React 18, TypeScript, Vite 5, Tailwind. Each has its own route/UI and calls the shared API.
- `apps/print-agent`: .NET 8 WPF agent with Windows spooler and an offline queue.
- `packages/types`, `packages/config`, `packages/validation`: workspace packages imported by the apps.
- `docker/`: API and static-site images plus nginx SPA fallback. `docker-compose.yml` runs one API and all three web apps.
- Package manager: npm workspaces, lockfile at repository root. No Git metadata is present in this workspace, so a Git diff could not be produced.

## User journey and feature status

| Capability | Status | Evidence / limitation |
|---|---|---|
| Public shop landing and shop QR | Implemented | Shop slug routes and shop QR records exist. |
| Upload | Partial | Memory upload and local storage are implemented; allowed MIME and signatures are checked. Legacy/Office preview and conversion are not implemented. |
| PDF/image metadata and preview | Partial | PDF page count and image metadata are extracted; browser PDF viewer exists. Office page count is heuristic. |
| Print settings and server pricing | Implemented with limits | Pricing is recalculated server-side. Defaults and shop rules exist; prices are floats and defaults are configured values, not universal tariffs. |
| Order creation and tracking | Implemented | Order/items/jobs are created; customer tracking now requires a high-entropy token. |
| UPI | Partial | QR/intent and UTR submission work; shop staff manually approve submitted proof. No bank-side automated UPI verification. |
| Razorpay | Partial | A Razorpay order can be created when credentials are set; signed callback/webhook verification is enforced. Customer card checkout wiring is not complete. |
| Shop queue and status | Partial | Dashboard, Socket.IO events, retries and status updates exist. Job completion means agent-reported spooler success; paper exit/physical receipt cannot be confirmed by software. |
| Printer discovery/dispatch | Partial | Windows agent implementation exists. Requires a paired, connected Windows device and real printer. |
| Admin/shop management | Partial | Many administrative screens and endpoints exist; authorization coverage varies by controller and needs further review. |
| Customer login/history/receipt download | Missing/partial | No customer identity-based history; tracking is order-link based. No complete downloadable receipt flow found. |

## Prioritized findings

### Fixed in this pass

1. **Critical — payment status could be forged.** Public verification previously set orders paid without validating a Razorpay signature. It now requires a matching gateway order and constant-time HMAC comparison. Razorpay webhooks require a configured secret and verify the raw request body.
2. **Critical — agent endpoints trusted caller-supplied shop IDs and job IDs.** Printer sync, heartbeat, and job status now require a registered agent token; job updates are scoped to its shop and validated. Demo-code and shop-slug/phone pairing fallbacks were removed; pairing codes must be live and pairing attempts are rate limited.
3. **High — order number exposed private order details.** Tracking and associated payment operations now require the unpredictable per-order tracking token; Socket.IO order-room joins validate it. Tracking responses omit storage keys, raw payment responses, and the token itself.
4. **High — shop staff actions were vulnerable to cross-shop access/replay.** Order lists are scoped to the authenticated shop for shop roles. Counter payment requires an unpaid counter order, and retry requires an owned failed job with retries remaining.
5. **High — upload trusted browser MIME labels.** Upload accepts only configured MIME types and validates recognizable file signatures. Orders reject expired files and files already associated with another shop.
6. **High — JWT code had a hardcoded fallback.** API authentication now requires configured access and refresh secrets.
7. **High — Compose database did not match Prisma.** Docker ran PostgreSQL but configured SQLite and did not persist the SQLite database. Compose now uses a persistent SQLite volume and requires JWT secrets from the local environment.

### Remaining priority issues

- Socket.IO shop-room access still needs authenticated shop/admin room authorization. Agent registration is token protected, but all dashboard socket clients are currently unauthenticated.
- Public file download links remain bearer-like opaque keys and have no expiry signature; review authorization and agent download delivery together before exposing the service to the public internet.
- Razorpay webhooks should also validate event amount/currency and use a persisted webhook event ID for idempotency. Gateway order creation does not itself prove capture; rely on the verified webhook or signed callback.
- API authorization should be reviewed controller by controller; several routes and administrative mutations may not consistently scope data to shop ownership.
- Office document page estimates are not reliable. Convert to a safe print-ready format in an isolated worker before claiming preview/accurate pricing support.
- Use integer paise or a decimal database representation for pricing/payment values instead of binary floats.
- The current API schema is SQLite only. Do not point it at PostgreSQL without changing the Prisma provider and providing a database migration plan.

## Deployment and operational notes

Docker Compose uses SQLite persisted in `database_data`, uploads in `upload_data`, and JWT keys interpolated from `.env`. The API container does not automatically initialize a fresh database schema; initialize it with the documented Prisma command before relying on a new deployment. Redis was removed from Compose because the API did not use it. No printer, payment gateway, or email server is included in local verification.

