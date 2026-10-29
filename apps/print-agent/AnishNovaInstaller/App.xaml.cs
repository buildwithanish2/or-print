using System;
using System.IO;
using System.Windows;

namespace AnishNovaInstaller
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                {
                    LogInstallerError("AppDomain Unhandled Exception", ex);
                }
            };

            DispatcherUnhandledException += (s, args) =>
            {
                LogInstallerError("Dispatcher Unhandled Exception", args.Exception);
                args.Handled = true;
            };
        }

        public static void LogInstallerError(string message, Exception? ex = null)
        {
            try
            {
                var logFile = Path.Combine(Path.GetTempPath(), "AnishNovaPrintAgent-install.log");
                var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [ERROR] {message}: {ex?.Message}\n{ex?.StackTrace}\n";
                File.AppendAllText(logFile, line);
            }
            catch { }
        }

        public static void LogInstallerInfo(string message)
        {
            try
            {
                var logFile = Path.Combine(Path.GetTempPath(), "AnishNovaPrintAgent-install.log");
                var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [INFO] {message}\n";
                File.AppendAllText(logFile, line);
            }
            catch { }
        }
    }
}
