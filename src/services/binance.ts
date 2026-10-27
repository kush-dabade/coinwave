/**
 * Binance public market-data mirror (keyless, CORS-enabled, generous limits).
 * Used for genuine OHLCV candles and daily closes. Prices are quoted in USDT,
 * which CoinWave treats as a USD proxy and labels as such.
 */

import { ApiError, fetchJson, num } from "./http"
import type { Asset, Candle } from "./coingecko"

const BASE = "https://data-api.binance.vision/api/v3"

export type BinanceInterval = "15m" | "1h" | "4h" | "1d" | "1w"

/** Last price of every USDT spot pair, keyed by base asset (e.g. "BTC"). */
export async function fetchUsdtPrices(
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const raw = await fetchJson<{ symbol?: string; price?: string }[]>(
    `${BASE}/ticker/price`,
    signal
  )
  if (!Array.isArray(raw))
    throw new ApiError("server", "Unexpected Binance payload")
  const out: Record<string, number> = {}
  for (const row of raw) {
    const symbol = row.symbol ?? ""
    const price = num(row.price)
    if (symbol.endsWith("USDT") && price !== null && price > 0) {
      out[symbol.slice(0, -4)] = price
    }
  }
  return out
}

/**
 * The Binance pair for a CoinGecko asset, or null. Tickers are not unique
 * across tokens, so a pair is only accepted when Binance's last price is
 * within 3% of CoinGecko's price for that asset.
 */
export function binancePairFor(
  asset: Pick<Asset, "symbol" | "price">,
  usdtPrices: Record<string, number>
): string | null {
  const base = asset.symbol.toUpperCase()
  if (!base || base === "USDT") return null
  const binancePrice = usdtPrices[base]
  if (!binancePrice || asset.price === null || asset.price <= 0) return null
  const diff = Math.abs(binancePrice / asset.price - 1)
  return diff <= 0.03 ? `${base}USDT` : null
}

export async function fetchKlines(
  pair: string,
  interval: BinanceInterval,
  limit = 500,
  signal?: AbortSignal
): Promise<Candle[]> {
  const raw = await fetchJson<unknown[]>(
    `${BASE}/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${Math.min(1000, limit)}`,
    signal
  )
  const out: Candle[] = []
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!Array.isArray(row)) continue
    const t = num(row[0])
    const o = num(row[1])
    const h = num(row[2])
    const l = num(row[3])
    const c = num(row[4])
    // Quote-asset volume (USDT), i.e. the dollar value traded in the candle.
    const v = num(row[7])
    if (t !== null && o !== null && h !== null && l !== null && c !== null) {
      out.push({ t, o, h, l, c, v })
    }
  }
  return out
}
