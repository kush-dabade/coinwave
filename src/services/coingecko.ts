/**
 * CoinGecko public API client.
 *
 * All responses are normalised: missing or malformed numbers become `null`,
 * never 0, so the UI can tell "unknown" apart from "zero".
 */

import { ApiError, fetchJson, num, positive, str, time } from "./http"

export { ApiError, describeError } from "./http"

const BASE = "https://api.coingecko.com/api/v3"

/** Keep roughly every nth point; sparklines do not need hourly resolution. */
function thin(values: number[], target: number) {
  if (values.length <= target) return values
  const step = (values.length - 1) / (target - 1)
  return Array.from({ length: target }, (_, i) => values[Math.round(i * step)])
}

// ---------------------------------------------------------------------------
// Markets

export type Asset = {
  id: string
  symbol: string
  name: string
  image: string | null
  rank: number | null
  price: number | null
  /** Percentage price changes over each period. */
  change1h: number | null
  change24h: number | null
  change7d: number | null
  change14d: number | null
  change30d: number | null
  change200d: number | null
  change1y: number | null
  /** Absolute USD price change over 24h. */
  priceChange24h: number | null
  marketCap: number | null
  /** Absolute USD change in market cap over 24h. */
  marketCapChange24h: number | null
  fdv: number | null
  volume24h: number | null
  high24h: number | null
  low24h: number | null
  circulatingSupply: number | null
  totalSupply: number | null
  maxSupply: number | null
  ath: number | null
  athChange: number | null
  athDate: number | null
  atl: number | null
  atlChange: number | null
  atlDate: number | null
  /** 7-day prices, oldest first; empty until a sparkline page is loaded. */
  sparkline: number[]
  lastUpdated: number | null
}

type RawMarket = Record<string, unknown> & {
  sparkline_in_7d?: { price?: unknown[] } | null
}

export function normalizeAsset(raw: RawMarket): Asset | null {
  const id = str(raw.id)
  if (!id) return null
  const sparkRaw = raw.sparkline_in_7d?.price
  const spark = Array.isArray(sparkRaw)
    ? sparkRaw.map(num).filter((v): v is number => v !== null)
    : []
  return {
    id,
    symbol: (str(raw.symbol) ?? "").toUpperCase(),
    name: str(raw.name) ?? id,
    image: str(raw.image),
    rank: positive(raw.market_cap_rank),
    price: num(raw.current_price),
    change1h: num(raw.price_change_percentage_1h_in_currency),
    change24h: num(
      raw.price_change_percentage_24h_in_currency ??
        raw.price_change_percentage_24h
    ),
    change7d: num(raw.price_change_percentage_7d_in_currency),
    change14d: num(raw.price_change_percentage_14d_in_currency),
    change30d: num(raw.price_change_percentage_30d_in_currency),
    change200d: num(raw.price_change_percentage_200d_in_currency),
    change1y: num(raw.price_change_percentage_1y_in_currency),
    priceChange24h: num(raw.price_change_24h),
    marketCap: positive(raw.market_cap),
    marketCapChange24h: num(raw.market_cap_change_24h),
    fdv: positive(raw.fully_diluted_valuation),
    volume24h: num(raw.total_volume),
    high24h: num(raw.high_24h),
    low24h: num(raw.low_24h),
    circulatingSupply: positive(raw.circulating_supply),
    totalSupply: positive(raw.total_supply),
    maxSupply: positive(raw.max_supply),
    ath: num(raw.ath),
    athChange: num(raw.ath_change_percentage),
    athDate: time(raw.ath_date),
    atl: num(raw.atl),
    atlChange: num(raw.atl_change_percentage),
    atlDate: time(raw.atl_date),
    sparkline: thin(spark, 56),
    lastUpdated: time(raw.last_updated),
  }
}

const CHANGES = "price_change_percentage=1h%2C24h%2C7d%2C14d%2C30d%2C200d%2C1y"
const MARKET_PARAMS = `vs_currency=usd&${CHANGES}&precision=full`

/** Size of the live market universe (one request, ~60 KB compressed). */
export const MARKET_UNIVERSE = 250

function assetsFrom(raw: unknown): Asset[] {
  if (!Array.isArray(raw))
    throw new ApiError("server", "Unexpected markets payload")
  return raw
    .map((r) => normalizeAsset(r as RawMarket))
    .filter((a): a is Asset => a !== null)
}

/** The 250 largest assets by market cap, without sparklines. */
export async function fetchUniverse(signal?: AbortSignal): Promise<Asset[]> {
  return assetsFrom(
    await fetchJson(
      `${BASE}/coins/markets?${MARKET_PARAMS}&order=market_cap_desc&per_page=${MARKET_UNIVERSE}&page=1&sparkline=false`,
      signal
    )
  )
}

/** 7-day sparklines for one page of 100 assets, keyed by id. */
export async function fetchSparklinePage(page: number, signal?: AbortSignal) {
  const assets = assetsFrom(
    await fetchJson(
      `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=true`,
      signal
    )
  )
  return Object.fromEntries(assets.map((a) => [a.id, a.sparkline])) as Record<
    string,
    number[]
  >
}

/** Specific assets by id: anything outside the top-250 universe. */
export async function fetchAssetsByIds(
  ids: string[],
  signal?: AbortSignal
): Promise<Asset[]> {
  if (ids.length === 0) return []
  const list = [...new Set(ids)].sort().slice(0, 250)
  return assetsFrom(
    await fetchJson(
      `${BASE}/coins/markets?${MARKET_PARAMS}&ids=${list.map(encodeURIComponent).join("%2C")}&per_page=250&sparkline=false`,
      signal
    )
  )
}

/** Assets in a CoinGecko category, largest first. */
export async function fetchCategoryAssets(
  category: string,
  signal?: AbortSignal
) {
  return assetsFrom(
    await fetchJson(
      `${BASE}/coins/markets?${MARKET_PARAMS}&category=${encodeURIComponent(category)}&order=market_cap_desc&per_page=250&page=1&sparkline=false`,
      signal
    )
  )
}

// ---------------------------------------------------------------------------
// Global market

export type GlobalMarket = {
  totalMarketCap: number | null
  totalVolume: number | null
  marketCapChange24h: number | null
  btcDominance: number | null
  ethDominance: number | null
  /** Market-cap share (%) by asset symbol, as reported by CoinGecko. */
  dominance: Record<string, number>
  activeAssets: number | null
  updatedAt: number | null
}

export async function fetchGlobal(signal?: AbortSignal): Promise<GlobalMarket> {
  const json = await fetchJson<{ data?: Record<string, unknown> }>(
    `${BASE}/global`,
    signal
  )
  const data = json.data ?? {}
  const pick = (field: string, key: string) =>
    num((data[field] as Record<string, unknown> | undefined)?.[key])
  const shares = (data.market_cap_percentage ?? {}) as Record<string, unknown>
  const dominance: Record<string, number> = {}
  for (const [k, v] of Object.entries(shares)) {
    const n = num(v)
    if (n !== null) dominance[k.toUpperCase()] = n
  }
  const updated = num(data.updated_at)
  return {
    totalMarketCap: pick("total_market_cap", "usd"),
    totalVolume: pick("total_volume", "usd"),
    marketCapChange24h: num(data.market_cap_change_percentage_24h_usd),
    btcDominance: pick("market_cap_percentage", "btc"),
    ethDominance: pick("market_cap_percentage", "eth"),
    dominance,
    activeAssets: num(data.active_cryptocurrencies),
    updatedAt: updated !== null ? updated * 1000 : null,
  }
}

// ---------------------------------------------------------------------------
// Categories (sectors / narratives, as classified by CoinGecko)

export type Category = {
  id: string
  name: string
  marketCap: number | null
  change24h: number | null
  volume24h: number | null
  top3: string[]
  updatedAt: number | null
}

export async function fetchCategories(
  signal?: AbortSignal
): Promise<Category[]> {
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/coins/categories`,
    signal
  )
  if (!Array.isArray(raw))
    throw new ApiError("server", "Unexpected categories payload")
  return raw
    .map((c) => {
      const id = str(c.id)
      if (!id) return null
      return {
        id,
        name: str(c.name) ?? id,
        marketCap: positive(c.market_cap),
        change24h: num(c.market_cap_change_24h),
        volume24h: num(c.volume_24h),
        top3: Array.isArray(c.top_3_coins)
          ? c.top_3_coins.filter((u): u is string => typeof u === "string")
          : [],
        updatedAt: time(c.updated_at),
      }
    })
    .filter((c): c is Category => c !== null)
}

// ---------------------------------------------------------------------------
// Asset profile

export type AssetProfile = {
  id: string
  name: string
  symbol: string
  description: string
  categories: string[]
  genesisDate: string | null
  hashingAlgorithm: string | null
  links: { label: string; url: string }[]
  platforms: { chain: string; address: string }[]
  change60d: number | null
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function safeUrl(value: unknown): string | null {
  const s = str(value)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === "https:" || u.protocol === "http:"
      ? u.toString()
      : null
  } catch {
    return null
  }
}

export async function fetchAssetProfile(
  id: string,
  signal?: AbortSignal
): Promise<AssetProfile> {
  const raw = await fetchJson<Record<string, unknown>>(
    `${BASE}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
    signal
  )
  const links = (raw.links ?? {}) as Record<string, unknown>
  const first = (value: unknown) =>
    (Array.isArray(value)
      ? value.map(safeUrl).find(Boolean)
      : safeUrl(value)) ?? null
  const out: { label: string; url: string }[] = []
  const push = (label: string, url: string | null) =>
    url && out.push({ label, url })
  push("Website", first(links.homepage))
  push("Whitepaper", safeUrl(links.whitepaper))
  push("Explorer", first(links.blockchain_site))
  push(
    "Source code",
    first((links.repos_url as Record<string, unknown> | undefined)?.github)
  )
  push("Reddit", safeUrl(links.subreddit_url))
  const twitter = str(links.twitter_screen_name)
  if (twitter)
    push("X (Twitter)", `https://x.com/${encodeURIComponent(twitter)}`)

  const platforms = Object.entries(
    (raw.platforms ?? {}) as Record<string, unknown>
  )
    .map(([chain, address]) => ({ chain, address: str(address) ?? "" }))
    .filter((p) => p.chain && p.address)
  const md = (raw.market_data ?? {}) as Record<string, unknown>
  const description = str(
    (raw.description as Record<string, unknown> | undefined)?.en
  )

  return {
    id,
    name: str(raw.name) ?? id,
    symbol: (str(raw.symbol) ?? "").toUpperCase(),
    description: description ? stripHtml(description) : "",
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter(
          (c): c is string => typeof c === "string" && c.trim() !== ""
        )
      : [],
    genesisDate: str(raw.genesis_date),
    hashingAlgorithm: str(raw.hashing_algorithm),
    links: out,
    platforms,
    change60d: num(
      (
        md.price_change_percentage_60d_in_currency as
          | Record<string, unknown>
          | undefined
      )?.usd
    ),
  }
}

// ---------------------------------------------------------------------------
// Exchange tickers (where an asset trades, and how tightly)

export type Ticker = {
  exchange: string
  pair: string
  priceUsd: number | null
  volumeUsd: number | null
  spreadPct: number | null
  trust: "green" | "yellow" | "red" | null
  url: string | null
  stale: boolean
  lastTraded: number | null
}

export async function fetchTickers(
  id: string,
  signal?: AbortSignal
): Promise<Ticker[]> {
  const raw = await fetchJson<{ tickers?: Record<string, unknown>[] }>(
    `${BASE}/coins/${encodeURIComponent(id)}/tickers?order=volume_desc&include_exchange_logo=false`,
    signal
  )
  return (raw.tickers ?? []).map((t) => {
    const market = (t.market ?? {}) as Record<string, unknown>
    const trust = str(t.trust_score)
    return {
      exchange: str(market.name) ?? "Unknown",
      pair: `${str(t.base) ?? "?"}/${str(t.target) ?? "?"}`,
      priceUsd: num(
        (t.converted_last as Record<string, unknown> | undefined)?.usd
      ),
      volumeUsd: num(
        (t.converted_volume as Record<string, unknown> | undefined)?.usd
      ),
      spreadPct: num(t.bid_ask_spread_percentage),
      trust:
        trust === "green" || trust === "yellow" || trust === "red"
          ? trust
          : null,
      url: safeUrl(t.trade_url),
      stale: t.is_stale === true || t.is_anomaly === true,
      lastTraded: time(t.last_traded_at),
    }
  })
}

// ---------------------------------------------------------------------------
// Price history

export type HistoryRange = "1D" | "7D" | "30D" | "90D" | "1Y"

export const HISTORY_RANGES: {
  key: HistoryRange
  days: number
  label: string
}[] = [
  { key: "1D", days: 1, label: "24 hours" },
  { key: "7D", days: 7, label: "7 days" },
  { key: "30D", days: 30, label: "30 days" },
  { key: "90D", days: 90, label: "90 days" },
  { key: "1Y", days: 365, label: "1 year" },
]

export type PricePoint = { t: number; p: number }

function series(raw: unknown): PricePoint[] {
  const out: PricePoint[] = []
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!Array.isArray(entry)) continue
    const t = num(entry[0])
    const p = num(entry[1])
    if (t !== null && p !== null && p >= 0) out.push({ t, p })
  }
  return out.sort((a, b) => a.t - b.t)
}

export async function fetchHistory(
  id: string,
  range: HistoryRange,
  signal?: AbortSignal
): Promise<PricePoint[]> {
  const days = HISTORY_RANGES.find((r) => r.key === range)?.days ?? 7
  const json = await fetchJson<{ prices?: unknown }>(
    `${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`,
    signal
  )
  return series(json.prices)
}

/** Daily closing prices for up to 365 days (fallback when Binance lacks a pair). */
export async function fetchDailyPrices(
  id: string,
  days = 365,
  signal?: AbortSignal
): Promise<PricePoint[]> {
  const json = await fetchJson<{ prices?: unknown }>(
    `${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    signal
  )
  return series(json.prices)
}

export type Candle = {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number | null
}

/**
 * CoinGecko OHLC (fallback when an asset has no Binance pair). Granularity is
 * fixed by CoinGecko: 30 min (1–2 days), 4 h (3–30 days), 4 days (31+ days),
 * and it carries no volume.
 */
export async function fetchCoinGeckoOHLC(
  id: string,
  days: number,
  signal?: AbortSignal
): Promise<Candle[]> {
  const raw = await fetchJson<unknown[]>(
    `${BASE}/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`,
    signal
  )
  const out: Candle[] = []
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!Array.isArray(row)) continue
    const [t, o, h, l, c] = row.map(num)
    if (t !== null && o !== null && h !== null && l !== null && c !== null) {
      out.push({ t, o, h, l, c, v: null })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

// ---------------------------------------------------------------------------
// Search (the whole CoinGecko catalogue)

export type SearchHit = {
  id: string
  name: string
  symbol: string
  rank: number | null
  thumb: string | null
}

export async function searchAssets(
  query: string,
  signal?: AbortSignal
): Promise<SearchHit[]> {
  const json = await fetchJson<{ coins?: Record<string, unknown>[] }>(
    `${BASE}/search?query=${encodeURIComponent(query)}`,
    signal
  )
  return (json.coins ?? [])
    .map((c) => {
      const id = str(c.id)
      if (!id) return null
      return {
        id,
        name: str(c.name) ?? id,
        symbol: (str(c.symbol) ?? "").toUpperCase(),
        rank: positive(c.market_cap_rank),
        thumb: str(c.large) ?? str(c.thumb),
      }
    })
    .filter((c): c is SearchHit => c !== null)
    .slice(0, 25)
}
