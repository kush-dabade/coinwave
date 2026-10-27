import { describe, expect, it } from "vitest"

import type { Asset } from "@/services/coingecko"

import {
  decodeConditions,
  encodeConditions,
  enrich,
  historyMetrics,
  parseHuman,
  PRESETS,
  screen,
  usesHistory,
  type Condition,
} from "./screener"

const base: Asset = {
  id: "x",
  symbol: "X",
  name: "X",
  image: null,
  rank: 1,
  price: 10,
  change1h: 0,
  change24h: 0,
  change7d: 0,
  change14d: 0,
  change30d: 0,
  change200d: 0,
  change1y: 0,
  priceChange24h: 0,
  marketCap: 1e9,
  marketCapChange24h: 0,
  fdv: null,
  volume24h: 1e8,
  high24h: 12,
  low24h: 8,
  circulatingSupply: 50,
  totalSupply: 100,
  maxSupply: 200,
  ath: 20,
  athChange: -50,
  athDate: null,
  atl: 1,
  atlChange: 900,
  atlDate: null,
  sparkline: [],
  lastUpdated: null,
}
const asset = (p: Partial<Asset>): Asset => ({ ...base, ...p })

describe("enrich", () => {
  const rows = enrich([
    asset({ id: "bitcoin", change7d: 5, change30d: 10, change1y: 50 }),
    asset({ id: "eth", change7d: 8, change30d: 4, change1y: null }),
  ])

  it("derives relative strength against Bitcoin in percentage points", () => {
    expect(rows[1].rs7d).toBe(3)
    expect(rows[1].rs30d).toBe(-6)
    expect(rows[1].rs1y).toBeNull()
    expect(rows[0].rs7d).toBeNull()
  })

  it("derives turnover, float and position in the 24h range", () => {
    expect(rows[0].volToMcap).toBeCloseTo(10)
    expect(rows[0].circulatingPct).toBeCloseTo(25)
    expect(rows[0].range24hPos).toBeCloseTo(50)
  })
})

describe("conditions", () => {
  const rows = enrich([
    asset({ id: "a", marketCap: 5e9, change30d: 12 }),
    asset({ id: "b", marketCap: 5e8, change30d: 30 }),
    asset({ id: "c", marketCap: 2e10, change30d: null }),
  ])

  it("combines conditions with AND", () => {
    const c: Condition[] = [
      { field: "marketCap", op: "gt", a: 1e9 },
      { field: "change30d", op: "gt", a: 10 },
    ]
    expect(screen(rows, c).map((r) => r.id)).toEqual(["a"])
  })

  it("never lets a missing value pass", () => {
    expect(
      screen(rows, [{ field: "change30d", op: "lt", a: 1000 }]).map((r) => r.id)
    ).toEqual(["a", "b"])
  })

  it("supports inclusive between in either order", () => {
    expect(
      screen(rows, [{ field: "change30d", op: "between", a: 30, b: 12 }]).map(
        (r) => r.id
      )
    ).toEqual(["a", "b"])
  })

  it("round-trips through the URL encoding, including negatives and decimals", () => {
    const c: Condition[] = [
      { field: "athChange", op: "between", a: -50.5, b: -10 },
      { field: "marketCap", op: "gt", a: 1e9 },
      { field: "volumeRatio30d", op: "gt", a: 2.5 },
    ]
    expect(decodeConditions(encodeConditions(c))).toEqual(c)
    expect(
      decodeConditions("bogus.gt.1,marketCap.zz.3,marketCap.lt.abc")
    ).toEqual([])
  })

  it("flags conditions that need the history scan", () => {
    expect(usesHistory([{ field: "volumeRatio30d", op: "gt", a: 2 }])).toBe(
      true
    )
    expect(usesHistory(PRESETS[0].conditions)).toBe(false)
  })
})

describe("parseHuman", () => {
  it("understands suffixes and symbols", () => {
    expect(parseHuman("1.5B")).toBe(1.5e9)
    expect(parseHuman("$250m")).toBe(2.5e8)
    expect(parseHuman("-3.5%")).toBe(-3.5)
    expect(parseHuman("2x")).toBe(2)
    expect(parseHuman("abc")).toBeNull()
  })
})

describe("historyMetrics", () => {
  const DAY = 86_400_000
  const now = Date.UTC(2026, 5, 1, 12)
  const candles = Array.from({ length: 61 }, (_, i) => {
    const t = Date.UTC(2026, 5, 1) - (60 - i) * DAY
    return { t, h: 110 + (i === 40 ? 50 : 0), l: 90, c: 100, v: 1000 }
  })
  candles[59].v = 3000 // yesterday
  candles[60] = { ...candles[60], c: 999, v: 99999 } // today, incomplete: ignored

  it("excludes the incomplete current day and uses 30 complete days", () => {
    const m = historyMetrics(candles, now)
    expect(m.fromHigh30d).toBeCloseTo((100 / 160 - 1) * 100)
    expect(m.fromLow30d).toBeCloseTo((100 / 90 - 1) * 100)
    expect(m.volumeRatio30d).toBeCloseTo(3)
    expect(m.volatility30d).toBe(0)
  })

  it("returns nulls with fewer than 30 complete days", () => {
    expect(historyMetrics(candles.slice(-20), now).fromHigh30d).toBeNull()
  })
})
