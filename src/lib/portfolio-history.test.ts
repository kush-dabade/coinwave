import { describe, expect, it } from "vitest"

import { reconstructHistory } from "./portfolio-history"
import type { Transaction } from "./portfolio"
import type { DailySeries } from "./stats"

let seq = 0
const tx = (
  p: Partial<Transaction> &
    Pick<Transaction, "side" | "quantity" | "price" | "date">
): Transaction => ({
  id: `t${++seq}`,
  assetId: "bitcoin",
  symbol: "BTC",
  name: "Bitcoin",
  image: null,
  createdAt: seq,
  ...p,
})

const series = (start: string, values: number[]): DailySeries => {
  const m: DailySeries = new Map()
  values.forEach((v, i) =>
    m.set(
      new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10),
      v
    )
  )
  return m
}

const window = { start: "2026-01-01", end: "2026-01-05" }

describe("reconstructHistory", () => {
  it("values holdings at each day's close and tracks net invested", () => {
    const h = reconstructHistory(
      [tx({ side: "buy", quantity: 2, price: 100, date: "2026-01-01" })],
      new Map([["bitcoin", series("2026-01-01", [100, 110, 99, 120, 120])]]),
      window
    )
    expect(h.points.map((p) => p.value)).toEqual([200, 220, 198, 240, 240])
    expect(h.points.every((p) => p.invested === 200)).toBe(true)
    expect(h.metrics.twr).toBeCloseTo(20)
  })

  it("counts the move from the purchase price to the first close", () => {
    // Bought at 100 on a day that closed at 110, then flat: +10%, matching
    // the gain in money terms.
    const h = reconstructHistory(
      [tx({ side: "buy", quantity: 1, price: 100, date: "2026-01-01" })],
      new Map([["bitcoin", series("2026-01-01", [110, 110, 110, 110, 110])]]),
      window
    )
    expect(h.metrics.twr).toBeCloseTo(10)
    expect(h.metrics.bestDay?.day).toBe("2026-01-01")
    // A first-day loss shows up in drawdown from the 100 baseline.
    const loss = reconstructHistory(
      [tx({ side: "buy", quantity: 1, price: 100, date: "2026-01-01" })],
      new Map([["bitcoin", series("2026-01-01", [80, 90, 90, 90, 90])]]),
      window
    )
    expect(loss.metrics.maxDrawdown).toBeCloseTo(-20)
    expect(loss.metrics.twr).toBeCloseTo(-10)
  })

  it("does not count added money as performance (time-weighted)", () => {
    const h = reconstructHistory(
      [
        tx({ side: "buy", quantity: 1, price: 100, date: "2026-01-01" }),
        // Buy 9 more on day 3 at the day's close: value jumps 10x, return is 0 that day.
        tx({ side: "buy", quantity: 9, price: 100, date: "2026-01-03" }),
      ],
      new Map([["bitcoin", series("2026-01-01", [100, 100, 100, 110, 110])]]),
      window
    )
    expect(h.points[2].value).toBe(1000)
    expect(h.points[2].flow).toBe(900)
    // Only the +10% move on day 4 counts.
    expect(h.metrics.twr).toBeCloseTo(10)
    expect(h.points[4].invested).toBe(1000)
  })

  it("treats sales as withdrawals and includes fees in cash flows", () => {
    const h = reconstructHistory(
      [
        tx({
          side: "buy",
          quantity: 2,
          price: 100,
          fee: 2,
          date: "2026-01-01",
        }),
        tx({
          side: "sell",
          quantity: 1,
          price: 150,
          fee: 1,
          date: "2026-01-03",
        }),
      ],
      new Map([["bitcoin", series("2026-01-01", [100, 150, 150, 150, 150])]]),
      window
    )
    expect(h.points[0].invested).toBe(202)
    // Sale returns 150 − 1 fee = 149.
    expect(h.points[2].invested).toBe(53)
    expect(h.points[4].value).toBe(150)
    // Value − invested equals total gain: 150 − 53 = 97 = (300 − 202) − 1 sale fee.
    expect(h.points[4].value - h.points[4].invested).toBeCloseTo(97)
  })

  it("starts undated and pre-window holdings at the window start", () => {
    const h = reconstructHistory(
      [
        tx({ side: "buy", quantity: 1, price: 50, date: null }),
        tx({ side: "buy", quantity: 1, price: 80, date: "2025-06-01" }),
      ],
      new Map([["bitcoin", series("2026-01-01", [100, 100, 100, 100, 100])]]),
      window
    )
    expect(h.points[0].value).toBe(200)
    expect(h.points[0].invested).toBe(130)
  })

  it("excludes and names assets with no price history", () => {
    const h = reconstructHistory(
      [
        tx({ side: "buy", quantity: 1, price: 100, date: "2026-01-01" }),
        tx({
          side: "buy",
          quantity: 5,
          price: 1,
          date: "2026-01-01",
          assetId: "mystery",
          symbol: "MYS",
          name: "Mystery",
        }),
      ],
      new Map([["bitcoin", series("2026-01-01", [100, 100, 100, 100, 100])]]),
      window
    )
    expect(h.excluded).toEqual([{ assetId: "mystery", symbol: "MYS" }])
    expect(h.points[0].value).toBe(100)
    expect(h.points[0].invested).toBe(100)
  })

  it("attributes gains per asset net of flows", () => {
    const h = reconstructHistory(
      [
        tx({ side: "buy", quantity: 1, price: 100, date: "2026-01-01" }),
        tx({
          side: "buy",
          quantity: 10,
          price: 10,
          date: "2026-01-01",
          assetId: "ethereum",
          symbol: "ETH",
          name: "Ethereum",
        }),
      ],
      new Map([
        ["bitcoin", series("2026-01-01", [100, 100, 100, 100, 130])],
        ["ethereum", series("2026-01-01", [10, 10, 10, 10, 9])],
      ]),
      window
    )
    const byId = Object.fromEntries(
      h.attribution.map((a) => [a.assetId, a.contribution])
    )
    // Holdings bought at the day-1 close, so day-1 start values equal flows.
    expect(byId.bitcoin).toBeCloseTo(30 - 0)
    expect(byId.ethereum).toBeCloseTo(-10)
  })

  it("carries a close forward over short gaps only", () => {
    const prices = series("2026-01-01", [100, 100, 100, 100, 100])
    prices.delete("2026-01-03")
    const h = reconstructHistory(
      [tx({ side: "buy", quantity: 1, price: 100, date: "2026-01-01" })],
      new Map([["bitcoin", prices]]),
      window
    )
    expect(h.points[2].value).toBe(100)
  })

  it("leaves metrics empty before anything is held", () => {
    const h = reconstructHistory([], new Map(), window)
    expect(h.metrics.twr).toBeNull()
    expect(h.points.every((p) => p.value === 0 && p.index === null)).toBe(true)
  })
})
