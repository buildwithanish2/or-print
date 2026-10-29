# Architecture

## Runtime map

```text
Customer browser ─┐
Shop dashboard ───┼── HTTP + Socket.IO ── Express API ── Prisma ── SQLite
Admin portal ─────┘                           │
                                              ├── local document storage
Windows print agent ◀──── Socket.IO jobs ─────┘
```

The repository is an npm-workspaces monorepo. Three independently built Vite/React applications share TypeScript packages. The API uses Express 4, Prisma 5, SQLite, Socket.IO, Multer, PDF-lib, Sharp, and payment/email integrations. The Windows agent is a separate .NET 8 WPF application.

## Request flow

1. The customer selects a shop by slug and uploads a document. The API checks the configured MIME type, basic file signature, size, and extracts PDF/image metadata before writing to local storage.
2. The customer configures print options. The API validates the request and calculates pricing from shop rules or configured platform defaults.
3. Order and line items are saved transactionally. The API returns the order number and random tracking token; the customer UI retains the token in the tracking URL.
4. UPI is presented as an intent/QR. A customer may submit a transaction reference; a shop operator must review it. Razorpay order creation requires shop/platform credentials. Razorpay signature/webhook checks are performed server-side.
5. A paid order is dispatched through the shop Socket.IO room to a paired Windows agent. The agent retrieves the file from the API and reports spooler/job status.
6. Customer tracking polls payment/status endpoints and listens to the order Socket.IO room after token validation.

## Data model

Prisma models users, shops, staff, printers/agents, shop QR records, files, orders/items, print jobs, pricing rules, payments/transactions, subscriptions, content, support, and audit records. The checked-in API schema declares SQLite; production SQLite storage must be on a persistent volume. No Prisma migration directory was found; current scripts use `prisma db push`.

## Entry points and commands

- API: `apps/api/src/server.ts`
- Customer: `apps/customer-web/src/main.tsx`
- Shop: `apps/shop-dashboard/src/main.tsx`
- Admin: `apps/admin-web/src/main.tsx`
- Agent: `apps/print-agent/PrintQRAgent/PrintQRAgent.csproj`
- Install: `npm install`
- Initialize schema: `npm run db:push --workspace=apps/api`
- Start all web/API dev servers: `npm run dev`
- Build: `npm run build`

The Windows agent is built separately with the .NET 8 SDK on Windows. No live printer was available for this audit.

