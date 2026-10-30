using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;

namespace PrintQRAgent.Services;

/// <summary>Verifies a Windows Authenticode signature with the operating-system trust provider.</summary>
public static class AuthenticodeVerifier
{
    private static readonly Guid GenericVerifyV2 = new("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");

    public static bool IsTrusted(string filePath, string? expectedPublisher, out string message)
    {
        message = "The file does not have a trusted Authenticode signature.";
        if (!OperatingSystem.IsWindows() || !File.Exists(filePath)) return false;
        var pathPointer = IntPtr.Zero;
        var fileInfoPointer = IntPtr.Zero;
        try
        {
            pathPointer = Marshal.StringToCoTaskMemUni(Path.GetFullPath(filePath));
            var fileInfo = new WinTrustFileInfo { Size = (uint)Marshal.SizeOf<WinTrustFileInfo>(), FilePath = pathPointer };
            fileInfoPointer = Marshal.AllocHGlobal(Marshal.SizeOf<WinTrustFileInfo>());
            Marshal.StructureToPtr(fileInfo, fileInfoPointer, false);
            var trustData = new WinTrustData
            {
                Size = (uint)Marshal.SizeOf<WinTrustData>(), UiChoice = 2,
                UnionChoice = 1, FileInfo = fileInfoPointer, StateAction = 1
            };
            var result = WinVerifyTrust(IntPtr.Zero, GenericVerifyV2, ref trustData);
            trustData.StateAction = 2;
            _ = WinVerifyTrust(IntPtr.Zero, GenericVerifyV2, ref trustData);
            if (result != 0) return false;

            using var certificate = new X509Certificate2(X509Certificate.CreateFromSignedFile(filePath));
            if (!string.IsNullOrWhiteSpace(expectedPublisher)
                && !certificate.Subject.Contains(expectedPublisher, StringComparison.OrdinalIgnoreCase))
            {
                message = "The file is signed by a publisher that does not match the expected AnishNova publisher.";
                return false;
            }
            message = "The file has a valid, trusted Windows signature.";
            return true;
        }
        catch (Exception ex)
        {
            message = "Windows could not verify the file signature (" + ex.GetType().Name + ").";
            return false;
        }
        finally
        {
            if (fileInfoPointer != IntPtr.Zero) Marshal.FreeHGlobal(fileInfoPointer);
            if (pathPointer != IntPtr.Zero) Marshal.FreeCoTaskMem(pathPointer);
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WinTrustFileInfo { public uint Size; public IntPtr FilePath; public IntPtr FileHandle; public IntPtr KnownSubject; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WinTrustData
    {
        public uint Size; public IntPtr PolicyCallbackData; public IntPtr SipClientData; public uint UiChoice;
        public uint RevocationChecks; public uint UnionChoice; public IntPtr FileInfo; public uint StateAction;
        public IntPtr StateData; public IntPtr UrlReference; public uint ProviderFlags; public uint UiContext;
        public IntPtr SignatureSettings;
    }

    [DllImport("wintrust.dll", ExactSpelling = true, PreserveSig = true)]
    private static extern int WinVerifyTrust(IntPtr window, [In] Guid actionId, ref WinTrustData data);
}
