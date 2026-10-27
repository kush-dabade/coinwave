import { describe, expect, it } from "vitest"

import {
  applyShocks,
  assetRisk,
  betaShock,
  concentration,
  correlationMatrix,
  simulateWeights,
} from "./risk"
import type { DailySeries } from "./stats"

const series = (values: number[], start = "2025-11-01"): DailySeries => {
  const m: DailySeries = new Map()
  values.forEach((v, i) =>
    m.set(
      new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10),
      v
    )
  )
  return m
}
const walk = (n: number, f: (i: number) => number) => {
  let v = 100
  return Array.from({ length: n }, (_, i) => (v *= 1 + f(i)))
}

describe("concentration", () => {
  it("measures HHI, effective positions and top shares", () => {
    const c = concentration([50, 30, 20])!
    expect(c.hhi).toBeCloseTo(0.38)
    expect(c.effectiveN).toBeCloseTo(1 / 0.38)
    expect(c.top1).toBeCloseTo(50)
    expect(c.top3).toBeCloseTo(100)
    expect(concentration([0, 0])).toBeNull()
  })
})

describe("assetRisk", () => {
  const btcValues = walk(200, (i) => Math.sin(i / 3) / 40)
  const btc = series(btcValues)
  const levered = series(walk(200, (i) => (2 * Math.sin(i / 3)) / 40))

  it("estimates beta and correlation to Bitcoin from paired returns", () => {
    const r = assetRisk("lev", levered, btc)
    expect(r.betaToBtc).toBeCloseTo(2, 5)
    expect(r.correlationToBtc).toBeCloseTo(1, 5)
    expect(r.volatility90d).not.toBeNull()
    expect(r.maxDrawdown1y).toBeLessThan(0)
  })

  it("defines Bitcoin's beta to itself as 1 and refuses short histories", () => {
    expect(assetRisk("bitcoin", btc, btc).betaToBtc).toBe(1)
    const short = assetRisk("new", series(btcValues.slice(0, 10)), btc)
    expect(short.volatility1y).toBeNull()
    expect(short.betaToBtc).toBeNull()
    expect(short.maxDrawdown1y).toBeNull()
  })
})

describe("stress scenarios", () => {
  const holdings = [
    { assetId: "bitcoin", symbol: "BTC", name: "Bitcoin", value: 600 },
    { assetId: "eth", symbol: "ETH", name: "Ethereum", value: 400 },
  ]

  it("applies chosen shocks and lists unshocked assets", () => {
    const r = applyShocks(holdings, (h) =>
      h.assetId === "bitcoin" ? -20 : null
    )
    expect(r.after).toBe(880)
    expect(r.changePct).toBeCloseTo(-12)
    expect(r.unshocked).toEqual(["ETH"])
  })

  it("propagates a Bitcoin move through beta, floored at a total loss", () => {
    expect(betaShock(-20, 1.5)).toBeCloseTo(-30)
    expect(betaShock(-80, 2)).toBe(-100)
    expect(betaShock(-20, null)).toBeNull()
  })
})

describe("historical simulation", () => {
  it("rebalances today's weights daily on common days", () => {
    const a = series(walk(60, () => 0.01))
    const b = series(walk(60, () => -0.01))
    const sim = simulateWeights(
      [
        { assetId: "a", symbol: "A", weight: 0.5 },
        { assetId: "b", symbol: "B", weight: 0.5 },
        { assetId: "c", symbol: "C", weight: 0.1 },
      ],
      new Map([
        ["a", a],
        ["b", b],
      ])
    )!
    // Equal +1% / −1% daily cancels out when rebalanced.
    expect(sim.totalReturn).toBeCloseTo(0, 8)
    expect(sim.missing).toEqual(["C"])
    expect(sim.days).toBe(59)
  })

  it("needs at least 30 daily returns", () => {
    expect(
      simulateWeights(
        [{ assetId: "a", symbol: "A", weight: 1 }],
        new Map([["a", series([1, 2, 3])]])
      )
    ).toBeNull()
  })
})

describe("correlationMatrix", () => {
  it("is symmetric with a unit diagonal and nulls for missing series", () => {
    const x = series(walk(60, (i) => Math.sin(i) / 50))
    const m = correlationMatrix(
      ["x", "y", "z"],
      new Map([
        ["x", x],
        ["y", x],
      ])
    )
    expect(m[0][0]).toBe(1)
    expect(m[0][1]).toBeCloseTo(1)
    expect(m[1][0]).toBeCloseTo(1)
    expect(m[0][2]).toBeNull()
  })
})
