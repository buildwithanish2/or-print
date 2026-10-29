using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using PrintQRAgent.Models;

namespace PrintQRAgent.Services
{
    public class WebSocketClientService
    {
        private readonly AgentConfig _config;
        private readonly PrintSpoolerService _spoolerService;
        private readonly OfflineQueueService _queueService;
        private readonly HttpClient _httpClient = new();
        private CancellationTokenSource? _cts;
        private bool _isConnected;
        private bool _isApiConnected;

        public event Action<bool, string>? ConnectionStatusChanged;
        public event Action<HealthState>? HealthUpdated;
        public event Action<PrintJobPayload>? JobReceived;
        public event Action<string, int, string?>? JobProgressUpdated;

        public bool IsConnected => _isConnected;
        public bool IsApiConnected => _isApiConnected;

        public WebSocketClientService(AgentConfig config, PrintSpoolerService spoolerService, OfflineQueueService queueService)
        {
            _config = config;
            _spoolerService = spoolerService;
            _queueService = queueService;
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
        }

        public void Start()
        {
            Stop();
            _cts = new CancellationTokenSource();
            _ = RunConnectionLoopAsync(_cts.Token);
        }

        public void Stop()
        {
            _cts?.Cancel();
            _isConnected = false;
            _isApiConnected = false;
            ConnectionStatusChanged?.Invoke(false, "Agent daemon stopped");
            EmitHealthUpdate();
        }

        private void EmitHealthUpdate()
        {
            try
            {
                var printers = _spoolerService.GetInstalledPrinters();
                var spoolerRunning = _spoolerService.IsSpoolerServiceRunning();
                var isPaired = !string.IsNullOrEmpty(_config.AgentToken) && _config.AgentToken != "none";

                HealthUpdated?.Invoke(new HealthState
                {
                    IsPaired = isPaired,
                    IsApiConnected = _isApiConnected,
                    IsWebSocketConnected = _isConnected,
                    IsSpoolerRunning = spoolerRunning,
                    IsHeartbeatActive = _isApiConnected && isPaired,
                    DiscoveredPrintersCount = printers.Count
                });
            }
            catch { }
        }

        /// <summary>
        /// Pairs agent with backend using Shop Pairing Code
        /// </summary>
        public async Task<(bool success, string message, string? shopName)> PairWithServerAsync(string pairingCode)
        {
            try
            {
                var payload = new
                {
                    pairingCode = pairingCode.Trim().ToUpper(),
                    deviceName = Environment.MachineName,
                    platform = "windows-x64",
                    agentVersion = "1.0.0"
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{_config.ServerUrl}/api/agents/pair", content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(responseBody);
                    var data = doc.RootElement.GetProperty("data");
                    _config.AgentToken = data.GetProperty("agentToken").GetString();
                    _config.PairingCode = pairingCode;
                    var shopName = data.TryGetProperty("shopName", out var s) ? s.GetString() : "Shop";
                    _config.ShopName = shopName;

                    App.SaveConfig();
                    LoggerService.LogInfo($"Successfully paired with Shop: {shopName} (Device Token: {_config.AgentToken})");

                    _isApiConnected = true;
                    _ = SyncPrintersAsync();
                    EmitHealthUpdate();

                    return (true, $"Agent activated successfully for {shopName}!", shopName);
                }
                else
                {
                    using var doc = JsonDocument.Parse(responseBody);
                    var msg = doc.RootElement.TryGetProperty("message", out var m) ? m.GetString() : "Pairing failed";
                    return (false, msg ?? "Invalid pairing code", null);
                }
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Pairing request exception", ex);
                return (false, $"Connection error: {ex.Message}", null);
            }
        }

        /// <summary>
        /// Syncs discovered Windows printers to the cloud database
        /// </summary>
        public async Task SyncPrintersAsync()
        {
            if (string.IsNullOrEmpty(_config.AgentToken) || _config.AgentToken == "none")
            {
                return;
            }

            try
            {
                var printers = _spoolerService.GetInstalledPrinters();
                var payload = new
                {
                    agentToken = _config.AgentToken,
                    printers
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{_config.ServerUrl}/api/agents/printers/sync", content);

                if (response.IsSuccessStatusCode)
                {
                    _isApiConnected = true;
                    LoggerService.LogInfo($"Synced {printers.Count} Windows printers to Shop Dashboard.");
                }
                else
                {
                    _isApiConnected = false;
                }
            }
            catch (Exception ex)
            {
                _isApiConnected = false;
                LoggerService.LogError("Printer sync exception", ex);
            }
            finally
            {
                EmitHealthUpdate();
            }
        }

        private async Task RunConnectionLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    // 1. Initial printer discovery sync
                    await SyncPrintersAsync();

                    _isConnected = true;
                    _isApiConnected = true;
                    ConnectionStatusChanged?.Invoke(true, $"Connected to Cloud Spooler ({_config.ServerUrl})");
                    EmitHealthUpdate();

                    while (!token.IsCancellationRequested && _isConnected)
                    {
                        // 2. Heartbeat to keep agent ONLINE in Admin & Shop dashboards
                        if (!string.IsNullOrEmpty(_config.AgentToken) && _config.AgentToken != "none")
                        {
                            try
                            {
                                var printers = _spoolerService.GetInstalledPrinters();
                                var heartbeatPayload = new
                                {
                                    agentToken = _config.AgentToken,
                                    status = "CONNECTED",
                                    printerCount = printers.Count,
                                    version = "1.0.0",
                                    deviceName = Environment.MachineName
                                };

                                var heartbeatContent = new StringContent(
                                    JsonSerializer.Serialize(heartbeatPayload),
                                    Encoding.UTF8,
                                    "application/json"
                                );
                                var res = await _httpClient.PostAsync($"{_config.ServerUrl}/api/agents/heartbeat", heartbeatContent, token);
                                _isApiConnected = res.IsSuccessStatusCode;
                            }
                            catch
                            {
                                _isApiConnected = false;
                            }
                        }

                        // 3. Process pending offline queue jobs
                        foreach (var job in _queueService.GetPendingJobs())
                        {
                            await ProcessJobAsync(job);
                        }

                        EmitHealthUpdate();
                        await Task.Delay(15000, token); // 15-second heartbeat interval
                    }
                }
                catch (Exception ex)
                {
                    _isConnected = false;
                    _isApiConnected = false;
                    ConnectionStatusChanged?.Invoke(false, $"Reconnecting: {ex.Message}");
                    LoggerService.LogWarn($"Connection loop warning: {ex.Message}. Retrying in 5 seconds...");
                    EmitHealthUpdate();
                    await Task.Delay(5000, token);
                }
            }
        }

        public async Task ProcessJobAsync(PrintJobPayload job)
        {
            LoggerService.LogInfo($"Processing print job: {job.OrderNumber} ({job.FileName})");
            JobReceived?.Invoke(job);
            JobProgressUpdated?.Invoke(job.Id, 20, "Downloading document...");

            var targetPrinter = _config.SelectedPrinterName ?? string.Empty;
            var (success, error) = await _spoolerService.PrintDocumentAsync(job, targetPrinter, (progress) =>
            {
                JobProgressUpdated?.Invoke(job.Id, progress, progress == 100 ? "COMPLETED" : "PRINTING");
            });

            if (success)
            {
                _queueService.MarkJobComplete(job.Id, job.IdempotencyKey);
                JobProgressUpdated?.Invoke(job.Id, 100, "COMPLETED");
                LoggerService.LogInfo($"Print job completed successfully: {job.OrderNumber}");

                // Notify backend server
                try
                {
                    var statusPayload = new { agentToken = _config.AgentToken, status = "COMPLETED", progressPercent = 100 };
                    var content = new StringContent(JsonSerializer.Serialize(statusPayload), Encoding.UTF8, "application/json");
                    await _httpClient.PostAsync($"{_config.ServerUrl}/api/agents/jobs/{job.Id}/status", content);
                }
                catch (Exception ex)
                {
                    LoggerService.LogWarn($"Failed to notify server of job completion: {ex.Message}");
                }
            }
            else
            {
                JobProgressUpdated?.Invoke(job.Id, 0, $"FAILED: {error}");
                LoggerService.LogError($"Print job failed: {job.OrderNumber} | Error: {error}");

                // Notify backend server
                try
                {
                    var statusPayload = new { agentToken = _config.AgentToken, status = "FAILED", progressPercent = 0, errorMessage = error };
                    var content = new StringContent(JsonSerializer.Serialize(statusPayload), Encoding.UTF8, "application/json");
                    await _httpClient.PostAsync($"{_config.ServerUrl}/api/agents/jobs/{job.Id}/status", content);
                }
                catch (Exception ex)
                {
                    LoggerService.LogWarn($"Failed to notify server of job failure: {ex.Message}");
                }
            }
        }
    }
}
