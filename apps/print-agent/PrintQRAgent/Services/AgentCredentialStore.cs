using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace PrintQRAgent.Services
{
    internal static class AgentCredentialStore
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("AnishNovaPrintAgent:user-token:v1");

        public static void Save(string directory, string? token)
        {
            var path = Path.Combine(directory, "agent-token.bin");
            if (string.IsNullOrWhiteSpace(token))
            {
                if (File.Exists(path)) File.Delete(path);
                return;
            }

            var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), Entropy, DataProtectionScope.CurrentUser);
            var tempPath = path + ".tmp";
            File.WriteAllBytes(tempPath, encrypted);
            File.Move(tempPath, path, true);
        }

        public static string? Load(string directory)
        {
            var path = Path.Combine(directory, "agent-token.bin");
            if (!File.Exists(path)) return null;
            var plaintext = ProtectedData.Unprotect(File.ReadAllBytes(path), Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(plaintext);
        }
    }
}
