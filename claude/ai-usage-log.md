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

---

## Author review

_Left for the project author to complete. Suggested contents: which generated code was read line by line, anything
changed by hand, anything rejected, and any decisions that were yours rather than Claude's._

- Reviewed by hand:
- Changed or rejected:
- Decisions made by the author:
