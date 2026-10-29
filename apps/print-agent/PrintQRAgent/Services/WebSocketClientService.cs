using System;
using System.Collections.Generic;
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
        private bool _isHeartbeatActive;
        private readonly string? _configurationError;
        private readonly AgentPairingClient _pairingClient;
        private readonly AgentHeartbeatClient _heartbeatClient;

        public event Action<bool, string>? ConnectionStatusChanged;
        public event Action<HealthState>? HealthUpdated;
        public event Action<PrintJobPayload>? JobReceived;
        public event Action<string, int, string?>? JobProgressUpdated;

        public bool IsConnected => _isConnected;
        public bool IsApiConnected => _isApiConnected;

        public WebSocketClientService(AgentConfig config, PrintSpoolerService spoolerService, OfflineQueueService queueService)
        {
            _config = config;
            try { _config.ServerUrl = AgentApiEndpoint.NormalizeForCurrentBuild(_config.ServerUrl); }
            catch (FormatException ex) { _configurationError = ex.Message; }
            _spoolerService = spoolerService;
            _queueService = queueService;
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
            _pairingClient = new AgentPairingClient(_config, _httpClient, App.SaveConfig);
            _heartbeatClient = new AgentHeartbeatClient(_httpClient, _config);
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
            _cts?.Dispose();
            _cts = null;
            _isConnected = false;
            _isApiConnected = false;
            _isHeartbeatActive = false;
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
                    IsWebSocketConnected = false,
                    IsQueuePolling = _isApiConnected && isPaired,
                    IsSpoolerRunning = spoolerRunning,
                    IsHeartbeatActive = _isHeartbeatActive && isPaired,
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
            if (_configurationError != null) return (false, _configurationError, null);
            try
            {
                var result = await _pairingClient.PairAsync(pairingCode);
                if (!result.success) return result;

                LoggerService.LogInfo($"Successfully paired with Shop: {result.shopName}. Agent credential is protected locally.");
                _isApiConnected = true;
                _ = SyncPrintersAsync();
                EmitHealthUpdate();
                return result;
            }
            catch (Exception ex)
            {
                if (ex is FormatException) return (false, ex.Message, null);
                LoggerService.LogWarn($"Pairing request failed ({ex.GetType().Name}). The pairing code and credential were not logged.");
                return (false, "Could not reach the configured AnishNova Print API. Check this computer's internet connection and try again.", null);
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
                if (_configurationError != null)
                {
                    _isApiConnected = false;
                    return;
                }
                var printers = _spoolerService.GetInstalledPrinters();
                using var request = AgentApiEndpoint.CreateAuthenticatedRequest(
                    HttpMethod.Post, _config.ServerUrl, "agents/printers/sync", _config.AgentToken);
                request.Content = new StringContent(JsonSerializer.Serialize(new { printers }), Encoding.UTF8, "application/json");
                using var response = await _httpClient.SendAsync(request);

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
            var consecutiveHeartbeatFailures = 0;
            while (!token.IsCancellationRequested)
            {
                try
                {
                    if (_configurationError != null)
                    {
                        _isConnected = false;
                        _isApiConnected = false;
                        _isHeartbeatActive = false;
                        ConnectionStatusChanged?.Invoke(false, _configurationError);
                        EmitHealthUpdate();
                        await Task.Delay(TimeSpan.FromSeconds(30), token);
                        continue;
                    }
                    if (string.IsNullOrWhiteSpace(_config.AgentToken) || _config.AgentToken == "none")
                    {
                        _isConnected = false;
                        _isApiConnected = false;
                        ConnectionStatusChanged?.Invoke(false, "Waiting for shop pairing");
                        EmitHealthUpdate();
                        await Task.Delay(5000, token);
                        continue;
                    }

                    // 1. Initial printer discovery sync
                    await SyncPrintersAsync();

                    _isConnected = _isApiConnected;
                    ConnectionStatusChanged?.Invoke(_isApiConnected, _isApiConnected ? "Connected to shop print queue" : "API unavailable; retrying shortly");
                    EmitHealthUpdate();

                    while (!token.IsCancellationRequested)
                    {
                        // 2. Heartbeat to keep agent ONLINE in Admin & Shop dashboards
                        if (!string.IsNullOrEmpty(_config.AgentToken) && _config.AgentToken != "none")
                        {
                            try
                            {
                                var printers = _spoolerService.GetInstalledPrinters();
                                var result = await _heartbeatClient.SendAsync(_config.AgentToken, printers.Count, token);
                                _isHeartbeatActive = result.success;
                                _isApiConnected = result.success;
                                if (result.success)
                                {
                                    consecutiveHeartbeatFailures = 0;
                                }
                                else
                                {
                                    consecutiveHeartbeatFailures++;
                                    ConnectionStatusChanged?.Invoke(false, result.message);
                                    LoggerService.LogWarn(result.message);
                                }
                            }
                            catch (OperationCanceledException) when (token.IsCancellationRequested)
                            {
                                break;
                            }
                            catch (Exception ex)
                            {
                                consecutiveHeartbeatFailures++;
                                _isHeartbeatActive = false;
                                _isApiConnected = false;
                                ConnectionStatusChanged?.Invoke(false, "Heartbeat could not reach the configured API. Retrying.");
                                LoggerService.LogWarn($"Heartbeat attempt failed ({ex.GetType().Name}); retry scheduled.");
                            }

                            // Durable queue polling closes the gap where a shop is offline when a payment is approved.
                            if (_isApiConnected) await PollJobsAsync(token);
                        }

                        // 3. Process pending offline queue jobs
                        foreach (var job in _queueService.GetPendingJobs())
                        {
                            await ProcessJobAsync(job);
                        }

                        EmitHealthUpdate();
                        var retrySeconds = consecutiveHeartbeatFailures == 0
                            ? 15
                            : Math.Min(60, 5 * (1 << Math.Min(consecutiveHeartbeatFailures - 1, 4)));
                        await Task.Delay(TimeSpan.FromSeconds(retrySeconds), token);
                    }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _isConnected = false;
                    _isApiConnected = false;
                    ConnectionStatusChanged?.Invoke(false, $"Reconnecting: {ex.Message}");
                    LoggerService.LogWarn($"Connection loop warning: {ex.Message}. Retrying in 5 seconds...");
                    EmitHealthUpdate();
                    if (!token.IsCancellationRequested) await Task.Delay(5000, token);
                }
            }
        }

        private async Task PollJobsAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var request = AgentApiEndpoint.CreateAuthenticatedRequest(
                    HttpMethod.Post, _config.ServerUrl, "agents/jobs/poll", _config.AgentToken ?? string.Empty);
                using var response = await _httpClient.SendAsync(request, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _isApiConnected = false;
                    return;
                }

                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (!document.RootElement.TryGetProperty("data", out var jobs) || jobs.ValueKind != JsonValueKind.Array) return;
                foreach (var item in jobs.EnumerateArray())
                {
                    var job = JsonSerializer.Deserialize<PrintJobPayload>(item.GetRawText());
                    if (job != null) _queueService.EnqueueJob(job);
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
            catch (Exception ex) { LoggerService.LogWarn($"Print queue polling failed: {ex.Message}"); }
        }

        public async Task ProcessJobAsync(PrintJobPayload job)
        {
            if (!_queueService.TryBeginPrint(job.Id, job.IdempotencyKey)) return;
            LoggerService.LogInfo($"Processing print job: {job.OrderNumber} ({job.FileName})");
            JobReceived?.Invoke(job);
            JobProgressUpdated?.Invoke(job.Id, 20, "Downloading document...");

            var targetPrinter = job.PrinterName;
            if (!string.IsNullOrWhiteSpace(_config.SelectedPrinterName) && !string.Equals(_config.SelectedPrinterName, job.PrinterName, StringComparison.OrdinalIgnoreCase))
            {
                await ReportJobStatusAsync(job, "FAILED", 0, "The shop-configured printer does not match this job's assigned printer.");
                _queueService.MarkJobResolved(job.Id, job.IdempotencyKey);
                return;
            }

            await ReportJobStatusAsync(job, "DOWNLOADING", 20, null);
            var (success, error) = await _spoolerService.PrintDocumentAsync(job, targetPrinter, AgentApiEndpoint.NormalizeForCurrentBuild(_config.ServerUrl), _config.AgentToken ?? string.Empty, (progress) =>
            {
                JobProgressUpdated?.Invoke(job.Id, progress, progress >= 90 ? "SENT_TO_SPOOLER" : "PRINTING");
                if (progress >= 80) return ReportJobStatusAsync(job, "PRINTING", 80, null);
                return Task.CompletedTask;
            });

            if (success)
            {
                await ReportJobStatusAsync(job, "SENT_TO_SPOOLER", 90, null);
                JobProgressUpdated?.Invoke(job.Id, 90, "SENT_TO_SPOOLER");
                LoggerService.LogInfo($"Print job was accepted by the Windows spooler: {job.OrderNumber}. Physical completion is not confirmed.");
            }
            else
            {
                JobProgressUpdated?.Invoke(job.Id, 0, $"FAILED: {error}");
                LoggerService.LogError($"Print job failed: {job.OrderNumber} | Error: {error}");
                await ReportJobStatusAsync(job, "FAILED", 0, error);
            }
            _queueService.MarkJobResolved(job.Id, job.IdempotencyKey);
        }

        private async Task ReportJobStatusAsync(PrintJobPayload job, string status, int progress, string? error)
        {
            try
            {
                using var request = AgentApiEndpoint.CreateAuthenticatedRequest(
                    HttpMethod.Post, _config.ServerUrl, $"agents/jobs/{Uri.EscapeDataString(job.Id)}/status", _config.AgentToken ?? string.Empty);
                request.Content = new StringContent(JsonSerializer.Serialize(new { status, progressPercent = progress, errorMessage = error }), Encoding.UTF8, "application/json");
                using var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode) LoggerService.LogWarn($"Server rejected print-job status update ({(int)response.StatusCode}).");
            }
            catch (Exception ex) { LoggerService.LogWarn($"Could not report print-job status: {ex.Message}"); }
        }
    }
}
