namespace TradeBlotter.Api.Domain;

/// <summary>
/// Derives positions from trades using the weighted average cost method.
/// </summary>
/// <remarks>
/// Trades are replayed per symbol in booking order:
/// <list type="bullet">
/// <item>Opening or adding to a position (same direction): average cost becomes the
/// quantity-weighted average of the existing position and the new trade.</item>
/// <item>Reducing a position (opposite direction): average cost is unchanged; selling
/// part of a long does not change what the remaining shares cost.</item>
/// <item>Closing to exactly zero: the position is flat and dropped from the result.</item>
/// <item>Flipping through zero (e.g. long 100, sell 150): the old position closes and the
/// remainder opens a new one at this trade's price.</item>
/// </list>
/// Short positions (negative quantity) are allowed and mirror the long rules.
/// </remarks>
public static class PositionCalculator
{
    public static IReadOnlyList<Position> Calculate(IEnumerable<Trade> trades)
    {
        var books = new Dictionary<string, (long Quantity, decimal AverageCost)>(StringComparer.Ordinal);

        foreach (var trade in trades.OrderBy(t => t.Timestamp).ThenBy(t => t.Id))
        {
            var current = books.GetValueOrDefault(trade.Symbol);
            books[trade.Symbol] = Apply(current.Quantity, current.AverageCost, trade.SignedQuantity, trade.Price);
        }

        return books
            .Where(b => b.Value.Quantity != 0)
            .OrderBy(b => b.Key, StringComparer.Ordinal)
            .Select(b => new Position(b.Key, b.Value.Quantity, b.Value.AverageCost))
            .ToList();
    }

    private static (long Quantity, decimal AverageCost) Apply(
        long quantity, decimal averageCost, long tradeQuantity, decimal price)
    {
        var newQuantity = quantity + tradeQuantity;

        // Opening or adding in the same direction: weighted average.
        if (quantity == 0 || Math.Sign(quantity) == Math.Sign(tradeQuantity))
        {
            var totalCost = Math.Abs(quantity) * averageCost + Math.Abs(tradeQuantity) * price;
            return (newQuantity, totalCost / Math.Abs(newQuantity));
        }

        // Closed flat.
        if (newQuantity == 0)
        {
            return (0, 0m);
        }

        // Partially reduced: remaining shares keep their cost.
        if (Math.Sign(newQuantity) == Math.Sign(quantity))
        {
            return (newQuantity, averageCost);
        }

        // Flipped through zero: the remainder is a new position opened at this price.
        return (newQuantity, price);
    }
}
