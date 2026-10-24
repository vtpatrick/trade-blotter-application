using Microsoft.AspNetCore.SignalR;
using TradeBlotter.Api.Contracts;

namespace TradeBlotter.Api.Hubs;

/// <summary>Messages the server pushes to connected blotters.</summary>
public interface ITradesClient
{
    Task TradeAdded(TradeResponse trade);
}

/// <summary>
/// Live blotter feed at <c>/hubs/trades</c>. Server-to-client only: trades are
/// submitted through the REST API, which then broadcasts them here.
/// </summary>
public sealed class TradesHub : Hub<ITradesClient>;
