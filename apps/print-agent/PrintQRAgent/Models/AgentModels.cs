using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace PrintQRAgent.Models
{
    public class AgentConfig
    {
        public string ServerUrl { get; set; } = PrintQRAgent.Services.AgentApiEndpoint.ProductionServerUrl;
        public string PairingCode { get; set; } = string.Empty;
        public string? AgentToken { get; set; }
        public string? ShopId { get; set; }
        public string? ShopName { get; set; }
        public string? DeviceName { get; set; }
        public string? SelectedPrinterName { get; set; }
        public bool AutoStartWithWindows { get; set; } = true;
        public bool MinimizeToTrayOnClose { get; set; } = true;
    }

    public class DiscoveredPrinter
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "ONLINE";

        [JsonPropertyName("isDefault")]
        public bool IsDefault { get; set; }

        [JsonPropertyName("isVirtual")]
        public bool IsVirtual { get; set; }

        [JsonPropertyName("supportsColor")]
        public bool SupportsColor { get; set; } = true;

        [JsonPropertyName("supportsDuplex")]
        public bool SupportsDuplex { get; set; } = true;

        [JsonPropertyName("supportedSizes")]
        public List<string> SupportedSizes { get; set; } = new();

        [JsonPropertyName("inkLevel")]
        public int InkLevel { get; set; } = 90;

        [JsonPropertyName("paperLevel")]
        public int PaperLevel { get; set; } = 85;

        public string DisplayName => IsDefault ? $"🖨️ {Name} (Default)" : $"🖨️ {Name}";
        public string StatusBadge => IsVirtual ? "Virtual Spooler" : (Status == "ONLINE" ? "● Ready" : "○ Offline");
    }

    public class PrintJobPayload
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("orderId")]
        public string OrderId { get; set; } = string.Empty;

        [JsonPropertyName("orderNumber")]
        public string OrderNumber { get; set; } = string.Empty;

        [JsonPropertyName("shopId")]
        public string ShopId { get; set; } = string.Empty;

        [JsonPropertyName("printerId")]
        public string PrinterId { get; set; } = string.Empty;

        [JsonPropertyName("printerName")]
        public string PrinterName { get; set; } = string.Empty;

        [JsonPropertyName("fileUrl")]
        public string FileUrl { get; set; } = string.Empty;

        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = string.Empty;

        [JsonPropertyName("mimeType")]
        public string MimeType { get; set; } = "application/pdf";

        [JsonPropertyName("settings")]
        public JobSettings Settings { get; set; } = new();

        [JsonPropertyName("idempotencyKey")]
        public string IdempotencyKey { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "QUEUED";

        [JsonPropertyName("progressPercent")]
        public int ProgressPercent { get; set; } = 0;

        [JsonPropertyName("attempts")]
        public int Attempts { get; set; } = 1;

        [JsonPropertyName("maxAttempts")]
        public int MaxAttempts { get; set; } = 3;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
    }

    public class JobSettings
    {
        [JsonPropertyName("colorMode")]
        public string ColorMode { get; set; } = "BW"; // BW or COLOR

        [JsonPropertyName("paperSize")]
        public string PaperSize { get; set; } = "A4";

        [JsonPropertyName("orientation")]
        public string Orientation { get; set; } = "PORTRAIT";

        [JsonPropertyName("duplexMode")]
        public string DuplexMode { get; set; } = "SIMPLEX";

        [JsonPropertyName("copies")]
        public int Copies { get; set; } = 1;

        [JsonPropertyName("pageRange")]
        public string PageRange { get; set; } = "ALL";

        [JsonPropertyName("pagesPerSheet")]
        public int PagesPerSheet { get; set; } = 1;

        [JsonPropertyName("quality")]
        public string Quality { get; set; } = "NORMAL";

        [JsonPropertyName("selectedPagesCount")]
        public int SelectedPagesCount { get; set; } = 1;
    }

    public class HealthState
    {
        public bool IsPaired { get; set; }
        public bool IsApiConnected { get; set; }
        public bool IsWebSocketConnected { get; set; }
        public bool IsQueuePolling { get; set; }
        public bool IsSpoolerRunning { get; set; } = true;
        public bool IsHeartbeatActive { get; set; }
        public int DiscoveredPrintersCount { get; set; }

        public bool IsFullyOnline => IsPaired && IsApiConnected && IsHeartbeatActive && IsSpoolerRunning;
    }
}
