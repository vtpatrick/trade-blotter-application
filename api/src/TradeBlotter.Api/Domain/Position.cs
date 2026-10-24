namespace TradeBlotter.Api.Domain;

/// <summary>
/// Net holding in one symbol, derived from trade history (never stored).
/// </summary>
/// <param name="Symbol">Ticker.</param>
/// <param name="NetQuantity">Shares held: positive is long, negative is short.</param>
/// <param name="AverageCost">Average price per share of the open position.</param>
public sealed record Position(string Symbol, long NetQuantity, decimal AverageCost);
