using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TradeBlotter.Api.Contracts;
using TradeBlotter.Api.Data;
using TradeBlotter.Api.Domain;
using TradeBlotter.Api.Hubs;

namespace TradeBlotter.Api.Controllers;

[ApiController]
[Route("api/trades")]
[Route("trades")] // the path in the exercise brief; the app itself uses /api
[Produces("application/json")]
public sealed class TradesController(
    TradeBlotterDbContext db,
    IHubContext<TradesHub, ITradesClient> hub,
    TimeProvider timeProvider) : ControllerBase
{
    /// <summary>All trades, newest first.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<TradeResponse>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<TradeResponse>> GetAll(CancellationToken cancellationToken)
    {
        var trades = await db.Trades
            .AsNoTracking()
            .OrderByDescending(t => t.Timestamp)
            .ThenByDescending(t => t.Id)
            .ToListAsync(cancellationToken);

        return trades.Select(TradeResponse.From).ToList();
    }

    [HttpGet("{id:long}")]
    [ProducesResponseType<TradeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TradeResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        var trade = await db.Trades.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        return trade is null ? NotFound() : TradeResponse.From(trade);
    }

    /// <summary>Books a trade and broadcasts it to live blotters.</summary>
    [HttpPost]
    [Consumes("application/json")]
    [ProducesResponseType<TradeResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TradeResponse>> Create(
        CreateTradeRequest request, CancellationToken cancellationToken)
    {
        // [ApiController] has already answered invalid requests with a 400 per field, so the values are
        // present and Trade's own checks (which would throw) only guard against a gap between the two.
        var trade = new Trade(
            request.Symbol!,
            Enum.Parse<TradeSide>(request.Side!),
            request.Quantity!.Value,
            request.Price!.Value,
            timeProvider.GetUtcNow());

        db.Trades.Add(trade);
        await db.SaveChangesAsync(cancellationToken);

        var response = TradeResponse.From(trade);
        await hub.Clients.All.TradeAdded(response);

        return CreatedAtAction(nameof(GetById), new { id = trade.Id }, response);
    }
}
