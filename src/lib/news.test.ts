import { describe, expect, it } from "vitest"

import { buildMatchers, groupStories, tagAssets, type NewsItem } from "./news"

const assets = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "near", name: "NEAR Protocol", symbol: "NEAR" },
  { id: "chainlink", name: "Chainlink", symbol: "LINK" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "midnight-3", name: "Midnight", symbol: "NIGHT" },
  { id: "stellar", name: "Stellar", symbol: "XLM" },
  { id: "optimism", name: "Optimism", symbol: "OP" },
]
const matchers = buildMatchers(assets)

describe("tagAssets", () => {
  it("recognises names, aliases and distinctive tickers", () => {
    expect(tagAssets("Ether and BTC rally", matchers)).toEqual([
      "bitcoin",
      "ethereum",
    ])
    expect(tagAssets("SOL hits record", matchers)).toEqual(["solana"])
  })

  it("ignores tickers that are ordinary words", () => {
    expect(
      tagAssets("Markets near a decision point, analysts say", matchers)
    ).toEqual([])
    expect(tagAssets("A link to the report", matchers)).toEqual([])
    expect(
      tagAssets(
        "Exchange halts withdrawals at midnight amid stellar demand and cautious optimism",
        matchers
      )
    ).toEqual([])
    expect(
      tagAssets("XLM jumps as Stellar Network adds payments partner", matchers)
    ).toEqual(["stellar"])
    expect(tagAssets("NEAR Protocol ships sharding upgrade", matchers)).toEqual(
      ["near"]
    )
    expect(tagAssets("Buying $NEAR and $LINK", matchers)).toEqual([
      "near",
      "chainlink",
    ])
  })
})

describe("groupStories", () => {
  const item = (id: string, title: string, source: string): NewsItem => ({
    id,
    title,
    link: `https://example.org/${id}`,
    source,
    sourceId: source.toLowerCase(),
    publishedAt: 0,
    summary: "",
    categories: [],
    image: null,
  })

  it("groups the same story from different outlets", () => {
    const groups = groupStories([
      item("a", "Bitcoin climbs as ETF inflows return", "CoinDesk"),
      item("b", "Bitcoin climbs as ETF inflows return to US funds", "Decrypt"),
      item("c", "Ethereum developers set date for next upgrade", "CoinDesk"),
    ])
    expect(groups.map((g) => [g.lead.id, g.related.map((r) => r.id)])).toEqual([
      ["a", ["b"]],
      ["c", []],
    ])
  })
})
