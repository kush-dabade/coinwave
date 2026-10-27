/**
 * Deterministic stand-ins for every external service CoinWave calls, used
 * only by the end-to-end tests. The market is synthetic (seeded random walks)
 * so journeys are repeatable and never depend on rate-limited public APIs.
 * Nothing here ships in the app bundle.
 */
import type { BrowserContext, Route } from "@playwright/test"

const DAY = 86_400_000
const HOUR = 3_600_000

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Spec = {
  id: string
  symbol: string
  name: string
  price: number
  supply: number
  categories: string[]
  /** Listed on Binance with a USDT pair. */
  binance: boolean
  vol: number
}

const SPECS: Spec[] = [
  {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    price: 68_000,
    supply: 19.8e6,
    categories: ["layer-1"],
    binance: true,
    vol: 0.03,
  },
  {
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    price: 3_400,
    supply: 120e6,
    categories: ["layer-1", "smart-contract-platform"],
    binance: true,
    vol: 0.035,
  },
  {
    id: "tether",
    symbol: "usdt",
    name: "Tether",
    price: 1,
    supply: 120e9,
    categories: ["stablecoins"],
    binance: false,
    vol: 0.0005,
  },
  {
    id: "solana",
    symbol: "sol",
    name: "Solana",
    price: 160,
    supply: 470e6,
    categories: ["layer-1", "smart-contract-platform"],
    binance: true,
    vol: 0.05,
  },
  {
    id: "binancecoin",
    symbol: "bnb",
    name: "BNB",
    price: 590,
    supply: 146e6,
    categories: ["layer-1"],
    binance: true,
    vol: 0.03,
  },
  {
    id: "usd-coin",
    symbol: "usdc",
    name: "USDC",
    price: 1,
    supply: 35e9,
    categories: ["stablecoins"],
    binance: true,
    vol: 0.0005,
  },
  {
    id: "ripple",
    symbol: "xrp",
    name: "XRP",
    price: 0.6,
    supply: 56e9,
    categories: ["layer-1"],
    binance: true,
    vol: 0.045,
  },
  {
    id: "dogecoin",
    symbol: "doge",
    name: "Dogecoin",
    price: 0.15,
    supply: 145e9,
    categories: ["meme-token"],
    binance: true,
    vol: 0.06,
  },
  {
    id: "cardano",
    symbol: "ada",
    name: "Cardano",
    price: 0.45,
    supply: 35e9,
    categories: ["layer-1", "smart-contract-platform"],
    binance: true,
    vol: 0.045,
  },
  {
    id: "avalanche-2",
    symbol: "avax",
    name: "Avalanche",
    price: 30,
    supply: 400e6,
    categories: ["layer-1", "smart-contract-platform"],
    binance: true,
    vol: 0.055,
  },
  {
    id: "chainlink",
    symbol: "link",
    name: "Chainlink",
    price: 15,
    supply: 600e6,
    categories: ["decentralized-finance-defi"],
    binance: true,
    vol: 0.05,
  },
  {
    id: "hyperliquid",
    symbol: "hype",
    name: "Hyperliquid",
    price: 25,
    supply: 330e6,
    categories: ["layer-1"],
    binance: false,
    vol: 0.06,
  },
  {
    id: "near",
    symbol: "near",
    name: "NEAR Protocol",
    price: 5,
    supply: 1.1e9,
    categories: ["layer-1", "smart-contract-platform"],
    binance: true,
    vol: 0.055,
  },
  {
    id: "uniswap",
    symbol: "uni",
    name: "Uniswap",
    price: 9,
    supply: 600e6,
    categories: ["decentralized-finance-defi"],
    binance: true,
    vol: 0.055,
  },
  {
    id: "dai",
    symbol: "dai",
    name: "Dai",
    price: 1,
    supply: 5e9,
    categories: ["stablecoins"],
    binance: false,
    vol: 0.0005,
  },
  {
    id: "aave",
    symbol: "aave",
    name: "Aave",
    price: 110,
    supply: 15e6,
    categories: ["decentralized-finance-defi"],
    binance: true,
    vol: 0.06,
  },
  {
    id: "pepe",
    symbol: "pepe",
    name: "Pepe",
    price: 0.00001,
    supply: 420e12,
    categories: ["meme-token"],
    binance: true,
    vol: 0.08,
  },
  ...Array.from({ length: 23 }, (_, i): Spec => {
    const n = String(i + 1).padStart(2, "0")
    return {
      id: `test-token-${n}`,
      symbol: `tt${n}`,
      name: `Test Token ${n}`,
      price: 0.5 + i * 0.7,
      supply: (40 - i) * 20e6,
      categories: [i % 2 ? "decentralized-finance-defi" : "gaming"],
      binance: i % 3 === 0,
      vol: 0.04 + (i % 5) * 0.01,
    }
  }),
]

/** Asset only reachable through search (outside the market universe). */
const REMOTE_ONLY = {
  id: "obscure-coin",
  symbol: "obs",
  name: "Obscure Coin",
  market_cap_rank: 1873,
}

const today = Math.floor(Date.now() / DAY) * DAY
const HISTORY_DAYS = 420

type Bar = { t: number; o: number; h: number; l: number; c: number; v: number }

/** Daily bars ending with today's still-forming bar, which closes at `price`. */
function dailyBars(spec: Spec, seed: number): Bar[] {
  const rand = rng(seed)
  const closes = [spec.price]
  for (let i = 1; i < HISTORY_DAYS; i++) {
    const shock = (rand() - 0.5) * 2 * spec.vol
    closes.unshift(
      Math.max(spec.price * 0.05, closes[0] / (1 + shock + 0.0004))
    )
  }
  if (spec.vol < 0.001)
    for (let i = 0; i < closes.length; i++)
      closes[i] = 1 + (rand() - 0.5) * 0.002
  closes[closes.length - 1] = spec.price
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1]
    const wiggle = 1 + rand() * spec.vol * 0.6
    return {
      t: today - (HISTORY_DAYS - 1 - i) * DAY,
      o,
      h: Math.max(o, c) * wiggle,
      l: Math.min(o, c) / wiggle,
      c,
      v: spec.price * spec.supply * (0.01 + rand() * 0.05),
    }
  })
}

const SERIES = new Map(SPECS.map((s, i) => [s.id, dailyBars(s, 1000 + i * 17)]))

function intradayBars(
  spec: Spec,
  stepMs: number,
  count: number,
  seed: number
): Bar[] {
  const rand = rng(seed)
  const closes = [spec.price]
  const v = spec.vol * Math.sqrt(stepMs / DAY)
  for (let i = 1; i < count; i++)
    closes.unshift(closes[0] / (1 + (rand() - 0.5) * 2 * v))
  const end = Math.floor(Date.now() / stepMs) * stepMs
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1]
    return {
      t: end - (count - 1 - i) * stepMs,
      o,
      h: Math.max(o, c) * (1 + v / 3),
      l: Math.min(o, c) * (1 - v / 3),
      c,
      v: spec.price * spec.supply * 0.0005 * (0.5 + rand()),
    }
  })
}

const pct = (now: number, then: number | undefined) =>
  then ? (now / then - 1) * 100 : null

function market(spec: Spec, rank: number, withSparkline: boolean) {
  const bars = SERIES.get(spec.id)!
  const closes = bars.map((b) => b.c)
  const at = (daysAgo: number) => closes[closes.length - 1 - daysAgo]
  const cap = spec.price * spec.supply
  const max = Math.max(...closes)
  const min = Math.min(...closes)
  const ath = max * 1.25
  return {
    id: spec.id,
    symbol: spec.symbol,
    name: spec.name,
    image: null,
    current_price: spec.price,
    market_cap: cap,
    market_cap_rank: rank,
    fully_diluted_valuation: cap * (spec.id.startsWith("test") ? 1.6 : 1.05),
    total_volume: bars[bars.length - 2].v,
    high_24h: spec.price * 1.02,
    low_24h: spec.price * 0.97,
    price_change_24h: spec.price - at(1),
    price_change_percentage_24h: pct(spec.price, at(1)),
    market_cap_change_24h: cap - at(1) * spec.supply,
    circulating_supply: spec.supply,
    total_supply: spec.supply * 1.05,
    max_supply: spec.id === "bitcoin" ? 21e6 : null,
    ath,
    ath_change_percentage: (spec.price / ath - 1) * 100,
    ath_date: new Date(today - 200 * DAY).toISOString(),
    atl: min * 0.6,
    atl_change_percentage: (spec.price / (min * 0.6) - 1) * 100,
    atl_date: new Date(today - 3000 * DAY).toISOString(),
    last_updated: new Date().toISOString(),
    price_change_percentage_1h_in_currency: ((rank * 7) % 11) / 10 - 0.5,
    price_change_percentage_24h_in_currency: pct(spec.price, at(1)),
    price_change_percentage_7d_in_currency: pct(spec.price, at(7)),
    price_change_percentage_14d_in_currency: pct(spec.price, at(14)),
    price_change_percentage_30d_in_currency: pct(spec.price, at(30)),
    price_change_percentage_200d_in_currency: pct(spec.price, at(200)),
    price_change_percentage_1y_in_currency: pct(spec.price, at(365)),
    ...(withSparkline
      ? {
          sparkline_in_7d: {
            price: intradayBars(spec, HOUR, 168, rank).map((b) => b.c),
          },
        }
      : {}),
  }
}

const ranked = [...SPECS].sort(
  (a, b) => b.price * b.supply - a.price * a.supply
)
const rankOf = new Map(ranked.map((s, i) => [s.id, i + 1]))
const markets = (specs: Spec[], spark = false) =>
  specs
    .map((s) => market(s, rankOf.get(s.id)!, spark))
    .sort((a, b) => a.market_cap_rank - b.market_cap_rank)

function coingecko(url: URL): unknown {
  const p = url.pathname.replace("/api/v3", "")
  const q = url.searchParams
  if (p === "/coins/markets") {
    const ids = q.get("ids")
    const category = q.get("category")
    const page = Number(q.get("page") ?? 1)
    const perPage = Number(q.get("per_page") ?? 100)
    let list = ranked
    if (ids) list = ranked.filter((s) => ids.split(",").includes(s.id))
    if (category) list = ranked.filter((s) => s.categories.includes(category))
    return markets(
      list.slice((page - 1) * perPage, page * perPage),
      q.get("sparkline") === "true"
    )
  }
  if (p === "/global") {
    const total = ranked.reduce((n, s) => n + s.price * s.supply, 0)
    const share = (id: string) => {
      const s = SPECS.find((x) => x.id === id)!
      return ((s.price * s.supply) / total) * 100
    }
    return {
      data: {
        active_cryptocurrencies: 17_000,
        total_market_cap: { usd: total },
        total_volume: { usd: total * 0.04 },
        market_cap_percentage: {
          btc: share("bitcoin"),
          eth: share("ethereum"),
          usdt: share("tether"),
          sol: share("solana"),
        },
        market_cap_change_percentage_24h_usd: 1.2,
        updated_at: Math.floor(Date.now() / 1000),
      },
    }
  }
  if (p === "/coins/categories") {
    const ids = [...new Set(SPECS.flatMap((s) => s.categories))]
    return ids.map((id, i) => {
      const members = ranked.filter((s) => s.categories.includes(id))
      return {
        id,
        name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        market_cap: members.reduce((n, s) => n + s.price * s.supply, 0),
        market_cap_change_24h: (i % 2 ? -1 : 1) * (1 + i * 0.7),
        volume_24h: members.reduce((n, s) => n + s.price * s.supply * 0.03, 0),
        top_3_coins: [],
        updated_at: new Date().toISOString(),
      }
    })
  }
  if (p === "/search") {
    const term = (q.get("query") ?? "").toLowerCase()
    const hits = [
      ...ranked.map((s) => ({
        id: s.id,
        name: s.name,
        symbol: s.symbol,
        market_cap_rank: rankOf.get(s.id),
      })),
      REMOTE_ONLY,
    ].filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.symbol.includes(term) ||
        c.id.includes(term)
    )
    return { coins: hits.map((c) => ({ ...c, thumb: null, large: null })) }
  }
  const coin = p.match(/^\/coins\/([^/]+)(\/[a-z_]+)?$/)
  if (!coin) return undefined
  const spec = SPECS.find((s) => s.id === coin[1])
  if (!spec) return null
  const bars = SERIES.get(spec.id)!
  const days = Number(q.get("days") ?? 7)
  switch (coin[2]) {
    case undefined:
      return {
        id: spec.id,
        symbol: spec.symbol,
        name: spec.name,
        categories: spec.categories.map((c) => c.replace(/-/g, " ")),
        description: {
          en: `<p>${spec.name} is a synthetic asset used by CoinWave’s automated tests.</p>`,
        },
        genesis_date: "2015-07-30",
        hashing_algorithm: null,
        links: {
          homepage: [`https://example.org/${spec.id}`],
          blockchain_site: [],
          repos_url: { github: [] },
          subreddit_url: null,
          twitter_screen_name: null,
          whitepaper: null,
        },
        platforms: {},
        market_data: {
          price_change_percentage_60d_in_currency: {
            usd: pct(spec.price, bars[bars.length - 61].c),
          },
        },
      }
    case "/tickers":
      return {
        tickers: ["Binance", "Coinbase Exchange", "Kraken"].map((name, i) => ({
          market: { name },
          base: spec.symbol.toUpperCase(),
          target: i === 1 ? "USD" : "USDT",
          converted_last: { usd: spec.price * (1 + (i - 1) * 0.0004) },
          converted_volume: {
            usd: spec.price * spec.supply * (0.01 / (i + 1)),
          },
          bid_ask_spread_percentage: 0.01 + i * 0.02,
          trust_score: "green",
          trade_url: null,
          is_stale: false,
          is_anomaly: false,
          last_traded_at: new Date().toISOString(),
        })),
      }
    case "/market_chart": {
      if (days <= 1)
        return {
          prices: intradayBars(spec, 5 * 60_000, 288, 7).map((b) => [b.t, b.c]),
        }
      if (days <= 90 && q.get("interval") !== "daily")
        return {
          prices: intradayBars(spec, HOUR, days * 24, 9).map((b) => [b.t, b.c]),
        }
      // Like CoinGecko: each 00:00 UTC point is the previous day's close,
      // followed by the current price.
      return {
        prices: [
          ...bars.slice(-days - 1, -1).map((b) => [b.t + DAY, b.c]),
          [Date.now(), spec.price],
        ],
      }
    }
    case "/ohlc": {
      const step = days <= 2 ? 30 * 60_000 : days <= 30 ? 4 * HOUR : 4 * DAY
      const count = Math.round((days * DAY) / step)
      return intradayBars(spec, step, count, 11).map((b) => [
        b.t,
        b.o,
        b.h,
        b.l,
        b.c,
      ])
    }
  }
  return undefined
}

const STEP: Record<string, number> = {
  "15m": 15 * 60_000,
  "1h": HOUR,
  "4h": 4 * HOUR,
  "1d": DAY,
  "1w": 7 * DAY,
}

function binance(url: URL): unknown {
  const p = url.pathname.replace("/api/v3", "")
  if (p === "/ticker/price") {
    return [
      ...SPECS.filter((s) => s.binance).map((s) => ({
        symbol: `${s.symbol.toUpperCase()}USDT`,
        price: String(s.price),
      })),
      { symbol: "BTCEUR", price: "62000" },
    ]
  }
  if (p === "/klines") {
    const pair = url.searchParams.get("symbol") ?? ""
    const spec = SPECS.find(
      (s) => s.binance && `${s.symbol.toUpperCase()}USDT` === pair
    )
    if (!spec) return null
    const interval = url.searchParams.get("interval") ?? "1d"
    const limit = Number(url.searchParams.get("limit") ?? 500)
    let bars: Bar[]
    if (interval === "1d") bars = SERIES.get(spec.id)!
    else if (interval === "1w") {
      const daily = SERIES.get(spec.id)!
      bars = []
      for (let i = daily.length % 7; i < daily.length; i += 7) {
        const w = daily.slice(i, i + 7)
        bars.push({
          t: w[0].t,
          o: w[0].o,
          h: Math.max(...w.map((b) => b.h)),
          l: Math.min(...w.map((b) => b.l)),
          c: w[w.length - 1].c,
          v: w.reduce((n, b) => n + b.v, 0),
        })
      }
    } else
      bars = intradayBars(
        spec,
        STEP[interval] ?? HOUR,
        Math.min(limit, 1000),
        5
      )
    return bars
      .slice(-limit)
      .map((b) => [
        b.t,
        String(b.o),
        String(b.h),
        String(b.l),
        String(b.c),
        "0",
        b.t + (STEP[interval] ?? DAY) - 1,
        String(b.v),
        100,
        "0",
        "0",
        "0",
      ])
  }
  return undefined
}

function fearGreed() {
  const rand = rng(42)
  const data = Array.from({ length: 365 }, (_, i) => {
    const value = Math.round(20 + rand() * 60)
    const label =
      value < 25
        ? "Extreme Fear"
        : value < 45
          ? "Fear"
          : value < 55
            ? "Neutral"
            : value < 75
              ? "Greed"
              : "Extreme Greed"
    return {
      value: String(value),
      value_classification: label,
      timestamp: String(Math.floor((today - i * DAY) / 1000)),
    }
  })
  return { name: "Fear and Greed Index", data }
}

const llama = (base: number, growth: number) =>
  Array.from({ length: 400 }, (_, i) => ({
    date: Math.floor((today - (399 - i) * DAY) / 1000),
    value: base * (1 + growth * (i / 400)),
  }))

function news() {
  const now = Date.now()
  const item = (
    n: number,
    title: string,
    source: string,
    sourceId: string,
    summary = ""
  ) => ({
    id: `n${n}`,
    title,
    link: `https://news.example.org/${sourceId}/${n}`,
    source,
    sourceId,
    publishedAt: now - n * 47 * 60_000,
    summary,
    categories: [],
    image: null,
  })
  return {
    fetchedAt: now,
    sources: [
      { id: "coindesk", name: "CoinDesk", ok: true, count: 3, error: null },
      { id: "decrypt", name: "Decrypt", ok: true, count: 2, error: null },
      {
        id: "theblock",
        name: "The Block",
        ok: false,
        count: 0,
        error: "HTTP 503",
      },
    ],
    items: [
      item(
        1,
        "Bitcoin climbs as ETF inflows return",
        "CoinDesk",
        "coindesk",
        "Spot bitcoin funds took in fresh capital this week."
      ),
      item(
        2,
        "Bitcoin climbs as ETF inflows return to US funds",
        "Decrypt",
        "decrypt"
      ),
      item(
        3,
        "Ethereum developers set date for next upgrade",
        "CoinDesk",
        "coindesk",
        "The hard fork targets validator efficiency."
      ),
      item(4, "Solana network activity hits a record", "Decrypt", "decrypt"),
      item(
        5,
        "Markets near a decision point, analysts say",
        "CoinDesk",
        "coindesk"
      ),
    ],
  }
}

export type MockOptions = {
  /** Make a service fail with HTTP 429 (rate limited). */
  rateLimit?: ("coingecko" | "binance" | "news")[]
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

export async function installMockApi(
  context: BrowserContext,
  options: MockOptions = {}
) {
  const limited = new Set(options.rateLimit ?? [])
  // Playwright runs the most recently registered matching route first, so
  // this catch-all (registered first) only sees requests nothing else
  // handles: no test may reach the real internet.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.abort()
  )
  await context.route(
    /^https:\/\/(api\.coingecko\.com|data-api\.binance\.vision|api\.alternative\.me|stablecoins\.llama\.fi|api\.llama\.fi)\//,
    (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === "api.coingecko.com") {
        if (limited.has("coingecko"))
          return route.fulfill({ status: 429, body: "" })
        const body = coingecko(url)
        return body === undefined
          ? json(route, { error: "not mocked" }, 404)
          : body === null
            ? json(route, { error: "coin not found" }, 404)
            : json(route, body)
      }
      if (url.hostname === "data-api.binance.vision") {
        if (limited.has("binance"))
          return route.fulfill({ status: 429, body: "" })
        const body = binance(url)
        return body === undefined || body === null
          ? json(route, { code: -1121, msg: "Invalid symbol." }, 400)
          : json(route, body)
      }
      if (url.hostname === "api.alternative.me") return json(route, fearGreed())
      if (url.hostname === "stablecoins.llama.fi")
        return json(
          route,
          llama(150e9, 0.2).map((d) => ({
            date: d.date,
            totalCirculatingUSD: { peggedUSD: d.value },
          }))
        )
      return json(
        route,
        llama(80e9, 0.4).map((d) => ({ date: d.date, tvl: d.value }))
      )
    }
  )
  await context.route("**/api/news", (route) =>
    limited.has("news")
      ? route.fulfill({ status: 503, body: "" })
      : json(route, news())
  )
}

export const MOCK = {
  bitcoinPrice: 68_000,
  ethereumPrice: 3_400,
  noBinanceAsset: "hyperliquid",
  remoteOnly: REMOTE_ONLY,
}
