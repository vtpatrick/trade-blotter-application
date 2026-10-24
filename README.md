# Trade Blotter

Enter equity trades, watch them appear in a live blotter, and see current positions (net quantity and average cost)
derived from the trade history. Built for the exercise in [docs/trade-blotter-exercise.docx](docs/trade-blotter-exercise.docx).

| Folder | Contents |
| ------ | -------- |
| `api/` | C# / ASP.NET Core Web API on .NET 8: EF Core + SQLite, SignalR, xUnit tests |
| `app/` | Vue 3 (Composition API) + TypeScript + Vite, Pinia, AG Grid Community, Vitest |
| `docs/` | Exercise brief, architecture notes, design decisions |
| `claude/` | How AI (Claude Code) was used, including the session transcript |

## How to run the project locally

### Prerequisites

Install these once; the run scripts handle everything else (NuGet and npm packages, and the database).

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (any 8.0.x; having only a newer SDK is not enough)
- [Node.js](https://nodejs.org/) 24 LTS (or 22.18+)
- Windows PowerShell 5.1+ (built into Windows) or PowerShell 7

If Windows refuses to run the scripts ("running scripts is disabled on this system"), allow local scripts once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

or run a script without changing the policy: `powershell -ExecutionPolicy Bypass -File .\run_api.ps1`.

### Start the backend and frontend

From the repo root, in two terminals:

```powershell
.\run_api.ps1   # API  -> http://localhost:5035 (Swagger at /swagger), hot reload
.\run_app.ps1   # App  -> http://localhost:5173
```

Open <http://localhost:5173>. In development the blotter starts with a simulated year of 103 trades (see
[Seed data](#seed-data)); book more and open a second browser window to see them arrive live.

| Script | Options |
| ------ | ------- |
| `run_api.ps1` | `-NoWatch` runs without hot reload |
| `run_app.ps1` | `-Install` forces a clean `npm ci` |

- The SQLite database (`api/src/TradeBlotter.Api/trade-blotter.db`) is created and migrated automatically on API
  startup, and seeded if it is empty. Delete the file to start again from the seed.
- `run_app.ps1` installs npm packages on first run and again whenever `package-lock.json` changes.
- Without PowerShell, the equivalent commands are `dotnet watch run --project src/TradeBlotter.Api --launch-profile http`
  from `api/`, and `npm ci && npm run dev` from `app/`.

### Tests and checks

```powershell
cd api
dotnet test                   # xUnit: position calculation + API integration tests

cd ../app
npm run test:unit -- --run    # Vitest: validation, store, components
npm run type-check            # vue-tsc
npm run lint                  # oxlint + eslint
npm run build                 # type-check + production build
```

## Seed data

So the blotter and positions panel open on something realistic, an empty database in **Development** is loaded
with a simulated one-year book: study 35's "standing pair" from my `trading-strategies` research (every month,
in each of six peer groups such as T/VZ/TMUS and WMT/TGT/COST, long the 60-day laggard and short the leader),
filled at real Interactive Brokers daily closes at each month end from October 2025 to September 2026. It produces opens, resizes, flips
through zero and closes, which exercises every branch of the position logic.

- The trades: `api/src/TradeBlotter.Api/Data/Seed/peer-pairs-trades.json`; every rebalance, explained:
  [docs/seed-portfolio.md](docs/seed-portfolio.md).
- They are loaded by `TradeSeeder` with their historical timestamps, only when the database has no trades and only
  in Development (`Seed:TradesFile` in `appsettings.Development.json`; set it empty to start blank).
  `POST /api/trades` is unaffected and still stamps the current time.
- To regenerate (needs DeskLink with the IBKR plugin and TWS logged in; market-data calls only):
  `node tools/seed-peer-pairs/generate.mjs [--refresh] [--from 2026-07 --to 2026-09]`. Prices are cached in
  `tools/seed-peer-pairs/.cache/` (not committed), so re-runs do not touch IBKR.

## Live prices (Bloomberg, client-side)

Bloomberg lives on the user's desk, so live prices are fetched **by the browser** from DeskLink's `bdp` route
(`http://localhost:9195/con/bloomberg/bdp`), never through the API. They power two things:

- **The trade ticket:** as a symbol is typed, it waits for a 350 ms pause, then shows the Bloomberg name, last
  price and day change, with **Use** to copy the price into the ticket. A new symbol aborts the lookup in flight,
  so a slow answer for an earlier symbol is never shown.
- **The Positions page** (`/positions`; built but not linked from the header for now, while the app focuses on the
  blotter; the blotter page keeps its positions panel): every open position marked to last price, with market value,
  unrealized and day P&L, and totals (long, short, net and gross exposure). One batched request every 15 seconds.
  Click a row to expand it into a DES-style panel: sector, market cap, P/E, P/B, EV/EBITDA, dividend yield,
  payout and ex-date, 52-week range, beta. It also has a 1Y–5Y daily price chart with the position's average cost
  and its trades (▲ buy, ▼ sell). History is one 5-year `bdh` request per symbol per session.

The blotter and Positions tables are **AG Grid Community** grids with spreadsheet-height rows. Columns sort, resize and
move, and always fill the grid exactly: they start at equal widths, a column you drag keeps its width while the others
absorb the difference, and the blotter never grows wider than the screen (no sideways scroll). The content area is
centred in the window, up to 1440px wide. Positions rows expand into a full-width panel with the security description (DES-style fields), your trades in
that symbol (each with the position it left) and the price chart. Live-price cells flash when they change.

Both grids also carry **Bloomberg technicals** columns, **hidden for now** (the figures are still loaded, so they
can be shown again by unhiding the columns in `app/src/grid/technicalColumns.ts`): RSI(14), price against the 50- and 200-day moving averages, and 30-day
volatility. On the blotter they are the figures **on each trade's date** (one `bdh` request for every symbol, once
per session). On Positions they are **current**, compared with the live price, and refreshed every 5 minutes
through DeskLink's 15-minute cache. They filter like any number column: `<30` on RSI finds trades made while
oversold.

Both grids have a **filter row under the column headers**: type in any column, and the columns combine with AND.
Each input takes a small expression language (`app/src/utils/columnFilter.ts`). Hover an input for its syntax, and an
invalid expression turns red and is ignored rather than emptying the table. On the Positions page the summary cards
and totals follow the filters.

| Column type | Examples |
| --- | --- |
| Numbers | `5`, `>5`, `<=-100`, `!0`, `10..20`, `5\|6` (either), `>5&<10` (both), `>5&<10\|0` (`&` binds tighter) |
| Text | `ko` (contains), `=ko` (exactly), `!t` (doesn't contain), `ko\|pep` |
| Dates (blotter Time) | `2026`, `2026-09`, `2026-09-30`, `>=2026-09-01`, `2026-01..2026-03` |

DeskLink's cache (`mode: "auto"`, 15-second freshness) fronts Bloomberg to spare the data budget. DeskLink must list
the app's origin (`http://localhost:5173`) under **Hosting > Allowed hosts**. Without DeskLink or a Bloomberg session
the app still works, and simply shows "Live prices unavailable". Set `VITE_DESKLINK_URL` to use another address.

## API

Each route is also served without the `/api` prefix, at the paths in the exercise brief (`POST /trades`,
`GET /trades`, `GET /positions`). The app itself uses `/api`.

| Method | Path | Result |
| ------ | ---- | ------ |
| `POST` | `/api/trades` | Books a trade. `201 Created` with the trade and a `Location` header; `400` with per-field errors |
| `GET` | `/api/trades` | All trades, newest first |
| `GET` | `/api/trades/{id}` | One trade, or `404` |
| `GET` | `/api/positions` | Open positions per symbol (`netQuantity`, `averageCost`); flat symbols omitted |
| `GET` | `/api/health` | Status of the API and database (`200`, or `503` if unhealthy) |
| WS | `/hubs/trades` | SignalR: pushes `TradeAdded` to every connected blotter |

```json
// POST /api/trades
{ "symbol": "AAPL", "side": "Buy", "quantity": 100, "price": 150.25 }

// 201 Created
{ "id": 1, "symbol": "AAPL", "side": "Buy", "quantity": 100, "price": 150.25,
  "notional": 15025.00, "timestamp": "2026-10-24T13:00:00+00:00" }

// GET /api/positions
[{ "symbol": "AAPL", "netQuantity": 100, "averageCost": 150.25 }]
```

Swagger UI at <http://localhost:5035/swagger> documents the same contracts, and `TradeBlotter.Api.http` has ready-made
requests.

## Assumptions and design decisions

More detail in [docs/decisions.md](docs/decisions.md) and [docs/architecture.md](docs/architecture.md).

**Domain**
- **Positions use the weighted average cost method.** Buys into a long (or sells into a short) re-average the cost.
  Reducing a position leaves the average cost of the remaining shares unchanged. Closing to zero drops the symbol.
  Trading through zero (long 100, sell 150) closes the old position and opens the remainder at that trade's price.
- **Short selling is allowed.** Selling more than you hold gives a negative net quantity, marked "Short" in the UI.
  The brief does not forbid it, and rejecting it would need a position check on every trade.
- **Positions are always derived, never stored.** `GET /api/positions` replays the trade history through
  `PositionCalculator`, a pure function with no database access, which keeps it easy to test.
- **Trade is valid by construction.** Its only constructor rejects a malformed symbol, an undefined side, a
  quantity or price of zero or less, and a missing timestamp. Properties cannot be changed afterwards. The API also
  validates the request, to give a friendly 400 per field; the domain type is the guarantee underneath, and EF Core
  loads stored rows through the same constructor.
- **Quantity is always positive; direction comes only from `side`** (as in FIX). "Buy −200" is rejected rather than
  read as a short. A short is the position you end up in after selling more than you hold, so it is booked as
  "Sell 200". Allowing a sign too would give every trade two spellings, and let a stray minus sign book the
  opposite of the side the trader picked.
- **The server assigns the timestamp** (UTC) when a trade is booked. Trades are immutable; there is no amend or cancel.
- **Symbols are normalized to upper case** and must start with a letter (letters, digits, `.` and `-`, up to 12
  characters, so `BRK.B` works). They are not checked against a security master.
- **Money is `decimal` in C#**, so notional and average cost are exact on the server. The browser formats them for
  display only (prices to 2 to 4 decimal places, notional to 2).

**API**
- **Endpoints sit under `/api`** so the frontend dev server can proxy one prefix and the API needs no CORS setup.
  The brief's paths (`/trades`, `/positions`) are served too, so the API can be exercised exactly as specified.
- **Validation errors are standard `ValidationProblemDetails`** with a message per field, which the form shows next to
  the matching input. `side` must be exactly `Buy` or `Sell`; numeric enum values are rejected.
- **`POST` returns the created trade**, so the submitting browser can show it immediately without waiting for the live
  feed.

**Frontend and live updates**
- **SignalR broadcasts each new trade** to every connected browser. The submitting browser also gets the trade from
  its `POST` response, so the store de-duplicates by id. After any new trade it re-fetches positions from the server,
  which remains the single source of position logic.
- **The live feed recovers by itself.** It reconnects automatically and reloads the blotter after a reconnect to catch
  up on missed trades. Header badges show the feed (Live / Reconnecting / Feed offline) and API health.
- **All shared state is in Pinia** (`stores/blotter.ts`, `stores/health.ts`, `stores/theme.ts`). The live price
  lookups are composables (`useLiveQuote`, `useLiveQuotes`), since they belong to the view that shows them.
- **Light by default**, with a dark mode toggle in the header that is remembered per browser. Sorting is per-table view state, kept in
  the component.
- **Scannability:** side is shown as a coloured BUY/SELL badge and a coloured left edge on each row. Numbers are
  right-aligned in a monospace font, new trades flash briefly, and every column is sortable (newest first by default).
- **The entry form** validates on the client with the same rules as the server, shows errors only after the first
  submit attempt, and previews the notional. The submit button spells out the order ("Sell 100 AAPL @ 150.25").
  After booking, the ticket clears but keeps the side.

**Tooling**
- **SQLite via EF Core**, with a committed migration applied at startup, so there is no database setup step.
- **Seed data is generated, not hand-written**, from a real strategy and real closes, and committed as a plain JSON
  file so a reviewer needs no market-data access. Corporate-action-adjusted history is detected and never used as a fill price; that is why
  FedEx (back-adjusted for the 2026 FedEx Freight spin-off) is not in the book.
- **The dev scripts are Windows PowerShell**, matching the author's environment. The project itself is
  cross-platform (see the commands above).

## What I would improve or add given more time

**Product**
- Amend and cancel trades with an audit trail (cancel as an offsetting record, not a delete), and trader or account
  fields so positions can be split by book.
- Realized P&L per position, and unrealized P&L once a price source is added.
- Blotter filtering (symbol, side, date) and paging or virtual scrolling for large histories.
- Keyboard-first entry (for example B/S to switch side) and a confirmation step for unusually large orders.

**Engineering**
- Compute positions incrementally, or cache them, instead of replaying all trades on every request. Fine at this
  scale, but the cost grows linearly with history.
- Push position updates over SignalR as well, to save a round trip per trade.
- Generate the TypeScript API types from the OpenAPI document, so the client and server contracts cannot drift.
- End-to-end browser tests (Playwright) for entry, the live update across two windows, and reconnecting.
- CI running build, lint, type-check and both test suites; Docker Compose for one-command setup.
- Idempotency keys on `POST /api/trades`, so a retried submission cannot book the same trade twice.
- Authentication, plus configuration and CORS for environments beyond local development.
