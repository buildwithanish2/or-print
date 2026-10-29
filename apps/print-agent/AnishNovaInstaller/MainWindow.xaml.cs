using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Win32;

namespace AnishNovaInstaller
{
    public partial class MainWindow : Window
    {
        private readonly string _targetDir;

        public MainWindow()
        {
            InitializeComponent();

            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            _targetDir = Path.Combine(localAppData, "Programs", "AnishNovaPrintAgent");
            InstallDirBox.Text = _targetDir;
        }

        private async void InstallBtn_Click(object sender, RoutedEventArgs e)
        {
            InstallBtn.IsEnabled = false;
            CancelBtn.IsEnabled = false;

            InstallProgressBar.Value = 10;
            ProgressStatusText.Text = "Creating application directories...";

            App.LogInstallerInfo($"Starting installation into: {_targetDir}");

            try
            {
                var targetExePath = Path.Combine(_targetDir, "PrintQRAgent.exe");
                var assetsDir = Path.Combine(_targetDir, "assets");
                var targetIconPath = Path.Combine(assetsDir, "app.ico");

                await Task.Run(() =>
                {
                    // 1. Create target directories
                    if (!Directory.Exists(_targetDir)) Directory.CreateDirectory(_targetDir);
                    if (!Directory.Exists(assetsDir)) Directory.CreateDirectory(assetsDir);

                    // 2. Extract embedded PrintQRAgent.exe payload
                    bool extracted = false;
                    var assembly = Assembly.GetExecutingAssembly();
                    
                    using (var resStream = assembly.GetManifestResourceStream("PrintQRAgent.exe"))
                    {
                        if (resStream != null)
                        {
                            using var fs = File.Create(targetExePath);
                            resStream.CopyTo(fs);
                            extracted = true;
                            App.LogInstallerInfo($"Successfully extracted embedded PrintQRAgent.exe ({fs.Length} bytes).");
                        }
                    }

                    // Extract embedded app.ico
                    using (var icoStream = assembly.GetManifestResourceStream("app.ico"))
                    {
                        if (icoStream != null)
                        {
                            using var fs = File.Create(targetIconPath);
                            icoStream.CopyTo(fs);
                            App.LogInstallerInfo($"Successfully extracted branded icon ({fs.Length} bytes).");
                        }
                    }

                    // Fallback to searching current/adjacent directory if embedded stream was not found
                    if (!extracted)
                    {
                        var currentDir = AppDomain.CurrentDomain.BaseDirectory;
                        string[] possibleSources = new[]
                        {
                            Path.Combine(currentDir, "PrintQRAgent.exe"),
                            Path.Combine(currentDir, "..", "PrintQRAgent", "bin", "Release", "net8.0-windows", "win-x64", "publish", "PrintQRAgent.exe"),
                            Path.Combine(currentDir, "..", "PrintQRAgent", "bin", "Debug", "net8.0-windows", "PrintQRAgent.exe"),
                            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "PrintQRAgent.exe")
                        };

                        foreach (var src in possibleSources)
                        {
                            if (File.Exists(src))
                            {
                                File.Copy(src, targetExePath, true);
                                App.LogInstallerInfo($"Copied payload from candidate: {src} to {targetExePath}");
                                extracted = true;
                                break;
                            }
                        }
                    }

                    // Also copy adjacent DLLs or config if available
                    var currentDirFiles = Directory.GetFiles(AppDomain.CurrentDomain.BaseDirectory);
                    foreach (var srcFile in currentDirFiles)
                    {
                        var fileName = Path.GetFileName(srcFile);
                        if (fileName.Equals("AnishNovaPrintAgent-Setup.exe", StringComparison.OrdinalIgnoreCase))
                            continue;

                        var destFile = Path.Combine(_targetDir, fileName);
                        try
                        {
                            File.Copy(srcFile, destFile, true);
                        }
                        catch { }
                    }
                });

                InstallProgressBar.Value = 60;
                ProgressStatusText.Text = "Creating shortcuts and Windows startup registration...";

                // 3. Register Startup Registry Key
                if (AutoStartCheck.IsChecked == true)
                {
                    try
                    {
                        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true);
                        key?.SetValue("AnishNovaPrintAgent", $"\"{targetExePath}\"");
                        App.LogInstallerInfo("Configured Windows auto-start registry key.");
                    }
                    catch (Exception ex)
                    {
                        App.LogInstallerError("Failed to set startup registry key", ex);
                    }
                }
                else
                {
                    // Keep upgrades predictable: disabling auto-start removes an older Run entry.
                    try
                    {
                        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true);
                        key?.DeleteValue("AnishNovaPrintAgent", false);
                    }
                    catch (Exception ex)
                    {
                        App.LogInstallerError("Failed to remove the previous startup registration", ex);
                    }
                }

                // 4. Create a desktop shortcut and optionally add the Start Menu shortcut.
                try
                {
                    var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    var desktopShortcut = Path.Combine(desktop, "AnishNova Print Agent.lnk");
                    CreateShortcut(targetExePath, desktopShortcut, _targetDir, "AnishNova Print Agent", targetIconPath);

                    if (CreateShortcutCheck.IsChecked == true)
                    {
                        var startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                        var startMenuShortcut = Path.Combine(startMenu, "AnishNova Print Agent.lnk");
                        CreateShortcut(targetExePath, startMenuShortcut, _targetDir, "AnishNova Print Agent - Windows Desktop Spooler", targetIconPath);
                    }

                    App.LogInstallerInfo($"Desktop shortcut created with icon at: {desktopShortcut}");
                }
                catch (Exception ex)
                {
                    App.LogInstallerError("Failed to create shortcuts", ex);
                }

                // 5. Register in Windows Programs & Features (Uninstall entry)
                try
                {
                    using var uninstKey = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\AnishNovaPrintAgent");
                    if (uninstKey != null)
                    {
                        uninstKey.SetValue("DisplayName", "AnishNova Print Agent");
                        uninstKey.SetValue("DisplayVersion", "1.0.0");
                        uninstKey.SetValue("Publisher", "AnishNova Technologies");
                        uninstKey.SetValue("DisplayIcon", targetExePath);
                        var uninstCmd = $"cmd.exe /c reg delete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\" /v AnishNovaPrintAgent /f & del \"%USERPROFILE%\\Desktop\\AnishNova Print Agent.lnk\" 2>nul & del \"%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\AnishNova Print Agent.lnk\" 2>nul & del \"%LOCALAPPDATA%\\AnishNovaPrint\\agent-token.bin\" 2>nul & del \"%LOCALAPPDATA%\\AnishNovaPrint\\config.json\" 2>nul & reg delete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnishNovaPrintAgent\" /f & rmdir /s /q \"{_targetDir}\"";
                        uninstKey.SetValue("UninstallString", uninstCmd);
                    }
                }
                catch { }

                InstallProgressBar.Value = 100;
                ProgressStatusText.Text = "Installation completed successfully! Launching Agent...";

                App.LogInstallerInfo("Installation completed with exit code 0.");

                // 6. Launch Agent Immediately
                if (LaunchAfterCheck.IsChecked == true && File.Exists(targetExePath))
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = targetExePath,
                            WorkingDirectory = _targetDir,
                            UseShellExecute = true
                        };
                        Process.Start(psi);
                        App.LogInstallerInfo("Launched PrintQRAgent.exe successfully.");
                    }
                    catch (Exception ex)
                    {
                        App.LogInstallerError("Failed to auto-launch PrintQRAgent.exe", ex);
                    }
                }

                MessageBox.Show(
                    "AnishNova Print Agent setup has completed successfully!\n\nThe desktop shortcut is ready and the Setup & Pairing screen will open immediately.",
                    "Setup Complete",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information
                );

                Application.Current.Shutdown();
            }
            catch (Exception ex)
            {
                App.LogInstallerError("Fatal Installation Error", ex);
                MessageBox.Show(
                    $"Installation encountered an error:\n{ex.Message}\n\nCheck log: %TEMP%\\AnishNovaPrintAgent-install.log",
                    "Installation Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
                InstallBtn.IsEnabled = true;
                CancelBtn.IsEnabled = true;
            }
        }

        private void CreateShortcut(string targetPath, string shortcutPath, string workingDir, string description, string iconPath)
        {
            try
            {
                Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic? shell = Activator.CreateInstance(shellType);
                    if (shell != null)
                    {
                        dynamic shortcut = shell.CreateShortcut(shortcutPath);
                        shortcut.TargetPath = targetPath;
                        shortcut.WorkingDirectory = workingDir;
                        shortcut.Description = description;
                        if (File.Exists(iconPath))
                        {
                            shortcut.IconLocation = $"{iconPath},0";
                        }
                        else
                        {
                            shortcut.IconLocation = $"{targetPath},0";
                        }
                        shortcut.Save();
                    }
                }
            }
            catch { }
        }

        private void CancelBtn_Click(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }
    }
}
