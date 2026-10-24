# AI usage log

Tool: Claude Code (CLI), working in this repository on Windows 11 with PowerShell.
Models used in the session so far: Claude Opus 5.5 for the scaffold, health feature and scripts;
Claude Sonnet 5.5 for the README, `docs/` and this log.

---

## 2026-10-24: Scaffold, health check, run scripts, documentation

### 1. Repository and scaffold
- **Asked for:** `git init`; an `api/` folder (C# .NET 8) and an `app/` folder (Vue 3 Composition API), scaffold only.
- **Claude did:** ran `git init`; generated the API with `dotnet new webapi` (controllers, solution file, `global.json`
  pinning .NET 8) and the frontend with `npm create vue@latest` (TypeScript, Router, Pinia, Vitest, ESLint, Prettier).
- **Choices Claude made without being asked:** controllers over minimal APIs; TypeScript, Pinia, Router and Vitest;
  ran `npm audit fix` to clear two moderate dev-dependency warnings in Vitest.
- **Verified by running:** `dotnet build` (0 warnings, 0 errors); `npm run type-check`, `npm run build`, the sample test.

### 2. Heartbeat/health endpoint, run scripts, frontend integration
- **Asked for:** `run_app.ps1` and `run_api.ps1`; a heartbeat/status/health endpoint on the backend, shown in the frontend.
- **Claude did:**
  - API: `GET /api/health` (`HealthController`, `HealthResponse` contract, `AddHealthChecks()` in `Program.cs`);
    removed the template weather sample.
  - Frontend: Vite proxy for `/api`, API client, Pinia polling store, header status badge, `/status` page and route,
    and 7 unit tests for the store.
  - Scripts: `run_api.ps1` (`dotnet watch`) and `run_app.ps1` (`npm`).
- **Verified by running:** both scripts started both servers; the endpoint answered directly and through the Vite
  proxy; a headless-browser screenshot of `/status` showed "API: Healthy"; lint, type-check, build and 8 unit tests passed.
- **Problems found and fixed:**
  - Type-check failed on `ErrorOptions` (the app's TypeScript config does not include it); Claude removed the
    `cause` option instead of changing the config.
  - Claude had assumed the Vite proxy returns `500` when the API is down. Running it showed `502` with a plain-text
    body; the client and its test were corrected to match.
- **Not verified:** the Unhealthy (`503`) and Degraded paths against the real API. They are covered only by mocked
  unit tests in the frontend, because no failing health check exists yet. There are no API tests.

### 3. Fresh-clone portability
- **Asked for:** confirmation that the scripts install all required packages for a new user.
- **Claude found gaps:** `run_app.ps1` skipped the install when `node_modules` already existed; `global.json`
  required a specific SDK patch (8.0.422); no version checks for Node or the .NET SDK.
- **Claude did:** switched to `npm ci` with lockfile-change detection, relaxed `global.json` to `8.0.100` with
  roll-forward, added SDK and Node version checks, and added a first README.
- **Verified by running:** copied only the git-trackable files to a clean folder and ran both scripts there (fresh
  `npm ci` and NuGet restore, healthy response through the proxy); confirmed a plain re-run skips the install and a
  touched lockfile triggers it.
- **Not verified:** a machine with no NuGet cache or an older .NET 8 SDK; the author's machine already had both.

### 4. README and docs (this entry)
- **Asked for:** a root README covering how to run locally, assumptions and design decisions, and what to improve
  with more time; plus `docs/` and `claude/` folders (this log, as an AI-usage record).
- **Claude did:** rewrote the README with those sections; added `docs/architecture.md` and `docs/decisions.md`; created
  this folder.
- **Interpretation note:** Claude first assumed "claude folder" meant the `.claude/` config folder and was corrected;
  the author then chose an AI usage log.
- **Verified by running:** the README's `npm run test:unit -- --run`, `npm run type-check` and `dotnet build`
  (8 tests passed, 0 warnings, 0 errors). `npm run lint` and `npm run build` were verified earlier in the session,
  not re-run after the docs were written.

### 5. The trade blotter (exercise implementation)
- **Asked for:** the exercise in `docs/trade-blotter-exercise.docx`: enter trades, a live blotter, and positions derived
  from trade history. The author chose SQLite via EF Core and SignalR.
- **Interaction note:** Claude first asked four multiple-choice design questions. The author rejected them as
  over-complicated and pointed to the brief in `docs/`, which already answered most of them. Claude then read the brief
  and built to it.
- **Model switch:** the session switched to Claude Sonnet 5.5 partway through; the author switched back to Claude
  Opus 5.5 ("use opus go again") and work resumed from where it stopped. The only Sonnet-era code changes were adding
  and pinning the EF Core packages.
- **Claude did:**
  - API:
    - Domain: `Trade`, `Position` and a pure `PositionCalculator` (weighted average cost, shorts and flips).
    - Data: EF Core SQLite context, a migration applied on startup, and a DB health check.
    - Endpoints: `POST/GET /api/trades`, `GET /api/trades/{id}` and `GET /api/positions`, plus a SignalR hub
      broadcasting `TradeAdded`.
    - Tests: an xUnit project with 12 calculator tests and 9 HTTP-level tests.
  - Frontend:
    - Removed the Vue starter content.
    - Added the trade API client and SignalR connection, a Pinia `blotter` store (de-duplication, reconnect and
      reload, ordered position refresh), and the entry form, sortable blotter, positions panel and live-feed badge.
    - Restyled the app with light and dark themes.
    - Tests: validation, store and component tests (30 Vitest tests in total).
  - Updated the README, `docs/architecture.md` and `docs/decisions.md`.
- **Verified by running:**
  - Automated checks:
    - `dotnet test`: 21 passed.
    - `npm run test:unit`: 30 passed.
    - Lint, type-check and the production build are clean.
  - Live end-to-end run with both scripts. A Node SignalR client connected through the Vite proxy (WebSocket
    transport) and booked 7 trades over REST:
    - All 7 broadcasts were received, and each POST returned `201` with a Location header.
    - An invalid POST returned `400` with all four field errors.
    - Positions matched a hand calculation (AAPL 120 @ 152; NVDA flat and omitted; TSLA short −15 @ 220.25).
  - Headless-browser screenshots at desktop width (light and dark) and 375px wide.
- **Problems found and fixed:**
  - An API test showed that `"side": "0"` was accepted as Buy. The enum converter accepts numeric strings even with
    integer values disabled. Fixed by validating `side` as a string with `[AllowedValues("Buy", "Sell")]`.
  - The live-feed badge's outer CSS class was also the name of its "live" state, so it would always have shown green.
    Claude caught this on review before it ran.
  - The store loaded data twice on startup, and a reload could drop a trade booked while it was in flight. Both
    were fixed before testing.
  - The narrow layout overflowed: grid columns would not shrink below the inputs' intrinsic width. Fixed with
    `minmax(0, 1fr)`.
  - Two narrow-width screenshots were misleading. The headless browser's minimum viewport is 492px, so a "420px"
    capture was cropped. Claude measured it and re-checked inside a 375px iframe.
  - Lint flagged conditional `expect`s and untyped mocks in the new tests; these were rewritten.
- **Not verified:**
  - Submitting through the form in a real browser by clicking. The form is covered by component tests and the
    POST path by the live run, but no browser automation (Playwright) is set up.
  - Reconnect behaviour after an API restart. That logic is not exercised by any test.
- **Cleanup:** the dev database created during the live run (holding the test trades) was deleted.

### 6. Run scripts: `.cmd` detour, then initial commit
- The author asked to switch the run scripts to `.cmd`. Claude wrote `run_api.cmd` and `run_app.cmd` with the
  same checks, but before they were tested the author decided to keep `.ps1`, their usual tool. The `.ps1` scripts
  were restored, and Claude re-checked them with a live run (health and positions through the proxy).
- Everything was then committed as a single initial commit, at the author's request.

### 7. Seed data: a simulated book from the author's strategy research
- **Asked for:** simulated trades in a portfolio, based on the studies in the author's `trading-strategies` repo,
  with prices from IBKR through DeskLink (`localhost:9195`). The author chose the peer-pairs study (35).
- **Strategy repo:** the local checkout was 5 commits behind, but its uncommitted edits overlapped the incoming
  ones (README, home page, .gitignore), so Claude did not pull. It read studies 32–35 from `origin/main` with
  `git show` instead. A read-only subagent surveyed all 35 studies for ones expressible in cash equities.
- **IBKR safety:** the TWS session was on port 7496 (normally live). Claude called only `status` and `history`
  (market data), never account, position, P&L or order routes.
- **Claude did:**
  - `tools/seed-peer-pairs/generate.mjs`:
    - Fetches a year of daily bars for 14 tickers and caches them in `.cache/`, which is not committed.
    - Applies study 35's standing-pair rule in six groups at the July, August and September 2026 month ends.
    - Writes 29 trades and `docs/seed-portfolio.md`.
  - `TradeSeeder` loads the file into an empty database, in Development only, keeping historical timestamps.
  - Integration tests now run as `Testing`, and there are 4 new seeder tests.
- **Problems found:**
  - FDX closes before 1 June 2026 are not whole cents. IBKR back-adjusted them for a corporate action, consistent
    with the FedEx Freight spin-off.
  - Claude checked that every fill is dated after that point, then made the generator detect adjusted stretches
    and refuse to fill on them.
  - `dotnet test` initially failed because the author's own running `dotnet watch` session locked the API binary.
    Claude identified the process, left it running, and built the tests into a separate folder.
- **Verified by running:**
  - The generator against live IBKR data (14 symbols, 251 bars each), then re-run from the cache.
  - `dotnet test`: 25 passed, including the Development-startup test that serves the seeded book (29 trades,
    12 positions: 6 long, 6 short).
- **Not verified:**
  - The seed loading in the author's running instance: it had not restarted onto the new code at the time of
    writing.
  - The UI with the seeded book (no screenshot taken).

### 8. Light/dark toggle, live Bloomberg prices, Positions page
- **Asked for:**
  - A light/dark toggle, since the author doesn't like dark mode.
  - A live price in the trade ticket from Bloomberg `bdp`, debounced as the symbol is typed.
  - A Positions page.
- **Correction from the author:** Claude began a server-side quote endpoint. The author stopped it, because Bloomberg
  lives on the client desktop, not the server. Claude rebuilt the feature as browser calls to DeskLink. DeskLink
  initially sent no CORS header for `localhost:5173`; the author added the origin under Allowed hosts.
- **Claude did:**
  - Theme: light by default, a toggle in the header, and the choice remembered.
  - `api/bloomberg.ts`: a single-symbol and batched `bdp` client, with `BRK.B` mapped to `BRK/B`.
  - `useLiveQuote`: debounced, aborts the previous lookup, ignores stale responses, refreshes every 15 s.
  - `useLiveQuotes` for batches.
  - Ticket UI with a "Use" button.
  - `valuePositions`: market value, unrealized and day P&L, and exposure totals.
  - `PositionsView` at `/positions`.
  - Tests: the frontend total went from 30 to 52.
- **Problems found:**
  - The composable tests reused a stopped effect scope, so the tests after the first failed.
  - `String.replaceAll` isn't in the app's TypeScript library settings.
  - Both were fixed.
- **Verified by running:**
  - A live `bdp` call for a valid ticker, an invalid one and a share class, to learn the response shapes.
  - Headless Edge driven over the DevTools protocol, typing symbols one character at a time into the real ticket.
    KO, BRK.B and AAPL resolved to the right name and price, and ZZQXQ showed "No Bloomberg security".
  - The Positions page in the same browser, pricing all 12 seeded positions. Claude checked two rows by hand,
    one long and one short.
  - `npm run lint`, `type-check`, the test suite (52 tests) and `build`.
- **Not verified:**
  - The dark theme visually after the toggle change.
  - Behaviour during market hours, when prices are actually moving. The page was tested on a Saturday, with
    Friday's closes.

### 9. Pointer cursor, expandable positions, price chart, quick filters
- **Pointer cursor:**
  - The author asked for the pointer cursor on buttons.
  - The cause on Buy/Sell was an invisible radio input on top of the visible button.
  - Claude fixed that and added a global rule, then verified in a real browser that all 36 clickable controls
    show the pointer.
- **Expandable rows:**
  - Asked for: expandable position rows with DES-style key fields (ratios, dividend) and a 1–5 year price chart,
    then quick filters on both pages.
  - The author also sent a screenshot asking that side-by-side panels end at the same line.
  - Claude used the `dataviz` skill's guidance. Its palette validator flagged the red/green pair as hard to tell
    apart for colour-blind readers (ΔE 5.5), so the trade markers also differ by shape (▲ buy, ▼ sell).
  - Fields and history come from DeskLink in the browser: `bdp` through DeskLink's 1-hour cache, and `bdh` with
    5 years of daily closes, fetched once per symbol per session.
  - The chart has a hover and keyboard crosshair, plus a text summary of the period's change, high and low.
- **Equal bottoms:**
  - The two expanded panels stretch to the same height.
  - On the blotter page, the left column sets the row height and the blotter fills it, scrolling inside.
- **Problems found:**
  - `Array.at()` isn't in the app's TypeScript library settings.
  - jsdom has no `ResizeObserver`.
  - A test fixture was dated today, which made the "Today" filter test wrong.
  - Text values in the monospace font wrapped. Claude saw this in its own screenshot and fixed it.
- **Verified by running:**
  - The full browser pass: expanded KO, switched the chart to 5Y and hovered it, and applied filters on both pages.
  - Measured panel bottoms: 960 = 960 for the detail panels and 1078 = 1078 on the blotter page.
  - Lint, type-check and 62 frontend tests.
- **Not verified:**
  - The dark theme for the new panel and chart.
  - Phone-width layout of the expanded panel.

### 10. Trade invariants (after the author questioned `required`)
- **The author asked:** "why in trade.cs is only symbol required?"
- **Claude's answer:** `required` was there only to satisfy the compiler's nullable check on a string. Value-type
  properties defaulted silently, so `new Trade { Symbol = "AAPL" }` compiled as a trade with zero quantity, zero
  price and no time.
- **The author pushed back:** shouldn't "Buy −200" just mean "short 200"? Claude explained why quantity stays
  positive with direction from the side (as in FIX), and that a short is a resulting position, booked as a sell.
  The author agreed.
- **Committed first:** the earlier work went in as three commits (seed data, frontend, docs), at the author's request.
- **Claude did:** gave `Trade` a validating constructor and immutable properties, and switched the controller,
  seeder and tests to it. It added 14 `TradeTests`, including that "Buy −200" is rejected.
- **Problem found:**
  - EF Core refused the entity, because it does not map getter-only properties; only the explicitly configured
    ones were bound.
  - Fixed with `private init` accessors.
  - `dotnet ef migrations has-pending-model-changes` confirmed there is no schema change.
- **Verified by running:** 39 API tests passed. They include saving and reading trades through SQLite, which uses
  the constructor.
- **Not verified:** the author's running `dotnet watch` session on the new code. A constructor change needs a
  restart (Ctrl+R).

### 11. A year of seed trades; column filters with expressions
- **Correction from the author:**
  - The author wanted a year of trades, not three months.
  - By "quick filters" they meant inputs under the column headers that accept expressions (`>5`, `5|6`), not
    chip buttons.
- **Seed:**
  - Claude extended the generator to 12 month ends (Oct 2025 to Sep 2026) with 2 years of IBKR history.
  - The adjusted-price guard then stopped the run: FDX fills before June 2026 would have used back-adjusted
    prices that never printed. Claude swapped the Parcel group (UPS/FDX) for Card networks (V/MA/AXP) and noted
    why in the generator, README and decision 14.
  - Result: 103 trades. API tests still pass, including the 6-long/6-short check.
- **Filters:**
  - `utils/columnFilter.ts`, a small expression language: `|`, `&`, comparisons, `!`, ranges, and dates at the
    precision typed.
  - `useColumnFilters`, which combines columns with AND and ignores invalid expressions.
  - A filter row under the headers of both tables. The blotter's whole header is now sticky.
  - The chip component was removed. Tests: 48 for the expression syntax, and the table tests were rewritten.
    The frontend total is 106.
- **Verified in a real browser:**
  - Typed into the actual inputs: `>1000`, `f|gm` and `2026-08` on the blotter, and an invalid `>` (turns red,
    shows the reason).
  - `<0` with `>0` on Positions, where the totals follow the filter.
- **Not done:** reloading the author's dev database. It still holds the old 30 trades (29 seed plus one AAPL
  trade the author booked), and the seed only loads into an empty database.

### 12. Filter spacing; Status tab removed
- **Filter spacing:**
  - "add gaps between them". Claude's first padding change had no effect: the tables' scoped `th { padding: 0 }`
    had the same specificity and loaded later.
  - Claude spotted this in its own screenshot and fixed it with a more specific `thead .filter-row th`.
  - Re-checked by screenshot: the inputs now line up with their columns, with clear gaps.
- **Status tab:** "remove status tab". Claude removed the route, the nav link and `StatusView.vue`. The API
  health badge stays, as plain text now rather than a link, and its tooltip lists each health check.
- **Verified by running:** lint, type-check, 106 frontend tests and the build.

### 13. AG Grid, a denser layout, Bloomberg status in the ticket, trade history in expanded rows
- **Asked for:**
  - "ag grid like functionality", "thinner like excel rows", "everything to be tighter … this does not say business".
  - Then: no gap under expanded rows; show when Bloomberg is unavailable in the ticket; show the symbol's
    historical trades when a position is expanded.
  - Then: a coherent commit history.
- **Claude did:**
  - Adopted AG Grid Community 36.2.0, pinned exactly, with a dense theme driven by the app's tokens and 24px rows.
  - Plugged the expression filter into AG Grid's filter API. Claude read the installed type definitions to get
    `enableFilterHandlers` right rather than working from memory.
  - Expanded positions are full-width rows that size themselves to their content.
  - A density pass across the app.
  - A DeskLink Bloomberg status check in the ticket.
  - A trade history panel in the expanded position, showing the position left after each trade.
- **Problems found:**
  - The floating filter's params lack `colDef`, which crashed it on mount. Claude found the cause from the
    browser console, through the DevTools protocol.
  - The filter input never received model updates: the grid uses `refresh()`. Tests caught this as "Clear
    filters" leaving stale text.
  - The totals row was missing on first load, because `modelUpdated` fired before `gridReady`.
  - The pinned-row class name differs in this AG Grid version.
  - Pinned columns hid the long/short row edge.
- **Commit mistake:** Claude's "Enforce Trade invariants" commit accidentally included two deletions that were
  already staged (`StatusView.vue`, `QuickFilter.vue`), leaving the app unbuildable at that commit. Neither commit
  had been pushed, so Claude reset them, kept the working tree, and rebuilt the history as one change per commit.
- **Verified by running:**
  - Browser screenshots: both grids, an expanded GM row (338px of content in a 340px row) and its 3 trades.
  - The blotter filter in the real grid: `gm` gives 3 of 30.
  - Lint, type-check, the build, and 111 frontend tests (three consecutive green runs).
- **Not verified:**
  - Dark mode with the grid.
  - The ticket's "unavailable" state with DeskLink actually stopped. It's covered only by a unit test.

### 14. Bloomberg technicals to use the empty width
- **Asked for:** less white space in both grids. Either compact the columns and add "technicals at the time of trade
  from bloomberg", or add side margins.
- **Claude did:**
  - Chose technicals, after checking with live calls that `RSI_14D`, `MOV_AVG_50D`, `MOV_AVG_200D` and
    `VOLATILITY_30D` work both historically (`bdh`) and currently (`bdp`).
  - Fixed column widths, so the leftover space is one strip at the right.
  - On the blotter, a one-request history lookup applied to each trade's New York date. On Positions, current
    figures against the live price.
  - Tests mock the new calls, so they never reach the real DeskLink on this machine.
- **Problem found:** a "called once" assertion counted calls from earlier tests, until the mock was reset per test.
- **Verified by running:**
  - Real-browser screenshots of both grids at 1900px, with Bloomberg data: for example, the 30 Sep F buy at RSI 28.7
    shows as oversold, and MA's RSI of 70.0 shows as overbought.
  - Lint, type-check, and 118 tests in two runs.

### 15. Grid width, hidden technicals, centred layout, the brief's endpoint paths
- **Asked for:**
  - Whitespace gone for good, row borders continuous, Bloomberg set apart, columns evenly distributed, resizing
    never reopening a gap, and the blotter never wider than the screen.
  - Then: a 50px gap, the group header row removed, the Positions link removed, the Bloomberg columns hidden
    (keeping the calls, with no toggle), and the content centred.
  - Then: a check against the exercise brief.
- **What went wrong first:**
  - Claude went through several patch attempts: column caps, then fixed widths, then pinning.
  - The author called out "you going half effort".
  - The root cause was pinning, which splits the grid into separate sections, so any width shortfall left a blank
    band.
- **Fix:**
  - No pinning, so all columns sit in one section.
  - Equal starting widths, scaled to fit.
  - Each column the user drags keeps its width, and one column is always left free to absorb the remainder.
  - An overflow check releases the oldest user width or trims the latest.
  - The grid refits on creation, data change, resize and drag.
  - Measured in a real browser by dragging columns (shrink, widen, a +900px over-widen) and resizing the window
    (1900, 1300 and 1000px). The blotter filled the grid exactly in every case except 1000px, where the
    since-hidden Bloomberg columns pushed the minimums over.
  - Claude also used a switch constant to hide the technicals; the author said "no toggle", so the columns are now
    simply `hide: true`.
- **Brief check:**
  - Every required feature was present.
  - The gaps found were the transcript (not yet in the repo), no public repo, a stale README and uncommitted work.
  - The brief's literal paths (`/trades`, `/positions`) returned 404 because of the `/api` prefix. Claude added them
    as aliases, with a test.
- **Verified by running:** 118 frontend tests, 40 API tests, lint and type-check.
- **Known issue:** the unlinked Positions page still overflows its grid by about 16px at 1900px.

---

## Author review

_Left for the project author to complete. Suggested contents: which generated code was read line by line, anything
changed by hand, anything rejected, and any decisions that were yours rather than Claude's._

- Reviewed by hand:
- Changed or rejected:
- Decisions made by the author:
