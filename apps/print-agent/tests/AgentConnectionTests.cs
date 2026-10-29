using System.Net;
using System.Text;
using PrintQRAgent.Models;
using PrintQRAgent.Services;
using Xunit;

namespace PrintQRAgent.Tests;

public sealed class AgentConnectionTests
{
    [Fact]
    public void PairingEndpointMigratesLoopbackAndNormalizesApiSuffix()
    {
        Assert.Equal(
            "https://api.anishnova.com/api/agents/pair",
            AgentApiEndpoint.BuildApiUri("http://localhost:5000/api/", "agents/pair").AbsoluteUri);
        Assert.Equal(
            "https://custom.example.test/api/agents/pair",
            AgentApiEndpoint.BuildApiUri("https://custom.example.test/api/", "/api/agents/pair").AbsoluteUri);
        Assert.Equal("http://localhost:5000",
            AgentApiEndpoint.NormalizeServerUrl("http://localhost:5000/api", allowLocalDevelopment: true));
    }

    [Fact]
    public void InvalidProductionApiConfigurationFailsClearlyInsteadOfSilentlyRedirecting()
    {
        Assert.Throws<FormatException>(() => AgentApiEndpoint.NormalizeServerUrl("not-a-url"));
        Assert.Throws<FormatException>(() => AgentApiEndpoint.NormalizeServerUrl("http://api.example.test"));
        Assert.Equal(AgentApiEndpoint.ProductionServerUrl,
            AgentApiEndpoint.NormalizeServerUrl("http://localhost:5000/api/"));
    }

    [Fact]
    public void UpdateManifestDownloadMustUseTheConfiguredHttpsApiAndExpectedPath()
    {
        Assert.Equal("https://api.anishnova.com/api/admin/agents/download/binary/latest",
            UpdateService.ValidateDownloadUrl(
                "https://api.anishnova.com/api/admin/agents/download/binary/latest",
                "https://api.anishnova.com"));
        Assert.Throws<InvalidDataException>(() => UpdateService.ValidateDownloadUrl(
            "https://attacker.example/file.exe", "https://api.anishnova.com"));
        Assert.Throws<InvalidDataException>(() => UpdateService.ValidateDownloadUrl(
            "http://api.anishnova.com/api/admin/agents/download/binary/latest", "https://api.anishnova.com"));
        Assert.Throws<InvalidDataException>(() => UpdateService.ValidateDownloadUrl(
            "https://api.anishnova.com/api/admin/agents/download/binary/latest?token=private", "https://api.anishnova.com"));
    }

    [Fact]
    public void UpdatesRequireAValidNewerVersionAndChecksum()
    {
        Assert.True(UpdateService.IsNewerVersion("1.0.2", "1.0.0"));
        Assert.False(UpdateService.IsNewerVersion("1.0.0", "1.0.2"));
        Assert.False(UpdateService.IsNewerVersion("not-a-version", "1.0.0"));
        Assert.True(UpdateService.IsValidSha256(new string('a', 64)));
        Assert.False(UpdateService.IsValidSha256("not-a-checksum"));
    }

    [Fact]
    public void OnlineStatusRequiresSuccessfulHeartbeat()
    {
        var health = new HealthState { IsPaired = true, IsApiConnected = true, IsSpoolerRunning = true };
        Assert.False(health.IsFullyOnline);
        health.IsHeartbeatActive = true;
        Assert.True(health.IsFullyOnline);
    }

    [Fact]
    public async Task PairingUsesCloudApiAndPersistsServerConfirmedShopAndDevice()
    {
        var handler = new RecordingHandler((request, _) =>
        {
            Assert.Equal("https://api.anishnova.com/api/agents/pair", request.RequestUri!.AbsoluteUri);
            return Task.FromResult(JsonResponse("""
                {"success":true,"data":{"agentToken":"server-issued-token","shopId":"shop-42","shopName":"Print Shop","deviceName":"SHOP-PC"}}
                """));
        });
        using var http = new HttpClient(handler);
        var config = new AgentConfig { ServerUrl = "http://localhost:5000/api" };
        var saved = false;
        var client = new AgentPairingClient(config, http, () => saved = true);

        var result = await client.PairAsync("ANP-TEST-CODE");

        Assert.True(result.success);
        Assert.Equal("Print Shop", result.shopName);
        Assert.True(saved);
        Assert.Equal("server-issued-token", config.AgentToken);
        Assert.Equal("shop-42", config.ShopId);
        Assert.Equal("SHOP-PC", config.DeviceName);
        Assert.Equal(string.Empty, config.PairingCode);
        Assert.Contains("ANP-TEST-CODE", handler.LastRequestBody);
    }

    [Fact]
    public async Task PairingDoesNotPersistOrClaimSuccessWhenSecurePersistenceFails()
    {
        var handler = new RecordingHandler((_, _) => Task.FromResult(JsonResponse("""
            {"success":true,"data":{"agentToken":"server-issued-token","shopId":"shop-42","shopName":"Print Shop"}}
            """)));
        using var http = new HttpClient(handler);
        var config = new AgentConfig();
        var client = new AgentPairingClient(config, http, () => false);

        var result = await client.PairAsync("ANP-TEST-CODE");

        Assert.False(result.success);
        Assert.Null(config.AgentToken);
        Assert.Null(config.ShopId);
        Assert.Null(config.ShopName);
    }

    [Fact]
    public async Task PairingRejectionDoesNotPersistCredentials()
    {
        var handler = new RecordingHandler((_, _) => Task.FromResult(JsonResponse("""
            {"success":false,"message":"Invalid or expired Shop Pairing Code."}
            """)));
        using var http = new HttpClient(handler);
        var config = new AgentConfig();
        var persistCalled = false;
        var client = new AgentPairingClient(config, http, () => { persistCalled = true; return true; });

        var result = await client.PairAsync("ANP-EXPIRED-CODE");

        Assert.False(result.success);
        Assert.False(persistCalled);
        Assert.Null(config.AgentToken);
        Assert.Equal("Invalid or expired Shop Pairing Code.", result.message);
    }

    [Theory]
    [InlineData(HttpStatusCode.OK, true)]
    [InlineData(HttpStatusCode.Unauthorized, false)]
    [InlineData(HttpStatusCode.ServiceUnavailable, false)]
    public async Task HeartbeatUsesBearerAuthenticationAndReportsBackendResult(HttpStatusCode status, bool expectedSuccess)
    {
        var handler = new RecordingHandler((request, _) =>
        {
            Assert.Equal("https://api.anishnova.com/api/agents/heartbeat", request.RequestUri!.AbsoluteUri);
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            Assert.Equal("agent-secret-for-test", request.Headers.Authorization?.Parameter);
            return Task.FromResult(new HttpResponseMessage(status));
        });
        using var http = new HttpClient(handler);
        var heartbeat = new AgentHeartbeatClient(http, new AgentConfig { ServerUrl = "http://localhost:5000" });

        var result = await heartbeat.SendAsync("agent-secret-for-test", 2, CancellationToken.None);

        Assert.Equal(expectedSuccess, result.success);
        Assert.DoesNotContain("agent-secret-for-test", handler.LastRequestBody);
        if (!expectedSuccess) Assert.Contains($"HTTP {(int)status}", result.message);
    }

    [Fact]
    public void SecondLaunchSignalsPrimaryInstanceForWindowActivation()
    {
        using var activated = new ManualResetEventSlim();
        var name = $"AnishNovaPrintAgent.Test.{Guid.NewGuid():N}";
        using var primary = new SingleInstanceCoordinator(name, activated.Set);
        using var second = new SingleInstanceCoordinator(name, () => { });

        Assert.True(primary.IsPrimaryInstance);
        Assert.False(second.IsPrimaryInstance);
        Assert.True(activated.Wait(TimeSpan.FromSeconds(3)));
    }

    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private sealed class RecordingHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        public string LastRequestBody { get; private set; } = string.Empty;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequestBody = request.Content == null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
            return await respond(request, cancellationToken);
        }
    }
}
