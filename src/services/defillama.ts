/** DefiLlama: stablecoin supply and DeFi TVL history (keyless, daily). */

import { fetchJson, num } from "./http"
import type { PricePoint } from "./coingecko"

/** Total circulating USD-pegged stablecoin supply, one point per day. */
export async function fetchStablecoinSupply(
  signal?: AbortSignal
): Promise<PricePoint[]> {
  const raw = await fetchJson<Record<string, unknown>[]>(
    "https://stablecoins.llama.fi/stablecoincharts/all",
    signal
  )
  const out: PricePoint[] = []
  for (const row of Array.isArray(raw) ? raw : []) {
    const date = num(row.date)
    const usd = num(
      (row.totalCirculatingUSD as Record<string, unknown> | undefined)
        ?.peggedUSD
    )
    if (date !== null && usd !== null && usd > 0)
      out.push({ t: date * 1000, p: usd })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Total value locked across all chains, one point per day. */
export async function fetchDefiTvl(
  signal?: AbortSignal
): Promise<PricePoint[]> {
  const raw = await fetchJson<Record<string, unknown>[]>(
    "https://api.llama.fi/v2/historicalChainTvl",
    signal
  )
  const out: PricePoint[] = []
  for (const row of Array.isArray(raw) ? raw : []) {
    const date = num(row.date)
    const tvl = num(row.tvl)
    if (date !== null && tvl !== null && tvl > 0)
      out.push({ t: date * 1000, p: tvl })
  }
  return out.sort((a, b) => a.t - b.t)
}
