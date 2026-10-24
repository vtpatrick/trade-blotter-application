using System.ComponentModel.DataAnnotations;
using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Contracts;

/// <summary>Body of <c>POST /api/trades</c>. The server assigns the id and timestamp.</summary>
/// <remarks>Properties are nullable so a missing field reports "required" rather than defaulting to 0.</remarks>
public sealed record CreateTradeRequest
{
    [Required]
    [RegularExpression(@"^\s*[A-Za-z][A-Za-z0-9.\-]{0,11}\s*$",
        ErrorMessage = "Symbol must start with a letter and be at most 12 letters, digits, '.' or '-'.")]
    public string? Symbol { get; init; }

    /// <summary>"Buy" or "Sell". A string rather than <see cref="TradeSide"/> because the enum
    /// converter would also accept numeric strings such as "0".</summary>
    [Required]
    [AllowedValues("Buy", "Sell", ErrorMessage = "Side must be Buy or Sell.")]
    public string? Side { get; init; }

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "Quantity must be a positive whole number of shares.")]
    public int? Quantity { get; init; }

    [Required]
    [Range(0.0001, 1_000_000_000, ErrorMessage = "Price must be greater than 0.")]
    public decimal? Price { get; init; }
}

public sealed record TradeResponse(
    long Id,
    string Symbol,
    TradeSide Side,
    int Quantity,
    decimal Price,
    decimal Notional,
    DateTimeOffset Timestamp)
{
    public static TradeResponse From(Trade trade) => new(
        trade.Id,
        trade.Symbol,
        trade.Side,
        trade.Quantity,
        trade.Price,
        trade.Quantity * trade.Price,
        trade.Timestamp);
}
