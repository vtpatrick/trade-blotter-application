using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Tests;

public class TradeTests
{
    private static readonly DateTimeOffset BookedAt = new(2026, 10, 23, 16, 0, 0, TimeSpan.FromHours(-4));

    [Fact]
    public void A_valid_trade_is_normalized()
    {
        var trade = new Trade(" brk.b ", TradeSide.Buy, 100, 542.19m, BookedAt);

        Assert.Equal("BRK.B", trade.Symbol);
        Assert.Equal(TimeSpan.Zero, trade.Timestamp.Offset);
        Assert.Equal(BookedAt, trade.Timestamp); // same instant, stored in UTC
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-200)] // "Buy -200" is not a short; a short is booked as "Sell 200"
    public void Quantity_must_be_positive(int quantity)
    {
        var e = Assert.Throws<ArgumentOutOfRangeException>(
            () => new Trade("AAPL", TradeSide.Buy, quantity, 100m, BookedAt));

        Assert.Equal("quantity", e.ParamName);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1.5")]
    public void Price_must_be_positive(string price)
    {
        var e = Assert.Throws<ArgumentOutOfRangeException>(
            () => new Trade("AAPL", TradeSide.Buy, 1, decimal.Parse(price), BookedAt));

        Assert.Equal("price", e.ParamName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("1AAPL")]
    [InlineData("AA PL")]
    [InlineData("TOOLONGSYMBOL")]
    public void Symbol_must_be_a_ticker(string symbol)
    {
        var e = Assert.Throws<ArgumentException>(() => new Trade(symbol, TradeSide.Buy, 1, 1m, BookedAt));

        Assert.Equal("symbol", e.ParamName);
    }

    [Fact]
    public void Side_must_be_Buy_or_Sell()
    {
        var e = Assert.Throws<ArgumentOutOfRangeException>(
            () => new Trade("AAPL", (TradeSide)7, 1, 1m, BookedAt));

        Assert.Equal("side", e.ParamName);
    }

    [Fact]
    public void Timestamp_is_required()
    {
        var e = Assert.Throws<ArgumentException>(() => new Trade("AAPL", TradeSide.Buy, 1, 1m, default));

        Assert.Equal("timestamp", e.ParamName);
    }

    [Theory]
    [InlineData(TradeSide.Buy, 200)]
    [InlineData(TradeSide.Sell, -200)]
    public void Side_alone_sets_the_direction(TradeSide side, long signed)
    {
        Assert.Equal(signed, new Trade("AAPL", side, 200, 1m, BookedAt).SignedQuantity);
    }
}
