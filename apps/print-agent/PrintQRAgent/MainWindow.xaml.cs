using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using PrintQRAgent.Models;
using PrintQRAgent.Services;
using MessageBox = System.Windows.MessageBox;

namespace PrintQRAgent
{
    public partial class MainWindow : Window
    {
        private readonly PrintSpoolerService _spoolerService = new();
        private readonly OfflineQueueService _queueService = new();
        private readonly WebSocketClientService _wsService;
        private readonly ObservableCollection<PrintJobPayload> _jobsList = new();
        private bool _isMasked = true;
        private bool _backgroundServicesStarted;
        private bool _allowClose;
        private readonly DispatcherTimer _printerRefreshTimer = new() { Interval = TimeSpan.FromMinutes(1) };

        public MainWindow()
        {
            InitializeComponent();
            _wsService = new WebSocketClientService(App.Config, _spoolerService, _queueService);

            QueueDataGrid.ItemsSource = _jobsList;

            _wsService.ConnectionStatusChanged += (connected, msg) =>
            {
                Dispatcher.Invoke(() =>
                {
                    StatusText.Text = connected ? "● ONLINE & ACTIVE" : $"○ {msg}";
                });
            };

            _wsService.HealthUpdated += (health) =>
            {
                Dispatcher.Invoke(() =>
                {
                    UpdateHealthUI(health);
                });
            };

            _wsService.JobReceived += (job) =>
            {
                Dispatcher.Invoke(() =>
                {
                    _jobsList.Insert(0, job);
                    QueueCountText.Text = $"Queue: {_jobsList.Count} Jobs";
                });
            };

            _wsService.JobProgressUpdated += (jobId, progress, statusMsg) =>
            {
                Dispatcher.Invoke(() =>
                {
                    var item = _jobsList.FirstOrDefault(j => j.Id == jobId);
                    if (item != null)
                    {
                        item.Status = statusMsg ?? $"{progress}%";
                        QueueDataGrid.Items.Refresh();
                    }
                });
            };

            Loaded += MainWindow_Loaded;
            Closing += MainWindow_Closing;
            _printerRefreshTimer.Tick += (_, _) => _ = RefreshPrintersAndSyncAsync();
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            if (_backgroundServicesStarted) return;
            _backgroundServicesStarted = true;

            var existingCode = App.Config.PairingCode ?? string.Empty;
            PairingCodePasswordBox.Password = existingCode;
            PairingCodeTextBox.Text = existingCode;

            if (!string.IsNullOrEmpty(App.Config.ShopName))
            {
                ShopInfoText.Text = $"✓ Paired with: {App.Config.ShopName}";
            }
            else
            {
                ShopInfoText.Text = "Status: Waiting for shop pairing code...";
            }

            VersionBadgeText.Text = $"v{UpdateService.CurrentVersion} (Installed)";

            RefreshPrinters();
            _printerRefreshTimer.Start();
            _ = _wsService.SyncPrintersAsync();
            _wsService.Start();

            // Background update check on startup (non-blocking)
            _ = CheckForUpdatesQuietlyAsync();
        }

        private void PairingCodePasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (_isMasked)
            {
                PairingCodeTextBox.Text = PairingCodePasswordBox.Password;
            }
        }

        private void PairingCodeTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_isMasked)
            {
                PairingCodePasswordBox.Password = PairingCodeTextBox.Text;
            }
        }

        private void ToggleMaskBtn_Click(object sender, RoutedEventArgs e)
        {
            _isMasked = !_isMasked;
            if (_isMasked)
            {
                PairingCodePasswordBox.Password = PairingCodeTextBox.Text;
                PairingCodePasswordBox.Visibility = Visibility.Visible;
                PairingCodeTextBox.Visibility = Visibility.Collapsed;
                ToggleMaskBtn.Content = "👁";
            }
            else
            {
                PairingCodeTextBox.Text = PairingCodePasswordBox.Password;
                PairingCodeTextBox.Visibility = Visibility.Visible;
                PairingCodePasswordBox.Visibility = Visibility.Collapsed;
                ToggleMaskBtn.Content = "🔒";
            }
        }

        private void UpdateHealthUI(HealthState health)
        {
            if (health.IsFullyOnline)
            {
                StatusText.Text = "● ONLINE & ACTIVE";
                StatusText.Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(52, 211, 153));
                StatusDot.Fill = new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129));
                StatusBadgeBorder.Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(6, 78, 59));
            }
            else if (health.IsPaired)
            {
                StatusText.Text = "● CONNECTING...";
                StatusText.Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(251, 191, 36));
                StatusDot.Fill = new SolidColorBrush(System.Windows.Media.Color.FromRgb(245, 158, 11));
                StatusBadgeBorder.Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(69, 26, 3));
            }
            else
            {
                StatusText.Text = "○ UNPAIRED";
                StatusText.Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(248, 113, 113));
                StatusDot.Fill = new SolidColorBrush(System.Windows.Media.Color.FromRgb(239, 68, 68));
                StatusBadgeBorder.Background = new SolidColorBrush(System.Windows.Media.Color.FromRgb(69, 10, 10));
            }

            HealthApiText.Text = health.IsApiConnected ? "API: ✓" : "API: ✕";
            HealthApiText.Foreground = health.IsApiConnected ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)) : new SolidColorBrush(System.Windows.Media.Color.FromRgb(239, 68, 68));

            HealthWsText.Text = health.IsQueuePolling ? "Job queue: ✓" : "Job queue: ✕";
            HealthWsText.Foreground = health.IsQueuePolling ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)) : new SolidColorBrush(System.Windows.Media.Color.FromRgb(239, 68, 68));

            HealthSpoolerText.Text = health.IsSpoolerRunning ? "Spooler: ✓" : "Spooler: ✕";
            HealthSpoolerText.Foreground = health.IsSpoolerRunning ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)) : new SolidColorBrush(System.Windows.Media.Color.FromRgb(239, 68, 68));

            HealthHeartbeatText.Text = health.IsHeartbeatActive ? "Heartbeat: ✓" : "Heartbeat: ✕";
            HealthHeartbeatText.Foreground = health.IsHeartbeatActive ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)) : new SolidColorBrush(System.Windows.Media.Color.FromRgb(239, 68, 68));
        }

        public void RefreshPrinters()
        {
            try
            {
                var printers = _spoolerService.GetInstalledPrinters();
                var physicalPrinters = printers.Where(printer => printer.IsPhysical).ToList();
                var selected = PrintSpoolerService.SelectPhysicalPrinter(physicalPrinters, App.Config.SelectedPrinterName);
                PrintersComboBox.ItemsSource = printers;
                PrintersComboBox.SelectedItem = selected;

                if (selected != null)
                {
                    App.Config.SelectedPrinterName = selected.Name;
                    PrinterCapabilitiesText.Text = "Selected: " + selected.Name + (selected.IsDefault ? " (Windows default)" : "") + " · " + selected.ConnectionType + " · " + selected.StatusBadge;
                    App.SaveConfig();
                }
                else
                {
                    var saved = App.Config.SelectedPrinterName;
                    PrinterCapabilitiesText.Text = !string.IsNullOrWhiteSpace(saved)
                        ? "Saved printer '" + saved + "' is unavailable. Check the shop printer assignment before selecting another device."
                        : physicalPrinters.Count == 0
                            ? "No physical printers are installed. Virtual printers are excluded from customer orders. Install a Windows/manufacturer driver, then rescan."
                            : "Multiple physical printers are available. Select the intended shop printer; no Windows default is configured.";
                }

            }
            catch (Exception ex)
            {
                LoggerService.LogError("Failed to refresh printers", ex);
            }
        }

        private async void RefreshPrinters_Click(object sender, RoutedEventArgs e)
        {
            RescanBtn.IsEnabled = false;
            RescanBtn.Content = "Rescanning...";
            try
            {
                var synced = await RefreshPrintersAndSyncAsync();
                MessageBox.Show(synced
                    ? "Windows printer discovery completed and available physical printers were synced to this shop."
                    : "Windows discovery completed, but printer sync did not succeed. Check the agent's API connection and shop pairing, then retry.",
                    "Printer rescan", synced ? MessageBoxButton.OK : MessageBoxButton.OK, synced ? MessageBoxImage.Information : MessageBoxImage.Warning);
            }
            finally
            {
                RescanBtn.IsEnabled = true;
                RescanBtn.Content = "↻ Rescan Printers";
            }
        }

        public async Task<bool> RefreshPrintersAndSyncAsync()
        {
            RefreshPrinters();
            return await _wsService.SyncPrintersAsync();
        }

        private void PrintersComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (PrintersComboBox.SelectedItem is DiscoveredPrinter selected)
            {
                if (selected.IsVirtual || !selected.IsAvailable)
                {
                    PrintersComboBox.SelectedItem = PrintersComboBox.Items.Cast<DiscoveredPrinter>()
                        .FirstOrDefault(printer => string.Equals(printer.Name, App.Config.SelectedPrinterName, StringComparison.OrdinalIgnoreCase));
                    MessageBox.Show(selected.ErrorState ?? "Choose an available physical printer for customer orders.", "Printer unavailable", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                App.Config.SelectedPrinterName = selected.Name;
                PrinterCapabilitiesText.Text = "Selected: " + selected.Name + (selected.IsDefault ? " (Windows default)" : "") + " · " + selected.ConnectionType + " · " + selected.StatusBadge;
                App.SaveConfig();
            }
        }

        private async void PairButton_Click(object sender, RoutedEventArgs e)
        {
            var code = (_isMasked ? PairingCodePasswordBox.Password : PairingCodeTextBox.Text).Trim().ToUpper();
            if (string.IsNullOrWhiteSpace(code))
            {
                MessageBox.Show("Please enter a Shop Pairing Code from your Shop Dashboard (e.g. ANP-XXXX-XXXX).", "Validation Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            PairButton.IsEnabled = false;
            PairButton.Content = "Activating...";

            try
            {
                var (success, msg, shopName) = await _wsService.PairWithServerAsync(code);
                if (success)
                {
                    App.Config.ShopName = shopName;
                    ShopInfoText.Text = $"✓ Paired with: {shopName ?? "Shop"}";
                    RefreshPrinters();
                    _ = await _wsService.SyncPrintersAsync();

                    MessageBox.Show(
                        $"{msg}\n\nAll Windows printers have been detected and registered.\nThe window will now minimize to the System Tray to handle background printing.",
                        "AnishNova Print Agent",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information
                    );

                    await Task.Delay(500);
                    Hide();
                }
                else
                {
                    MessageBox.Show(msg, "Pairing Failed", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Pairing failed: {ex.Message}", "Connection Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                PairButton.IsEnabled = true;
                PairButton.Content = "Activate Agent";
            }
        }

        private async Task CheckForUpdatesQuietlyAsync()
        {
            try
            {
                var result = await UpdateService.CheckForUpdatesAsync(App.Config.ServerUrl);
                if (result.UpdateAvailable && result.Manifest != null)
                {
                    Dispatcher.Invoke(() =>
                    {
                        VersionBadgeText.Text = $"v{result.Manifest.LatestVersion} Available!";
                        VersionBadgeText.Foreground = new SolidColorBrush(System.Windows.Media.Color.FromRgb(245, 158, 11));
                    });
                }
            }
            catch { }
        }

        private async void CheckUpdateBtn_Click(object sender, RoutedEventArgs e)
        {
            CheckUpdateBtn.IsEnabled = false;
            CheckUpdateBtn.Content = "Checking...";

            try
            {
                var result = await UpdateService.CheckForUpdatesAsync(App.Config.ServerUrl);
                if (result.UpdateAvailable && result.Manifest != null)
                {
                    var prompt = $"AnishNova Print Agent v{result.Manifest.LatestVersion} is available!\n\nRelease Notes:\n" +
                                 string.Join("\n• ", result.Manifest.ReleaseNotes) +
                                 "\n\nWould you like to download and install the update now?";

                    var response = MessageBox.Show(prompt, "Software Update", MessageBoxButton.YesNo, MessageBoxImage.Information);
                    if (response == MessageBoxResult.Yes)
                    {
                        await PerformUpdateAsync(result.Manifest);
                    }
                }
                else
                {
                    MessageBox.Show($"You are using the latest version of AnishNova Print Agent (v{UpdateService.CurrentVersion}).", "Up to Date", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Update check failed: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                CheckUpdateBtn.IsEnabled = true;
                CheckUpdateBtn.Content = "🔄 Check Updates";
            }
        }

        private async Task PerformUpdateAsync(UpdateManifest manifest)
        {
            try
            {
                StatusText.Text = "Downloading update...";
                var (success, error) = await UpdateService.DownloadAndInstallUpdateAsync(manifest, (pct, status) =>
                {
                    Dispatcher.Invoke(() =>
                    {
                        StatusText.Text = $"{status} ({pct}%)";
                    });
                });

                if (!success)
                {
                    MessageBox.Show($"Update installation failed:\n{error}", "Update Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to apply update: {ex.Message}", "Update Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        public void TriggerTestPrint()
        {
            try
            {
                var selectedPrinter = App.Config.SelectedPrinterName;
                if (string.IsNullOrEmpty(selectedPrinter))
                {
                    MessageBox.Show("No printer selected. Please select a Windows printer first.", "Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                if (MessageBox.Show("Send one diagnostic page to '" + selectedPrinter + "'? This is a real print and may use paper and ink.", "Confirm diagnostic test print", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                    return;

                var orderNumber = $"TEST-{new Random().Next(1000, 9999)}";
                var sampleJob = new PrintJobPayload
                {
                    Id = Guid.NewGuid().ToString(),
                    OrderNumber = orderNumber,
                    FileName = "AnishNova_Diagnostic_Test_Page.pdf",
                    PrinterName = selectedPrinter,
                    Settings = new JobSettings { Copies = 1, ColorMode = "BW", PaperSize = "A4" },
                    Status = "PRINTING"
                };

                _jobsList.Insert(0, sampleJob);
                QueueCountText.Text = $"Queue: {_jobsList.Count} Jobs";

                var (success, error) = _spoolerService.PrintDiagnosticTestPage(selectedPrinter, orderNumber);
                if (success)
                {
                    sampleJob.Status = "COMPLETED";
                    QueueDataGrid.Items.Refresh();
                    MessageBox.Show($"✓ Diagnostic test print {orderNumber} successfully sent to: {selectedPrinter}", "Test Print Success", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    sampleJob.Status = "FAILED";
                    QueueDataGrid.Items.Refresh();
                    MessageBox.Show($"✕ Test print failed:\n{error}", "Test Print Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to execute test print: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void TestPrint_Click(object sender, RoutedEventArgs e)
        {
            TriggerTestPrint();
        }

        private void OpenDashboard_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "https://shop-dashboard-one-eosin.vercel.app/login",
                    UseShellExecute = true
                });
            }
            catch { }
        }

        private void ViewLogs_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var logPath = LoggerService.GetLogPath();
                if (File.Exists(logPath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = logPath,
                        UseShellExecute = true
                    });
                }
                else
                {
                    MessageBox.Show($"Log file location: {logPath}", "Logs", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Unable to open logs: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void MinimizeToTray_Click(object sender, RoutedEventArgs e)
        {
            Hide();
        }

        private void Exit_Click(object sender, RoutedEventArgs e)
        {
            if (System.Windows.Application.Current is App myApp)
            {
                myApp.ExitAgent();
            }
            else
            {
                System.Windows.Application.Current.Shutdown();
            }
        }

        private void MainWindow_Closing(object? sender, CancelEventArgs e)
        {
            if (!_allowClose && App.Config.MinimizeToTrayOnClose)
            {
                e.Cancel = true;
                Hide();
            }
            else
            {
                _printerRefreshTimer.Stop();
                _wsService.Stop();
            }
        }

        public void PrepareForExit()
        {
            _allowClose = true;
            _wsService.Stop();
        }
    }
}
