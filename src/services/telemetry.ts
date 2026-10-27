import { useSyncExternalStore } from "react"

/**
 * In-memory record of every request CoinWave makes, per data source. Powers
 * the Data Status page so users can see which source is slow, failing or
 * rate limited instead of guessing from a blank panel.
 */

export type SourceId =
  | "coingecko"
  | "binance"
  | "alternative"
  | "defillama"
  | "news"

export const SOURCES: Record<
  SourceId,
  { name: string; url: string; purpose: string; limits: string }
> = {
  coingecko: {
    name: "CoinGecko public API",
    url: "https://www.coingecko.com/en/api",
    purpose:
      "Prices, market caps, volumes, % changes, categories, asset profiles, exchange tickers, search, fallback history.",
    limits:
      "Keyless and aggressively rate limited (a handful of calls per minute). History limited to 365 days.",
  },
  binance: {
    name: "Binance public market data",
    url: "https://data-api.binance.vision",
    purpose:
      "OHLCV candles for Chart Studio; daily closes for Compare, Risk Lab and portfolio history (USDT pairs).",
    limits:
      "Keyless, generous weight limits. Covers assets with a Binance USDT spot pair only; USDT is used as a USD proxy.",
  },
  alternative: {
    name: "Alternative.me Fear & Greed Index",
    url: "https://alternative.me/crypto/fear-and-greed-index/",
    purpose: "Daily sentiment index and its 1-year history.",
    limits: "Updated once a day.",
  },
  defillama: {
    name: "DefiLlama",
    url: "https://defillama.com",
    purpose: "Stablecoin supply history and total DeFi TVL history.",
    limits: "Keyless. Daily resolution.",
  },
  news: {
    name: "CoinWave news service",
    url: "/api/news",
    purpose:
      "Aggregates publisher RSS feeds (CoinDesk, Cointelegraph, Decrypt, The Block, Bitcoin Magazine, CryptoSlate).",
    limits:
      "Runs as a small server function because RSS feeds do not allow browser access. Cached for 5 minutes.",
  },
}

export type RequestRecord = {
  at: number
  source: SourceId
  path: string
  status: number | "network" | "aborted"
  ms: number
}

export type SourceState = {
  ok: number
  failed: number
  lastSuccess: number | null
  lastFailure: number | null
  lastError: string | null
  lastLatency: number | null
  rateLimited: number
}

type Snapshot = {
  sources: Record<SourceId, SourceState>
  log: RequestRecord[]
}

const emptyState = (): SourceState => ({
  ok: 0,
  failed: 0,
  lastSuccess: null,
  lastFailure: null,
  lastError: null,
  lastLatency: null,
  rateLimited: 0,
})

let snapshot: Snapshot = {
  sources: {
    coingecko: emptyState(),
    binance: emptyState(),
    alternative: emptyState(),
    defillama: emptyState(),
    news: emptyState(),
  },
  log: [],
}
const listeners = new Set<() => void>()

export function sourceFor(url: string): SourceId {
  if (url.includes("coingecko.com")) return "coingecko"
  if (url.includes("binance")) return "binance"
  if (url.includes("alternative.me")) return "alternative"
  if (url.includes("llama.fi")) return "defillama"
  return "news"
}

export function recordRequest(record: RequestRecord, error?: string) {
  const prev = snapshot.sources[record.source]
  const ok = typeof record.status === "number" && record.status < 400
  if (record.status === "aborted") return
  const next: SourceState = ok
    ? {
        ...prev,
        ok: prev.ok + 1,
        lastSuccess: record.at,
        lastLatency: record.ms,
      }
    : {
        ...prev,
        failed: prev.failed + 1,
        lastFailure: record.at,
        lastError: error ?? String(record.status),
        lastLatency: record.ms,
        rateLimited:
          prev.rateLimited +
          (record.status === 429 || record.status === "network" ? 1 : 0),
      }
  snapshot = {
    sources: { ...snapshot.sources, [record.source]: next },
    log: [record, ...snapshot.log].slice(0, 80),
  }
  listeners.forEach((l) => l())
}

export function useTelemetry() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
    () => snapshot
  )
}
