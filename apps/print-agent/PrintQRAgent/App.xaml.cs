using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Text.Json;
using System.Windows;
using System.Windows.Forms;
using PrintQRAgent.Models;
using PrintQRAgent.Services;
using Application = System.Windows.Application;
using MessageBox = System.Windows.MessageBox;

namespace PrintQRAgent
{
    public partial class App : Application
    {
        private NotifyIcon? _notifyIcon;
        private MainWindow? _mainWindow;
        private SingleInstanceCoordinator? _singleInstance;
        public static AgentConfig Config { get; set; } = new();

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            _singleInstance = new SingleInstanceCoordinator("AnishNovaPrintAgent", () =>
            {
                Dispatcher.BeginInvoke(new Action(ShowDashboard));
            });
            if (!_singleInstance.IsPrimaryInstance)
            {
                Shutdown();
                return;
            }

            // 1. Setup Global Crash-Proof Exception Handlers
            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                {
                    LoggerService.LogError("Unhandled AppDomain Exception", ex);
                }
            };

            DispatcherUnhandledException += (s, args) =>
            {
                LoggerService.LogError("Dispatcher Unhandled Exception", args.Exception);
                args.Handled = true; // Prevent abrupt crash
            };

            LoggerService.LogInfo("==================================================");
            LoggerService.LogInfo("AnishNova Print Agent v1.0.0 starting...");
            LoggerService.LogInfo($"OS: {Environment.OSVersion}, .NET: {Environment.Version}, 64-bit: {Environment.Is64BitProcess}");
            LoggerService.LogInfo($"Log Path: {LoggerService.GetLogPath()}");

            // 2. Load Local Configuration
            LoadConfig();

            // 3. Setup System Tray Icon
            SetupSystemTray();

            // 4. Create and show Main Window
            _mainWindow = new MainWindow();

            // Only run silently in background if a valid paired shop token exists
            if (!string.IsNullOrEmpty(Config.AgentToken) && Config.AgentToken != "none")
            {
                LoggerService.LogInfo($"Found existing active pairing{(string.IsNullOrWhiteSpace(Config.ShopName) ? string.Empty : $" for shop {Config.ShopName}")}. Running in System Tray.");
                _mainWindow.WindowState = WindowState.Minimized;
                _mainWindow.Hide();
            }
            else
            {
                LoggerService.LogInfo("No active pairing found. Displaying Setup & Activation screen.");
                _mainWindow.WindowState = WindowState.Normal;
                _mainWindow.Show();
                _mainWindow.Activate();
            }
        }

        private void SetupSystemTray()
        {
            try
            {
                Icon? appIcon = null;
                var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] candidateIconPaths = new[]
                {
                    Path.Combine(baseDir, "assets", "app.ico"),
                    Path.Combine(baseDir, "app.ico"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "AnishNovaPrintAgent", "assets", "app.ico")
                };

                foreach (var p in candidateIconPaths)
                {
                    if (File.Exists(p))
                    {
                        try { appIcon = new Icon(p); break; } catch { }
                    }
                }

                _notifyIcon = new NotifyIcon
                {
                    Text = "AnishNova Print Agent - Windows Spooler",
                    Visible = true,
                    Icon = appIcon ?? SystemIcons.Application
                };

                var contextMenu = new ContextMenuStrip();
                contextMenu.Items.Add("Open Dashboard", null, (s, e) => ShowDashboard());
                contextMenu.Items.Add("Refresh Printers", null, (s, e) => _mainWindow?.RefreshPrinters());
                contextMenu.Items.Add("Diagnostic Test Print", null, (s, e) => _mainWindow?.TriggerTestPrint());
                contextMenu.Items.Add(new ToolStripSeparator());
                contextMenu.Items.Add("View Logs", null, (s, e) => OpenLogFile());
                contextMenu.Items.Add(new ToolStripSeparator());
                contextMenu.Items.Add("Exit Agent", null, (s, e) => ExitAgent());

                _notifyIcon.ContextMenuStrip = contextMenu;
                _notifyIcon.DoubleClick += (s, e) => ShowDashboard();
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Failed to initialize System Tray Icon", ex);
            }
        }

        public void ShowDashboard()
        {
            if (_mainWindow == null)
            {
                _mainWindow = new MainWindow();
            }
            _mainWindow.Show();
            _mainWindow.WindowState = WindowState.Normal;
            _mainWindow.Activate();
        }

        public static bool SaveConfig()
        {
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var dir = Path.Combine(localAppData, "AnishNovaPrint");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                var filePath = Path.Combine(dir, "config.json");
                AgentCredentialStore.Save(dir, Config.AgentToken);
                var savedConfig = new AgentConfig
                {
                    ServerUrl = Config.ServerUrl,
                    PairingCode = string.Empty,
                    AgentToken = null,
                    ShopId = Config.ShopId,
                    ShopName = Config.ShopName,
                    DeviceName = Config.DeviceName,
                    SelectedPrinterName = Config.SelectedPrinterName,
                    AutoStartWithWindows = Config.AutoStartWithWindows,
                    MinimizeToTrayOnClose = Config.MinimizeToTrayOnClose
                };
                var json = JsonSerializer.Serialize(savedConfig, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(filePath, json);
                LoggerService.LogInfo("Agent configuration saved successfully.");
                return true;
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Failed to save config.json", ex);
                return false;
            }
        }

        private static void LoadConfig()
        {
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var filePath = Path.Combine(localAppData, "AnishNovaPrint", "config.json");
                if (File.Exists(filePath))
                {
                    var json = File.ReadAllText(filePath);
                    var loaded = JsonSerializer.Deserialize<AgentConfig>(json);
                    if (loaded != null)
                    {
                        Config = loaded;
                        // The agent does not run a local API. Normalize stale localhost URLs,
                        // legacy /api suffixes, and malformed values to a safe cloud API base.
                        Config.ServerUrl = AgentApiEndpoint.NormalizeServerUrl(Config.ServerUrl);
                        Config.AgentToken ??= AgentCredentialStore.Load(Path.GetDirectoryName(filePath)!);
                        // Migrate credentials from older plaintext configuration to per-user Windows DPAPI storage.
                        if (!string.IsNullOrWhiteSpace(Config.AgentToken)) SaveConfig();
                        LoggerService.LogInfo($"Configuration loaded. Server: {Config.ServerUrl}; pairing credentials are redacted.");
                    }
                }
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Failed to load config.json", ex);
            }
        }

        private void OpenLogFile()
        {
            try
            {
                var logPath = LoggerService.GetLogPath();
                if (File.Exists(logPath))
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = logPath,
                        UseShellExecute = true
                    });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Unable to open log file: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        public void ExitAgent()
        {
            LoggerService.LogInfo("Agent shutdown requested by user.");
            _notifyIcon?.Dispose();
            Shutdown();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            _notifyIcon?.Dispose();
            _singleInstance?.Dispose();
            base.OnExit(e);
        }
    }
}
