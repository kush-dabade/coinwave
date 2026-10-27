/**
 * Risk and exposure analysis for a set of weighted holdings.
 *
 * Three kinds of output, always labelled as such in the UI:
 * - observed: measured from historical prices (volatility, drawdown,
 *   correlation, beta);
 * - scenario: the consequence of shocks the user chooses;
 * - estimate: shocks propagated from Bitcoin through historical beta.
 * None of these are forecasts.
 */

import {
  annualizedVolatility,
  beta,
  correlation,
  dayKey,
  maxDrawdown,
  pairedReturns,
  percentile,
  seriesReturns,
  type DailySeries,
} from "./stats"

export type Holding = {
  assetId: string
  symbol: string
  name: string
  value: number
}

export function concentration(values: number[]) {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const w = values.map((v) => v / total).sort((a, b) => b - a)
  const hhi = w.reduce((s, x) => s + x * x, 0)
  return {
    hhi,
    effectiveN: 1 / hhi,
    top1: w[0] * 100,
    top3: w.slice(0, 3).reduce((a, b) => a + b, 0) * 100,
  }
}

export type AssetRisk = {
  assetId: string
  observations: number
  volatility90d: number | null
  volatility1y: number | null
  maxDrawdown1y: number | null
  betaToBtc: number | null
  correlationToBtc: number | null
}

function slice(series: DailySeries, days: number, end: string) {
  const start = dayKey(Date.parse(end) - days * 86_400_000)
  return new Map([...series].filter(([d]) => d > start && d <= end))
}

export function assetRisk(
  assetId: string,
  series: DailySeries,
  btc: DailySeries | undefined
): AssetRisk {
  const days = [...series.keys()].sort()
  const end = days[days.length - 1] ?? dayKey(Date.now())
  const yearly = slice(series, 365, end)
  const closes = [...yearly.keys()].sort().map((d) => yearly.get(d)!)
  const pr =
    btc && assetId !== "bitcoin"
      ? pairedReturns(slice(series, 365, end), slice(btc, 365, end))
      : null
  return {
    assetId,
    observations: seriesReturns(yearly).length,
    volatility90d: annualizedVolatility(seriesReturns(slice(series, 90, end))),
    volatility1y: annualizedVolatility(seriesReturns(yearly)),
    maxDrawdown1y:
      closes.length >= 30 ? (maxDrawdown(closes)?.pct ?? null) : null,
    betaToBtc: assetId === "bitcoin" ? 1 : pr ? beta(pr.a, pr.b) : null,
    correlationToBtc:
      assetId === "bitcoin" ? 1 : pr ? correlation(pr.a, pr.b) : null,
  }
}

/** Pairwise correlation of daily returns; null where overlap is too short. */
export function correlationMatrix(
  ids: string[],
  series: Map<string, DailySeries>
) {
  return ids.map((a) =>
    ids.map((b) => {
      if (a === b) return 1
      const sa = series.get(a)
      const sb = series.get(b)
      if (!sa || !sb) return null
      const pr = pairedReturns(sa, sb)
      return correlation(pr.a, pr.b)
    })
  )
}

export type StressResult = {
  before: number
  after: number
  change: number
  changePct: number
  rows: {
    assetId: string
    symbol: string
    value: number
    shockPct: number | null
    after: number
    change: number
  }[]
  unshocked: string[]
}

/**
 * Applies per-asset % shocks to current values. Assets without a shock stay
 * unchanged and are listed, so a scenario never silently assumes zero.
 */
export function applyShocks(
  holdings: Holding[],
  shockFor: (h: Holding) => number | null
): StressResult {
  const rows = holdings.map((h) => {
    const s = shockFor(h)
    const after = s === null ? h.value : h.value * (1 + s / 100)
    return {
      assetId: h.assetId,
      symbol: h.symbol,
      value: h.value,
      shockPct: s,
      after,
      change: after - h.value,
    }
  })
  const before = rows.reduce((a, r) => a + r.value, 0)
  const after = rows.reduce((a, r) => a + r.after, 0)
  return {
    before,
    after,
    change: after - before,
    changePct: before > 0 ? (after / before - 1) * 100 : 0,
    rows,
    unshocked: rows.filter((r) => r.shockPct === null).map((r) => r.symbol),
  }
}

/** Beta-implied shock: asset move ≈ beta × Bitcoin move, floored at −100%. */
export function betaShock(btcShockPct: number, assetBeta: number | null) {
  if (assetBeta === null) return null
  return Math.max(-100, assetBeta * btcShockPct)
}

export type Simulation = {
  days: number
  totalReturn: number
  volatility: number | null
  maxDrawdown: number | null
  worstDay: number
  p5Day: number
  bestDay: number
  index: { day: string; value: number }[]
  missing: string[]
}

/**
 * Historical simulation of today's weights, rebalanced daily: what the
 * current allocation would have experienced over the past year. Only days
 * where every included asset has a price are used.
 */
export function simulateWeights(
  weights: { assetId: string; symbol: string; weight: number }[],
  series: Map<string, DailySeries>
): Simulation | null {
  const usable = weights.filter((w) => (series.get(w.assetId)?.size ?? 0) > 1)
  const missing = weights
    .filter((w) => !usable.includes(w))
    .map((w) => w.symbol)
  if (usable.length === 0) return null
  const total = usable.reduce((a, w) => a + w.weight, 0)
  const days = [...series.get(usable[0].assetId)!.keys()]
    .filter((d) => usable.every((w) => series.get(w.assetId)!.has(d)))
    .sort()
  const rets: { day: string; r: number }[] = []
  for (let i = 1; i < days.length; i++) {
    if (Date.parse(days[i]) - Date.parse(days[i - 1]) !== 86_400_000) continue
    let r = 0
    for (const w of usable) {
      const s = series.get(w.assetId)!
      r += (w.weight / total) * (s.get(days[i])! / s.get(days[i - 1])! - 1)
    }
    rets.push({ day: days[i], r })
  }
  if (rets.length < 30) return null
  let v = 100
  const index = [{ day: days[0], value: 100 }]
  for (const x of rets) {
    v *= 1 + x.r
    index.push({ day: x.day, value: v })
  }
  const daily = rets.map((x) => x.r * 100)
  return {
    days: rets.length,
    totalReturn: v - 100,
    volatility: annualizedVolatility(rets.map((x) => x.r)),
    maxDrawdown: maxDrawdown(index.map((p) => p.value))?.pct ?? null,
    worstDay: Math.min(...daily),
    p5Day: percentile(daily, 5),
    bestDay: Math.max(...daily),
    index,
    missing,
  }
}
