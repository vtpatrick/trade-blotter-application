using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TradeBlotter.Api.Contracts;
using TradeBlotter.Api.Data;
using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Tests;

/// <summary>
/// End-to-end tests through the HTTP pipeline. Each test gets its own in-memory SQLite
/// database (xUnit creates a new class instance per test).
/// </summary>
public sealed class TradesApiTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly SqliteConnection _connection;
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public TradesApiTests()
    {
        // An in-memory SQLite database lives as long as its connection stays open.
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<TradeBlotterDbContext>>();
                services.AddDbContext<TradeBlotterDbContext>(o => o.UseSqlite(_connection));
            }));

        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        _connection.Dispose();
    }

    private Task<HttpResponseMessage> PostTrade(object body) => _client.PostAsJsonAsync("/api/trades", body);

    [Fact]
    public async Task Post_valid_trade_returns_201_with_location_and_normalized_trade()
    {
        var response = await PostTrade(new { symbol = " aapl ", side = "Buy", quantity = 100, price = 150.25m });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var trade = await response.Content.ReadFromJsonAsync<TradeResponse>(Json);
        Assert.NotNull(trade);
        Assert.Equal("AAPL", trade.Symbol);
        Assert.Equal(TradeSide.Buy, trade.Side);
        Assert.Equal(15_025m, trade.Notional);
        Assert.Equal($"/api/trades/{trade.Id}", response.Headers.Location?.AbsolutePath);
    }

    [Fact]
    public async Task Post_invalid_trade_returns_400_with_a_message_per_field()
    {
        var response = await PostTrade(new { symbol = "", side = "Buy", quantity = 0, price = -1m });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(Json);
        Assert.NotNull(problem);
        Assert.Contains("Symbol", problem.Errors.Keys);
        Assert.Contains("Quantity", problem.Errors.Keys);
        Assert.Contains("Price", problem.Errors.Keys);
    }

    [Fact]
    public async Task Post_missing_fields_returns_400()
    {
        var response = await PostTrade(new { symbol = "AAPL" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(Json);
        Assert.NotNull(problem);
        Assert.Contains("Side", problem.Errors.Keys);
        Assert.Contains("Quantity", problem.Errors.Keys);
        Assert.Contains("Price", problem.Errors.Keys);
    }

    [Theory]
    [InlineData("Hold")]
    [InlineData("0")]
    public async Task Post_unknown_side_returns_400(string side)
    {
        var response = await PostTrade(new { symbol = "AAPL", side, quantity = 1, price = 1m });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_trades_returns_newest_first()
    {
        await PostTrade(new { symbol = "AAPL", side = "Buy", quantity = 1, price = 1m });
        await PostTrade(new { symbol = "MSFT", side = "Sell", quantity = 2, price = 2m });

        var trades = await _client.GetFromJsonAsync<List<TradeResponse>>("/api/trades", Json);

        Assert.NotNull(trades);
        Assert.Equal(["MSFT", "AAPL"], trades.Select(t => t.Symbol));
    }

    [Fact]
    public async Task Get_trade_by_unknown_id_returns_404()
    {
        var response = await _client.GetAsync("/api/trades/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Get_positions_derives_from_trades_and_omits_flat_symbols()
    {
        await PostTrade(new { symbol = "AAPL", side = "Buy", quantity = 100, price = 10m });
        await PostTrade(new { symbol = "AAPL", side = "Buy", quantity = 50, price = 13m });
        await PostTrade(new { symbol = "MSFT", side = "Buy", quantity = 10, price = 400m });
        await PostTrade(new { symbol = "MSFT", side = "Sell", quantity = 10, price = 410m });

        var positions = await _client.GetFromJsonAsync<List<Position>>("/api/positions", Json);

        Assert.Equal([new Position("AAPL", 150, 11m)], positions);
    }

    [Fact]
    public async Task Health_reports_database_check()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var health = await response.Content.ReadFromJsonAsync<HealthResponse>(Json);
        Assert.NotNull(health);
        Assert.Contains(health.Checks, c => c.Name == "database" && c.Status == "Healthy");
    }
}
