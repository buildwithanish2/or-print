# Test and Verification Report

Run date: 2026-10-28

## Results

| Check | Result | Notes |
|---|---|---|
| `npm run type-check` (baseline, before edits) | Passed | All workspace type checks completed. |
| `npm run build` (baseline, before edits) | Passed | API and all three Vite apps built. |
| `npm run type-check` | Passed | All workspaces completed after the changes. |
| `npm run build` | Passed | API and all three Vite apps built after the changes. |
| `npm run test --workspace=apps/api` | Passed | 4 focused tests passed for page ranges and request validation. |
| Docker Compose validation | Passed | `docker compose config --quiet` completed successfully. `docker compose build` could not connect because the Docker Desktop Linux engine is not running. |
| Prisma schema validation | Passed | `npx prisma validate --schema=apps/api/prisma/schema.prisma`. |
| Dependency audit | Failed with known advisories | `npm audit --omit=dev`: 11 remaining (3 moderate, 6 high, 2 critical) after safe `npm audit fix`; see Security Audit. |
| .NET print-agent build | Passed | `dotnet build apps/print-agent/PrintQRAgent/PrintQRAgent.csproj --no-restore`, 0 warnings/errors. No physical printer was available. |
| API runtime smoke check | Blocked | `prisma db push` against an isolated temporary SQLite URL returned `Schema engine error` without diagnostics. The API was not started against project data; no existing database or upload was touched. |

No database reset or destructive data command was run. `.env` contents were not printed or copied. The npm audit update changed compatible dependency resolutions in `package-lock.json`; no `--force` major upgrades were applied.

