# Windows Print Agent releases

## Current release packaging

The agent is a .NET 8 WPF desktop application targeting `net8.0-windows` / `win-x64`. The setup program is also a self-contained WPF executable; it installs per-user under `%LOCALAPPDATA%\Programs\AnishNovaPrintAgent`, creates shortcuts, optionally registers startup under the current user's Run key, and launches the pairing screen. It is not an MSI or a Windows service, and installation does not require administrator rights. Windows may still show its normal security prompts.

On a Windows machine with the .NET 8 SDK and network access for NuGet restore:

```powershell
npm run agent:build
# For a tagged release, provide its version directly:
powershell -NoProfile -ExecutionPolicy Bypass -File apps/print-agent/publish.ps1 -Version 1.2.3
node apps/api/scripts/verify-agent-release.cjs
```

The build creates stable and versioned setup and agent executables plus `agent-release.json` under `apps/api/public/downloads/`. The manifest contains SHA-256 and byte sizes. The build fails if either executable is absent, too small, or not a Windows PE file. The Docker API image also validates both binaries and their manifest before building, then copies them into the final runtime image. The downloads directory is ignored by Git; it must be populated by the Windows release process before creating an API image.

For CI, push a tag such as `agent-v1.2.3`. `.github/workflows/publish-windows-agent.yml` publishes on a Windows runner and attaches versioned binaries and the manifest to the GitHub release. No credentials are needed beyond the repository's GitHub Actions token.

## Production API deployment

After producing the release on Windows, securely copy these files to the API Docker build context at `apps/api/public/downloads/` on the deployment machine: `AnishNovaPrintAgent-Setup.exe`, `AnishNovaPrintAgent-Setup-<version>.exe`, `PrintQRAgent.exe`, `PrintQRAgent-<version>.exe`, and `agent-release.json`. Verify the release there before building. The API Compose service uses the named `database_data` volume at `/app/data`; this release has no database migration.

Before a production rollout, from the Compose project directory on EC2, make and verify a consistent SQLite online backup without stopping the API or detaching volumes:

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker run --rm --volumes-from printqr-api python:3-alpine python -c "import sqlite3; src=sqlite3.connect('/app/data/printqr.db'); dst=sqlite3.connect('/app/data/printqr.db.backup-$stamp'); src.backup(dst); result=dst.execute('PRAGMA integrity_check').fetchone()[0]; dst.close(); src.close(); print(result); raise SystemExit(0 if result == 'ok' else 1)"
```

Proceed only if the command reports `ok`; the backup remains in the persistent database volume as `printqr.db.backup-<UTC timestamp>`. Then run:

```bash
node apps/api/scripts/verify-agent-release.cjs
docker compose build api
docker compose up -d --no-deps api
docker compose ps api
curl -fsS https://api.anishnova.com/api/health
curl -sS -D - -o /dev/null https://api.anishnova.com/api/admin/agents/download/latest
```

The final download response must be HTTP 200, `application/vnd.microsoft.portable-executable`, and include the setup attachment filename and expected content length. Do not remove the database volume. Rollback is to restore the previous API image/tag and its previous artifact bundle; no database rollback is needed for this artifact-only release.

The public agent installer and update download routes are intentionally registered before the admin authentication middleware because shop owners download the setup from the dashboard. They serve only the two fixed artifacts after manifest, file-size and PE-header readiness checks. The installer route increments its download count only after readiness succeeds. The API does not expose local filesystem paths in failure responses.

## Release 1.0.2 prepared locally (2026-10-29)

Windows x64 self-contained .NET 8 publishing succeeded on a Windows build machine. The release script and Windows embedded-payload verification passed:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `AnishNovaPrintAgent-Setup.exe` | 152189023 | `17b645bca2375749afcaf0072f4fa5c3fe580ce860105daf2cc6d010732c8fdf` |
| `PrintQRAgent.exe` | 80502895 | `48e229908edbb920c2914638c9c3d745537b318d5e27b4321b5d8806ad75df04` |

The artifacts are in `E:\or-print-agent-release-1.0.2` on the release workstation. They are not committed and have not been copied to production. The live API was checked read-only on 2026-10-29 and still advertised release `1.0.0`; production download `HEAD` returned the old 152182367-byte installer. Therefore release 1.0.2 is locally verified, not published to the production API. The setup executable is unsigned because no signing certificate was available; Windows SmartScreen may warn users.

For a clean install, run the setup executable and follow its per-user installer prompts. For an upgrade, exit the running agent from its tray menu before setup; setup refuses to replace files while the agent is running. User configuration and DPAPI-protected pairing credentials are retained by the installer. No Windows installation or upgrade was exercised as part of the artifact build.

## Pairing and operational limits

The installer launches the existing pairing UI. Pairing codes are obtained from the authenticated shop dashboard and remain time-limited and single-use according to the API. New installs default to `https://api.anishnova.com`. The paired agent token is now stored with current-user Windows DPAPI protection; old plaintext config is migrated on load. The pairing code and token are not logged. Existing installations with an old explicit localhost API URL need to update the server URL in their local configuration or reinstall/re-pair.

The agent now polls `POST /api/agents/jobs/poll` using its paired credential. The API atomically claims only queued jobs for that shop whose payment is `PAID` or `NOT_REQUIRED`, whose order is not cancelled/completed, and whose assigned printer is online. The agent downloads a job document through `GET /api/agents/jobs/:jobId/file`; the API rechecks agent/shop ownership, payment eligibility, job status, MIME type and file size. It prints PDF, PNG, and JPEG files to the printer assigned to the job. WebP is rejected because the current Windows GDI+ image path does not reliably decode it. Pairing codes are one-time, expire after ten minutes, and now carry 64 bits of random data. The persistent agent token is encrypted with current-user Windows DPAPI and is no longer returned by the dashboard's pairing-code endpoint.

The agent records a job's idempotency key durably before invoking the Windows spooler. This prevents a restart from silently printing the same claimed job again; a crash at that point can require an operator to inspect the printer and explicitly reconcile or retry the job. The Windows `PrintDocument.Print()` call confirms that Windows accepted the job into its spooler. It does not confirm paper physically exited the printer. The agent reports `SENT_TO_SPOOLER`, not `COMPLETED`; an independent, reliable spooler completion signal remains unimplemented. Do not claim physical completion or unattended duplicate-safe retries until that signal and its reconciliation behavior are implemented and tested.

The API reports `503` in production until the new artifact bundle is transferred and the API image is rebuilt. No real Windows installation, shop pairing, live API binary download, or physical printer test was available in this task. Production SSH was unavailable, so the server artifact and deployment could not be updated. See the completion report for the exact access blocker.

## Current source changes and next release

The official GitHub release endpoint was checked before changing the source version: `agent-v1.0.2` is currently the latest published release. Its published manifest says 1.0.2; it does not prove the production API has been updated. Existing release tags are immutable, so these source changes target **1.0.3** and must use a new `agent-v1.0.3` tag. Do not overwrite or recreate `agent-v1.0.2`.

### Antivirus, signing, and installation trust

The existing setup and agent are self-contained Windows x64 single-file executables. No vendor-side antivirus verdict was available, so the earlier warnings cannot be classified as confirmed false positives. The 1.0.2 release was unsigned; lack of publisher reputation/signature is a likely trust limitation, not proof of an antivirus defect. Signing can improve publisher identity and integrity but does not guarantee SmartScreen reputation or that every antivirus vendor will allow the app.

Local development builds can remain unsigned. A tagged official release now requires the protected GitHub Actions secrets `WINDOWS_SIGNING_CERT_BASE64` and `WINDOWS_SIGNING_CERT_PASSWORD`, containing a real code-signing PFX issued to the legitimate publisher. The release script signs the agent before embedding it, signs the setup executable, timestamps both signatures, and checks Windows signature trust and the `AnishNova Technologies` publisher name before generating the manifest. The installer verifies its own signature and the embedded agent signature when the release manifest requires signing; the updater verifies a required signature after the existing size/hash checks and before replacement. Keep the PFX secrets only in repository/organization Actions secrets; never put them in source, `.env`, build artifacts, or chat. If the legal publisher name on the certificate differs, stop and update the expected publisher only after confirming the certificate's legitimate identity.

The installer remains a per-user WPF setup program, not an MSI or Windows service. It installs under `%LOCALAPPDATA%\Programs\AnishNovaPrintAgent`; it does not install drivers, disable security tools, or request elevation. Windows may still show security prompts. Submit a suspected false positive using the actual unsigned/signed file and hash through the official [Microsoft Security Intelligence file submission portal](https://www.microsoft.com/en-us/wdsi/filesubmission). Do not ask users to add exclusions.

### Printer discovery and selection behavior

Discovery reads Windows Print Spooler `EnumPrinters` metadata for local devices and user-connected network/shared printers, including driver, port, default flag, and spooler status flags. The .NET printer settings API supplies supported paper sizes, color, duplex, and installed-printer fallback entries. The agent refreshes on startup, manual rescan, and once per minute as a recovery fallback. USB/network classification is inferred from Windows attributes and port names; it is not guaranteed to identify every vendor-specific physical link. Installed virtual printers are displayed locally but excluded from shop order synchronization and automatic customer-job selection.

Automatic selection preserves a configured available physical printer. With no saved printer, one available physical device is selected; with several, only the Windows default physical printer is selected. If there are multiple devices and no default, the operator must choose. If the saved printer is offline, the agent does not silently fail over. Generic ink/paper levels are no longer invented; those fields remain unknown unless a genuine driver-provided telemetry integration is added. Windows spooler status is the best generic readiness signal and is not a guarantee that paper will physically exit.

The print job path rejects virtual/missing destinations and rejects requested color or duplex settings when the selected printer says those modes are unsupported; it no longer silently substitutes PDF output or downgrades settings. A diagnostic print now asks for confirmation before using paper/ink.

### Supported Windows and release verification

The project targets self-contained `win-x64` on .NET 8. Microsoft lists Windows 11 x64 and Windows 10 x64 editions including LTSC/Enterprise among the .NET 8 supported operating systems; Windows 10 support is limited to LTSC and Enterprise. This is a framework compatibility target, not a completed device-installation matrix. Windows 10 Home, ARM devices, all vendor drivers, install/upgrade/uninstall, SmartScreen behavior, real pairing, and physical printing still require explicit testing on the target computers. See [Microsoft's .NET on Windows support table](https://learn.microsoft.com/en-us/dotnet/core/install/windows).

For the next official release, configure the two signing secrets and push a new `agent-v1.0.3` tag. CI fails before publishing if signing is absent, invalid, or the publisher does not match. Local unsigned package verification is not evidence of a signed release, Windows installation, antivirus approval, or physical printing. The API artifact and Vercel/production deployment remain separate from the GitHub release and must be verified independently.
