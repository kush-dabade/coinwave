/**
 * Market-wide aggregates computed from the asset universe, so every view
 * (Command Center, market tape, Intelligence) agrees on the same numbers.
 */

import { direction, isNum } from "./format"
import { median } from "./stats"
import type { Asset } from "@/services/coingecko"

/**
 * Aggregate market cap and its 24h change, computed from constituents.
 * Assets without a known 24h market-cap change are left out of the change
 * (but included in the total).
 */
export function aggregateCap(assets: Asset[]) {
  let cap = 0
  let now = 0
  let before = 0
  for (const a of assets) {
    if (!isNum(a.marketCap)) continue
    cap += a.marketCap
    if (isNum(a.marketCapChange24h)) {
      now += a.marketCap
      before += a.marketCap - a.marketCapChange24h
    }
  }
  return { cap, change: before > 0 ? (now / before - 1) * 100 : null }
}

export type ChangeKey =
  | "change1h"
  | "change24h"
  | "change7d"
  | "change30d"
  | "change200d"
  | "change1y"

export const PERIODS: { key: ChangeKey; label: string }[] = [
  { key: "change1h", label: "1h" },
  { key: "change24h", label: "24h" },
  { key: "change7d", label: "7d" },
  { key: "change30d", label: "30d" },
  { key: "change200d", label: "200d" },
  { key: "change1y", label: "1y" },
]

/** Advancers, decliners and unchanged (|Δ| < 0.005%) for one period. */
export function breadth(assets: Asset[], key: ChangeKey = "change24h") {
  const counted = assets.filter((a) => isNum(a[key]))
  const up = counted.filter((a) => direction(a[key]) === "up").length
  const down = counted.filter((a) => direction(a[key]) === "down").length
  const values = counted.map((a) => a[key] as number)
  return {
    up,
    down,
    flat: counted.length - up - down,
    total: counted.length,
    missing: assets.length - counted.length,
    pctUp: counted.length ? (up / counted.length) * 100 : null,
    median: values.length ? median(values) : null,
  }
}

/** Largest movers above a market-cap floor (filters out illiquid micro caps). */
export function movers(
  assets: Asset[],
  minCap: number,
  key: ChangeKey = "change24h",
  n = 5
) {
  const ranked = assets
    .filter((a) => isNum(a[key]) && (a.marketCap ?? 0) >= minCap)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
  return {
    gainers: ranked.filter((a) => direction(a[key]) === "up").slice(0, n),
    losers: ranked
      .filter((a) => direction(a[key]) === "down")
      .reverse()
      .slice(0, n),
  }
}
