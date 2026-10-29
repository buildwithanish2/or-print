# OR PRINT deployment: Vercel frontends and persistent API host

This repository is an npm workspaces monorepo. Deploy each Vite portal as a separate Vercel project, and run the Express API on a persistent Docker host. The API uses SQLite, local upload/evidence directories, and a Socket.IO connection used by the shop dashboard and Windows print agent; these files and the database must survive restarts and deployments.

## 1. Prepare domains and backend host

Choose HTTPS URLs before making the portals live. Example names are `print.example.com`, `shop.example.com`, `admin.example.com`, and `api.example.com`; replace these examples with domains you own.

Use a VPS/server with Docker Engine and Docker Compose, persistent disk, TLS termination, and a reverse proxy for the API. Keep the SQLite file, customer uploads, and private college-ID evidence on persistent, access-controlled volumes. The existing Compose API service declares persistent volumes for all three. Do not expose the SQLite file or the raw API port publicly; proxy HTTPS and Socket.IO/WebSocket upgrade traffic to port 5000.

Deploy only the API service from the repository root after preparing the server-side `.env` with the required production values:

```sh
docker compose config --quiet
docker compose up -d --build api
docker compose ps api
```

Set these server-only values in the backend host's secret store or protected Compose environment:

- `DATABASE_URL` (Compose currently points it to `/app/data/printqr.db` on the persistent `database_data` volume)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`, and `COLLEGE_ID_HASH_SECRET`
- `PUBLIC_API_URL`, `CUSTOMER_PORTAL_URL`, `SHOP_PORTAL_URL`, and `ADMIN_PORTAL_URL`
- `CORS_ORIGIN`: comma-separated exact HTTPS origins for the customer, shop, and admin portals
- Persistent `UPLOAD_DIR` and `COLLEGE_EVIDENCE_DIR`; `SMTP_*` if contact verification or recovery email is to be enabled
- Provider credentials and webhook secrets only when their sandbox/configuration has been validated

Use unique production secrets. Never put server secrets in Vercel or a `VITE_*` variable. Production API startup rejects missing/non-HTTPS public URLs and wildcard/non-HTTPS CORS origins.

### Database and migration gate

The production database path/schema/migration state has not been inspected. Do not launch the API against an existing production database until its actual persistent path is confirmed, a timestamped backup is made and verified, and the migration state is reconciled. Follow [PRODUCTION_MIGRATION_PLAN.md](PRODUCTION_MIGRATION_PLAN.md) and [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md). Never run `db push`, reset, or a destructive database command against production as a shortcut.

## 2. Create three Vercel projects

Connect the GitHub repository `buildwithanish2/or-print` to Vercel three times, creating one project per frontend:

| Vercel project | Root Directory | Framework | Build command | Output directory |
|---|---|---|---|---|
| OR PRINT Customer | `apps/customer-web` | Vite | `vercel.json` workspace build | `dist` |
| OR PRINT Shop | `apps/shop-dashboard` | Vite | `vercel.json` workspace build | `dist` |
| OR PRINT Admin | `apps/admin-web` | Vite | `vercel.json` workspace build | `dist` |

The committed `vercel.json` files install from the monorepo root, build the shared package declarations, and then build the selected app workspace. In each project's Root Directory settings, enable **Include source files outside of Root Directory in the Build Step**, so the app can resolve `packages/config`, `packages/types`, and `packages/validation`. These settings are especially important for the install/build commands that run from the repository root.

Each app includes its own `vercel.json` SPA rewrite. This is required for direct visits and browser refreshes on routes such as `/print/:shopSlug`, `/track/:orderNumber`, and dashboard routes.

## 3. Set frontend build variables

Set these variables in each Vercel project's **Settings → Environment Variables** for Production (and Preview only if Preview should call a non-production API). Values are public URL configuration, not secrets. Vite embeds them in the generated browser bundle, so redeploy after changing them.

| Project | Variables |
|---|---|
| Customer | `VITE_API_URL=https://api.anishnova.com/api`; `VITE_SOCKET_URL=https://api.anishnova.com`; `VITE_SHOP_URL=https://shop-dashboard-one-eosin.vercel.app` |
| Shop | `VITE_API_URL=https://api.anishnova.com/api`; `VITE_SOCKET_URL=https://api.anishnova.com`; `VITE_CUSTOMER_URL=https://customer-web-six-livid.vercel.app` |
| Admin | `VITE_API_URL=https://api.anishnova.com/api`; `VITE_CUSTOMER_URL=https://customer-web-six-livid.vercel.app`; `VITE_SHOP_URL=https://shop-dashboard-one-eosin.vercel.app` |

The Customer Web production build now falls back to `https://api.anishnova.com/api` if `VITE_API_URL` is missing or points to a local/non-HTTPS host. Keep the explicit Vercel value above so deployments are predictable. The Shop and Admin builds still require their API variables. The Socket.IO URL is the API origin without `/api`; TLS termination must support WebSocket upgrades. Redeploy a portal after changing its variables.

## 4. Go-live verification

1. Confirm each Vercel production deployment builds and the portal's deep links refresh successfully.
2. Confirm API health at `https://api.example.com/api/health`, CORS preflight from all three portal origins, and Socket.IO connection/reconnection from the shop portal.
3. Test a customer upload, pricing, permitted checkout, order tracking, and shop dashboard queue using non-production/test payment credentials.
4. Pair the Windows print agent to the production API and verify a real test print before describing print completion as hardware-confirmed.
5. Confirm backups, disk monitoring, upload/evidence retention, SMTP delivery, payment webhooks, and logs are configured.

Generated print-agent installers are intentionally not tracked in Git. Build them on a Windows .NET 8 build machine using `npm run agent:build`, then place the outputs in `apps/api/public/downloads` as part of the API image build/release. The current API Dockerfile must include that directory in the runtime image for its static agent-download routes to serve those packages.

No live Vercel deployment, production database migration, live payment, or physical print has been performed by this setup guide.
