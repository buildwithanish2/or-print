using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using PrintQRAgent.Models;

namespace PrintQRAgent.Services
{
    public static class AgentApiEndpoint
    {
        public const string ProductionServerUrl = "https://api.anishnova.com";

        public static string NormalizeForCurrentBuild(string? configuredUrl)
        {
#if DEBUG
            const bool allowLocalDevelopment = true;
#else
            const bool allowLocalDevelopment = false;
#endif
            return NormalizeServerUrl(configuredUrl, allowLocalDevelopment);
        }

        public static string NormalizeServerUrl(string? configuredUrl, bool allowLocalDevelopment = false)
        {
            if (string.IsNullOrWhiteSpace(configuredUrl)) return ProductionServerUrl;
            if (!Uri.TryCreate(configuredUrl.Trim(), UriKind.Absolute, out var uri)
                || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment))
                throw new FormatException("The configured API URL is invalid. Enter an HTTPS API base URL.");

            if (uri.IsLoopback && !allowLocalDevelopment) return ProductionServerUrl;
            if (uri.Scheme != Uri.UriSchemeHttps
                && !(allowLocalDevelopment && uri.Scheme == Uri.UriSchemeHttp))
                throw new FormatException("The configured API URL must use HTTPS outside a development build.");

            var path = uri.AbsolutePath.TrimEnd('/');
            if (path.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
                path = path[..^4].TrimEnd('/');

            var builder = new UriBuilder(uri) { Path = path, Query = string.Empty, Fragment = string.Empty };
            return builder.Uri.AbsoluteUri.TrimEnd('/');
        }

        public static Uri BuildApiUri(string? configuredUrl, string route)
        {
            var root = NormalizeForCurrentBuild(configuredUrl);
            var cleanRoute = route.Trim().TrimStart('/');
            if (cleanRoute.StartsWith("api/", StringComparison.OrdinalIgnoreCase)) cleanRoute = cleanRoute[4..];
            return new Uri($"{root}/api/{cleanRoute}", UriKind.Absolute);
        }

        public static HttpRequestMessage CreateAuthenticatedRequest(HttpMethod method, string? configuredUrl, string route, string token)
        {
            var request = new HttpRequestMessage(method, BuildApiUri(configuredUrl, route));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return request;
        }
    }

    public sealed class AgentPairingClient
    {
        private readonly AgentConfig _config;
        private readonly HttpClient _httpClient;
        private readonly Func<bool> _persistConfig;

        public AgentPairingClient(AgentConfig config, HttpClient httpClient, Func<bool> persistConfig)
        {
            _config = config;
            _httpClient = httpClient;
            _persistConfig = persistConfig;
        }

        public async Task<(bool success, string message, string? shopName)> PairAsync(string pairingCode, CancellationToken cancellationToken = default)
        {
            var payload = new
            {
                pairingCode = pairingCode.Trim().ToUpperInvariant(),
                deviceName = Environment.MachineName,
                platform = "windows-x64",
                agentVersion = "1.0.0"
            };

            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await _httpClient.PostAsync(
                AgentApiEndpoint.BuildApiUri(_config.ServerUrl, "agents/pair"), content, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;
            if (!response.IsSuccessStatusCode || !root.TryGetProperty("data", out var data))
            {
                var message = root.TryGetProperty("message", out var errorMessage)
                    ? errorMessage.GetString()
                    : null;
                return (false, message ?? "Pairing was rejected. Generate a new code and try again.", null);
            }

            var token = ReadString(data, "agentToken");
            var shopId = ReadString(data, "shopId");
            var shopName = ReadString(data, "shopName");
            var deviceName = ReadString(data, "deviceName") ?? Environment.MachineName;
            if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(shopId) || string.IsNullOrWhiteSpace(shopName))
                return (false, "The server returned incomplete pairing details. Generate a new code and try again.", null);

            _config.AgentToken = token;
            _config.ShopId = shopId;
            _config.ShopName = shopName;
            _config.DeviceName = deviceName;
            _config.PairingCode = string.Empty;

            if (!_persistConfig())
            {
                _config.AgentToken = null;
                _config.ShopId = null;
                _config.ShopName = null;
                _config.DeviceName = null;
                return (false, "The server accepted pairing, but this computer could not securely save the agent credentials. Generate a fresh pairing code and try again.", null);
            }

            return (true, $"Agent activated successfully for {shopName}!", shopName);
        }

        private static string? ReadString(JsonElement element, string propertyName) =>
            element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
                ? property.GetString()
                : null;
    }

    public sealed class AgentHeartbeatClient
    {
        private readonly HttpClient _httpClient;
        private readonly AgentConfig _config;

        public AgentHeartbeatClient(HttpClient httpClient, AgentConfig config)
        {
            _httpClient = httpClient;
            _config = config;
        }

        public async Task<(bool success, string message)> SendAsync(string token, int printerCount, CancellationToken cancellationToken)
        {
            using var request = AgentApiEndpoint.CreateAuthenticatedRequest(
                HttpMethod.Post, _config.ServerUrl, "agents/heartbeat", token);
            request.Content = new StringContent(JsonSerializer.Serialize(new
            {
                status = "CONNECTED",
                printerCount,
                version = "1.0.0",
                deviceName = Environment.MachineName
            }), Encoding.UTF8, "application/json");

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode
                ? (true, "Heartbeat accepted")
                : (false, $"Heartbeat rejected by the API (HTTP {(int)response.StatusCode}).");
        }
    }
}
