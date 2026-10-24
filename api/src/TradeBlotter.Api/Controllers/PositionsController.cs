using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TradeBlotter.Api.Data;
using TradeBlotter.Api.Domain;

namespace TradeBlotter.Api.Controllers;

[ApiController]
[Route("api/positions")]
[Route("positions")] // the path in the exercise brief; the app itself uses /api
[Produces("application/json")]
public sealed class PositionsController(TradeBlotterDbContext db) : ControllerBase
{
    /// <summary>
    /// Open positions per symbol (net quantity and average cost), derived from the full
    /// trade history. Flat symbols are omitted. Ordered by symbol.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<Position>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<Position>> GetAll(CancellationToken cancellationToken)
    {
        var trades = await db.Trades.AsNoTracking().ToListAsync(cancellationToken);
        return PositionCalculator.Calculate(trades);
    }
}
