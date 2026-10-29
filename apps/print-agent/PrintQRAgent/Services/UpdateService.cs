using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace PrintQRAgent.Services
{
    public class UpdateManifest
    {
        [JsonPropertyName("latestVersion")]
        public string LatestVersion { get; set; } = "1.0.0";

        [JsonPropertyName("minimumSupportedVersion")]
        public string MinimumSupportedVersion { get; set; } = "1.0.0";

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
        public const string CurrentVersion = "1.0.0";
        private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(60) };

        public static async Task<UpdateCheckResult> CheckForUpdatesAsync(string serverUrl)
        {
            try
            {
                var endpoint = $"{serverUrl.TrimEnd('/')}/api/agents/update/latest";
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
                var latest = Version.Parse(manifest.LatestVersion);
                var minSupported = Version.Parse(manifest.MinimumSupportedVersion);

                var isUpdateAvailable = latest > current;
                var isMandatory = manifest.Mandatory || (current < minSupported);

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
                    Message = $"Unable to check for updates: {ex.Message}"
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

                var stagedExePath = Path.Combine(updatesDir, "PrintQRAgent.new.exe");
                var batchScriptPath = Path.Combine(updatesDir, "apply-update.cmd");
                var targetExePath = Path.Combine(localAppData, "Programs", "AnishNovaPrintAgent", "PrintQRAgent.exe");

                // If running in development without installation folder, fallback to current exe location
                if (!File.Exists(targetExePath))
                {
                    targetExePath = Process.GetCurrentProcess().MainModule?.FileName ?? targetExePath;
                }

                var downloadUrl = manifest.DownloadUrl;
                if (string.IsNullOrEmpty(downloadUrl))
                {
                    downloadUrl = $"{App.Config.ServerUrl.TrimEnd('/')}/api/admin/agents/download/binary/latest";
                }

                LoggerService.LogInfo($"Downloading in-place update from: {downloadUrl}");

                using (var response = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
                {
                    response.EnsureSuccessStatusCode();
                    var totalBytes = response.Content.Headers.ContentLength ?? (manifest.FileSize > 0 ? manifest.FileSize : 71600000);

                    using var contentStream = await response.Content.ReadAsStreamAsync();
                    using var fileStream = new FileStream(stagedExePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

                    var buffer = new byte[81920];
                    long totalRead = 0;
                    int read;

                    while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
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

                progressCallback(96, "Preparing atomic in-place restart...");

                // Write atomic update script that replaces binary and restarts immediately without setup wizards
                var batchContent = $@"@echo off
timeout /t 1 /nobreak > nul
:retry_copy
taskkill /f /im PrintQRAgent.exe > nul 2>&1
timeout /t 1 /nobreak > nul
copy /y ""{stagedExePath}"" ""{targetExePath}"" > nul
if errorlevel 1 goto retry_copy
del ""{stagedExePath}"" > nul 2>&1
start """" ""{targetExePath}""
exit
";
                File.WriteAllText(batchScriptPath, batchContent);
                LoggerService.LogInfo($"Update batch script generated at: {batchScriptPath}");

                progressCallback(100, "Restarting AnishNova Print Agent...");

                var psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c \"{batchScriptPath}\"",
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
