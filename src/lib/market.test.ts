import { describe, expect, it } from "vitest"

import type { Asset } from "@/services/coingecko"

import { aggregateCap, breadth, movers } from "./market"

const a = (id: string, p: Partial<Asset>): Asset =>
  ({
    id,
    symbol: id.toUpperCase(),
    name: id,
    marketCap: 1e9,
    marketCapChange24h: 0,
    change24h: 0,
    ...p,
  }) as Asset

describe("aggregateCap", () => {
  it("weights the change by market cap and ignores unknown changes", () => {
    const r = aggregateCap([
      a("x", { marketCap: 110, marketCapChange24h: 10 }),
      a("y", { marketCap: 90, marketCapChange24h: -10 }),
      a("z", { marketCap: 50, marketCapChange24h: null }),
    ])
    expect(r.cap).toBe(250)
    // 200 now vs 200 before → 0%
    expect(r.change).toBeCloseTo(0)
  })

  it("returns no change when nothing is known", () => {
    expect(
      aggregateCap([a("x", { marketCapChange24h: null })]).change
    ).toBeNull()
  })
})

describe("breadth", () => {
  it("counts advancers, decliners, flat and missing", () => {
    const b = breadth([
      a("a", { change24h: 2 }),
      a("b", { change24h: -1 }),
      a("c", { change24h: 0.001 }),
      a("d", { change24h: null }),
    ])
    expect([b.up, b.down, b.flat, b.total, b.missing]).toEqual([1, 1, 1, 3, 1])
    expect(b.pctUp).toBeCloseTo(100 / 3)
    expect(b.median).toBeCloseTo(0.001)
  })
})

describe("movers", () => {
  it("ranks above a market-cap floor", () => {
    const m = movers(
      [
        a("big-up", { change24h: 5, marketCap: 2e9 }),
        a("tiny-up", { change24h: 50, marketCap: 1e6 }),
        a("big-down", { change24h: -7, marketCap: 3e9 }),
        a("mid-down", { change24h: -2, marketCap: 2e9 }),
      ],
      1e8
    )
    expect(m.gainers.map((x) => x.id)).toEqual(["big-up"])
    expect(m.losers.map((x) => x.id)).toEqual(["big-down", "mid-down"])
  })
})
