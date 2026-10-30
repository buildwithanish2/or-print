# Super Admin Functional Audit

## Scope and confirmed defects

The Super Admin portal uses a single-page tab router in `apps/admin-web/src/App.tsx`. Sidebar navigation maps tabs to pathname routes, and browser history restores the active tab. Direct route refresh handling already exists; this pass did not change that route model.

The review found several controls that appeared editable but were not fully connected to real behavior:

- Global A4 price caps were stored as platform settings but were not enforced by shop price saves or customer price quotes.
- The platform fee and GST inputs were saved, but the order pricing service used only static application configuration.
- Global Pricing and Website Statistics initialized with sample-looking values and retained them after a failed load, making a failed request look like saved configuration.
- Global Pricing and Website Statistics saved multiple fields one request at a time, so a network failure could leave partially updated configuration.
- Website navigation edits always submitted `isEnabled: true`; there was no control to keep an item hidden.
- Homepage banners could be created/deleted but not edited; editing visibility/order was unavailable.
- Leads and shops exposed only an initial batch despite backend support for pagination. Partner applications and tickets loaded all rows without server pagination.
- Leads, partner applications, tickets, and the public statistics section displayed fabricated fallback values when records were absent.

## Implemented

- Added validated, transactional `PUT /api/admin/settings/batch` for the platform pricing and homepage metric setting keys. The older single-setting endpoint now applies the same allowlist and validation.
- Connected configured service fee and GST settings to order-price calculation, retaining environment configuration as a compatibility default when database settings are absent.
- Enforced configured A4 B&W/color caps when shops save rates and when customer quotes are calculated. A missing/invalid cap now returns a clear configuration error; existing over-cap rules are reported rather than silently repriced.
- Removed misleading default values from admin pricing/statistics forms. Failed loads show retry/error feedback and do not allow accidental edits against invented values.
- Added navigation visibility editing and existing banner editing, including visibility and display order.
- Added bounded server-side pagination (maximum 100 records per request) and page controls for shops, leads, partner applications, and support tickets.
- Replaced sample IDs/counts/cities in admin tables and sample public metrics with an em dash when the API has no configured value. Public metrics now return an error status when the database read fails instead of reporting a successful empty response.

## Verification

- Admin Web tests: 10 passed.
- Admin Web type-check and production build: passed.
- API tests: 54 passed, including validation for batched admin settings.
- API type-check and production build: passed.
- Customer Web production build: passed.
- `git diff --check`: passed (Git emitted only line-ending conversion warnings for working files).

No production database, deployment, or account data was modified. The existing `README.md` user change remains untouched. This audit focused on editable/persisted controls and list pagination exposed by the Super Admin portal; it does not certify external payment, printer, or production integrations.
