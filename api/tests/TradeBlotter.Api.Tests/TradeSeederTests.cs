using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TradeBlotter.Api.Contracts;
using TradeBlotter.Api.Data;
using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Tests;

public sealed class TradeSeederTests
{
    // Copied next to the test assembly by the test project (see the .csproj).
    private static readonly string SeedFile = Path.Combine(AppContext.BaseDirectory, "Seed", "peer-pairs-trades.json");

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    [Fact]
    public async Task Committed_seed_file_loads_in_time_order()
    {
        var trades = await TradeSeeder.LoadAsync(SeedFile);

        Assert.NotEmpty(trades);
        Assert.Equal(trades.OrderBy(t => t.Timestamp).Select(t => t.Timestamp), trades.Select(t => t.Timestamp));
        Assert.All(trades, t => Assert.True(t.Timestamp < DateTimeOffset.UtcNow));
    }

    [Fact]
    public async Task Committed_seed_book_holds_one_long_and_one_short_per_peer_group()
    {
        // Six groups, each ending the last rebalance long its laggard and short its leader.
        var positions = PositionCalculator.Calculate(await TradeSeeder.LoadAsync(SeedFile));

        Assert.Equal(12, positions.Count);
        Assert.Equal(6, positions.Count(p => p.NetQuantity > 0));
        Assert.Equal(6, positions.Count(p => p.NetQuantity < 0));
    }

    [Fact]
    public async Task Seeds_an_empty_database_once()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new TradeBlotterDbContext(
            new DbContextOptionsBuilder<TradeBlotterDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync();

        var first = await TradeSeeder.SeedIfEmptyAsync(db, SeedFile);
        var second = await TradeSeeder.SeedIfEmptyAsync(db, SeedFile);

        Assert.True(first > 0);
        Assert.Equal(0, second);
        Assert.Equal(first, await db.Trades.CountAsync());
    }

    [Fact]
    public async Task Development_startup_serves_the_seeded_book()
    {
        using var api = new ApiFactory("Development");
        using var client = api.Factory.CreateClient();
        var expected = (await TradeSeeder.LoadAsync(SeedFile)).Count;

        var trades = await client.GetFromJsonAsync<List<TradeResponse>>("/api/trades", Json);
        var positions = await client.GetFromJsonAsync<List<Position>>("/api/positions", Json);

        Assert.Equal(expected, trades?.Count);
        Assert.Equal(12, positions?.Count);
    }
}
