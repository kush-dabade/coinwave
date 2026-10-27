import { describe, expect, it } from "vitest"

import { bollinger, ema, macd, rsi, sma } from "./indicators"

// The StockCharts RSI worked example.
const CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
  46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25,
  45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13,
]

describe("sma / ema", () => {
  it("averages a trailing window and leaves the warm-up empty", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it("seeds EMA with the SMA and applies the 2/(n+1) weight", () => {
    const e = ema(CLOSES, 10)
    expect(e.slice(0, 9).every((v) => v === null)).toBe(true)
    expect(e[9]).toBeCloseTo(44.779, 3)
    expect(e[e.length - 1]).toBeCloseTo(44.119299, 5)
  })

  it("returns all nulls when there is not enough data", () => {
    expect(ema([1, 2], 5)).toEqual([null, null])
    expect(sma([1, 2], 5)).toEqual([null, null])
  })
})

describe("rsi (Wilder)", () => {
  const r = rsi(CLOSES, 14)
  // Independently computed with Wilder smoothing.
  const expected = [
    70.46, 66.25, 66.48, 69.35, 66.29, 57.92, 62.88, 63.21, 56.01, 62.34, 54.67,
    50.39, 40.02, 41.49, 41.9, 45.5, 37.32, 33.09, 37.79,
  ]

  it("starts at index = period", () => {
    expect(r.slice(0, 14).every((v) => v === null)).toBe(true)
  })

  it("matches the reference series", () => {
    expected.forEach((v, i) => expect(r[14 + i]).toBeCloseTo(v, 1))
  })

  it("agrees with the published StockCharts example within rounding", () => {
    expect(Math.abs(r[14]! - 70.53)).toBeLessThan(0.1)
    expect(Math.abs(r[CLOSES.length - 1]! - 37.77)).toBeLessThan(0.1)
  })

  it("handles flat and one-directional series", () => {
    expect(rsi(new Array(20).fill(5), 14)[19]).toBe(50)
    expect(
      rsi(
        Array.from({ length: 20 }, (_, i) => i + 1),
        14
      )[19]
    ).toBe(100)
  })
})

describe("macd", () => {
  const values = Array.from(
    { length: 60 },
    (_, i) => 100 + Math.sin(i / 4) * 10 + i * 0.5
  )
  const m = macd(values)

  it("is the fast EMA minus the slow EMA", () => {
    const f = ema(values, 12)
    const s = ema(values, 26)
    expect(m.line[40]).toBeCloseTo(f[40]! - s[40]!, 10)
    expect(m.line[24]).toBeNull()
  })

  it("starts the signal line 9 observations after the MACD line", () => {
    expect(m.signal[25 + 7]).toBeNull()
    expect(m.signal[25 + 8]).not.toBeNull()
    expect(m.histogram[50]).toBeCloseTo(m.line[50]! - m.signal[50]!, 10)
  })
})

describe("bollinger", () => {
  it("uses population standard deviation around the SMA", () => {
    const b = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2)
    expect(b.middle[7]).toBe(5)
    expect(b.upper[7]).toBeCloseTo(9, 10)
    expect(b.lower[7]).toBeCloseTo(1, 10)
  })
})
