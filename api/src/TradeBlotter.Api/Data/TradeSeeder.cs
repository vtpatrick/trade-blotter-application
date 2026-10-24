using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Data;

/// <summary>
/// Loads a simulated trade history into an empty database (development only, see Program.cs).
/// Unlike <c>POST /api/trades</c>, seeded trades keep their own historical timestamps.
/// The default file is produced by tools/seed-peer-pairs/generate.mjs.
/// </summary>
public static class TradeSeeder
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(allowIntegerValues: false) },
    };

    public static async Task<IReadOnlyList<Trade>> LoadAsync(string path, CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(path);
        var file = await JsonSerializer.DeserializeAsync<SeedFile>(stream, Json, cancellationToken)
            ?? throw new InvalidDataException($"{path} is empty.");

        return file.Trades
            .Select((t, i) =>
            {
                if (string.IsNullOrWhiteSpace(t.Symbol) || t.Quantity <= 0 || t.Price <= 0)
                {
                    throw new InvalidDataException($"{path}: trade {i} needs a symbol and a positive quantity and price.");
                }

                return new Trade
                {
                    Symbol = t.Symbol.Trim().ToUpperInvariant(),
                    Side = t.Side,
                    Quantity = t.Quantity,
                    Price = t.Price,
                    Timestamp = t.Timestamp.ToUniversalTime(),
                };
            })
            .OrderBy(t => t.Timestamp)
            .ToList();
    }

    /// <summary>Inserts the file's trades if there are no trades yet. Returns how many were added.</summary>
    public static async Task<int> SeedIfEmptyAsync(
        TradeBlotterDbContext db, string path, CancellationToken cancellationToken = default)
    {
        if (await db.Trades.AnyAsync(cancellationToken))
        {
            return 0;
        }

        var trades = await LoadAsync(path, cancellationToken);
        db.Trades.AddRange(trades);
        await db.SaveChangesAsync(cancellationToken);
        return trades.Count;
    }

    private sealed record SeedFile(string? Description, IReadOnlyList<SeedTrade> Trades);

    private sealed record SeedTrade(string Symbol, TradeSide Side, int Quantity, decimal Price, DateTimeOffset Timestamp);
}
