# CoinWave

A local-first crypto market workstation: market intelligence, charting,
screening, research, portfolio analytics and decision support in one dark-first
interface.

CoinWave uses free public market data, labels where every number comes from,
and never fabricates data it doesn't have. Everything you create stays in your
own browser. There is no account and no server-side copy.

## Workspaces

| Route           | Workspace          | What it does                                                                                                                                                                                               |
| --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | **Command Center** | Customizable widgets: market pulse, majors, portfolio, watchlist, alerts, movers, research due for review, news, recently viewed, sectors and a market map.                                                |
| `/markets`      | **Markets**        | The top 250 by market cap, CoinGecko categories and your watchlists. Size tiers, stablecoin hiding, choosable columns and 7-day sparklines. All state lives in the URL. Search reaches every listed asset. |
| `/markets/:id`  | **Asset**          | Price history, performance vs Bitcoin, market facts, profile and links, venues and liquidity, related news, plus your position, watchlists, alerts, notes and theses for the asset.                        |
| `/screener`     | **Screener**       | Combine conditions on 22 real metrics, with presets and saved screens. An optional history scan adds 30-day highs and lows, a volume baseline and volatility from daily data.                              |
| `/chart`        | **Chart Studio**   | Genuine OHLCV candles, SMA, EMA, Bollinger bands, volume, RSI and MACD, percentage-mode comparison, log scale, full screen, saved layouts, and click-to-alert at a price.                                  |
| `/compare`      | **Compare**        | Normalized performance, return, volatility, drawdown, beta and a correlation matrix. Each statistic requires at least 30 observations.                                                                     |
| `/intelligence` | **Market regime**  | Breadth, dominance, Fear & Greed history, stablecoin supply and DeFi TVL, shown as individual transparent indicators rather than a single black-box score.                                                 |
| `/news`         | **News**           | Headlines from six publisher RSS feeds. Duplicates are grouped, assets tagged, items can be saved to research, and failing sources are reported.                                                           |
| `/portfolio`    | **Portfolio**      | Transaction ledger with fees. Holdings use average cost. Performance is rebuilt from your history (time-weighted), with drawdown, BTC/ETH benchmarks and attribution. CSV import and export.               |
| `/risk`         | **Risk Lab**       | Concentration, exposure, observed volatility, correlation and beta, plus user-defined scenarios. Observed values and scenarios are labelled as such.                                                       |
| `/watchlists`   | **Watchlists**     | Multiple lists with per-asset notes, reordering, a default list and alert shortcuts.                                                                                                                       |
| `/alerts`       | **Alerts**         | Price, % change, volume and portfolio-value alerts. Alerts are checked in the browser while CoinWave is open, with optional system notifications.                                                          |
| `/research`     | **Research**       | Markdown notes, saved articles, collections, tags, asset links and revision history.                                                                                                                       |
| `/journal`      | **Thesis journal** | Theses with assumptions, catalysts, risks, invalidation and review dates. Decisions record the price at the time so they can be reviewed later.                                                            |
| `/status`       | **Data status**    | Per-source health, latency, failures, rate limits, the query cache and a log of recent requests.                                                                                                           |
| `/settings`     | **Settings**       | Theme, refresh rate, market defaults, chart defaults, notifications, storage use, full backup export and import (merge or replace, with preview), and per-section reset.                                   |

Press `/` or `Ctrl K` / `⌘K` anywhere to search assets, pages, watchlists,
notes, theses, alerts, saved screens and actions. Press `G` then a letter to
jump to a workspace, or `?` to list all shortcuts. Shortcuts are ignored while
you type.

## Data sources

| Source                                                                | Used for                                                                                                  | Notes                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [CoinGecko public API](https://www.coingecko.com/en/api)              | Prices, market caps, volumes, % changes, categories, profiles, exchange tickers, search, fallback history | Keyless and heavily rate limited; history is limited to 365 days.                |
| [Binance public market data](https://data-api.binance.vision)         | OHLCV candles; daily closes for Compare, Risk Lab and portfolio history                                   | USDT pairs only, treated as a USD proxy and labelled that way.                   |
| [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) | Fear & Greed Index and its 1-year history                                                                 | Daily.                                                                           |
| [DefiLlama](https://defillama.com)                                    | Stablecoin supply, total DeFi TVL                                                                         | Daily.                                                                           |
| Publisher RSS feeds                                                   | News (CoinDesk, Cointelegraph, Decrypt, The Block, Bitcoin Magazine, CryptoSlate)                         | Fetched by the `/api/news` function, because RSS doesn't allow browser requests. |

No API keys are used, and none are shipped to the browser.

### Honesty rules

- **Unknown is never zero.** Missing values render as `—`, and unpriced holdings
  are named and excluded from totals rather than valued at $0.
- **Sources are named.** Chart Studio states whether candles are Binance OHLCV
  or coarser CoinGecko OHLC (no volume). Compare names the assets whose closes
  came from CoinGecko.
- **Binance pairs are verified.** Tickers aren't unique, so a Binance pair is
  accepted only when its price is within 3% of CoinGecko's.
- **Daily closes are aligned.** CoinGecko stamps each daily price at 00:00 UTC,
  which is the previous day's close. Those points are re-keyed so they line up
  with exchange daily candles, and the still-forming day is always dropped.
- **Not enough data means no number.** Volatility, correlation and beta require
  at least 30 observations. Screener conditions never pass an asset that is
  missing the value.
- **Observed, scenario and forecast are different things.** Risk Lab labels
  historical measurements as observed and user-defined shocks as scenarios.
  CoinGecko provides no forecasts, and CoinWave makes none.
- **No invented market structure.** CoinWave has no order books, funding rates,
  open interest, liquidations, on-chain flows or institutional data, because no
  free source provides them reliably. They are absent rather than simulated.
- **Freshness is visible.** The top bar shows data age. When a refresh fails,
  the last good data stays on screen, marked as delayed. A last-good snapshot in
  `localStorage` covers a rate-limited first load.

### Alerts are browser-only

Alerts are evaluated in the browser, only against data fetched after the alert
was created, and only while a CoinWave tab is open. With several tabs open, a
cross-tab lock makes sure each alert fires once. System notifications are
opt-in and use the browser's Notification API. Nothing is sent to an external
service.

## Portfolio accounting

- Assets are keyed by CoinGecko id, not by ticker.
- **Average cost.** Buy fees are added to cost basis, and sell fees are deducted
  from proceeds. Realised P&L is the net proceeds minus the average cost of
  the units sold.
- **Validation.** Sales are checked against the whole ledger, so you can't sell
  more than you held on a date. Edits and deletions that would leave a later
  sale short are blocked too.
- **History.** Performance is reconstructed from dated transactions and daily
  closes. It is time-weighted, so deposits and withdrawals don't count as
  returns. Holdings are valued at each day's close, and the move from a trade's
  price to that close counts as performance (including on the first day). Undated (migrated) transactions
  and assets without price history are listed as excluded, and no history is
  fabricated for them. Transfers between wallets are not modelled: record them
  as nothing, or as a sale and a purchase.
- A clearly labelled sample portfolio can be explored. It is never mixed with
  real data.

## Your data

Everything is stored in `localStorage`, validated on load, and synced across
tabs:

| Key                         | Contents                        |
| --------------------------- | ------------------------------- |
| `coinwave:portfolio:v2`     | Transactions                    |
| `coinwave:watchlists:v1`    | Watchlists and notes            |
| `coinwave:alerts:v1`        | Alerts and their history        |
| `coinwave:research:v1`      | Notes, collections, revisions   |
| `coinwave:journal:v1`       | Theses and journal entries      |
| `coinwave:screens:v1`       | Saved screens                   |
| `coinwave:chart-layouts:v1` | Chart layouts                   |
| `coinwave:settings:v1`      | Preferences                     |
| `coinwave:snapshot:*`       | Cached market data (disposable) |

Earlier versions' keys (`coinwave_holdings`, `coinwave_watchlist`) are migrated
on first load and left untouched.

**Settings → Your data** exports everything as one JSON backup. Importing a
backup shows a preview first. You can then merge, which skips duplicate
transactions and keeps the newer copy of each note or thesis, or replace
section by section. Every import and deletion can be undone straight away.
Portfolio transactions can also be exported and imported as CSV.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (includes the /api/news function)
npm run typecheck  # tsc -b: app, server/config and e2e projects
npm run lint
npm test           # Vitest unit tests
npm run test:e2e   # Playwright end-to-end tests (builds, then runs vite preview)
npm run build
npm run preview
```

The end-to-end suite runs every external API against a deterministic mock
(`e2e/mock-api.ts`), so it is repeatable and never touches the public APIs. It
needs Playwright's Chromium (`npx playwright install chromium`, if missing).

### Architecture

```
api/news.ts          Vercel function: GET /api/news (wraps server/news.ts)
server/              RSS parsing and news aggregation (shared with the Vite dev/preview middleware)
src/
  pages/             One code-split module per workspace
  components/
    layout/          App shell, navigation, command palette, data status
    charts/          lightweight-charts wrappers (StudioChart, LineChart)
    data/            Tables, sparklines, market map, price chart, states
    command/ asset/ alerts/ portfolio/ research/   Workspace building blocks
    ui/              Radix-based primitives (dialog, sheet, menu, tabs, controls)
  hooks/queries.ts   Typed data layer: TanStack Query, retries, snapshots, freshness
  services/          API clients that normalise every response; request telemetry
  stores/            Local-first persistent stores, and backup glue
  lib/               Pure logic with unit tests: accounting, history, indicators,
                     statistics, screener, risk, alerts, news tagging, markdown, backup
e2e/                 Playwright specs and the mock API
```

### Design system

Tokens live in `src/index.css`: a dark-first workstation palette (with a light
theme), one accent for interaction, green and red reserved for price movement,
and an amber warning colour. UI and figures use Geist, tickers use Geist Mono,
and Newsreader is used only for long-form writing surfaces. Chart series and
market-map colours were checked for contrast and colour-vision separation.

## Deployment

`vercel.json` serves `index.html` for every path except `/api/`, so deep links
work on refresh and `/api/news` runs as a serverless function. Any static host
works for the app itself. Without the news function, the News workspace says
it is unavailable, and the rest of the app is unaffected.

## Known limitations

- US dollars only. Binance data is quoted in USDT and used as a USD proxy.
- Free APIs mean rate limits, at most 365 days of CoinGecko history, and no
  order books, derivatives or on-chain data.
- Alerts only run while a tab is open. There is no server-side push.
- Data is per browser. Use the JSON backup to move it.
