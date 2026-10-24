# Design decisions

Short records of choices that shape the project. Newest at the bottom.

## 1. Two independent projects: `api/` and `app/`

**Decision:** A .NET 8 Web API and a Vue 3 (Composition API) frontend in separate folders, joined only by HTTP.
**Why:** Matches the requested structure and lets each side be built, tested and deployed on its own.
**Trade-off:** Types are duplicated across the boundary until they are generated from OpenAPI.

## 2. Vite proxy for `/api` in development

**Decision:** The dev server forwards `/api/*` to `http://localhost:5035`; the API has no CORS configuration.
**Why:** The browser sees a single origin, so local development needs no CORS setup and no hard-coded API URL in
frontend code.
**Trade-off:** Only covers dev. Hosting the frontend on another origin later requires CORS or a reverse proxy.

## 3. Health endpoint aggregates ASP.NET Core health checks

**Decision:** `HealthController` calls `HealthCheckService` and returns a custom JSON report. Unhealthy is `503`;
Degraded stays `200`.
**Why:** New dependencies (database, market data) become one registration line and appear in the report with no
controller changes. Degraded still serves traffic, so load balancers should not treat it as down.
**Trade-off:** One endpoint serves both "is the process up" and "are dependencies healthy". A production setup would
likely split liveness and readiness.

## 4. The UI separates "unhealthy" from "offline"

**Decision:** A `503` carrying a report is `unhealthy`. No report (network error, timeout, non-JSON response) is `offline`.
**Why:** "The API told us something is wrong" and "we cannot reach the API" need different responses from a user.
**Found by testing:** with the API stopped, the Vite proxy returns a plain-text `502`, not a `500` as first assumed.
The client therefore keys on the response having a JSON health body, not on a particular status code.

## 5. Polling with a self-scheduling timer

**Decision:** The Pinia store schedules the next check only after the previous one finishes, every 10 seconds.
**Why:** Checks can never overlap or pile up behind a slow response. Simpler than a push channel for a heartbeat.
**Trade-off:** Up to 10 seconds of lag in the badge. Live trade data would use SignalR or SSE instead.

## 6. Reproducible setup

**Decision:** `run_app.ps1` uses `npm ci` and reinstalls when `package-lock.json` is newer than `node_modules`.
`api/global.json` pins SDK `8.0.100` with `rollForward: latestFeature`.
**Why:** A fresh clone runs with two commands, and a pull that changes dependencies does not leave a stale
`node_modules`. Any installed 8.0.x SDK is accepted, but a newer major SDK alone is not.
**Trade-off:** The scripts cannot install .NET or Node themselves; they check for them and say what is missing.

## 7. Windows PowerShell dev scripts

**Decision:** `run_api.ps1` and `run_app.ps1` at the repo root.
**Why:** The requested workflow and the author's platform.
**Trade-off:** Not usable as-is on macOS or Linux without PowerShell 7. The underlying commands are
`dotnet watch run` and `npm run dev`.

## 8. Weighted average cost, with shorts allowed

**Decision:** Positions use the weighted average cost method. Reducing a position keeps its average cost; flipping
through zero opens the remainder at the flipping trade's price. Selling more than is held creates a short.
**Why:** It is the usual blotter convention and answers "average cost on mixed buys and sells" unambiguously.
Allowing shorts keeps booking a pure append with no position check.
**Trade-off:** No FIFO/LIFO lot tracking, so realized P&L per lot is not available.

## 9. Positions derived on every request by a pure calculator

**Decision:** `GET /api/positions` loads all trades and runs `PositionCalculator.Calculate`. Nothing about positions
is stored.
**Why:** The brief requires derived positions, and a pure function is the easiest thing to unit test thoroughly.
**Trade-off:** Cost grows linearly with trade history. A snapshot or incremental update would be needed at scale.

## 10. SQLite via EF Core, migrated on startup

**Decision:** A committed `InitialCreate` migration, applied with `Database.Migrate()` when the API starts.
Timestamps are stored as integers (`DateTimeOffsetToBinaryConverter`) so SQLite can sort them.
**Why:** Zero setup for a reviewer. Migrations rather than `EnsureCreated` so the schema can evolve.
**Trade-off:** Migrating on startup is not something to do with multiple instances in production.

## 11. `side` validated as a string

**Decision:** `CreateTradeRequest.Side` is a string restricted to `Buy`/`Sell` with `[AllowedValues]`, then parsed to
the `TradeSide` enum.
**Found by testing:** binding straight to the enum accepted `"0"` as `Buy`, even with integer enum values disabled.
An API test caught it.

## 12. SignalR broadcasts trades; the client re-fetches positions

**Decision:** The hub pushes only `TradeAdded`. Clients upsert by id (the submitting client already has the trade
from its `POST` response) and then re-fetch `/api/positions`.
**Why:** Position logic lives in one place (the server). The submitting browser updates instantly even if the live feed
is down.
**Trade-off:** One extra HTTP call per trade per client. Pushing positions on the hub would remove it.

## 13. Client-side validation mirrors the server

**Decision:** `validateTrade.ts` repeats the server's rules so errors appear without a round trip. The server stays
authoritative, and its `400` field errors are shown on the same inputs.
**Trade-off:** The rules exist twice. Generating them from a shared schema would avoid drift.

## 14. Seed the dev database from a real strategy on real prices

**Decision:** An empty Development database is loaded from `Data/Seed/peer-pairs-trades.json`: study 35's standing
peer pair (six groups, monthly, October 2025 to September 2026, 103 trades) filled at IBKR daily closes, generated by
`tools/seed-peer-pairs/generate.mjs` through DeskLink.
**Why:** A blotter is easier to judge with a book in it, and a real rule produces the cases position logic has to get
right (adds, partial trims, flips through zero, closes) in a way hand-typed rows would not. Committing the generated
JSON means nobody needs market-data access to run the app.
**Details:** Seeding bypasses `POST` so trades keep historical timestamps; it runs only in Development and only when the
table is empty, so it never mixes with real entries. Integration tests run as `Testing` to stay unseeded. The raw price
cache is not committed. IBKR back-adjusts history for corporate actions (FDX before the FedEx Freight spin-off); the
generator detects adjusted stretches and refuses to fill on them.
That guard is why the Parcel group (UPS/FDX) was swapped for Card networks (V/MA/AXP) when the seed grew to a year:
FDX fills before June 2026 would have used prices that never printed.
**Trade-off:** The JSON holds IBKR-derived closes for 15 tickers at 12 month ends; regenerating needs TWS and DeskLink.

## 15. Live Bloomberg prices are fetched by the browser, not the API

**Decision:** The trade ticket and the Positions page call DeskLink's `bdp` route on `localhost:9195` directly from
the browser. The API knows nothing about market data.
**Why:** Bloomberg runs on the business user's desktop (Terminal and DeskLink), not on the server. The prices are a
convenience for that user, so they belong on the client. On a desk without DeskLink the app works and says the price is
unavailable.
**Details:**
- The ticket debounces typing (350 ms), aborts the previous lookup, and applies only the newest response.
- Positions batch every symbol into one request every 15 seconds.
- DeskLink's cache (`mode: "auto"`, 15 s) fronts Bloomberg, to spare the data budget.
- Share classes map to Bloomberg's slash form (`BRK.B` becomes `BRK/B US Equity`).
- DeskLink must allow the app's origin under Hosting > Allowed hosts.

**Trade-off:** Valuation (market value, P&L) is computed in the browser from server positions and client prices, so
another consumer of the API would not get P&L.

## 16. Trade enforces its own invariants; quantity is never signed

**Decision:** `Trade` has one constructor that validates symbol format, side, quantity > 0, price > 0 and a timestamp,
and normalizes the symbol (upper case) and the timestamp (UTC). Its properties have private `init` accessors.
**Why:** Before this, only `Symbol` was `required`, and only to satisfy the compiler's nullable check. Nothing in the
type itself stopped a trade with quantity 0 or no timestamp. Now no layer (controller, seeder, tests, EF
materialization) can create an invalid `Trade`. The request DTO keeps its own validation for user-facing 400s.
**Direction:** "Buy −200" is rejected, not treated as a short. A short is a resulting position, and booking it as
"Sell 200" keeps one spelling per trade, so a stray minus sign can't flip the trader's chosen side. A "Sell Short"
side (as in FIX, for Reg SHO purposes) would be the way to flag short sales explicitly. It's not built.
**Trade-off:** The validation rules exist in the request (as attributes) and in the domain (in code). They match
today, and the domain is the one that cannot be bypassed.

## 17. AG Grid Community for the blotter and positions

**Decision:** Both tables are AG Grid Community (MIT) grids rather than hand-built HTML tables. The dense theme
is driven by the app's CSS tokens, rows are 24px, and the filter row under the headers is our expression syntax
plugged in as an AG Grid filter.
**Why:** The author asked for AG Grid behaviour and a sleek, efficient screen. Using AG Grid gives column
resize/move, virtualised scrolling for large histories, cell flashing on live prices and pinned totals, without
reimplementing them.
**Details:** Expanded positions are full-width rows, and `postSortRows` keeps each one under its position. Detail
rows measure their content, so there is no fixed-height gap. The filter input exposes `refresh()`, because the grid
passes the current model through it; without that, "Clear filters" left stale text (caught by a test).
**Trade-off:** About 1 MB more JavaScript, as `AllCommunityModule` is registered; registering only the modules used
would cut that. Tests drive the real grid in jsdom, and need a short settle after row changes.

## 18. Bloomberg technicals beside trades and positions

**Decision:** The blotter shows Bloomberg's RSI(14), 50/200-day moving averages (as price against each) and 30-day
volatility on each trade's date. Positions shows the same figures, current.
**Why:** The grids had a wide empty band. The author chose filling it with information over adding margins. These
are Bloomberg's own studies (`RSI_14D`, `MOV_AVG_50D`, `MOV_AVG_200D`, `VOLATILITY_30D`), not app arithmetic, so
they match the Terminal.
**Details:**
- The blotter makes one `bdh` request for every symbol, from the earliest trade to today, fetching only symbols it
  has not yet loaded.
- A trade uses the last bar on or before its New York trade date, so a trade booked today uses yesterday's figures.
- Positions uses `bdp` through DeskLink's 15-minute cache, every 5 minutes.
- Fetched in the browser, like the prices (decision 15).

**Trade-off:** The blotter's request grows with history: about a year of daily bars for each traded symbol.
