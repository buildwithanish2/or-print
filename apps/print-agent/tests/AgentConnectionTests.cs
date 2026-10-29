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
