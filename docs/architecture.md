# Architecture

## Overview

```
Browser ──► Vite dev server :5173 ──(proxy /api/*, /hubs/* incl. WebSocket)──► ASP.NET Core API :5035
            serves the Vue app                                                   controllers, SignalR hub,
                                                                                 EF Core ──► SQLite file
```

The repository has two independent projects that meet only at `/api/*` (REST) and `/hubs/*` (SignalR).

### `api/`

```
api/
├── global.json                        # pins the .NET 8 SDK line
├── .config/dotnet-tools.json          # local dotnet-ef (only needed to add migrations)
├── src/TradeBlotter.Api/
│   ├── Program.cs                     # services, JSON options, DB migration on startup, endpoints
│   ├── Domain/
│   │   ├── Trade.cs                   # entity + TradeSide enum
│   │   ├── Position.cs                # derived value (record)
│   │   └── PositionCalculator.cs      # pure: trades -> positions (weighted average cost)
│   ├── Data/
│   │   ├── TradeBlotterDbContext.cs
│   │   └── Migrations/
│   ├── Contracts/                     # request/response shapes (CreateTradeRequest, TradeResponse, HealthResponse)
│   ├── Controllers/                   # TradesController, PositionsController, HealthController
│   └── Hubs/TradesHub.cs              # strongly typed hub: ITradesClient.TradeAdded
└── tests/TradeBlotter.Api.Tests/
    ├── PositionCalculatorTests.cs     # unit tests for the position rules
    └── TradesApiTests.cs              # HTTP-level tests, in-memory SQLite per test
```

- **`Domain/`** has no dependency on ASP.NET or EF Core. `PositionCalculator` takes trades and returns positions,
  so the core logic is tested without a database or HTTP.
- **`Contracts/`** keeps the wire format separate from the entity. `TradeResponse` adds the computed `Notional`.
  `CreateTradeRequest` uses nullable properties, so a missing field reports "required" instead of silently becoming 0.
- **Controllers stay thin:** validate, map, save, broadcast. There is no repository or service layer; at this size it
  would only add indirection.

### `app/`

```
app/src/
├── api/
│   ├── trades.ts                      # fetch wrappers + types mirroring the C# contracts
│   ├── tradesHub.ts                   # SignalR connection factory
│   └── health.ts
├── stores/
│   ├── blotter.ts                     # trades, positions, live feed state, submit
│   └── health.ts                      # API heartbeat polling
├── grid/                              # AG Grid setup shared by both grids
│   ├── theme.ts                       # dense theme driven by the app's CSS colour tokens
│   ├── expressionFilter.ts            # the expression syntax as an AG Grid column filter
│   ├── ExpressionFilterInput.vue      # the input under each header
│   ├── positionRows.ts                # expanded positions -> full-width detail rows
│   └── PositionDetailRow.vue          # detail row; sizes itself to its content
├── components/
│   ├── TradeEntryForm.vue             # live Bloomberg price + availability
│   ├── BlotterTable.vue               # AG Grid
│   ├── PositionsPanel.vue
│   ├── LiveFeedIndicator.vue
│   └── ApiStatusIndicator.vue
├── utils/
│   ├── validateTrade.ts               # pure, mirrors the server rules
│   └── format.ts                      # number/time formatting
├── views/ BlotterView.vue, PositionsView.vue
└── App.vue                            # header; starts the blotter feed and health polling
```

Data flows one way: `api/` → Pinia store → components. Components never call `fetch` or SignalR directly.

## Booking a trade end to end

1. `TradeEntryForm` validates with `validateTrade` and calls `blotter.submitTrade`.
2. `POST /api/trades`: `[ApiController]` model validation returns `400 ValidationProblemDetails` for bad input.
   Otherwise the controller normalizes the symbol, stamps the time, saves, broadcasts `TradeAdded` to all hub
   clients, and returns `201` with the trade.
3. The submitting browser adds the trade from the `POST` response straight away. Every browser, including the
   submitter, also receives `TradeAdded`. `upsertTrade` ignores ids it already has, so the trade appears once.
4. On any new trade the store re-fetches `GET /api/positions`. A request counter discards out-of-order responses.
5. `BlotterTable` re-sorts and flashes the new row. `PositionsPanel` re-renders from the store.

### Live feed lifecycle

- On start the store opens the hub connection and loads trades and positions.
- If the API is down, the store retries every 5 seconds and shows "Feed offline".
- After a dropped connection, SignalR's automatic reconnect takes over ("Reconnecting"). Once reconnected, the store
  reloads everything to catch up on missed broadcasts. A reload merges with what is shown, so a trade booked during
  the reload is not lost.

## Positions

`PositionCalculator.Calculate` replays trades per symbol in `(Timestamp, Id)` order:

| Situation | Net quantity | Average cost |
| --- | --- | --- |
| Open or add (same direction) | `q + t` | `(abs(q) × avg + abs(t) × price) / abs(q + t)` |
| Reduce (opposite, does not cross zero) | `q + t` | unchanged |
| Close to zero | 0 (symbol omitted) | reset |
| Flip through zero | `q + t` | trade price |

Here `q` is the signed net quantity before the trade and `t` the trade's signed quantity (+ buy, − sell).

## Health

`GET /api/health` aggregates registered ASP.NET Core health checks: `self` and `database` (EF Core can connect).
The app polls it every 10 seconds for the header badge, whose tooltip lists each check. `HealthResponse` is mirrored by hand in
`app/src/api/health.ts`, and the trade contracts in `app/src/api/trades.ts`.

## Environments

| | Development |
| --- | --- |
| API | `http://localhost:5035` (`http` launch profile), `dotnet watch` |
| Database | `trade-blotter.db` next to the API project; migrated on startup |
| Frontend | `http://localhost:5173`; `/api` and `/hubs` proxied to the API (override the target with `API_URL`) |
| Other environments | Not defined: no hosting, CORS or production configuration yet |
