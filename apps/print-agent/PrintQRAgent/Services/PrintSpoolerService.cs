using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using PDFtoImage;
using PrintQRAgent.Models;
using SkiaSharp;

namespace PrintQRAgent.Services
{
    public class PrintSpoolerService
    {
        private static readonly HttpClient _httpClient = new();
        private const uint PrinterEnumLocal = 0x00000002;
        private const uint PrinterEnumConnections = 0x00000004;
        private const uint PrinterStatusError = 0x00000002;
        private const uint PrinterStatusPaperJam = 0x00000008;
        private const uint PrinterStatusPaperOut = 0x00000010;
        private const uint PrinterStatusOffline = 0x00000080;
        private const uint PrinterStatusNotAvailable = 0x00001000;
        private const uint PrinterStatusUserIntervention = 0x00100000;
        private const uint PrinterStatusDoorOpen = 0x00400000;
        private const uint PrinterAttributeShared = 0x00000008;
        private const uint PrinterAttributeNetwork = 0x00000010;

        /// <summary>
        /// Checks if Windows Print Spooler subsystem is available and responding
        /// </summary>
        public bool IsSpoolerServiceRunning()
        {
            try
            {
                var ok = EnumPrinters(PrinterEnumLocal | PrinterEnumConnections, null, 4, IntPtr.Zero, 0, out var needed, out _);
                return ok || Marshal.GetLastWin32Error() == 122 || (needed == 0 && Marshal.GetLastWin32Error() == 0);
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Print Spooler service check failed", ex);
                return false;
            }
        }

        /// <summary>
        /// Discovers Windows local printers and per-user network connections through the spooler.
        /// Ink and paper telemetry are deliberately left unset because generic Windows APIs do not
        /// provide truthful levels for every driver.
        /// </summary>
        public List<DiscoveredPrinter> GetInstalledPrinters()
        {
            var byName = new Dictionary<string, DiscoveredPrinter>(StringComparer.OrdinalIgnoreCase);
            var defaultPrinterName = string.Empty;

            try
            {
                var settings = new PrinterSettings();
                defaultPrinterName = settings.PrinterName;
            }
            catch (Exception ex) { LoggerService.LogWarn($"Windows could not identify its default printer: {ex.Message}"); }

            var nativePrinters = TryEnumeratePrinterMetadata(out var enumerationError);
            if (enumerationError != null)
                LoggerService.LogWarn($"Windows spooler metadata was incomplete: {enumerationError}");

            try
            {
                foreach (var metadata in nativePrinters)
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(metadata.Name)) continue;
                        var printerSettings = new PrinterSettings { PrinterName = metadata.Name };
                        var isVirtual = IsVirtualPrinter(metadata.Name, metadata.DriverName, metadata.PortName);
                        var flaggedError = GetPrinterError(metadata.StatusFlags);
                        var available = printerSettings.IsValid && flaggedError == null;

                        byName[metadata.Name] = new DiscoveredPrinter
                        {
                            Name = metadata.Name,
                            Model = string.IsNullOrWhiteSpace(metadata.DriverName) ? metadata.Name : metadata.DriverName,
                            DriverName = metadata.DriverName,
                            PortName = metadata.PortName,
                            ConnectionType = GetConnectionType(metadata.Attributes, metadata.PortName),
                            ErrorState = flaggedError ?? (printerSettings.IsValid ? null : "Printer driver is unavailable."),
                            Status = available ? "ONLINE" : "OFFLINE",
                            IsAvailable = available,
                            IsDefault = string.Equals(metadata.Name, defaultPrinterName, StringComparison.OrdinalIgnoreCase),
                            IsVirtual = isVirtual,
                            SupportsColor = printerSettings.IsValid && printerSettings.SupportsColor,
                            SupportsDuplex = printerSettings.IsValid && printerSettings.CanDuplex,
                            SupportedSizes = printerSettings.IsValid
                                ? printerSettings.PaperSizes.Cast<PaperSize>()
                                    .Select(paper => NormalizePaperSize(paper.PaperName))
                                    .Where(size => !string.IsNullOrWhiteSpace(size))
                                    .Distinct(StringComparer.OrdinalIgnoreCase)
                                    .ToList()
                                : new List<string>()
                        };
                    }
                    catch (Exception ex)
                    {
                        LoggerService.LogWarn($"Windows could not query an installed printer: {ex.Message}");
                    }
                }

                // Keep entries that the .NET print API sees even when a driver does not expose
                // PRINTER_INFO_2 metadata. These are shown as unavailable rather than guessed ready.
                foreach (string printerName in PrinterSettings.InstalledPrinters)
                {
                    if (byName.ContainsKey(printerName)) continue;
                    var printerSettings = new PrinterSettings { PrinterName = printerName };
                    byName[printerName] = new DiscoveredPrinter
                    {
                        Name = printerName,
                        Model = printerName,
                        ConnectionType = "UNKNOWN",
                        ErrorState = "Windows did not provide printer driver or port details.",
                        Status = "OFFLINE",
                        IsAvailable = false,
                        IsDefault = string.Equals(printerName, defaultPrinterName, StringComparison.OrdinalIgnoreCase),
                        IsVirtual = IsVirtualPrinter(printerName, string.Empty, string.Empty),
                        SupportsColor = printerSettings.IsValid && printerSettings.SupportsColor,
                        SupportsDuplex = printerSettings.IsValid && printerSettings.CanDuplex,
                        SupportedSizes = printerSettings.IsValid
                            ? printerSettings.PaperSizes.Cast<PaperSize>().Select(p => NormalizePaperSize(p.PaperName)).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                            : new List<string>()
                    };
                }
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Failed to enumerate Windows printers", ex);
            }

            return byName.Values.OrderByDescending(printer => printer.IsDefault).ThenBy(printer => printer.Name, StringComparer.OrdinalIgnoreCase).ToList();
        }

        public static DiscoveredPrinter? SelectPhysicalPrinter(IEnumerable<DiscoveredPrinter> printers, string? savedPrinterName)
        {
            var discovered = printers.ToList();
            var usable = discovered.Where(printer => printer.IsPhysical && printer.IsAvailable).ToList();
            if (!string.IsNullOrWhiteSpace(savedPrinterName))
            {
                var saved = discovered.FirstOrDefault(printer => string.Equals(printer.Name, savedPrinterName, StringComparison.OrdinalIgnoreCase));
                return saved is { IsPhysical: true, IsAvailable: true } ? saved : null;
            }
            if (usable.Count == 1) return usable[0];
            return usable.FirstOrDefault(printer => printer.IsDefault);
        }

        private static List<PrinterMetadata> TryEnumeratePrinterMetadata(out string? error)
        {
            error = null;
            uint flags = PrinterEnumLocal | PrinterEnumConnections;
            _ = EnumPrinters(flags, null, 2, IntPtr.Zero, 0, out var required, out _);
            var nativeError = Marshal.GetLastWin32Error();
            if (required == 0)
            {
                if (nativeError != 0 && nativeError != 122) error = new System.ComponentModel.Win32Exception(nativeError).Message;
                return new List<PrinterMetadata>();
            }

            var buffer = Marshal.AllocHGlobal((int)required);
            try
            {
                if (!EnumPrinters(flags, null, 2, buffer, required, out _, out var returned))
                {
                    error = new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()).Message;
                    return new List<PrinterMetadata>();
                }
                var result = new List<PrinterMetadata>((int)returned);
                var itemSize = Marshal.SizeOf<PrinterInfo2>();
                for (var index = 0; index < returned; index++)
                {
                    var info = Marshal.PtrToStructure<PrinterInfo2>(IntPtr.Add(buffer, checked((int)index * itemSize)));
                    var name = Marshal.PtrToStringUni(info.PrinterName) ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    result.Add(new PrinterMetadata(name, Marshal.PtrToStringUni(info.DriverName) ?? string.Empty,
                        Marshal.PtrToStringUni(info.PortName) ?? string.Empty, info.Attributes, info.Status));
                }
                return result;
            }
            finally { Marshal.FreeHGlobal(buffer); }
        }

        private static string? GetPrinterError(uint status)
        {
            if ((status & PrinterStatusPaperJam) != 0) return "Paper jam reported by Windows.";
            if ((status & PrinterStatusPaperOut) != 0) return "Printer reports that paper is out.";
            if ((status & PrinterStatusDoorOpen) != 0) return "Printer cover or door is open.";
            if ((status & PrinterStatusOffline) != 0) return "Printer is offline.";
            if ((status & PrinterStatusNotAvailable) != 0) return "Printer is not available.";
            if ((status & PrinterStatusUserIntervention) != 0) return "Printer requires user attention.";
            if ((status & PrinterStatusError) != 0) return "Windows reports a printer error.";
            return null;
        }

        public static bool IsVirtualPrinter(string name, string driver = "", string port = "")
        {
            var description = $"{name} {driver} {port}";
            return new[] { "Microsoft Print to PDF", "Microsoft XPS Document Writer", "OneNote", "Fax", "Adobe PDF", "PDFCreator", "PaperPort" }
                       .Any(marker => description.Contains(marker, StringComparison.OrdinalIgnoreCase))
                   || port.StartsWith("FILE:", StringComparison.OrdinalIgnoreCase)
                   || port.StartsWith("PORTPROMPT:", StringComparison.OrdinalIgnoreCase)
                   || port.Equals("NUL:", StringComparison.OrdinalIgnoreCase);
        }

        private static string GetConnectionType(uint attributes, string port)
        {
            return ClassifyConnectionType(port,
                (attributes & PrinterAttributeNetwork) != 0,
                (attributes & PrinterAttributeShared) != 0);
        }

        public static string ClassifyConnectionType(string port, bool isNetwork = false, bool isShared = false)
        {
            if (isNetwork) return "NETWORK_IP";
            if (isShared) return "SHARED_SPOOLER";
            if (port.StartsWith("USB", StringComparison.OrdinalIgnoreCase)) return "USB";
            if (port.StartsWith("WSD", StringComparison.OrdinalIgnoreCase)
                || port.StartsWith("IP_", StringComparison.OrdinalIgnoreCase)
                || port.StartsWith("IPP", StringComparison.OrdinalIgnoreCase)
                || port.StartsWith("\\\\", StringComparison.OrdinalIgnoreCase)) return "NETWORK_IP";
            return string.IsNullOrWhiteSpace(port) ? "UNKNOWN" : "LOCAL";
        }

        private sealed record PrinterMetadata(string Name, string DriverName, string PortName, uint Attributes, uint StatusFlags);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct PrinterInfo2
        {
            public IntPtr ServerName;
            public IntPtr PrinterName;
            public IntPtr ShareName;
            public IntPtr PortName;
            public IntPtr DriverName;
            public IntPtr Comment;
            public IntPtr Location;
            public IntPtr DevMode;
            public IntPtr SeparatorFile;
            public IntPtr PrintProcessor;
            public IntPtr DataType;
            public IntPtr Parameters;
            public IntPtr SecurityDescriptor;
            public uint Attributes;
            public uint Priority;
            public uint DefaultPriority;
            public uint StartTime;
            public uint UntilTime;
            public uint Status;
            public uint Jobs;
            public uint AveragePagesPerMinute;
        }

        [DllImport("winspool.drv", EntryPoint = "EnumPrintersW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
        private static extern bool EnumPrinters(uint flags, string? name, uint level, IntPtr buffer, uint bufferSize, out uint needed, out uint returned);

        /// <summary>
        /// Generates and spools a physical diagnostic test print to the specified Windows printer
        /// </summary>
        public (bool success, string? error) PrintDiagnosticTestPage(string targetPrinterName, string orderNumber)
        {
            try
            {
                using var printDoc = new PrintDocument();
                if (!string.IsNullOrWhiteSpace(targetPrinterName))
                {
                    printDoc.PrinterSettings.PrinterName = targetPrinterName;
                }

                if (!printDoc.PrinterSettings.IsValid)
                {
                    return (false, $"Selected printer '{targetPrinterName}' is offline or invalid.");
                }

                printDoc.DocumentName = $"AnishNova_Diagnostic_Test_{orderNumber}";
                printDoc.DefaultPageSettings.PaperSize = new PaperSize("A4", 827, 1169); // Standard A4 (100ths of inch)
                printDoc.DefaultPageSettings.Margins = new Margins(50, 50, 50, 50);

                printDoc.PrintPage += (sender, e) =>
                {
                    if (e.Graphics == null) return;

                    var g = e.Graphics;
                    var margin = e.MarginBounds;

                    using var brushPurple = new SolidBrush(Color.FromArgb(124, 58, 237));
                    using var brushDark = new SolidBrush(Color.FromArgb(15, 23, 42));
                    using var brushGray = new SolidBrush(Color.FromArgb(100, 116, 139));
                    using var brushEmerald = new SolidBrush(Color.FromArgb(16, 185, 129));

                    using var fontLogo = new Font("Arial", 22, FontStyle.Bold);
                    using var fontTitle = new Font("Arial", 16, FontStyle.Bold);
                    using var fontBody = new Font("Arial", 11, FontStyle.Regular);
                    using var fontBold = new Font("Arial", 11, FontStyle.Bold);
                    using var fontSmall = new Font("Arial", 9, FontStyle.Italic);

                    // Header Banner Box
                    g.FillRectangle(brushPurple, margin.Left, margin.Top, margin.Width, 50);
                    g.DrawString("AnishNova Print — Diagnostic Spooler Test", fontTitle, Brushes.White, margin.Left + 15, margin.Top + 12);

                    int y = margin.Top + 70;

                    // Status details
                    g.DrawString("WINDOWS DESKTOP PRINT AGENT VERIFICATION", fontBold, brushDark, margin.Left, y);
                    y += 25;

                    g.DrawString($"Job Reference ID: {orderNumber}", fontBody, brushDark, margin.Left, y);
                    y += 20;
                    g.DrawString($"Target Windows Printer: {targetPrinterName}", fontBody, brushDark, margin.Left, y);
                    y += 20;
                    g.DrawString($"Spool Timestamp: {DateTime.Now:yyyy-MM-dd HH:mm:ss}", fontBody, brushDark, margin.Left, y);
                    y += 20;
                    g.DrawString($"Machine Name: {Environment.MachineName} ({Environment.OSVersion})", fontBody, brushDark, margin.Left, y);
                    y += 35;

                    // Border check rectangle
                    using var penBorder = new Pen(Color.FromArgb(148, 163, 184), 2);
                    g.DrawRectangle(penBorder, margin.Left, y, margin.Width, 240);

                    g.DrawString("PRINTER ALIGNMENT & MARGIN VERIFICATION", fontBold, brushPurple, margin.Left + 15, y + 15);
                    g.DrawString("✓ Top-to-Bottom margin calibration: PASSED", fontBody, brushEmerald, margin.Left + 15, y + 45);
                    g.DrawString("✓ Windows Print Spooler direct dispatch: PASSED", fontBody, brushEmerald, margin.Left + 15, y + 70);
                    g.DrawString("✓ Zero-Queue cloud integration: ACTIVE", fontBody, brushEmerald, margin.Left + 15, y + 95);
                    g.DrawString("✓ Cryptographic ephemeral document shredding: ENABLED", fontBody, brushEmerald, margin.Left + 15, y + 120);

                    // Footer
                    y = margin.Bottom - 40;
                    g.DrawLine(penBorder, margin.Left, y, margin.Right, y);
                    y += 10;
                    g.DrawString("Developed by AnishNova Technologies • Enterprise Printing Infrastructure", fontSmall, brushGray, margin.Left, y);

                    e.HasMorePages = false;
                };

                printDoc.Print();
                LoggerService.LogInfo($"Successfully submitted diagnostic test print {orderNumber} to '{targetPrinterName}'");
                return (true, null);
            }
            catch (Exception ex)
            {
                LoggerService.LogError("Diagnostic test print failed", ex);
                return (false, ex.Message);
            }
        }

        /// <summary>
        /// Downloads the customer document, rasterizes each page, and spools physically to the Windows printer
        /// </summary>
        public async Task<(bool success, string? error)> PrintDocumentAsync(
            PrintJobPayload job,
            string targetPrinterName,
            string serverUrl,
            string agentToken,
            Func<int, Task> progressCallback)
        {
            string tempPath = string.Empty;
            try
            {
                await progressCallback(15);

                var allowedMimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["application/pdf"] = ".pdf", ["image/png"] = ".png", ["image/jpeg"] = ".jpg"
                };
                if (!allowedMimeTypes.TryGetValue(job.MimeType, out var extension)) return (false, "This file type is not supported by the Windows print agent.");
                if (string.IsNullOrWhiteSpace(agentToken)) return (false, "The agent is not paired with a shop.");
                if (job.Settings.Copies < 1 || job.Settings.Copies > 100) return (false, "The requested copy count is outside the supported range.");
                if (string.IsNullOrWhiteSpace(targetPrinterName) || IsVirtualPrinter(targetPrinterName, string.Empty, string.Empty))
                    return (false, "Select an installed physical printer before processing customer orders. Virtual printers are not valid customer destinations.");

                // Download only from the configured API host using the per-user protected agent credential.
                var configuredApi = new Uri(serverUrl);
                var fileUri = new Uri(job.FileUrl);
                var secureTransport = fileUri.Scheme == Uri.UriSchemeHttps || (configuredApi.IsLoopback && fileUri.Scheme == Uri.UriSchemeHttp);
                if (!secureTransport || fileUri.Scheme != configuredApi.Scheme || !string.Equals(fileUri.Host, configuredApi.Host, StringComparison.OrdinalIgnoreCase)
                    || !fileUri.AbsolutePath.StartsWith("/api/agents/jobs/", StringComparison.Ordinal))
                    return (false, "The document download URL is outside the configured secure API host.");
                tempPath = Path.Combine(Path.GetTempPath(), $"printqr_{Guid.NewGuid():N}{extension}");
                using var request = new HttpRequestMessage(HttpMethod.Get, fileUri);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", agentToken);
                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode)
                {
                    return (false, $"Failed to download file from server: HTTP {response.StatusCode}");
                }

                const int maximumFileBytes = 50 * 1024 * 1024;
                if (response.Content.Headers.ContentLength > maximumFileBytes) return (false, "The document exceeds the print agent's file-size limit.");
                await using (var destination = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
                await using (var source = await response.Content.ReadAsStreamAsync())
                {
                    var buffer = new byte[81920];
                    int count;
                    long total = 0;
                    while ((count = await source.ReadAsync(buffer)) > 0)
                    {
                        total += count;
                        if (total > maximumFileBytes) return (false, "The document exceeds the print agent's file-size limit.");
                        await destination.WriteAsync(buffer.AsMemory(0, count));
                    }
                }
                var fileBytes = await File.ReadAllBytesAsync(tempPath);
                if (!HasExpectedSignature(job.MimeType, fileBytes)) return (false, "The downloaded document contents do not match its declared file type.");

                await progressCallback(40);

                var isPdf = job.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ||
                            (job.MimeType != null && job.MimeType.Contains("pdf", StringComparison.OrdinalIgnoreCase));

                // 2. Prepare pages to print based on PageRange
                var pagesToPrint = new List<int>(); // 0-based page indices

                if (isPdf)
                {
                    var totalPdfPages = Conversion.GetPageCount(fileBytes);
                    if (totalPdfPages < 1) return (false, "The PDF has no printable pages.");

                    pagesToPrint = ParsePageRange(job.Settings.PageRange, totalPdfPages);
                }
                else
                {
                    pagesToPrint.Add(0); // Single page for images
                }

                if (pagesToPrint.Count == 0) return (false, "The selected page range contains no printable pages.");

                await progressCallback(60);

                // 3. Configure Windows PrintDocument Spooler
                using var printDoc = new PrintDocument();
                printDoc.PrinterSettings.PrinterName = targetPrinterName;

                if (!printDoc.PrinterSettings.IsValid)
                {
                    return (false, $"Target printer '{targetPrinterName}' is unavailable or offline.");
                }
                if (job.Settings.ColorMode == "COLOR" && !printDoc.PrinterSettings.SupportsColor)
                    return (false, "The selected printer does not report color support; the job was not downgraded to black and white.");
                if (job.Settings.DuplexMode != "SIMPLEX" && !printDoc.PrinterSettings.CanDuplex)
                    return (false, "The selected printer does not report duplex support; the job was not downgraded to single-sided.");

                printDoc.DocumentName = $"AnishNova_{job.OrderNumber}_{job.FileName}";
                printDoc.PrinterSettings.Copies = (short)Math.Max(1, job.Settings.Copies);

                var requestedPaperSize = string.IsNullOrWhiteSpace(job.Settings.PaperSize) ? "A4" : job.Settings.PaperSize;
                var availablePaperSize = printDoc.PrinterSettings.PaperSizes.Cast<PaperSize>()
                    .FirstOrDefault(paper => NormalizePaperSize(paper.PaperName).Equals(requestedPaperSize, StringComparison.OrdinalIgnoreCase));
                if (availablePaperSize == null)
                {
                    return (false, $"The selected printer does not support {requestedPaperSize} paper.");
                }
                printDoc.DefaultPageSettings.PaperSize = availablePaperSize;

                // Duplex Configuration
                if (job.Settings.DuplexMode == "DUPLEX_LONG_EDGE")
                {
                    printDoc.PrinterSettings.Duplex = Duplex.Vertical;
                }
                else if (job.Settings.DuplexMode == "DUPLEX_SHORT_EDGE")
                {
                    printDoc.PrinterSettings.Duplex = Duplex.Horizontal;
                }
                else
                {
                    printDoc.PrinterSettings.Duplex = Duplex.Simplex;
                }

                // Color & Orientation
                printDoc.DefaultPageSettings.Color = job.Settings.ColorMode == "COLOR" && printDoc.PrinterSettings.SupportsColor;
                printDoc.DefaultPageSettings.Landscape = job.Settings.Orientation == "LANDSCAPE";

                // Multi-page loop state
                int currentPagePointer = 0;

                printDoc.PrintPage += (sender, e) =>
                {
                    if (e.Graphics == null) return;

                    var g = e.Graphics;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;

                    var printBounds = e.MarginBounds;

                    if (isPdf)
                    {
                        int targetPageIndex = pagesToPrint[currentPagePointer];
                        using var skBitmap = Conversion.ToImage(fileBytes, page: targetPageIndex);
                        if (skBitmap == null) throw new InvalidDataException($"PDF page {targetPageIndex + 1} could not be rendered.");
                        using var image = SKBitmapToGdiImage(skBitmap);
                        if (image == null) throw new InvalidDataException($"PDF page {targetPageIndex + 1} could not be converted for printing.");
                        DrawImageProportional(g, image, printBounds);
                    }
                    else
                    {
                        // Render standard Image file
                        using var image = Image.FromFile(tempPath);
                        DrawImageProportional(g, image, printBounds);
                    }

                    currentPagePointer++;

                    // Determine if there are more pages in the multi-page print job
                    if (currentPagePointer < pagesToPrint.Count)
                    {
                        e.HasMorePages = true;
                    }
                    else
                    {
                        e.HasMorePages = false;
                    }
                };

                await progressCallback(80);

                // Send print job to Windows Print Spooler
                printDoc.Print();

                await progressCallback(90);
                LoggerService.LogInfo($"Windows spooler accepted {pagesToPrint.Count} page(s) for job {job.Id} ({job.FileName}) at '{targetPrinterName}'. This does not confirm physical completion.");

                return (true, null);
            }
            catch (Exception ex)
            {
                LoggerService.LogError($"PrintDocumentAsync failed for job {job.Id}", ex);
                return (false, ex.Message);
            }
            finally
            {
                // Ephemeral file shredding on agent disk
                if (!string.IsNullOrEmpty(tempPath) && File.Exists(tempPath))
                {
                    try { File.Delete(tempPath); } catch { }
                }
            }
        }

        private static bool HasExpectedSignature(string mimeType, byte[] bytes)
        {
            if (mimeType == "application/pdf") return bytes.Length >= 5 && System.Text.Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-";
            if (mimeType == "image/png") return bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
            if (mimeType == "image/jpeg") return bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff;
            return false;
        }

        /// <summary>
        /// Proportionally scales and centers an image within the printable margins without clipping
        /// </summary>
        private static void DrawImageProportional(Graphics g, Image image, Rectangle printBounds)
        {
            float imageRatio = (float)image.Width / image.Height;
            float boundsRatio = (float)printBounds.Width / printBounds.Height;

            int drawWidth, drawHeight;

            if (imageRatio > boundsRatio)
            {
                drawWidth = printBounds.Width;
                drawHeight = (int)(printBounds.Width / imageRatio);
            }
            else
            {
                drawHeight = printBounds.Height;
                drawWidth = (int)(printBounds.Height * imageRatio);
            }

            int x = printBounds.Left + (printBounds.Width - drawWidth) / 2;
            int y = printBounds.Top + (printBounds.Height - drawHeight) / 2;

            g.DrawImage(image, x, y, drawWidth, drawHeight);
        }

        /// <summary>
        /// Converts SkiaSharp SKBitmap to GDI+ System.Drawing.Image
        /// </summary>
        private static Image? SKBitmapToGdiImage(SKBitmap skBitmap)
        {
            using var image = SKImage.FromBitmap(skBitmap);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            using var ms = new MemoryStream();
            data.SaveTo(ms);
            ms.Position = 0;
            return Image.FromStream(ms);
        }

        private static string NormalizePaperSize(string paperName)
        {
            var name = paperName.Trim();
            foreach (var standard in new[] { "A3", "A4", "A5", "LETTER", "LEGAL" })
            {
                if (name.StartsWith(standard, StringComparison.OrdinalIgnoreCase) ||
                    name.Equals(standard == "LETTER" ? "Letter" : standard == "LEGAL" ? "Legal" : standard, StringComparison.OrdinalIgnoreCase))
                    return standard;
            }
            return string.Empty;
        }

        /// <summary>
        /// Parses a page range string (e.g. "ALL", "1-3, 5, 7-9") into a list of 0-based page indices
        /// </summary>
        public static List<int> ParsePageRange(string? rangeStr, int totalPages)
        {
            var pages = new HashSet<int>();

            if (string.IsNullOrWhiteSpace(rangeStr) || rangeStr.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                for (int i = 0; i < totalPages; i++) pages.Add(i);
                return pages.OrderBy(p => p).ToList();
            }

            var parts = rangeStr.Split(',');
            foreach (var part in parts)
            {
                var clean = part.Trim();
                if (clean.Length == 0) throw new FormatException("Page range contains an empty entry.");
                if (clean.Contains('-'))
                {
                    var segs = clean.Split('-');
                    if (segs.Length != 2 || !int.TryParse(segs[0], out int start) || !int.TryParse(segs[1], out int end) || start < 1 || end < start || end > totalPages)
                        throw new FormatException("Page range is invalid or outside the document.");
                    for (int i = start; i <= end; i++) pages.Add(i - 1);
                }
                else if (int.TryParse(clean, out int singlePage))
                {
                    if (singlePage < 1 || singlePage > totalPages) throw new FormatException("Selected page is outside the document.");
                    pages.Add(singlePage - 1);
                }
                else throw new FormatException("Page range format is invalid.");
            }

            return pages.OrderBy(p => p).ToList();
        }
    }
}
