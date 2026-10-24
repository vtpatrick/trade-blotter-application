namespace TradeBlotter.Api.Domain;

public enum TradeSide
{
    Buy,
    Sell,
}

/// <summary>An executed equity trade. Trades are immutable once booked.</summary>
public sealed class Trade
{
    public long Id { get; init; }

    /// <summary>Ticker, stored upper-case (e.g. AAPL).</summary>
    public required string Symbol { get; init; }

    public TradeSide Side { get; init; }

    /// <summary>Number of shares; always positive. Direction comes from <see cref="Side"/>.</summary>
    public int Quantity { get; init; }

    /// <summary>Price per share; always positive.</summary>
    public decimal Price { get; init; }

    /// <summary>When the trade was booked (UTC), set by the server.</summary>
    public DateTimeOffset Timestamp { get; init; }

    /// <summary>Quantity signed by side: positive for Buy, negative for Sell.</summary>
    public long SignedQuantity => Side == TradeSide.Buy ? Quantity : -(long)Quantity;
}
