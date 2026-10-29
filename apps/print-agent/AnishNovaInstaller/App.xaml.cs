using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Windows;

namespace AnishNovaInstaller
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            if (e.Args.Contains("--verify-agent-payload", StringComparer.Ordinal))
            {
                Environment.ExitCode = VerifyEmbeddedAgentPayload() ? 0 : 1;
                Shutdown();
                return;
            }

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

        private static bool VerifyEmbeddedAgentPayload()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                var expectedHash = assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
                    .FirstOrDefault(attribute => attribute.Key == "AgentPayloadSha256")?.Value;
                if (string.IsNullOrWhiteSpace(expectedHash) || !System.Text.RegularExpressions.Regex.IsMatch(expectedHash, "^[a-fA-F0-9]{64}$"))
                    return false;
                using var payload = assembly.GetManifestResourceStream("PrintQRAgent.exe");
                if (payload == null) return false;
                var actualHash = SHA256.HashData(payload);
                return CryptographicOperations.FixedTimeEquals(actualHash, Convert.FromHexString(expectedHash));
            }
            catch
            {
                return false;
            }
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
