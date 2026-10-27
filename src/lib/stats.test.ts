import { describe, expect, it } from "vitest"

import {
  annualizedVolatility,
  beta,
  correlation,
  closesFromMidnightSnapshots,
  dayKey,
  maxDrawdown,
  pairedReturns,
  percentile,
  periodReturn,
  returns,
  seriesReturns,
  stdev,
  toDaily,
} from "./stats"

const DAY = 86_400_000
const t0 = Date.UTC(2026, 0, 1)
const daily = (values: number[], start = t0) =>
  toDaily(values.map((p, i) => ({ t: start + i * DAY, p })))

describe("basic statistics", () => {
  it("computes simple returns", () => {
    const r = returns([100, 110, 99])
    expect(r).toHaveLength(2)
    expect(r[0]).toBeCloseTo(0.1, 12)
    expect(r[1]).toBeCloseTo(-0.1, 12)
  })

  it("uses the sample standard deviation", () => {
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 5)
  })

  it("annualises with √365 and refuses small samples", () => {
    const r = Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.01 : -0.01))
    expect(annualizedVolatility(r)).toBeCloseTo(
      stdev(r) * Math.sqrt(365) * 100,
      10
    )
    expect(annualizedVolatility(r.slice(0, 10))).toBeNull()
  })

  it("interpolates percentiles", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([10], 5)).toBe(10)
  })
})

describe("maxDrawdown", () => {
  it("finds the largest peak-to-trough fall", () => {
    const dd = maxDrawdown([100, 120, 90, 110, 60, 130])!
    expect(dd.pct).toBeCloseTo(-50)
    expect(dd.peakIndex).toBe(1)
    expect(dd.troughIndex).toBe(4)
    expect(dd.recovered).toBe(true)
  })

  it("reports an unrecovered drawdown and a rising series", () => {
    expect(maxDrawdown([100, 80, 90])!.recovered).toBe(false)
    expect(maxDrawdown([1, 2, 3])!.pct).toBe(0)
    expect(maxDrawdown([1])).toBeNull()
  })
})

describe("correlation and beta", () => {
  const market = Array.from({ length: 60 }, (_, i) => Math.sin(i) / 50)

  it("detects perfect positive and negative co-movement", () => {
    expect(
      correlation(
        market,
        market.map((x) => x * 3)
      )
    ).toBeCloseTo(1, 10)
    expect(
      correlation(
        market,
        market.map((x) => -x)
      )
    ).toBeCloseTo(-1, 10)
  })

  it("measures beta as covariance over market variance", () => {
    expect(
      beta(
        market.map((x) => 2 * x),
        market
      )
    ).toBeCloseTo(2, 10)
  })

  it("refuses to estimate from too few observations", () => {
    expect(correlation(market.slice(0, 10), market.slice(0, 10))).toBeNull()
    expect(beta(market.slice(0, 10), market.slice(0, 10))).toBeNull()
  })

  it("returns null for a constant series", () => {
    expect(correlation(new Array(40).fill(0), market.slice(0, 40))).toBeNull()
  })
})

describe("daily series alignment", () => {
  it("keys by UTC day and keeps the last close per day", () => {
    const s = toDaily([
      { t: t0, p: 1 },
      { t: t0 + 3_600_000, p: 2 },
      { t: t0 + DAY, p: 3 },
    ])
    expect([...s]).toEqual([
      [dayKey(t0), 2],
      [dayKey(t0 + DAY), 3],
    ])
  })

  it("pairs returns only on consecutive common days", () => {
    const a = daily([100, 110, 121, 133.1])
    const b = daily([10, 11, 12.1, 13.31])
    b.delete(dayKey(t0 + 2 * DAY))
    const r = pairedReturns(a, b)
    // Day 2 is missing in b, so only day0→day1 pairs (day1→day3 spans a gap).
    expect(r.a).toHaveLength(1)
    expect(r.a[0]).toBeCloseTo(0.1)
    expect(r.b[0]).toBeCloseTo(0.1)
  })

  it("skips gaps in single-series returns and computes period returns", () => {
    const s = daily([100, 110, 121])
    expect(seriesReturns(s)).toHaveLength(2)
    expect(periodReturn(s)).toBeCloseTo(21)
    expect(periodReturn(daily([5]))).toBeNull()
  })
})

describe("closesFromMidnightSnapshots", () => {
  // Real values: CoinGecko BTC daily points vs Binance BTCUSDT daily closes.
  const at = (iso: string) => Date.parse(iso)
  it("re-keys a 00:00 UTC snapshot to the day it closes and drops intraday points", () => {
    const out = closesFromMidnightSnapshots([
      { t: at("2026-10-24T00:00:00Z"), p: 81102.3 },
      { t: at("2026-10-25T00:00:00Z"), p: 80810.6 },
      { t: at("2026-10-26T00:00:00Z"), p: 80048.8 },
      { t: at("2026-10-26T12:24:30Z"), p: 80258.7 },
    ])
    const series = toDaily(out)
    // Binance closes: 23 Oct 81,189.4 · 24 Oct 80,888.2 · 25 Oct 80,154.1
    expect([...series.keys()]).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ])
    expect(series.get("2026-10-25")).toBe(80048.8)
  })

  it("tolerates timestamps a few minutes off midnight", () => {
    const out = closesFromMidnightSnapshots([
      { t: at("2026-10-26T00:03:00Z"), p: 1 },
      { t: at("2026-10-25T23:58:00Z"), p: 2 },
    ])
    expect(out.map((p) => dayKey(p.t))).toEqual(["2026-10-25", "2026-10-25"])
  })
})
