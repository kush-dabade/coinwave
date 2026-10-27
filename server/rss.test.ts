import { describe, expect, it } from "vitest"

import { cleanSummary, decodeEntities, parseFeed, toPlainText } from "./rss"
import {
  buildMatchers,
  groupStories,
  tagAssets,
  type NewsItem,
} from "../src/lib/news"

const RSS = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title><![CDATA[Bitcoin Dips Below $80,000 &amp; Ether Follows]]></title>
  <link>https://decrypt.co/1/bitcoin-dips</link>
  <pubDate>Mon, 26 Oct 2026 13:02:43 +0000</pubDate>
  <description><![CDATA[<p>The <b>largest</b> crypto fell&nbsp;3%.</p><script>alert(1)</script>]]></description>
  <category><![CDATA[Markets]]></category>
  <media:content url="https://img.example/a.jpg" medium="image"/>
</item>
<item>
  <title>No link item</title>
  <pubDate>Mon, 26 Oct 2026 13:02:43 +0000</pubDate>
</item>
<item>
  <title>Bad link</title>
  <link>javascript:alert(1)</link>
  <pubDate>Mon, 26 Oct 2026 13:02:43 +0000</pubDate>
</item>
<item>
  <title>Undated</title>
  <link>https://x.example/u</link>
</item>
</channel></rss>`

const ATOM = `<feed><entry>
  <title>Solana &#x2019;s upgrade ships</title>
  <link href="https://example.com/sol"/>
  <published>2026-10-25T10:00:00Z</published>
  <summary>Short &lt;em&gt;summary&lt;/em&gt;</summary>
  <category term="Layer 1s"/>
</entry></feed>`

describe("parseFeed", () => {
  const items = parseFeed(RSS, { id: "decrypt", name: "Decrypt" })

  it("reads RSS items and decodes CDATA, entities and HTML safely", () => {
    expect(items).toHaveLength(1)
    const [a] = items
    expect(a.title).toBe("Bitcoin Dips Below $80,000 & Ether Follows")
    expect(a.summary).toBe("The largest crypto fell 3%.")
    expect(a.categories).toEqual(["Markets"])
    expect(a.image).toBe("https://img.example/a.jpg")
    expect(a.publishedAt).toBe(Date.parse("Mon, 26 Oct 2026 13:02:43 +0000"))
  })

  it("skips items without a safe link or a date", () => {
    expect(items.map((i) => i.link)).toEqual([
      "https://decrypt.co/1/bitcoin-dips",
    ])
  })

  it("reads Atom entries", () => {
    const [e] = parseFeed(ATOM, { id: "x", name: "X" })
    expect(e.title).toBe("Solana ’s upgrade ships")
    expect(e.link).toBe("https://example.com/sol")
    expect(e.summary).toBe("Short summary")
    expect(e.categories).toEqual(["Layer 1s"])
  })

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("&#36;5 &mdash; &#x1F680; &bogus;")).toBe(
      "$5 — \u{1F680} &bogus;"
    )
    expect(toPlainText("<p>a</p><br/>b")).toBe("a b")
  })
})

const item = (p: Partial<NewsItem>): NewsItem => ({
  id: p.link ?? "i",
  title: "",
  link: "https://x/" + Math.random(),
  source: "S",
  sourceId: "s",
  publishedAt: Date.UTC(2026, 9, 26),
  summary: "",
  categories: [],
  image: null,
  ...p,
})

describe("groupStories", () => {
  it("groups near-identical headlines from different publishers", () => {
    const groups = groupStories([
      item({
        title: "Strive buys 6,182 bitcoin for $511 million",
        sourceId: "a",
      }),
      item({
        title: "Strive buys 6,182 bitcoin worth $511 million",
        sourceId: "b",
        publishedAt: Date.UTC(2026, 9, 26, 2),
      }),
      item({
        title: "Ethereum developers schedule next upgrade",
        sourceId: "c",
      }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.related.length)?.related).toHaveLength(1)
  })

  it("never merges two stories from the same publisher", () => {
    const groups = groupStories([
      item({ title: "Bitcoin price update today", sourceId: "a" }),
      item({
        title: "Bitcoin price update today",
        sourceId: "a",
        link: "https://x/2",
      }),
    ])
    expect(groups).toHaveLength(2)
  })
})

describe("tagAssets", () => {
  const matchers = buildMatchers([
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH" },
    { id: "near", name: "NEAR Protocol", symbol: "NEAR" },
    { id: "chainlink", name: "Chainlink", symbol: "LINK" },
    { id: "solana", name: "Solana", symbol: "SOL" },
  ])

  it("tags assets by name, alias and distinctive ticker", () => {
    expect(tagAssets("Ether slides as BTC holds $80K", matchers)).toEqual([
      "bitcoin",
      "ethereum",
    ])
    expect(tagAssets("Chainlink expands CCIP", matchers)).toEqual(["chainlink"])
  })

  it("does not tag ordinary words that happen to be tickers or names", () => {
    expect(
      tagAssets("Markets near record as traders link up; SOLD out", matchers)
    ).toEqual([])
    expect(tagAssets("Investors eye near-term risks", matchers)).toEqual([])
  })

  it("accepts explicit $TICKER mentions and full names for ambiguous assets", () => {
    expect(tagAssets("$LINK and $NEAR rally", matchers)).toEqual([
      "near",
      "chainlink",
    ])
    expect(tagAssets("NEAR Protocol launches AI hub", matchers)).toEqual([
      "near",
    ])
  })
})

describe("cleanSummary", () => {
  it("drops a repeated publisher and headline, and trailing boilerplate", () => {
    const title =
      "Bitcoin Price Hovers Near $80,000 as Traders Await Fed Decision"
    const raw = `Bitcoin Magazine ${title} Bitcoin price hovers near $80,000 as traders wait on this week's Fed decision. This post ${title} first appeared on Bitcoin Magazine and is written by Jane Doe.`
    expect(cleanSummary(raw, title, "Bitcoin Magazine")).toBe(
      "Bitcoin price hovers near $80,000 as traders wait on this week's Fed decision."
    )
    expect(
      cleanSummary(
        "Fees rose. The post Fees rose appeared first on CryptoSlate.",
        "Fees",
        "CryptoSlate"
      )
    ).toBe("Fees rose.")
    expect(cleanSummary("Plain summary.", "Headline", "Decrypt")).toBe(
      "Plain summary."
    )
  })
})
