# Transcript: research subagent surveying the trading-strategies studies

Exported from `agent-a3d9e2089cc9d53a4.jsonl` by `tools/export-transcript.mjs`.
Your messages and Claude's replies are complete. Tool results longer than 2500 characters are shortened. Content the app injects behind the scenes (system reminders) and Claude's private reasoning are left out, and email addresses are redacted.

---

### User · 2026-10-24 13:15:28

> Survey the strategy research repo at C:\repos\trading-strategies_v2 (read-only; do NOT modify anything, do NOT run git pull/checkout/stash). I need to pick strategies to generate a realistic *simulated equity trade history* for a trade blotter app.
> 
> The blotter only supports cash equities/ETFs: each trade is symbol, Buy/Sell, whole-share quantity, price per share. Positions are net quantity + average cost; short positions (negative qty) are allowed.
> 
> Sources to read:
> 1. The root README.md (984 lines; the index near the top, and any results/summary sections further down) and OPERATIONAL.md.
> 2. Each study folder 01-* through 31-* in the working tree: read its README.md (and skim the main study .py only if the README lacks the conclusion or the instruments). Note: folders 22-31 are untracked local work, still read them.
> 3. Studies 32-35 exist only on the remote branch, not the working tree. Read them with `git -C C:/repos/trading-strategies_v2 show origin/main:<path>` e.g. `git show origin/main:33-market-short-interest/README.md`, `34-housing-shorts/README.md`, `35-peer-shocks/README.md`, and for 32-trucking (no README) skim `git show origin/main:32-trucking/study.py` header/docstring. These git show commands are read-only and fine.
> 
> For EVERY study report a compact row:
> - number + name
> - asset class (single stocks / equity ETFs / Treasuries / futures / options-vol / FX / other)
> - verdict as the study states it (tradeable strategy with stats like Sharpe/hit rate, or "no trade"/primer/not run), quote the key line
> - if it could be expressed in cash equities or ETFs: the concrete positions (tickers, long/short, sizing or weighting rule, holding period, entry/exit rule). Name actual tickers mentioned in the README or code (e.g. universe lists, short lists, baskets). If the instrument is futures/bonds/FX/vol, say what liquid ETF proxy would be the closest (e.g. TLT/IEF for duration, SVXY/VXX for VIX carry) and whether that proxy is faithful.
> 
> Then give a short recommendation: the 3-5 studies best suited to seed a simulated equity portfolio of maybe 30-80 trades over a few months, preferring ones with a positive verdict, clear rules, and named tickers, and a mix of longs and shorts. For each, list the specific tickers and the trade pattern (e.g. "long the last 3 sessions of each month in TLT, flat otherwise"). Mention any price levels/dates in the studies only if they're actually there; do not invent prices.
> 
> Keep the final report under ~1200 words, as a table plus the recommendation. Include file paths you relied on.

<details><summary>Tool: <code>Bash</code></summary>

_List repo contents and remote tree_

```bash
cd C:/repos/trading-strategies_v2 && ls && git status --short | head -50 && git ls-tree --name-only origin/main | head -60
```

</details>

<details><summary>Result</summary>

```
01-intraday-continuation
02-vol-spread
03-correlation
04-vol-reversion
05-bond-rv
06-treasury-cusip-rv
07-vol-forecast
08-rate-beta
09-shippers
10-small-energy
11-aviation
12-casinos
13-government-contractors
14-consumer-web
15-biotech-catalysts
16-network-signals
17-treasury-flies
18-treasury-month-end
19-vix-carry
20-global-month-end
21-treasury-calendar
22-treasury-rv-pca
23-ml-em-fx
24-ml-treasury-timing
25-ml-curve-rv
26-ml-vix-carry
27-ml-equity-xs
28-mbs-rv
29-macro-book
30-em-fx-core-satellite
31-book-optimisation
OPERATIONAL.md
README.md
bbg_pull
common
dashboard
data
home.html
inventory
 M .gitignore
 M README.md
 M home.html
?? 22-treasury-rv-pca/
?? 23-ml-em-fx/
?? 24-ml-treasury-timing/
?? 25-ml-curve-rv/
?? 26-ml-vix-carry/
?? 27-ml-equity-xs/
?? 28-mbs-rv/
?? 29-macro-book/
?? 30-em-fx-core-satellite/
?? 31-book-optimisation/
?? bbg_pull/
?? common/ml.py
?? inventory/
.claude
.gitignore
01-intraday-continuation
02-vol-spread
03-correlation
04-vol-reversion
05-bond-rv
06-treasury-cusip-rv
07-vol-forecast
08-rate-beta
09-shippers
10-small-energy
11-aviation
12-casinos
13-government-contractors
14-consumer-web
15-biotech-catalysts
16-network-signals
17-treasury-flies
18-treasury-month-end
19-vix-carry
20-global-month-end
21-treasury-calendar
32-trucking
33-market-short-interest
34-housing-shorts
35-peer-shocks
OPERATIONAL.md
README.md
common
dashboard
home.html
```

</details>

<details><summary>Tool: <code>Read</code></summary>

`C:\repos\trading-strategies_v2\README.md`

</details>

<details><summary>Result</summary>

````
1	# trading-strategies
2	
3	Systematic strategy research. Data comes from Bloomberg via the local Plugboard gateway on
4	`http://127.0.0.1:9195` (DeskHub's successor; `common/deskhub.py` maps the routes), cached to SQLite so a study can be re-run without re-pulling.
5	Bloomberg data budget is tight: always hit the cache first.
6	
7	## Layout
8	
9	Each strategy is a self-contained folder holding its own fetch, analysis, viewer template
10	and results.
11	
12	```
13	common/                     shared plumbing
14	  deskhub.py                gateway client
15	  store.py                  SQLite connection and writers
16	  paths.py                  every shared location, resolved once
17	  viewer.py                 inlines results JSON into a page template
18	  bootstrap.py              runs a strategy's fetch when its cache is empty
19	  universe.py               builds the cap-weighted index baskets
20	  progress.py               run monitor: a study writes progress.json, a page polls it
21	data/                       one shared cache (gitignored): bars.db, universe*.json
22	home.html                   landing page linking to all the viewers
23	
24	01-intraday-continuation/   does an up open predict an up close
25	02-vol-spread/              the implied-minus-realized vol screen, with trade tickets
26	03-correlation/             equity, currency and cross-sectional correlation
27	04-vol-reversion/           per-name reversion scores: vol, vs market, rate of change
28	05-bond-rv/                 curve-level Treasury RV, carry and roll, the priced policy path
29	06-treasury-cusip-rv/       CUSIP-level Treasury RV off a Nelson-Siegel curve
30	07-vol-forecast/            forecasting realized vol, premium vs discount, the tail hedge
31	08-rate-beta/               who wins and loses when the 10-year moves, and the short list
32	09-shippers/                shippers: rates, dilution, decomposition; phase 1 built, not yet run (Bloomberg), see its README
33	10-small-energy/            primer: small producers from the regulator's production files
34	11-aviation/                primer: airlines and operators from ADS-B, one tail at a time
35	12-casinos/                 casinos from state revenue reports: phase 2 run (11 states), see its README
36	13-government-contractors/  federal awards from USAspending: phase 1 run (24 names), see its README
37	14-consumer-web/            primer: small consumer names from search, apps and web
38	15-biotech-catalysts/       primer: smal
… (8918 more characters)
````

</details>

<details><summary>Tool: <code>Read</code></summary>

`C:\repos\trading-strategies_v2\OPERATIONAL.md`

</details>

<details><summary>Result</summary>

```
1	# Operational studies: measure what a small company is doing before it reports it
2	
3	Studies 01 to 08 were statistical: prices, vols, yields. Studies 09 onward are operational.
4	The idea is the same in every one: find a public series that reports the company's activity
5	ahead of its financials, build a nowcast of the number the market is waiting for, and trade the
6	gap between the nowcast and what the market expects into the print.
7	
8	| Folder | Business | The series that leads the financials | Free? |
9	|---|---|---|---|
10	| 09-shippers | small shippers (phase 1 built and tested on synthetic data, not yet run: Bloomberg held requests for a workflow review on 2026-09-29) | AIS vessel tracks times freight rates | rates yes, AIS no |
11	| 10-small-energy | small oil and gas producers | state regulator production and permits by operator | yes |
12	| 11-aviation | regional airlines, charter, helicopters | ADS-B flights per tail number, BTS T-100 | mostly |
13	| 12-casinos | regional casinos (phase 2 run: 11 states parsed, nowcast good for pure-plays, print edge since 2022, no monthly trade) | state gaming board revenue by property | yes |
14	| 13-government-contractors | small defence and government IT (phase 1 run: 24 names, obligations too lumpy to nowcast, awards priced the day they are signed, no trade) | USAspending and SAM.gov awards by vendor | yes |
15	| 14-consumer-web | small consumer companies | search interest, app downloads, web traffic, hiring | proxies yes, panels no |
16	| 15-biotech-catalysts | small biotechs | the catalyst calendar, trial registry, financings | yes |
17	| 16-network-signals | games, apps, streaming, ISPs, infrastructure | player counts, domain rank, certificate transparency, BGP and IP growth | mostly |
18	
19	Each folder holds a primer: the thesis, the series, where it comes from and what it costs, the
20	universe, the method, the trap, a phase 1 that needs no new data spend, and a phase 2 that
21	does. They are worked one at a time; a primer says "primer" at the top until its phase 1 has
22	run, and then it says what the data said, like every other study here.
23	
24	Common ground for all of them, to build once:
25	
26	- an **entity map** module: company to its operating identifiers (IMO numbers, operator IDs,
27	  tail numbers, properties, UEIs, app IDs, trial sponsors), kept as a table per study
28	- a **nowcast harness**: quarter-to-date series against reported quarterly numbers, with the
29	  lag fitted per co
… (153 more characters)
```

</details>

<details><summary>Tool: <code>Grep</code></summary>

```json
{
  "pattern": "^#{2,3} ",
  "path": "C:\\repos\\trading-strategies_v2\\README.md",
  "output_mode": "content"
}
```

</details>

<details><summary>Result</summary>

```
7:## Layout
76:## Running one
99:## The Run engine button
114:## What is not in the repo
122:## Viewing
168:## Study 01: intraday continuation
173:### The question is two questions
191:### Priors from the literature (to be confirmed or killed against our own data)
215:### Design
230:### Honest expectations
237:## Layout
248:## Results (run 2026-09-02, Bloomberg daily OHLC via DeskHub)
261:### The SPX trap
272:### What is left worth testing
284:## Study 02: volatility correlation (dispersion)
312:### A methodology trap worth recording
326:## Vol scanner
346:### Scanner: sparklines and the trade ticket
372:## Study 03: currency correlation
408:## Study 04: stock correlation structure
427:### The universe-drift trap
438:### Viewer
449:### Sparklines and chart horizons
480:## Study 04: reversion, name by name
502:### Result: volatility reverts, price does not
518:### Two things the first version got wrong
528:### Caveat
537:## Study 05: bond relative value
541:### The premise, corrected
550:### Is the priced path worth following?
569:### Carry and roll
585:### The RV screen: butterflies revert, spreads do not
601:### What is not here yet
609:## Study 06: Treasury CUSIP relative value
617:### Four traps, all of which bit before they were fixed
635:### On-the-runs are excluded from the fit
644:### Seeing the underlying data, not just the metric
663:### What it produces
673:## Study 07: forecasting volatility, and what an option's premium is measured against
692:### Volatility is forecastable, and the market already does it
715:### The regime is a filter, not a model input
733:### Probability of profit is a fee, not a forecast
741:### The yardstick: what "premium" has to be measured against
771:### The straddle and the cheap put
801:### Names
816:### 07b: other data points (`python fetch_signals.py && python signals.py`)
850:### Trading it: `python engine.py run`
877:### What was wrong in the first version
888:### Layout
902:## Study 08: rate beta, the long list and the short list
```

</details>

<details><summary>Tool: <code>Bash</code></summary>

_List each study folder and README lengths_

```bash
cd C:/repos/trading-strategies_v2 && for d in [0-3][0-9]-*/; do echo "== $d"; ls $d; wc -l $d/README.md 2>/dev/null; done
```

</details>

<details><summary>Result</summary>

```
== 01-intraday-continuation/
build.py
export.py
fetch_daily.py
fetch_intraday.py
study.py
viewer
== 02-vol-spread/
build.py
fetch.py
scanner.py
viewer
== 03-correlation/
build.py
cross_section.py
equity.py
fetch_fx.py
fetch_sectors.py
fetch_vol.py
fx.py
viewer
== 04-vol-reversion/
build.py
fetch.py
study.py
viewer
== 05-bond-rv/
build.py
fetch.py
study.py
viewer
== 06-treasury-cusip-rv/
build.py
fetch.py
study.py
viewer
== 07-vol-forecast/
build.py
engine.py
fetch.py
fetch_signals.py
hedge.py
models.py
signals.py
study.py
trader.json
viewer
== 08-rate-beta/
build.py
engine.py
fetch.py
study.py
trader.json
viewer
== 09-shippers/
README.md
build.py
fetch.py
study.py
viewer
143 09-shippers//README.md
== 10-small-energy/
README.md
57 10-small-energy//README.md
== 11-aviation/
README.md
59 11-aviation//README.md
== 12-casinos/
README.md
build.py
fetch.py
nj.py
nv.py
regionals.py
states.py
study.py
viewer
123 12-casinos//README.md
== 13-government-contractors/
README.md
build.py
fetch.py
study.py
usaspending.py
viewer
117 13-government-contractors//README.md
== 14-consumer-web/
README.md
57 14-consumer-web//README.md
== 15-biotech-catalysts/
README.md
58 15-biotech-catalysts//README.md
== 16-network-signals/
README.md
60 16-network-signals//README.md
== 17-treasury-flies/
README.md
__pycache__
build.py
data
fetch.py
monitor.html
progress.json
study.py
viewer
84 17-treasury-flies//README.md
== 18-treasury-month-end/
README.md
__pycache__
build.py
data
fetch.py
monitor.html
progress.json
study.py
viewer
64 18-treasury-month-end//README.md
== 19-vix-carry/
README.md
__pycache__
build.py
data
fetch.py
study.py
viewer
41 19-vix-carry//README.md
== 20-global-month-end/
README.md
build.py
data
fetch.py
monitor.html
progress.json
study.py
viewer
51 20-global-month-end//README.md
== 21-treasury-calendar/
README.md
build.py
data
fetch.py
monitor.html
progress.json
study.py
viewer
57 21-treasury-calendar//README.md
== 22-treasury-rv-pca/
README.md
__pycache__
data
fetch.py
study.py
viewer
123 22-treasury-rv-pca//README.md
== 23-ml-em-fx/
README.md
study.py
viewer
511 23-ml-em-fx//README.md
== 24-ml-treasury-timing/
README.md
study.py
viewer
405 24-ml-treasury-timing//README.md
== 25-ml-curve-rv/
README.md
study.py
viewer
312 25-ml-curve-rv//README.md
== 26-ml-vix-carry/
README.md
__pycache__
data
fetch.py
study.py
viewer
382 26-ml-vix-carry//README.md
== 27-ml-equity-xs/
README.md
__pycache__
audit.py
study.py
viewer
478 27-ml-equity-xs//README.md
== 28-mbs-rv/
README.md
_
… (820 more characters)
```

</details>

<details><summary>Tool: <code>Read</code></summary>

`C:\repos\trading-strategies_v2\README.md`

</details>

<details><summary>Result</summary>

```
237	## Layout
238	
239	- `common/deskhub.py` - thin client for the gateway
240	- `fetch_daily.py` - daily OHLC into the shared `data/bars.db`
241	- `fetch_intraday.py` - 30-min bars into the same cache
242	- `study.py` - the conditional tables
243	- `export.py` - every cached ticker into `viewer/results.json`
244	- `notebooks/` - exploratory work
245	
246	---
247	
248	## Results (run 2026-09-02, Bloomberg daily OHLC via DeskHub)
249	
250	15 instruments, 1990-2026. Run from `01-intraday-continuation/`.
251	
252	**The answer is no.** On clean data, an up open does not predict an up session.
253	
254	| Finding | Evidence |
255	|---|---|
256	| Gap-up "edge" vanishes once the gap is excluded | SPY: 69.3% close above prior close, but 51.9% close above the open, against a 52.5% base rate. Edge is **-0.57 pts**. |
257	| Nothing is significant | Of 15 instruments, 13 have a gap-up interval straddling their own base rate. The two that clear it (AAPL, NVDA) are **negative**: gap-ups fade. |
258	| Single stocks are worse, not better | Every clean single name is at or below its base rate. Their base rates also sit *below* 50%: stock returns are right-skewed, so the median day is a small loss. |
259	| The drift is entirely overnight | QQQ: $1 grows to **$30.23** held overnight-only vs **$0.46** intraday-only, against $13.86 buy-and-hold. SPY overnight leg averages 3.31 bp/day, session leg 0.75 bp/day. |
260	
261	### The SPX trap
262	
263	`SPX Index` appears to show a large, statistically significant +8.14 pt continuation edge.
264	It is fake. The index open was reported as *exactly* the prior close on **37.9%** of days,
265	and on **94%** of days between 1995 and 2004: Bloomberg carried a synthetic open before the
266	index was computed from live opening prints. Every "close > open" figure inherits that,
267	which mechanically manufactures continuation.
268	
269	Use `SPY` or `QQQ` for anything involving an opening price. The viewer measures the stale
270	rate per instrument and refuses to present a flagged one without a warning.
271	
272	### What is left worth testing
273	
274	The daily-bar work is done and the answer is negative. The one live thread is Phase 2:
275	first-30-minute momentum (Gao/Han/Li/Zhou), which conditions on a different variable than
276	the gap and is the only version of this idea with published support. Intraday history is
277	capped near 140 days, so it can only ever be suggestive here.
278	
279	The overnight/intraday split is the more valuable f
… (17670 more characters)
```

</details>

<details><summary>Tool: <code>Read</code></summary>

`C:\repos\trading-strategies_v2\README.md`

</details>

<details><summary>Result</summary>

```
616	
617	### Four traps, all of which bit before they were fixed
618	
619	- **The universe was a third foreign.** `govtListRequest` matches issuer tickers by prefix,
620	  and "T" also starts TURKGB, THAIGB and TCV, so 133 of 442 "Treasuries" were Turkish, Thai
621	  and Australian government bonds. `SECURITY_TYP = US GOVERNMENT` separates them.
622	- **Floating rate notes passed the coupon filter.** An FRN carries a current coupon, but its
623	  quoted yield is a discount margin. The four outstanding FRNs priced 50 to 58bp through the
624	  curve and owned the entire rich end of the screen.
625	- **`DUR_ADJ_MID` returns nothing as a time series.** It works as a point-in-time field, so
626	  the failure was silent: every duration came back null and every switch was filtered out,
627	  leaving an empty table rather than an error. Duration is now computed analytically from
628	  coupon, maturity and yield.
629	- **A raw residual is not a signal.** Eight neighbouring 1.3-year bonds all showed +5 to +7bp
630	  cheap at once. That is not eight mispriced bonds, it is the curve missing a local kink.
631	  Cheapness is now measured against bonds within nine months, which leaves the idiosyncratic
632	  part, and then z-scored per CUSIP because some issues are permanently cheap on size or
633	  coupon.
634	
635	### On-the-runs are excluded from the fit
636	
637	Benchmarks trade through the curve because they are the liquid hedging instruments, not
638	because anyone mispriced them. Left in the fit they drag the curve toward their own liquidity
639	premium and make every other bond look cheap by construction. They are identified as the most
640	recently issued bond in each original tenor bucket (an age cutoff labels three or four per
641	tenor as benchmark when only one is), priced off the resulting curve, and reported separately:
642	currently **-0.9bp** rich.
643	
644	### Seeing the underlying data, not just the metric
645	
646	Cheapness is a difference, and a difference with both sides hidden cannot be sanity checked.
647	Since `residual = (actual yield - fitted yield) x 100`, the curve yield each bond was judged
648	against comes straight back out of what is already stored, so both levels are shown.
649	
650	Opening a row gives two charts: the bond's actual yield against the fitted curve yield with
651	the gap shaded, then that gap on its own in basis points against the bond's own mean.
652	
653	The row sparkline plots the **difference**, not the two levels. Plot
… (21940 more characters)
```

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Print READMEs for studies 09-12_

```bash
cd C:/repos/trading-strategies_v2 && for d in 09 10 11 12; do echo "=================== $d"; cat $d-*/README.md; done
```

</details>

<details><summary>Result</summary>

````
=================== 09
# 09: small shippers, tracked ship by ship

**Status:** phase 1 built and tested on synthetic data, not yet run on market data. On 2026-09-29
Bloomberg answered every reference and history request from this machine with LIMIT /
WORKFLOW_REVIEW_NEEDED ("Workflow review needed"), so nothing has been fetched. Page (Run log only
until the first run): <http://127.0.0.1:9194/app/b26a8266/> (`monitor.html`). When access is back:

```bash
python fetch.py --dry-run     # what it will ask for (about 28 requests); no Bloomberg calls
python fetch.py               # ten years: 34 names, 9 freight indices, 2 ETFs
python study.py               # about half a minute
python build.py               # monitor.html
```

## Phase 1: what it runs

**Universe** (`fetch.py`). 21 small owners, the names the thesis is about: Castor, Toro, Icon,
C3is, Globus, EuroDry, Euroseas, Performance, Pyxis, Imperial Petroleum, Top Ships, OceanPal,
Seanergy, United Maritime, StealthGas, Diana, Pangaea, Ardmore, Dynagas, Himalaya, Safe Bulkers.
10 larger anchors: Star Bulk, Genco, Scorpio Tankers, International Seaways, Nordic American,
Teekay Tankers, DHT, Dorian LPG, Navios Partners, Global Ship Lease. And three that are gone
(Eagle Bulk, Golden Ocean, DryShips), so the sample is not only the survivors. Each name has a
dated segment (dry bulk, crude, product, both kinds of tanker, LPG, LNG, containers, mixed) that
picks its freight index. A fleet that is mostly one class gets that class's index. The
vessel-by-vessel fleet table is phase 2.

**Data.** Per name: the daily total-return index, month-end split-adjusted price and market cap
(their ratio is the split-adjusted share count), quarterly revenue, earnings dates and the split
history. Freight: Baltic Dry, Capesize, Panamax, Supramax, Handysize, Dirty and Clean Tanker,
LPG (VLGC, Middle East to Japan) and the New ConTex. ETFs: BDRY (dry bulk freight futures) and
BOAT. `fetch.py` checks every ticker's NAME first in one request (ICON was Iconix until 2021),
skips what is already cached, and stops at the first empty answer, because a blocked account
comes back as an empty success, not an error.

**Tests** (`study.py`):

- **A. Rates.** This month's index change against next month's basket return over IWM and over
  the group; the same week to week and day to day; against BDRY and BOAT; to 2021 and from 2022;
  per name.
- **B. Dilution.** A tercile sort each month-end on twelve-mont
… (19447 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Print READMEs for studies 13-17_

```bash
cd C:/repos/trading-strategies_v2 && for d in 13 14 15 16 17; do echo "=================== $d"; cat $d-*/README.md; done
```

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Print READMEs for studies 18-21_

```bash
cd C:/repos/trading-strategies_v2 && for d in 18 19 20 21; do echo "=================== $d"; cat $d-*/README.md; done
```

</details>

<details><summary>Result</summary>

```
=================== 13
# 13: government contractors, award by award

**Status:** phase 1 run, 2026-09-28, on 24 of 28 names. Page: <http://127.0.0.1:9194/app/36d04a93/> (`monitor.html`).

## Phase 1 results

USAspending gives, for free and by API, every awardee entity, its monthly contract obligations and
every transaction with its action date. `fetch.py` holds the universe and the family regex per
company (subsidiaries and acquired names); `usaspending.py` pulls it (cached per name under
`data/us/`). The API began refusing connections after about forty thousand transactions, so Leidos,
General Dynamics, Lockheed and L3Harris are not in this run; a rerun fetches only them. The 24
that are in include every small and mid cap, which is the point, and Northrop and Huntington
Ingalls as primes.

**How much of revenue the record sees.** Trailing twelve months of contract obligations against
trailing revenue: Huntington Ingalls 68%, Booz Allen 57%, V2X 57%, SAIC 52%, National Presto 52%,
CACI 42%, Amentum 36%, AeroVironment 32%, KBR 27%, Parsons 23%, Northrop 22%, ICF 21%,
Intuitive Machines 21%, Kratos 16%, BWXT 12%, Tetra Tech 9%. Under 6%
for Mercury, Curtiss-Wright, Ducommun, VSE, Rocket Lab, Planet, BlackSky and Redwire: they sell
to the primes, and subcontracts are not in the record.

**Nowcast: weak.** Quarterly obligations growth against reported revenue growth, pooled corr
0.11 in the same quarter, less at a lag. Booz Allen 0.66 and ICF 0.52 on four-quarter sums,
Parsons 0.48, KBR 0.49 in the same quarter, then nothing above 0.35. Obligations are lumpy (a year of funding lands in one
month, options on old awards count as new money), so quarter to quarter they say little about
revenue even where they are most of it.

**Earnings day: nothing.** The obligations on record before the print (DoD actions 90 days old,
civilian 30 days old) against the same window a year earlier: 478 prints, the sign goes the
wrong way (t -0.4), both halves, small caps and primes alike.

**Award events: the market reads the record the day it is written.** 839 transactions at or
above 1% of market cap, excess return against the group:

| Bucket | Events | Award day | Day after | Open to close, day after | Drift 5d |
|---|---|---|---|---|---|
| all | 839 | +0.09% (t 0.8) | +0.08% (t 0.9) | +0.02% | -0.27% (t -1.4) |
| new awards | 164 | +0.43% (t 2.1) | -0.09% | -0.24% | +0.08% |
| modifications | 675 | +0.01% | +0.12% (t 1.4) | +0.08% | -0.35%
… (18775 more characters)
```

</details>

<details><summary>Result</summary>

````
=================== 18
# 18: the month-end Treasury rally

**Status:** run 2026-09-29 on public data only: the Treasury's daily par yield curve (1990 to
2026, Study 17's download) and the Treasury's auction record with maturities. Page:
<http://127.0.0.1:9194/app/5a9b0b39/> (`monitor.html`).

```bash
python fetch.py     # the auction record (the curve comes from 17-treasury-flies/data/)
python study.py     # a second
python build.py     # monitor.html
```

## What the data says

**Yields fall into every month-end, across the curve.** The last session of the month alone
averages -1.3 to -1.5bp (t about -5); the two before it add another -0.4 to -0.7bp. Across all
sessions the 10-year moves -0.03bp a day.

**The rule: long duration for the last 3 sessions of every month**, in at the close three
sessions before the month's last, out at its close, 0.3bp a round trip in futures:

| Tenor | bp a trade | t | Hit | bp a year | Sharpe | Worst | Years positive | To 2007 | From 2008 | Since 2025 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2-year | 2.22 | 5.1 | 60% | 26.7 | 0.85 | | 27 of 37 | 2.25 | 2.20 | 0.45 |
| 5-year | 2.53 | 5.3 | 61% | 30.3 | 0.87 | -29 | 28 of 37 | 2.13 | 2.91 | 1.70 |
| 10-year | 2.02 | 4.5 | 59% | 24.2 | 0.73 | -28 | 28 of 37 | 1.82 | 2.21 | 0.70 |
| 30-year | 2.02 | 4.6 | 61% | 24.2 | 0.80 | -32 | 26 of 34 | 2.22 | 1.87 | -0.60 |

It holds in both halves, in every five-year block through 2024, and without the largest 5% of
months (10-year 1.67bp, t 4.2). The window hardly matters (2 to 5 sessions all give t near 4);
holding into the next month makes it worse, so the exit is the month's last close.

**Why: not any flow the public record shows.** Month-end maturities (cash to reinvest), the
duration issued during the month (what the indices add at month-end), refunding months and
quarter-ends: each ranked against its own previous 36 months, none moves the result (the
largest, issuance, is +0.9bp high against low, t 0.9). Checked separately against the S&P 500
(the cached Bloomberg history, so not in this study): the rally is the same size after up and
down months for stocks, so it is not pension rebalancing. It is not the curve's construction
either: the 10 and 30-year settle mid-month and rally just the same. What is left is plain
month-end demand for duration.

**The weak spot is now.** Since January 2025 the 10-year averages 0.70bp a trade and the 30-year
-0.60bp over 21 month-ends, with Jun
… (9396 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Print heads of READMEs 22-24_

```bash
cd C:/repos/trading-strategies_v2 && for d in 22 23 24; do echo "=================== $d"; head -90 $d-*/README.md; done
```

</details>

<details><summary>Result</summary>

````
=================== 22
# Study 22: Treasury butterflies, rebuilt to a desk standard

**Verdict: no edge.** Rebuilt the way a rates RV desk would hold it, Treasury butterfly relative
value earns nothing out of sample. Study 17's two "working" flies were a level-and-slope bet plus
the Treasury's own curve-fitting noise. A curvature carry trade that looked good on the way turned
out to be an artifact of how roll-down was estimated, and on the Fed's smooth fitted curve both
reversion and carry lose.

```bash
python ../17-treasury-flies/fetch.py   # the Treasury's par curve, 1990 on (Study 17's data/)
python fetch.py                        # the Fed's fitted curve (Gurkaynak, Sack and Wright), 1961 on
python study.py                        # about 3 minutes; viewer/results.json
```

Public data only, no Bloomberg. It needs numpy and pandas. On this network, downloads need the
Windows certificate store, because a TLS-inspecting proxy re-signs fiscaldata.treasury.gov and
others: run the fetch scripts with `truststore.inject_into_ssl()` first, never with verification
off.

## What changed from Study 17

Study 17 found that 1s2s3s and 5s7s10s reverted after costs (Sharpe 0.44 and 0.45). It left five
things open, and this study closes each one.

1. **Weights.** A 1:2:1 fly keeps level and slope exposure. Here every fly is PCA-hedged ex ante:
   the third principal component of the legs' daily changes over the trailing 504 sessions,
   refitted each month from data before it, with the belly at 1 of DV01.
2. **Carry and roll-down.** Every leg earns carry over the 3-month bill and roll-down along the
   day's curve, so a trade that fights carry pays for it.
3. **Legs that were issued.** A maturity is used only while Treasury was issuing it: no 1-year
   bill 2001-2008, no 3-year 1998-2003, no 7-year 1993-2009, no 20-year before 2020, no 30-year
   2002-2006. A relaxed run allows those gaps as old bonds at double cost.
4. **Parameters chosen walk-forward.** 27 variants (lookback 126/252/504, entry z 1.5/2.0/2.5,
   hold 20/60/120). Each year uses the variant with the best Sharpe on the years before it.
5. **The book, not the best fly.** All flies at equal risk, each trade sized to the fly's trailing
   daily volatility. Costs are 0.5bp a leg round trip (1bp at 20 and 30 years), about 2bp a fly in
   Study 17's units, and everything is re-run at double cost.

Signals at one close trade at the next. Sharpe is annualised from monthly P&L, Study 17's
definition; t-statistic
… (13762 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Print heads of READMEs 25-27_

```bash
cd C:/repos/trading-strategies_v2 && for d in 25 26 27; do echo "=================== $d"; head -70 $d-*/README.md; done
```

</details>

<details><summary>Result</summary>

````
=================== 25
# Study 25: machine learning on the cross-section of Treasury curve trades

**Verdict: no.** Across eleven curve trades on the Fed's fitted curve, a ridge model, a
gradient-boosted tree model and their blend rank next month's winners no better than chance: an
information coefficient of 0.01 (t 0.4 to 0.6), a gross Sharpe of 0.08 to 0.09, and -0.69 to -1.12
after costs. They lose to the plain momentum rule even before costs, and after costs every book
here loses money, the three simple rules included. An elastic net, added after that first run,
keeps no feature at all in 15 of its 27 yearly fits and otherwise little more than 12-month
momentum. It loses the least (-0.20, t -0.9) only because it holds no position in 180 of the 319
months, and it changes nothing (see [Elastic net](#elastic-net-added-after-the-first-run)).

```bash
python study.py     # about 30 seconds; reads Study 22's and Study 17's data/; writes viewer/results.json
```

Public data only, no Bloomberg. It needs numpy, pandas and scikit-learn, and the shared harness
`common/ml.py`. The data comes from `22-treasury-rv-pca/fetch.py` (the Fed's fitted curve) and
`17-treasury-flies/fetch.py` (the Treasury's 3-month bill and the VIX).

## The test

The research pitch says machine learning is used where it adds measurable value, with simpler
econometric rules as the check against overfitting. This study applies that check to curve
relative value, the family of Studies 17 and 22. The whole protocol is in the `study.py`
docstring, written before the first run and not changed after it.

**Instruments.** Eleven DV01-weighted packages of constant-maturity zeros on the Fed's fitted
curve (Gurkaynak, Sack and Wright), 1990 on:

- the seven PCA-hedged flies of Study 22 Part C: 2s3s5s, 3s5s7s, 5s7s10s, 7s10s20s, 10s20s30s,
  2s5s10s and 5s10s30s. The weights are the third principal component of the legs' daily changes
  over the 504 sessions to each month-end, with +1 DV01 on the belly.
- four DV01-neutral steepeners: 2s10s, 5s30s, 2s5s and 10s30s (long the short leg, short the long
  leg).

On this curve carry and roll are exact: a constant-maturity zero earns its forward rate over the
bill, (f(T) - r) x dt / T in bp of yield per unit of duration.

**Target.** Each package's P&L over the next month (yield change plus exact carry and roll),
divided by its trailing monthly volatility (252-day daily vol x sqrt(21)).

**Timing.** Predictions are made at each month-end close. The trade i
… (11502 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Find study 27 universe and read 28-29 heads_

```bash
cd C:/repos/trading-strategies_v2 && grep -n -i -E "TICKERS|UNIVERSE|SECTOR|= \[|= \{" 27-ml-equity-xs/study.py | head -40; for d in 28 29; do echo "=================== $d"; head -60 $d-*/README.md; done
```

</details>

<details><summary>Result</summary>

```
20:Universe (survivorship caveat)
27:    are about this universe, not the US market.
42:    sect1m    the stock's sector ETF's return over the 21 sessions to t. Mapping: airlines JETS,
124:    Precious Metals (now Gold.com), a bullion dealer. The universe was meant to hold Barrick, a gold
125:    miner mapped to GDX, and the database has no Barrick series, so GOLD is dropped. The universe
177:SECTOR_ETF = {
190:    "SPY": ["AMZN", "GOOGL", "META"],      # no obvious sector ETF on disk: the market stands in
192:ETF_OF = {s: e for e, names in SECTOR_ETF.items() for s in names}
194:FEATURES = ["r1w", "mom1m", "mom3m", "mom6m", "mom12_1", "vol1m", "beta1y", "dist52w", "sect1m",
196:FEATURE_TIMING = {
205:    "sect1m": "sector ETF (SPY for AMZN, GOOGL, META), 21 sessions to t",
209:BASELINES = {"reversal_1w": ("r1w", -1.0), "momentum_12_1": ("mom12_1", 1.0)}
211:ADDED_MODELS = ["enet", "blend3"]         # added after the first run
212:MODEL_ORDER = ["ridge", "gbm", "blend", "reversal_1w", "momentum_12_1"] + ADDED_MODELS
215:SUBPERIODS = [("2019-2020", "2019-01-01", "2020-12-31"), ("2021-2022", "2021-01-01", "2022-12-31"),
224:    names = STOCKS + sorted(set(SECTOR_ETF)) + ["VIX"]
225:    raw = {}
232:    gaps = {t: int(len(cal.difference(raw[t].index)) - (cal < raw[t].index[0]).sum()) for t in names}
242:    daily = {
257:    rows = []
329:    res = {}
334:        row = {
346:            row["subperiods"][name] = {"sharpe": sp.get("sharpe"), "nw_t": sp.get("nw_t"),
350:        row["by_year_at_10vol"] = {str(y): round(float(v * scale), 4) for y, v in mo.groupby(mo.index.year).sum().items()}
351:        row["cum_net_at_10vol"] = {str(k.date())[:7]: round(float(v), 4) for k, v in (mo * scale).cumsum().items()}
356:        row["spy_hedged_ex_post"] = {"sharpe": hp.get("sharpe"), "nw_t": hp.get("nw_t"),
358:        row["gross_exposure_by_year"] = {str(y): round(float(v), 3)
361:        row["median_distinct_preds_by_year"] = {str(y): float(v) for y, v in nun.groupby(nun.index.year).median().items()}
364:        row["spy_hedged_ex_ante"] = {"mean_book_beta": round(float(b["beta_ex_ante"].mean()), 3),
370:            row["minus_momentum"] = {"raw": {"sharpe": raw.get("sharpe"), "nw_t": raw.get("nw_t")},
378:    out = {}
385:        out[str(y)] = {"train_rows": int(len(tr)), "iterations": int(est[-1].n_iter_),
396:    out = {}
404:        coef = {f: round(float(c), 8) + 0.0 for f, c in zip(FEATURES, e.coef_)}
405:        out[str(y)] = {"train_rows": int(len(tr)), "alpha
… (8457 more characters)
```

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Get study 27 stocks and study 29 equity calendar sleeve rule_

```bash
cd C:/repos/trading-strategies_v2 && sed -n 160,192p 27-ml-equity-xs/study.py; grep -n -i -E "calendar|turn of the month|pre-holiday|halloween|FOMC" 29-macro-book/README.md | head -30; head -40 29-macro-book/sleeve_calendar.py
```

</details>

<details><summary>Result</summary>

```
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(REPO, "common"))
import ml  # noqa: E402

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
# ml.ic_stats on a date where the GBM gives every name the same prediction: the IC is undefined
# there and ic_stats drops it; the warning is expected.
warnings.filterwarnings("ignore", message="An input array is constant")

DB = r"C:\repos\equity-pairs-trading\data\local.db"
OUT = os.path.join(HERE, "viewer", "results.json")

SECTOR_ETF = {
    "JETS": ["AAL", "DAL", "LUV", "UAL"],
    # GOLD removed in the audit: local.db's "GOLD US Equity" series is not Barrick Gold (see the
    # docstring, "Audit fix"). Its price path fits A-Mark Precious Metals (now Gold.com).
    "GDX": ["AEM", "KGC", "NEM"],
    "SOXX": ["AMD", "AVGO", "INTC", "NVDA", "QCOM"],
    "XLF": ["BAC", "C", "GS", "JPM", "WFC"],
    "XLE": ["COP", "CVX", "EOG", "SLB", "XOM"],
    "XLU": ["AEP", "DUK", "NEE", "SO"],
    "XPH": ["ABBV", "BMY", "JNJ", "MRK", "PFE"],
    "XRT": ["COST", "KR", "TGT", "WMT"],
    "XTN": ["FDX", "JBHT", "ODFL", "UPS"],
    "XLK": ["AAPL", "MSFT"],
    "SPY": ["AMZN", "GOOGL", "META"],      # no obvious sector ETF on disk: the market stands in
}
ETF_OF = {s: e for e, names in SECTOR_ETF.items() for s in names}
9:calendar of Studies 18, 20 and 21. Without that family the book earns 0.28 since 2010 and -0.04
11:and the equity calendar) earn 0.92 together over 1996-2026 but 0.43 since 2010 and 0.00 since 2020.
40:| S&P 500 calendar timing | 1983-07 to 2026-08 | 0.61 (4.46) | 0.56 | 0.52 | -29.1 |
42:| s21 Treasury calendar (Study 21) | 1993-01 to 2026-08 | 1.00 (5.68) | 0.84 | 1.29 | -26.9 |
80:| S&P 500 total return and bills | Yahoo, S&P's total return index, Shiller dividends, FRED | calendar, book benchmarks |
82:| FOMC, payroll and CPI dates | the Fed's FOMC pages, ALFRED release dates | calendar, s21 |
173:## Sleeve 4: S&P 500 calendar timing
175:**Rule.** Long S&P 500 futures on the turn of the month (the last session and the first three of
176:the next; Lakonishok and Smidt 1988) and in the even weeks of the FOMC cycle (Cieslak, Morse and
186:all 18 placebo calendars built the same way (median 0.23), so the timing did carry information in
190:day on the days held less the other days, before and after publication: turn of the month
191:16.2bp and 4.34b
… (4672 more characters)
```

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Read study 29 sleeves and 30-31 heads_

```bash
cd C:/repos/trading-strategies_v2 && sed -n 100,200p 29-macro-book/README.md; for d in 30 31; do echo "=================== $d"; head -50 $d-*/README.md; done
```

</details>

<details><summary>Result</summary>

```
2022 (compounded). Bonds supply 40% of the gross P&L, FX 29%, equities 23%, commodities 8%.

**After publication.** From 2012-06, after the paper appeared: 0.32 (t 1.28). Against 500
random-sign books built the same way, its gross Sharpe since then sits at the 91.8th
percentile: not distinguishable from noise. AQR's managed-futures fund (AQMIX) earned 0.34 net of
fees from 2010-02 (this sleeve 0.39 over the same months), correlation 0.67.

**Variants** (net Sharpe; since 2012-06): 12-month return over volatility instead of its sign
0.71; 0.35. Blend of 1, 3 and 12 months (Hurst, Ooi and Pedersen 2017) 0.75; 0.10. Bonds alone
0.63; 0.40. FX alone 0.42; -0.09. Equities alone 0.41; 0.25. Commodities alone
(from 2008-11) 0.30; 0.21. Every signal one month later 0.49; 0.14. The long-only
book with the same sizing earns 0.40, and trend's alpha over it is 7.5% a year (t 5.27).

**Verdict.** The strongest sleeve here whose rule was not found on this data, and the one that
pays in crises. Its record since publication (0.32) is what to expect, and it is not yet proven.

## Sleeve 2: G10 FX carry, momentum and value

**Rule.** Nine currencies against the dollar (EUR, DEM before 1999, JPY, GBP, CHF, CAD, AUD, NZD,
SEK, NOK) as one-month forwards. Three dollar-neutral cross-sectional books at equal risk: carry,
the 3-month interest differential (Lustig and Verdelhan 2007; Koijen, Moskowitz, Pedersen and Vrugt
2018); momentum, the 12-month forward return skipping the latest month (Menkhoff, Sarno, Schmeling
and Schrimpf 2012); and value, the 5-year change in the real exchange rate (Asness, Moskowitz and
Pedersen 2013). Demeaned ranks, each divided by the currency's volatility. Signal at the month-end
fixing, trade at the next; 2bp per unit of turnover.

**Result.** 1982-08 to 2026-08: Sharpe 0.43 (t 2.79), 0.40 at double cost, maximum drawdown
-30.9%, skew -1.24. By decade: 0.79 in the 1990s, 0.94 in the 2000s, 0.07 in the 2010s and 0.19 since 2020. It
earned 0.60 up to 2008 and 0.14 from 2009. Correlation 0.22 with the S&P 500 and -0.14 with the US 10-year. It made
+51.5% in 2002 at up to 7.5x gross notional; without that year the Sharpe is 0.34.

**After publication.** 0.10 after Asness, Moskowitz and Pedersen (from 2013-07), and 0.09 after Lustig and
Verdelhan (from 2007-04). The noise band of 200 placebo books over the 158 months after AMP
is -0.45 to +0.34, so the recent record is noise. Each signal after its own paper: carry
0.12, momentum 0.05, value -0.23.

**Ch
… (10748 more characters)
```

</details>

**Claude:**

Now the remote-only studies 32-35.

<details><summary>Tool: <code>Bash</code></summary>

_List remote study files and read study 33 README_

```bash
cd C:/repos/trading-strategies_v2 && git ls-tree -r --name-only origin/main -- 32-trucking 33-market-short-interest 34-housing-shorts 35-peer-shocks; echo ======33; git show origin/main:33-market-short-interest/README.md | head -120
```

</details>

<details><summary>Result</summary>

````
32-trucking/README.md
32-trucking/build.py
32-trucking/fetch.py
32-trucking/fetch_short.py
32-trucking/study.py
32-trucking/viewer/template.html
33-market-short-interest/README.md
33-market-short-interest/build.py
33-market-short-interest/fetch.py
33-market-short-interest/fetch_fundamentals.py
33-market-short-interest/screen.py
33-market-short-interest/study.py
33-market-short-interest/viewer/template.html
34-housing-shorts/README.md
34-housing-shorts/build.py
34-housing-shorts/fetch.py
34-housing-shorts/study.py
34-housing-shorts/viewer/template.html
35-peer-shocks/README.md
35-peer-shocks/build.py
35-peer-shocks/fetch.py
35-peer-shocks/study.py
35-peer-shocks/viewer/template.html
======33
# 33: short interest across every listed stock, against this year

**Status:** snapshot run 2026-10-02 on public data only: FINRA's consolidated short interest for
every listed symbol on four settlement dates (2026-09-15, 2026-08-31, 2025-12-31, 2025-09-15),
Nasdaq's screener for names, sectors and market caps, Yahoo prices from August 2025, SEC share
counts. Page: <http://127.0.0.1:9194/app/2fb1265e/> (`monitor.html`).

```bash
python fetch.py     # builds data/public.db at the repo root (97 MB; about 12 minutes; resumable)
python fetch_fundamentals.py   # SEC frames, about 270 calls, 5 minutes
python study.py
python build.py
```

## The store

`data/public.db` is a public-data SQLite store, separate from the Bloomberg cache: 7,073 listed
securities (5,323 common stocks after dropping ETFs, warrants, units, preferreds, notes and
funds), 22,500 symbols of short interest per settlement date, share counts for 4,400 filers, and
a year of dividend-adjusted daily prices for every common stock. `fetch.py` skips what is there
and can be extended to every settlement date since April 2020 (about 2.5M rows, 200 MB) when the
full history is wanted.

## What the data says

Statistics use the 3,798 common stocks with a market cap of $50M or more, a price of $1 or more,
short interest and a YTD return. Short % = shares short over the listing's shares outstanding.

**Where it is.** The median stock is 4.4% short (mean 6.1%, 90th percentile 13.5%, 18% of names
above 10%), up from 3.2% at the start of the year and 2.9% a year ago. Shorts live in the small
and mid caps: medians 5.4% ($300M to $2B) and 6.1% ($2B to $10B) against 3.0% for large caps,
where only 3% of names are above 10% short. By sector, health care (6.8%) and technology (5.4%)
carry the most, finance (3.1%) the least.

**
… (4011 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Read study 32 and 34 READMEs from remote_

```bash
cd C:/repos/trading-strategies_v2 && echo =====32; git show origin/main:32-trucking/README.md; echo =====34; git show origin/main:34-housing-shorts/README.md
```

</details>

<details><summary>Result</summary>

````
=====32
# 32: trucking, from diesel, freight rates and the carriers' own filings

**Status:** run 2026-10-02 on public data only: dividend-adjusted prices for 32 names (Yahoo), the
DOE weekly diesel price (EIA), BLS producer prices for truckload and LTL freight, the BTS freight
index, quarterly SEC filings for 23 carriers and FINRA short interest. Page: <http://127.0.0.1:9194/app/a9713d9a/> (`monitor.html`).

```bash
python fetch.py     # about 3 minutes: prices, diesel, PPI, TSI, filings
python fetch_short.py   # FINRA short interest since 2020
python study.py
python build.py
```

## The question

Diesel hit a record $6.53 on 2026-09-21 (up 54% on the year), sixteen trucking companies went
bankrupt in a month, and the Bloomberg assistant listed 21 public trucking names with their
returns. The question is who gains and who loses among the listed names, and what happened to
each kind of carrier after the past diesel spikes.

**Groups:** truckload asset-based carriers (KNX, WERN, HTLD, MRTN, SNDR, PAMT, CVLG), LTL (ODFL,
SAIA, ARCB, XPO, TFII, FedEx Freight since May 2026), asset-light brokers and intermodal (JBHT,
CHRW, RXO, LSTR, HUBG, FWRD, ULH), equipment (PCAR, CMI, WNC, ALSN), small listings (PAL, TOPP)
and two that failed (Celadon to its 2019 bankruptcy, Roadrunner to its 2020 delisting).

## What the data says

**A. The squeeze comes after the diesel print and lasts a month.** Fuel surcharges reset weekly
off the DOE price, with a lag. Per +1% weekly rise in diesel, truckload carriers' excess return
over SPY is -4bp in the same week (t -0.7), **-10bp the week after** (t -2.2) and **-35bp over the
next four weeks** (t -2.5). LTL, asset-light and equipment show nothing significant. So the market
does not price the squeeze on the day; the stocks drift for a month.

**B. The past spikes were not kind to truckload a year out.** Eight spikes since 2003 (a 13-week
rise of 20%+ at a two-year high): 2003-03, 2004-10, 2005-10, 2008-04, 2011-04, 2021-03, 2022-05
and 2026-03. Excess return over SPY in the following year: truckload -4% on average, positive in 3
of 7; LTL +9%, positive in 6 of 7; asset-light +10%, positive in 6 of 7. The spread is wide (2011:
truckload -30%; 2008: equipment -59% with SPY -48%). This spike is different so far: truckload
+32% over SPY in the first 13 weeks and +12% at 26, LTL +25% then -2%, asset-light +6% then -6%.
Past spikes mostly saw the asset-based carriers fall first.

**C. Freight rates.** Truckload PPI is +13% year on year 
… (15133 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Read study 35 README from remote_

```bash
cd C:/repos/trading-strategies_v2 && git show origin/main:35-peer-shocks/README.md
```

</details>

<details><summary>Result</summary>

````
# 35: peer groups, correlation and downside shocks

**Status:** run 2026-10-05 on public data only (Yahoo prices to 2026-10-02). 147 names in 43 groups of
close peers, 1995 to date. Page: `monitor.html` (not yet registered with the gateway).

```bash
python fetch.py     # about 3 minutes
python study.py     # about 30 seconds
python build.py
```

## The question

Close peers drift apart in normal times. The claim: when the group is shocked down, they fall
together and the gap between them closes. The leader catches down to the pack. Is that true across
peer groups in general, is it more than beta, and is any of it a trade?

**Groups** (`fetch.py`): credit bureaus, rating agencies, card networks, exchanges, asset managers,
money-centre banks, brokers, regional banks, consumer lenders, mortgage insurers, life and P&C
insurers, managed care, drug distributors, railroads, truckload, parcel, airlines, cruise lines,
hotels, casinos, US automakers, homebuilders, home improvement, dollar stores, big-box retail,
tobacco, soft drinks, oil majors, E&Ps, oilfield services, refiners, steel, copper, chip equipment,
memory, payroll, defence, towers, waste, telecoms, utilities and staffing. Two to six names each.

**Definitions.** A *down-shock* is the group's 10-day return at -2 standard deviations or worse,
against its trailing one-year volatility measured before the window, one per 40 sessions per group:
1,471 of them, and 1,691 up-shocks. *The gap* is how far each name has pulled away from its group:
its 60-day return less the group's, measured before the window. *Share of the gap closed* is minus
the slope of the window's returns on that gap across the group: 100% means the leader and the
laggard ended level, negative means further apart. *After beta* takes out each name's beta to the
group times the group's move first. t-statistics cluster by calendar month.

## What the data says

**A. Peers do move together in a shock, but no more than in a rally.** Average 20-day correlation
of peers goes from 0.62 before a down-shock to 0.70 just after, against 0.63 on ordinary dates and a
peak of 0.66 around up-shocks. In the tails, though, the two directions look the same: peers'
correlation on days both are in their worst 10% averages 0.555, and 0.547 on days both are in their
best 10%. Down beats up in 26 of 43 groups (t 0.8). Both are about double what a normal distribution
gives (0.28), so the common shocks are fat-tailed in both directions.

**B. The gap does not close in
… (4196 more characters)
````

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Extract peer group ticker lists from study 35_

```bash
cd C:/repos/trading-strategies_v2 && git show origin/main:35-peer-shocks/fetch.py | grep -n -E '^\s*"[a-z].*\[' | head -50
```

</details>

<details><summary>Result</summary>

```
(Bash completed with no output)
```

</details>

<details><summary>Tool: <code>Bash</code></summary>

_Show start of study 35 fetch script_

```bash
cd C:/repos/trading-strategies_v2 && git show origin/main:35-peer-shocks/fetch.py | sed -n 1,90p
```

</details>

<details><summary>Result</summary>

```
"""Pull the public data for Study 35: close peers, how they correlate and whether they converge when
the group is shocked down. No Bloomberg.

    python fetch.py            # about 3 minutes; prices are refreshed each run

Source: Yahoo Finance chart API, daily, split- and dividend-adjusted closes, full history
(query1.finance.yahoo.com), for the peer groups below and SPY. Saved as downloaded under
data/prices/ with URLs and times in data/sources.json.

The groups are tight peers: companies that sell the same thing to the same customers, so a shock to
one is news for the others. They are picked today, from names that still trade, which is the
survivorship bias the README describes. Experian trades in London (EXPN.L, pence); the group uses
its US ADR (EXPGY, dollars, US hours) so its days line up with Equifax and TransUnion, and EXPN.L
is kept for the chart.
"""

import datetime as dt
import json
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36", "Accept": "application/json,text/plain,*/*"}
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{t}?period1=0&period2=1900000000&interval=1d&events=div%2Csplit"

# group -> (label, tickers)
GROUPS = {
    "BUREAU": ("Credit bureaus", ["EFX", "TRU", "EXPGY"]),
    "RATING": ("Rating agencies", ["SPGI", "MCO"]),
    "CARDS": ("Card networks", ["V", "MA", "AXP"]),
    "EXCH": ("Exchanges", ["ICE", "CME", "NDAQ", "CBOE"]),
    "ASSET": ("Asset managers", ["BLK", "TROW", "BEN", "IVZ"]),
    "BANKS": ("Money-centre banks", ["JPM", "BAC", "C", "WFC"]),
    "BROKER": ("Investment banks and brokers", ["GS", "MS", "SCHW"]),
    "REGION": ("Regional banks", ["USB", "PNC", "TFC", "FITB", "KEY", "RF"]),
    "CONSUMER": ("Consumer lenders", ["SYF", "ALLY", "COF"]),
    "MI": ("Mortgage insurers", ["MTG", "RDN", "ESNT"]),
    "LIFE": ("Life insurers", ["MET", "PRU", "LNC", "PFG"]),
    "PC": ("Property and casualty insurers", ["TRV", "ALL", "PGR", "CB"]),
    "MANAGED": ("Managed care", ["UNH", "ELV", "CI", "HUM", "CNC", "MOH"]),
    "DISTRIB": ("Drug distributors", ["MCK", "CAH", "COR"]),
    "RAIL": ("Railroads", ["UNP", "CSX", "NSC", "CP", "CNI"]),
    "TRUCK": ("Truckload carriers", ["KNX", "WERN", "HTLD", "MRTN", "SNDR"]),
    "PARCEL": ("Parcel", ["UPS", "FDX"]),
    "AIR": ("Airlines", ["DAL", "UAL", "AAL", "LUV", "ALK"]),
    "CR
… (1965 more characters)
```

</details>

<details><summary>Tool: <code>SubagentHandback</code></summary>

```json
{
  "message": "I surveyed all 35 studies without modifying anything. Only a handful can be traded in cash equities or ETFs. Study 08 is the only one with a named, dated long/short stock book. Studies 01–08 have no README of their own; their write-ups are in the root README. Folder 03 holds the README's \"Study 03\" (FX correlation) and its first \"Study 04\" (stock correlation structure).\n\n| # | Asset class | Verdict (quoted) | Cash equity / ETF expression |\n|---|---|---|---|\n| 01 intraday continuation | Equity ETFs, single stocks | \"The answer is no. On clean data, an up open does not predict an up session.\" It also says \"The drift is entirely overnight.\" | Overnight-only SPY/QQQ: buy at close, sell at next open. Reported as a finding, not a tested rule. |\n| 02 vol spread / dispersion | Options-vol | Short correlation pays only when it is priced high: Q5 88% hit, Q1 loses 89%. \"Currently pointing the wrong way.\" | None that is faithful. |\n| 03 FX correlation | FX options | \"Priced almost exactly right.\" | None. |\n| 03 (README's 04) stock correlation structure | Single stocks | Descriptive. Tightest pairs: NSC/UNP, AMAT/LRCX, STX/WDC, MCO/SPGI, HD/LOW. | Pair candidates, never backtested. |\n| 04 vol reversion | Options-vol | \"Volatility reverts, price does not.\" | None for price. |\n| 05 bond RV | Treasuries | \"Trade the flies, read the spreads.\" Screen only. | No ETF can hold a butterfly. |\n| 06 CUSIP RV | Treasuries | A screen of 25 bond switches. | None. |\n| 07 vol forecast | SPX options plus ES | Short straddle with filter plus 85% put, Sharpe ~0.35–0.39. Paper trade opened 2026-09-25. | Not faithful. SVXY is only a loose stand-in. |\n| 08 rate beta | Single stocks | Book Sharpe 0.64 with the regime gate. The $10k account version: \"+3.3% a year, Sharpe 0.33\". | Exact book. Long RNR, SCHW, CB, MET, PGR; short CBRE, VNO, SLG, ARE, CWK. $1,000 each, rebalanced at month end, held while the real-rate-led regime is on. \"First run, 28 Sep 2026: regime on, book opened.\" |\n| 09 shippers | Single stocks | \"Not yet run\" (Bloomberg blocked). | Universe named in the README (e.g. SBLK, GNK, STNG, INSW; ETFs BDRY, BOAT). No rule. |\n| 10 small energy | Single stocks | Primer. | None. |\n| 11 aviation | Single stocks | Primer. | None. |\n| 12 casinos | Single stocks | \"Monthly long/short: nothing.\" The only edge is the sign of the state surprise before earnings, \"not a strategy on its own\". | 2-day trades around earnings in FLL, MCRI, BYD, RRR, PENN, hedged against the group. |\n| 13 gov contractors | Single stocks | \"Not a strategy.\" | None. |\n| 14 consumer web | — | Primer. | None. |\n| 15 biotech | — | Primer (XBI as benchmark). | None. |\n| 16 network signals | — | Primer. | None. |\n| 17 Treasury flies | Treasuries | 1s2s3s Sharpe 0.44 (study 22 later overturns this). | Not expressible. |\n| 18 Treasury month-end | Treasuries | \"Long duration for the last 3 sessions of every month.\" 5-year: Sharpe 0.87, hit 61%. \"The weak spot is now\" (since 2025). | Long IEI (5y), IEF (10y) or TLT (30y), 3 sessions a month. Direction matches, but ETF closes are not the par curve and the edge (~2bp) is thin. Fair for simulation. |\n| 19 VIX carry | VIX futures | \"Verdict: no.\" It is leveraged equity beta. | SVXY (0.5x short) or short VXX/VIXY. Faithful in direction, but the result is still no. |\n| 20 global month-end | Govt bonds | Five of six markets show the effect. \"The US stays the core trade.\" | IEF/TLT; Canada has no liquid US ETF. |\n| 21 Treasury calendar | 5-year futures | \"The best result so far that can actually be traded.\" Sharpe 1.02. | IEI. Long the last 3 sessions of the month. Long the session before, of and after each scheduled FOMC announcement. Short the 5 sessions before each 5-year and 10-year auction. Net position capped at one unit. |\n| 22 Treasury RV PCA | Treasuries | \"Verdict: no edge.\" | None. |\n| 23 ML EM FX | FX | \"Verdict: no.\" | CEW is not faithful. |\n| 24 ML Treasu
… (5248 more characters)
```

</details>

<details><summary>Result</summary>

```
{"success":true,"message":"Report delivered to your caller."}
```

</details>

