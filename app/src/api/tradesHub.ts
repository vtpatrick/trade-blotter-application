import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import type { Trade } from './trades'

/** Server-to-client messages on /hubs/trades (see api/.../Hubs/TradesHub.cs). */
export interface TradesHubHandlers {
  tradeAdded(trade: Trade): void
}

export function createTradesConnection(handlers: TradesHubHandlers): HubConnection {
  const connection = new HubConnectionBuilder()
    .withUrl('/hubs/trades')
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on('TradeAdded', handlers.tradeAdded)
  return connection
}
