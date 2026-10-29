using System;
using System.IO;

namespace PrintQRAgent.Services
{
    public static class LoggerService
    {
        private static readonly string LogDirectory;
        private static readonly string LogFilePath;
        private static readonly object LockObj = new();

        static LoggerService()
        {
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                LogDirectory = Path.Combine(localAppData, "AnishNovaPrint", "logs");
                if (!Directory.Exists(LogDirectory))
                {
                    Directory.CreateDirectory(LogDirectory);
                }
                LogFilePath = Path.Combine(LogDirectory, "agent.log");
            }
            catch
            {
                LogDirectory = Path.GetTempPath();
                LogFilePath = Path.Combine(LogDirectory, "AnishNovaPrintAgent-install.log");
            }
        }

        public static void LogInfo(string message)
        {
            WriteLog("INFO", message);
        }

        public static void LogWarn(string message)
        {
            WriteLog("WARN", message);
        }

        public static void LogError(string message, Exception? ex = null)
        {
            var fullMessage = ex != null ? $"{message} | Exception: {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}" : message;
            WriteLog("ERROR", fullMessage);
        }

        private static void WriteLog(string level, string message)
        {
            try
            {
                var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [{level}] {message}";
                lock (LockObj)
                {
                    File.AppendAllText(LogFilePath, line + Environment.NewLine);
                }
                Console.WriteLine(line);
            }
            catch { }
        }

        public static string GetLogPath() => LogFilePath;
    }
}
