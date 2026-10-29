# PrintQR — Production-Ready QR Print SaaS Platform

**OR PRINT** is a QR-based online print-order platform. Customers can open a shop link, upload supported documents, choose print settings, see server-calculated pricing, and follow an order. A paired Windows print agent can receive and spool jobs to a shop printer. UPI transaction proof is reviewed by shop staff. Razorpay support requires gateway credentials and its customer checkout flow needs end-to-end integration verification.

## Windows print agent packages

The Windows agent and installer binaries are build outputs and are not stored in the source repository. Install the .NET 8 SDK on a Windows build machine, then run `npm run agent:build` from the repository root. The generated packages are written to `apps/api/public/downloads` for the API download routes. Build these artifacts as part of each deployment that serves agent downloads.

---

## 🌟 Key Features

* **Customer experience (`apps/customer-web`)**: Shop landing page, PDF/image preview, print configuration, server-calculated price, UPI proof submission, counter payment selection, and token-protected order tracking. Office preview/conversion and account-based order history are not implemented.

* **Shop dashboard (`apps/shop-dashboard`)**: Orders and live queue, printer/agent management, pairing codes, shop pricing, and settings. Physical printing requires a paired Windows agent and an available printer.

* **Admin console (`apps/admin-web`)**: Platform metrics, shop/content management, subscriptions, pricing, support, and diagnostics.

* **Windows print agent (`apps/print-agent`)**: .NET 8 WPF agent with printer discovery, spooler dispatch, reconnection, local queue, and status reporting.

---

## 🏗️ Architecture

```text
OR PRINT/
├── apps/
│   ├── api/                     # Node.js + Express + TypeScript + Socket.IO + Prisma
│   ├── customer-web/            # Mobile-first customer experience (Vite + React + Tailwind)
│   ├── shop-dashboard/          # Shop Owner & Staff management portal
│   ├── admin-web/               # Super Admin SaaS control center
│   └── print-agent/             # C# .NET 8 WPF Desktop Windows Agent
├── packages/
│   ├── types/                   # Shared TypeScript interfaces
│   ├── config/                  # Constants, supported paper sizes, MIME types
│   └── validation/              # Shared Zod validation schemas
├── prisma/
│   ├── schema.prisma            # Normalized database schema
│   └── seed.ts                  # Comprehensive demo seed data
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── nginx.conf
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
* **Node.js**: v20+
* **.NET SDK**: .NET 8.0 SDK (for Windows Desktop Agent)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure and initialize the database

Copy `.env.example` to `.env`, set unique random values for `JWT_SECRET` and `JWT_REFRESH_SECRET`, and configure `DATABASE_URL`. Never use the example strings in a deployed environment. The Prisma schema currently supports SQLite.

```bash
# Initialize/update the local SQLite schema
npm run db:push --workspace=apps/api
# Optional development seed
npm run db:seed --workspace=apps/api
```

### 4. Start Development Servers

* **Start Backend REST API & WebSocket Gateway** (Port 5000):
  ```bash
  npm run dev --workspace=apps/api
  ```

* **Start Customer Mobile Web App** (Port 5173):
  ```bash
  npm run dev --workspace=apps/customer-web
  ```

* **Start Shop Management Dashboard** (Port 5174):
  ```bash
  npm run dev --workspace=apps/shop-dashboard
  ```

* **Start Super Admin Console** (Port 5175):
  ```bash
  npm run dev --workspace=apps/admin-web
  ```

* **Build and Run Windows Print Agent (.NET 8)**:
  ```bash
  dotnet run --project apps/print-agent/PrintQRAgent/PrintQRAgent.csproj
  ```

---

## 🔑 Demo Login Credentials

| Role | Email | Password | Portal URL |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin@example.com` | `Admin@123456` | `http://localhost:5175` |
| **Demo Shop Owner** | `owner@abcdigital.com` | `Shop@123456` | `http://localhost:5174` |
| **Demo Shop Staff** | `staff@abcdigital.com` | `Staff@123456` | `http://localhost:5174` |
| **Customer QR Landing** | *(No login required)* | Scan QR or visit | `http://localhost:5173/print/abc-digital-print` |

---

## Printing Flow and Limits

1. **Scan QR**: Customer opens `http://localhost:5173/print/abc-digital-print`.
2. **Upload**: Choose an allowed PDF, Office document, or image. PDF/image metadata is read; Office page count may be estimated and Office preview is not supported.
3. **Configure & Live Price**: Select Color/B&W, Duplex, copies, and see the price calculate dynamically.
4. **Payment**: UPI transfer proof is submitted for shop review, or the customer chooses pay at counter. Razorpay requires configured credentials; verify its checkout flow before enabling it.
5. **Queue**: Once payment is confirmed, the API dispatches the job to the shop's connected agent.
6. **Printing status**: The agent reports spooler/job status. `COMPLETED` reflects the agent's report and does not independently prove paper was physically collected.
7. **Tracking**: The order link includes a private tracking token; keep the link private.

---

## 🐳 Docker Deployment

Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in `.env` first. Compose persists SQLite and uploads in named volumes. Initialize the database schema once for a new volume:

```bash
docker compose run --rm api npx prisma db push --schema=apps/api/prisma/schema.prisma
```

Then launch the web/API stack:

```bash
docker compose up -d
```

The schema is SQLite, so Compose does not start PostgreSQL or Redis. See the project docs for implementation scope and verification.

## Checks

```bash
npm run type-check
npm run test --workspace=apps/api
npm run build
```

The current automated suite is small and covers page-range counting and request validation. Hardware, payment gateway, webhook, and multi-user authorization flows still need integration testing.

## Project documentation

- [Project audit](docs/PROJECT_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Feature status](docs/FEATURE_STATUS.md)
- [Bug fixes](docs/BUG_FIXES.md)
- [Security audit](docs/SECURITY_AUDIT.md)
- [Test report](docs/TEST_REPORT.md)
