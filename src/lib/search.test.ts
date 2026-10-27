import { describe, expect, it } from "vitest"

import type { Asset } from "@/services/coingecko"

import { searchLocalAssets } from "./search"

const asset = (id: string, symbol: string, name: string, rank: number) =>
  ({ id, symbol, name, rank }) as Asset

const assets = [
  asset("bitcoin", "btc", "Bitcoin", 1),
  asset("bitcoin-cash", "bch", "Bitcoin Cash", 20),
  asset("wrapped-bitcoin", "wbtc", "Wrapped Bitcoin", 15),
  asset("ethereum", "eth", "Ethereum", 2),
  asset("ethereum-classic", "etc", "Ethereum Classic", 30),
]

describe("searchLocalAssets", () => {
  it("ranks exact ticker matches first, then prefixes, then by market rank", () => {
    expect(searchLocalAssets(assets, "eth").map((a) => a.id)).toEqual([
      "ethereum",
      "ethereum-classic",
    ])
    expect(searchLocalAssets(assets, "bitcoin").map((a) => a.id)).toEqual([
      "bitcoin",
      "bitcoin-cash",
      "wrapped-bitcoin",
    ])
  })

  it("matches word starts inside names and ignores case and whitespace", () => {
    expect(searchLocalAssets(assets, "  CASH ").map((a) => a.id)).toEqual([
      "bitcoin-cash",
    ])
    expect(searchLocalAssets(assets, "")).toEqual([])
  })

  it("respects the limit", () => {
    expect(searchLocalAssets(assets, "e", 1)).toHaveLength(1)
  })
})
