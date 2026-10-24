using System.Text.RegularExpressions;

namespace TradeBlotter.Api.Domain;

public enum TradeSide
{
    Buy,
    Sell,
}

/// <summary>
/// An executed equity trade. Immutable, and valid by construction: an instance with a missing
/// symbol, a non-positive quantity or price, or no timestamp cannot exist.
/// </summary>
/// <remarks>
/// Quantity is always positive and direction comes only from <see cref="Side"/>, as in FIX.
/// "Buy -200" is not a short: going short is the position that results from selling more than is
/// held, so it is booked as "Sell 200". Allowing a sign as well would give two spellings of every
/// trade and let a stray minus sign book the opposite of the side the trader chose.
/// </remarks>
public sealed partial class Trade
{
    /// <summary>Upper-case ticker: a letter, then letters, digits, '.' or '-' (e.g. BRK.B), 12 at most.</summary>
    public const int MaxSymbolLength = 12;

    // EF Core also materializes stored trades through this constructor (parameters bind to the
    // properties by name), so rows read from the database are checked against the same rules.
    // The private init accessors exist so EF maps the properties; nothing outside can change them.
    public Trade(string symbol, TradeSide side, int quantity, decimal price, DateTimeOffset timestamp)
    {
        var normalized = symbol?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!SymbolFormat().IsMatch(normalized))
        {
            throw new ArgumentException(
                $"Symbol '{symbol}' is not a ticker: a letter, then letters, digits, '.' or '-', at most {MaxSymbolLength}.",
                nameof(symbol));
        }

        if (!Enum.IsDefined(side))
        {
            throw new ArgumentOutOfRangeException(nameof(side), side, "Side must be Buy or Sell.");
        }

        if (quantity <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(quantity), quantity, "Quantity must be a positive number of shares; direction comes from Side.");
        }

        if (price <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(price), price, "Price must be greater than 0.");
        }

        if (timestamp == default)
        {
            throw new ArgumentException("A trade needs the time it was booked.", nameof(timestamp));
        }

        Symbol = normalized;
        Side = side;
        Quantity = quantity;
        Price = price;
        Timestamp = timestamp.ToUniversalTime();
    }

    /// <summary>Assigned by the database when the trade is saved.</summary>
    public long Id { get; private set; }

    /// <summary>Ticker, upper case (e.g. AAPL).</summary>
    public string Symbol { get; private init; }

    public TradeSide Side { get; private init; }

    /// <summary>Number of shares; always positive. Direction comes from <see cref="Side"/>.</summary>
    public int Quantity { get; private init; }

    /// <summary>Price per share; always positive.</summary>
    public decimal Price { get; private init; }

    /// <summary>When the trade was booked, in UTC.</summary>
    public DateTimeOffset Timestamp { get; private init; }

    /// <summary>Quantity signed by side: positive for Buy, negative for Sell.</summary>
    public long SignedQuantity => Side == TradeSide.Buy ? Quantity : -(long)Quantity;

    [GeneratedRegex(@"^[A-Z][A-Z0-9.\-]{0,11}$")]
    private static partial Regex SymbolFormat();
}
