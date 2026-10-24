using TradeBlotter.Api.Domain;
using static TradeBlotter.Api.Domain.TradeSide;

namespace TradeBlotter.Api.Tests;

public class PositionCalculatorTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 24, 9, 30, 0, TimeSpan.Zero);

    /// <summary>Builds a trade booked <paramref name="minute"/> minutes after the open.</summary>
    private static Trade T(string symbol, TradeSide side, int quantity, decimal price, int minute) =>
        new(symbol, side, quantity, price, Start.AddMinutes(minute));

    [Fact]
    public void No_trades_gives_no_positions()
    {
        Assert.Empty(PositionCalculator.Calculate([]));
    }

    [Fact]
    public void Single_buy_opens_long_at_trade_price()
    {
        var positions = PositionCalculator.Calculate([T("AAPL", Buy, 100, 150m, 0)]);

        Assert.Equal([new Position("AAPL", 100, 150m)], positions);
    }

    [Fact]
    public void Buys_average_by_quantity_weight()
    {
        // (100 * 10 + 50 * 13) / 150 = 11
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 100, 10m, 0),
            T("AAPL", Buy, 50, 13m, 1),
        ]);

        Assert.Equal([new Position("AAPL", 150, 11m)], positions);
    }

    [Fact]
    public void Partial_sell_reduces_quantity_and_keeps_average_cost()
    {
        // Avg after buys: (100 * 10 + 100 * 20) / 200 = 15; selling at any price leaves the rest at 15.
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 100, 10m, 0),
            T("AAPL", Buy, 100, 20m, 1),
            T("AAPL", Sell, 50, 30m, 2),
        ]);

        Assert.Equal([new Position("AAPL", 150, 15m)], positions);
    }

    [Fact]
    public void Buy_after_partial_sell_averages_with_remaining_cost()
    {
        // Hold 50 @ 10 after the sell; add 50 @ 20 -> (50 * 10 + 50 * 20) / 100 = 15
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 100, 10m, 0),
            T("AAPL", Sell, 50, 12m, 1),
            T("AAPL", Buy, 50, 20m, 2),
        ]);

        Assert.Equal([new Position("AAPL", 100, 15m)], positions);
    }

    [Fact]
    public void Flat_position_is_omitted()
    {
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 100, 10m, 0),
            T("AAPL", Sell, 100, 12m, 1),
        ]);

        Assert.Empty(positions);
    }

    [Fact]
    public void Reopening_after_flat_starts_a_fresh_average()
    {
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 100, 10m, 0),
            T("AAPL", Sell, 100, 12m, 1),
            T("AAPL", Buy, 10, 50m, 2),
        ]);

        Assert.Equal([new Position("AAPL", 10, 50m)], positions);
    }

    [Fact]
    public void Selling_through_zero_flips_to_short_at_the_flipping_trade_price()
    {
        // Long 100 closes; the extra 50 opens a short at 12.
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 100, 10m, 0),
            T("AAPL", Sell, 150, 12m, 1),
        ]);

        Assert.Equal([new Position("AAPL", -50, 12m)], positions);
    }

    [Fact]
    public void Short_positions_mirror_long_rules()
    {
        // Short 200 @ (100 * 20 + 100 * 10) / 200 = 15; buying 50 back leaves short 150 @ 15.
        var positions = PositionCalculator.Calculate(
        [
            T("MSFT", Sell, 100, 20m, 0),
            T("MSFT", Sell, 100, 10m, 1),
            T("MSFT", Buy, 50, 5m, 2),
        ]);

        Assert.Equal([new Position("MSFT", -150, 15m)], positions);
    }

    [Fact]
    public void Trades_are_replayed_in_time_order_regardless_of_input_order()
    {
        // In time order: buy 100 @ 10, sell 50 @ 99 -> 50 @ 10.
        // Taken in input order instead, the sell would open a short and give a different answer.
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Sell, 50, 99m, 5),
            T("AAPL", Buy, 100, 10m, 0),
        ]);

        Assert.Equal([new Position("AAPL", 50, 10m)], positions);
    }

    [Fact]
    public void Symbols_are_independent_and_sorted()
    {
        var positions = PositionCalculator.Calculate(
        [
            T("MSFT", Buy, 10, 400m, 0),
            T("AAPL", Buy, 20, 150m, 1),
            T("TSLA", Buy, 5, 200m, 2),
            T("TSLA", Sell, 5, 210m, 3),
        ]);

        Assert.Equal(
        [
            new Position("AAPL", 20, 150m),
            new Position("MSFT", 10, 400m),
        ], positions);
    }

    [Fact]
    public void Average_cost_keeps_full_decimal_precision()
    {
        // (1 * 10 + 2 * 11) / 3 = 10.666...
        var positions = PositionCalculator.Calculate(
        [
            T("AAPL", Buy, 1, 10m, 0),
            T("AAPL", Buy, 2, 11m, 1),
        ]);

        Assert.Equal(32m / 3m, positions.Single().AverageCost);
    }
}
