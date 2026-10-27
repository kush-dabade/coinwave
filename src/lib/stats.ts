/**
 * Return and risk statistics on daily price series.
 *
 * Conventions (shown to users wherever the numbers appear):
 * - Returns are simple daily returns of closing prices.
 * - Volatility is the sample standard deviation of daily returns, annualised
 *   with √365 because crypto trades every day.
 * - Correlation and beta use only days where both series have a price.
 * - Statistics that need history return null below a minimum sample size
 *   instead of a misleadingly precise number.
 */

export const MIN_OBSERVATIONS = 30

export type DailySeries = Map<string, number>

/** UTC calendar day key, e.g. "2026-10-26". */
export function dayKey(t: number) {
  return new Date(t).toISOString().slice(0, 10)
}

export function toDaily(points: { t: number; p: number }[]): DailySeries {
  const map: DailySeries = new Map()
  // Later points on the same day overwrite earlier ones: the day's close.
  for (const pt of points)
    if (Number.isFinite(pt.p) && pt.p > 0) map.set(dayKey(pt.t), pt.p)
  return map
}

/** The part of a daily series on or after `start` (a dayKey). */
export function sinceDay(series: DailySeries, start: string): DailySeries {
  return new Map([...series].filter(([d]) => d >= start))
}

const DAY_MS = 86_400_000

/**
 * CoinGecko's daily series stamps each price at 00:00 UTC: the snapshot that
 * closes the previous day (it matches an exchange's daily close for that
 * day, not the day in its timestamp). Re-key each snapshot to the day it
 * closes and drop intraday points such as the trailing "now" price, so the
 * series lines up with exchange daily candles.
 */
export function closesFromMidnightSnapshots(
  points: { t: number; p: number }[],
  tolerance = 10 * 60_000
) {
  const out: { t: number; p: number }[] = []
  for (const pt of points) {
    const offset = ((pt.t % DAY_MS) + DAY_MS) % DAY_MS
    if (Math.min(offset, DAY_MS - offset) > tolerance) continue
    const midnight = Math.round(pt.t / DAY_MS) * DAY_MS
    out.push({ t: midnight - 1, p: pt.p })
  }
  return out
}

export function returns(values: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) out.push(values[i] / values[i - 1] - 1)
  }
  return out
}

export function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN
}

/** Sample standard deviation (n − 1). */
export function stdev(values: number[]) {
  if (values.length < 2) return NaN
  const m = mean(values)
  return Math.sqrt(
    values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1)
  )
}

/** Annualised volatility (%) from daily returns, or null with too few observations. */
export function annualizedVolatility(
  dailyReturns: number[],
  min = MIN_OBSERVATIONS
) {
  if (dailyReturns.length < min) return null
  return stdev(dailyReturns) * Math.sqrt(365) * 100
}

export type Drawdown = {
  pct: number
  peakIndex: number
  troughIndex: number
  recovered: boolean
}

/** Largest peak-to-trough decline (%) in a value series. */
export function maxDrawdown(values: number[]): Drawdown | null {
  if (values.length < 2) return null
  let peak = values[0]
  let peakIndex = 0
  let worst: Drawdown = {
    pct: 0,
    peakIndex: 0,
    troughIndex: 0,
    recovered: true,
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i]
      peakIndex = i
    }
    const dd = peak > 0 ? (values[i] / peak - 1) * 100 : 0
    if (dd < worst.pct)
      worst = { pct: dd, peakIndex, troughIndex: i, recovered: false }
  }
  if (worst.pct < 0) {
    const peakValue = values[worst.peakIndex]
    worst.recovered = values
      .slice(worst.troughIndex)
      .some((v) => v >= peakValue)
  }
  return worst
}

/** Pearson correlation, or null when fewer than `min` paired observations. */
export function correlation(a: number[], b: number[], min = MIN_OBSERVATIONS) {
  const n = Math.min(a.length, b.length)
  if (n < min) return null
  const ma = mean(a.slice(0, n))
  const mb = mean(b.slice(0, n))
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  if (va === 0 || vb === 0) return null
  return cov / Math.sqrt(va * vb)
}

/** Beta of `asset` returns against `market` returns. */
export function beta(
  asset: number[],
  market: number[],
  min = MIN_OBSERVATIONS
) {
  const n = Math.min(asset.length, market.length)
  if (n < min) return null
  const ma = mean(asset.slice(0, n))
  const mm = mean(market.slice(0, n))
  let cov = 0
  let vm = 0
  for (let i = 0; i < n; i++) {
    cov += (asset[i] - ma) * (market[i] - mm)
    vm += (market[i] - mm) ** 2
  }
  return vm === 0 ? null : cov / vm
}

/** Linear-interpolated percentile (p in 0–100). */
export function percentile(values: number[], p: number) {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((x, y) => x - y)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function median(values: number[]) {
  return percentile(values, 50)
}

/**
 * Daily returns of two series on the days both have a close (and the day
 * before). Missing days break the chain rather than spanning gaps.
 */
export function pairedReturns(a: DailySeries, b: DailySeries) {
  const days = [...a.keys()].filter((d) => b.has(d)).sort()
  const ra: number[] = []
  const rb: number[] = []
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]
    const cur = days[i]
    if (Date.parse(cur) - Date.parse(prev) !== 86_400_000) continue
    ra.push(a.get(cur)! / a.get(prev)! - 1)
    rb.push(b.get(cur)! / b.get(prev)! - 1)
  }
  return { a: ra, b: rb, days: days.length }
}

/** Returns of a single daily series over consecutive days only. */
export function seriesReturns(s: DailySeries) {
  const days = [...s.keys()].sort()
  const out: number[] = []
  for (let i = 1; i < days.length; i++) {
    if (Date.parse(days[i]) - Date.parse(days[i - 1]) !== 86_400_000) continue
    out.push(s.get(days[i])! / s.get(days[i - 1])! - 1)
  }
  return out
}

/** Restrict a daily series to the last `days` calendar days. */
export function lastDays(s: DailySeries, days: number, now = Date.now()) {
  const cutoff = dayKey(now - days * 86_400_000)
  return new Map([...s].filter(([d]) => d >= cutoff))
}

/** Period return (%) between the first and last close. */
export function periodReturn(s: DailySeries) {
  const days = [...s.keys()].sort()
  if (days.length < 2) return null
  const first = s.get(days[0])!
  const last = s.get(days[days.length - 1])!
  return first > 0 ? (last / first - 1) * 100 : null
}
