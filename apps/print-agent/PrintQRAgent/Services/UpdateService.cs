using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Reflection;
using System.Threading.Tasks;

namespace PrintQRAgent.Services
{
    public class UpdateManifest
    {
        [JsonPropertyName("latestVersion")]
        public string LatestVersion { get; set; } = "1.0.2";

        [JsonPropertyName("minimumSupportedVersion")]
        public string MinimumSupportedVersion { get; set; } = "1.0.2";

        [JsonPropertyName("mandatory")]
        public bool Mandatory { get; set; }

        [JsonPropertyName("releaseDate")]
        public string ReleaseDate { get; set; } = string.Empty;

        [JsonPropertyName("channel")]
        public string Channel { get; set; } = "stable";

        [JsonPropertyName("releaseNotes")]
        public string[] ReleaseNotes { get; set; } = Array.Empty<string>();

        [JsonPropertyName("downloadUrl")]
        public string DownloadUrl { get; set; } = string.Empty;

        [JsonPropertyName("sha256")]
        public string? Sha256 { get; set; }

        [JsonPropertyName("fileSize")]
        public long FileSize { get; set; }
    }

    public class UpdateCheckResult
    {
        public bool UpdateAvailable { get; set; }
        public bool IsMandatory { get; set; }
        public UpdateManifest? Manifest { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class UpdateService
    {
        public static string CurrentVersion => Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.2";
        private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(60) };

        public static string ValidateDownloadUrl(string downloadUrl, string configuredApiUrl)
        {
            if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out var candidate)
                || !Uri.TryCreate(AgentApiEndpoint.NormalizeForCurrentBuild(configuredApiUrl), UriKind.Absolute, out var api)
                || candidate.Scheme != (api.IsLoopback && api.Scheme == Uri.UriSchemeHttp ? Uri.UriSchemeHttp : Uri.UriSchemeHttps)
                || !string.IsNullOrEmpty(candidate.UserInfo)
                || !string.IsNullOrEmpty(candidate.Query)
                || !string.IsNullOrEmpty(candidate.Fragment)
                || !string.Equals(candidate.Host, api.Host, StringComparison.OrdinalIgnoreCase)
                || candidate.Port != api.Port
                || !candidate.AbsolutePath.EndsWith("/api/admin/agents/download/binary/latest", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("The update manifest contains an unsafe or unexpected download URL.");
            }

            return candidate.AbsoluteUri;
        }

        public static bool IsValidSha256(string? value) =>
            value != null && System.Text.RegularExpressions.Regex.IsMatch(value, "^[a-fA-F0-9]{64}$");

        public static bool IsNewerVersion(string? candidate, string? installed) =>
            Version.TryParse(candidate, out var candidateVersion)
            && Version.TryParse(installed, out var installedVersion)
            && candidateVersion > installedVersion;

        public static async Task<UpdateCheckResult> CheckForUpdatesAsync(string serverUrl)
        {
            try
            {
                var endpoint = AgentApiEndpoint.BuildApiUri(serverUrl, "agents/update/latest");
                var response = await _httpClient.GetAsync(endpoint);
                if (!response.IsSuccessStatusCode)
                {
                    return new UpdateCheckResult
                    {
                        UpdateAvailable = false,
                        Message = $"Update server returned HTTP {response.StatusCode}"
                    };
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var dataElement = doc.RootElement.GetProperty("data");
                var manifest = JsonSerializer.Deserialize<UpdateManifest>(dataElement.GetRawText());

                if (manifest == null)
                {
                    return new UpdateCheckResult { UpdateAvailable = false, Message = "Invalid manifest data" };
                }

                var current = Version.Parse(CurrentVersion);
                if (!Version.TryParse(manifest.LatestVersion, out var latest)
                    || !Version.TryParse(manifest.MinimumSupportedVersion, out var minSupported))
                    return new UpdateCheckResult { UpdateAvailable = false, Message = "The update service returned invalid version metadata." };

                if (latest < current || minSupported > latest)
                {
                    return new UpdateCheckResult
                    {
                        UpdateAvailable = false,
                        Message = "The update service returned an invalid or older release. No update was installed."
                    };
                }

                var isUpdateAvailable = latest > current;
                var isMandatory = manifest.Mandatory || (current < minSupported);
                if (isUpdateAvailable) _ = ValidateDownloadUrl(manifest.DownloadUrl, serverUrl);

                return new UpdateCheckResult
                {
                    UpdateAvailable = isUpdateAvailable,
                    IsMandatory = isMandatory,
                    Manifest = manifest,
                    Message = isUpdateAvailable
                        ? $"New version v{manifest.LatestVersion} is available."
                        : "You're using the latest version of AnishNova Print Agent."
                };
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Update check failed", ex);
                return new UpdateCheckResult
                {
                    UpdateAvailable = false,
                Message = "Unable to check for updates. Confirm this computer can reach the configured API and try again."
                };
            }
        }

        public static async Task<(bool success, string? error)> DownloadAndInstallUpdateAsync(
            UpdateManifest manifest,
            Action<int, string> progressCallback)
        {
            try
            {
                progressCallback(5, "Connecting to release update server...");

                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var updatesDir = Path.Combine(localAppData, "AnishNovaPrint", "updates");
                if (!Directory.Exists(updatesDir)) Directory.CreateDirectory(updatesDir);

                var agentProcessId = Environment.ProcessId;
                var stagedExePath = Path.Combine(updatesDir, $"PrintQRAgent.new-{agentProcessId}.exe");
                var updateScriptPath = Path.Combine(updatesDir, $"apply-update-{agentProcessId}.ps1");
                var targetExePath = Path.Combine(localAppData, "Programs", "AnishNovaPrintAgent", "PrintQRAgent.exe");

                // If running in development without installation folder, fallback to current exe location
                if (!File.Exists(targetExePath))
                {
                    targetExePath = Process.GetCurrentProcess().MainModule?.FileName ?? targetExePath;
                }

                if (!IsNewerVersion(manifest.LatestVersion, CurrentVersion))
                    return (false, "The update is not newer than the installed version. Downgrades are not permitted.");
                if (manifest.FileSize < 1024 * 1024 || !IsValidSha256(manifest.Sha256))
                    return (false, "The update manifest is missing valid size or checksum information.");

                var fallbackDownloadUrl = AgentApiEndpoint.BuildApiUri(App.Config.ServerUrl, "admin/agents/download/binary/latest").AbsoluteUri;
                var downloadUrl = ValidateDownloadUrl(
                    string.IsNullOrWhiteSpace(manifest.DownloadUrl) ? fallbackDownloadUrl : manifest.DownloadUrl,
                    App.Config.ServerUrl);

                using (var response = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
                {
                    response.EnsureSuccessStatusCode();
                    if (response.RequestMessage?.RequestUri is not Uri finalUri
                        || !string.Equals(finalUri.Host, new Uri(downloadUrl).Host, StringComparison.OrdinalIgnoreCase)
                        || finalUri.Scheme != Uri.UriSchemeHttps)
                        return (false, "The update server redirected to an unexpected download location.");
                    var totalBytes = response.Content.Headers.ContentLength ?? manifest.FileSize;
                    if (totalBytes != manifest.FileSize)
                        return (false, "The update size did not match the release metadata.");

                    using var contentStream = await response.Content.ReadAsStreamAsync();
                    using var fileStream = new FileStream(stagedExePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

                    var buffer = new byte[81920];
                    long totalRead = 0;
                    int read;

                    while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        if (totalRead + read > manifest.FileSize)
                            return (false, "The downloaded update exceeded the size declared by the release manifest.");
                        await fileStream.WriteAsync(buffer, 0, read);
                        totalRead += read;
                        if (totalBytes > 0)
                        {
                            var pct = Math.Min(90, (int)((totalRead * 85) / totalBytes) + 5);
                            progressCallback(pct, $"Downloading v{manifest.LatestVersion} in-place: {totalRead / (1024 * 1024)}MB / {totalBytes / (1024 * 1024)}MB...");
                        }
                    }
                }

                progressCallback(92, "Verifying binary integrity...");

                var fileInfo = new FileInfo(stagedExePath);
                if (fileInfo.Length < 1024 * 1024)
                {
                    return (false, "Downloaded update package is incomplete.");
                }

                if (fileInfo.Length != manifest.FileSize)
                {
                    File.Delete(stagedExePath);
                    return (false, "Downloaded update did not match the release metadata.");
                }

                await using (var stagedStream = File.OpenRead(stagedExePath))
                {
                    var actualHash = Convert.ToHexString(await SHA256.HashDataAsync(stagedStream)).ToLowerInvariant();
                    if (!CryptographicOperations.FixedTimeEquals(
                        Convert.FromHexString(actualHash), Convert.FromHexString(manifest.Sha256!.Trim())))
                    {
                        File.Delete(stagedExePath);
                        return (false, "Downloaded update failed its integrity check.");
                    }
                }

                await using (var stagedStream = File.OpenRead(stagedExePath))
                {
                    var signature = new byte[2];
                    if (await stagedStream.ReadAsync(signature) != 2 || signature[0] != (byte)'M' || signature[1] != (byte)'Z')
                    {
                        File.Delete(stagedExePath);
                        return (false, "The downloaded update is not a valid Windows executable.");
                    }
                }

                progressCallback(96, "Preparing atomic in-place restart...");

                // Wait only for this process; do not terminate unrelated agents or loop forever.
                static string PsQuote(string value) => "'" + value.Replace("'", "''", StringComparison.Ordinal) + "'";
                var backupExePath = targetExePath + $".previous-{agentProcessId}";
                var updateScript = $@"$ErrorActionPreference = 'Stop'
$agentPid = {agentProcessId}
$staged = {PsQuote(stagedExePath)}
$target = {PsQuote(targetExePath)}
$backup = {PsQuote(backupExePath)}
$started = $null
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ((Get-Process -Id $agentPid -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {{ Start-Sleep -Milliseconds 250 }}
if (Get-Process -Id $agentPid -ErrorAction SilentlyContinue) {{ throw 'Agent did not exit in time.' }}
try {{
  for ($attempt = 1; $attempt -le 8; $attempt++) {{
    try {{
      if (Test-Path -LiteralPath $target) {{ Move-Item -LiteralPath $target -Destination $backup -Force }}
      Move-Item -LiteralPath $staged -Destination $target -Force
      if ((Get-Item -LiteralPath $target).Length -lt 1048576) {{ throw 'Updated agent is incomplete.' }}
      $started = Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) -PassThru
      Start-Sleep -Seconds 2
      if ($started.HasExited) {{ throw 'Updated agent did not start.' }}
      Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
      exit 0
    }} catch {{
      if (Test-Path -LiteralPath $backup) {{
        if ($started -and !$started.HasExited) {{ Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue }}
        Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
        Move-Item -LiteralPath $backup -Destination $target -Force
      }}
      Start-Sleep -Seconds 2
    }}
  }}
  throw 'Could not replace the agent after several safe attempts.'
}} catch {{
  if (Test-Path -LiteralPath $backup) {{
    Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $backup -Destination $target -Force
  }}
  if (Test-Path -LiteralPath $target) {{ Start-Process -FilePath $target -WorkingDirectory (Split-Path -Parent $target) }}
  exit 1
}}
";
                File.WriteAllText(updateScriptPath, updateScript);
                LoggerService.LogInfo("Verified update package and started the bounded update worker.");

                progressCallback(100, "Restarting AnishNova Print Agent...");

                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{updateScriptPath}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                };

                Process.Start(psi);
                LoggerService.LogInfo("Update worker process spawned. Exiting existing agent instance...");

                await Task.Delay(800);
                Environment.Exit(0);
                return (true, null);
            }
            catch (Exception ex)
            {
                LoggerService.LogError("In-place update execution failed", ex);
                return (false, ex.Message);
            }
        }
    }
}
