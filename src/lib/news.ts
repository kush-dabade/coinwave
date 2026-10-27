/**
 * Client-side news helpers: grouping duplicate stories across publishers and
 * tagging the assets a headline is about.
 */

import type { NewsItem } from "../../server/rss"

export type { NewsItem }

const STOP = new Set(
  "a an the and or of to in on for with by as at from is are be its it this that new says say after over into amid vs".split(
    " "
  )
)

function tokens(title: string) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9$ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
  )
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

export type StoryGroup = { lead: NewsItem; related: NewsItem[] }

/**
 * Groups stories from different publishers whose headlines are near
 * duplicates (word overlap ≥ 55%, published within 36 hours). The earliest
 * report leads; the others are shown as "also covered by".
 */
export function groupStories(
  items: NewsItem[],
  threshold = 0.55
): StoryGroup[] {
  const sorted = [...items].sort((a, b) => b.publishedAt - a.publishedAt)
  const groups: { lead: NewsItem; related: NewsItem[]; tokens: Set<string> }[] =
    []
  for (const item of sorted) {
    const t = tokens(item.title)
    const match = groups.find(
      (g) =>
        g.lead.sourceId !== item.sourceId &&
        !g.related.some((r) => r.sourceId === item.sourceId) &&
        Math.abs(g.lead.publishedAt - item.publishedAt) < 36 * 3_600_000 &&
        jaccard(g.tokens, t) >= threshold
    )
    if (match) match.related.push(item)
    else groups.push({ lead: item, related: [], tokens: t })
  }
  return groups.map(({ lead, related }) => ({ lead, related }))
}

// ---------------------------------------------------------------------------
// Asset tagging

export type AssetRef = { id: string; name: string; symbol: string }

/** Extra names people use for major assets. */
const ALIASES: Record<string, string[]> = {
  bitcoin: ["bitcoin", "btc"],
  ethereum: ["ethereum", "ether", "eth"],
  solana: ["solana"],
  ripple: ["xrp", "ripple"],
  binancecoin: ["bnb"],
  dogecoin: ["dogecoin", "doge"],
  cardano: ["cardano"],
  tron: ["tron", "trx"],
  "avalanche-2": ["avalanche", "avax"],
  chainlink: ["chainlink"],
  "the-open-network": ["toncoin"],
  polkadot: ["polkadot"],
  litecoin: ["litecoin", "ltc"],
  "shiba-inu": ["shiba inu", "shib"],
  tether: ["tether", "usdt"],
  "usd-coin": ["usdc"],
  hyperliquid: ["hyperliquid"],
  sui: ["sui network"],
  near: ["near protocol"],
  monero: ["monero", "xmr"],
  // "Stellar" is also an ordinary adjective.
  stellar: ["xlm", "stellar network", "stellar lumens"],
}

/** Names and tickers that are ordinary words in headlines. */
const AMBIGUOUS = new Set([
  "near",
  "link",
  "one",
  "gas",
  "sui",
  "ton",
  "op",
  "dot",
  "uni",
  "sand",
  "mana",
  "ape",
  "beam",
  "core",
  "flow",
  "rose",
  "gala",
  "jasmy",
  "sun",
  "pepe",
  "bonk",
  "wif",
  "ai",
  "eth2",
  "usd",
  "eur",
  "ceo",
  "sec",
  "etf",
  "fed",
  "the",
  "pi",
  "ip",
  "s",
  "x",
  "w",
  "g",
  "kas",
  "ena",
  "aave",
  "maker",
  "sky",
  "ondo",
  "ftt",
  "dai",
  "story",
  "move",
  "act",
  "zeta",
  "hype",
  "virtual",
  "pump",
  "trump",
  "melania",
  "world",
  "liberty",
  "plume",
  "mantra",
  "aero",
  // Asset names that are everyday words in headlines.
  "midnight",
  "render",
  "optimism",
  "dash",
  "compound",
  "immutable",
  "stacks",
  "theta",
  "flare",
  "mantle",
  "gate",
  "sonic",
  "stellar",
])

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export type Matcher = { id: string; patterns: RegExp[] }

export function buildMatchers(assets: AssetRef[]): Matcher[] {
  return assets.map((a) => {
    const names = new Set<string>(ALIASES[a.id] ?? [])
    const name = a.name.toLowerCase()
    if (!AMBIGUOUS.has(name) && name.length >= 4) names.add(name)
    const patterns = [...names].map(
      (n) => new RegExp(`(^|[^a-z0-9])${escape(n)}([^a-z0-9]|$)`, "i")
    )
    // Tickers: an explicit $TICKER always counts; a bare uppercase ticker
    // counts only when it is distinctive (3+ chars, not an ordinary word).
    const sym = a.symbol.toUpperCase()
    if (sym) {
      patterns.push(new RegExp(`\\$${escape(sym)}\\b`))
      if (sym.length >= 3 && !AMBIGUOUS.has(sym.toLowerCase())) {
        patterns.push(
          new RegExp(`(^|[^A-Za-z0-9])${escape(sym)}([^A-Za-z0-9]|$)`)
        )
      }
    }
    return { id: a.id, patterns }
  })
}

export function tagAssets(text: string, matchers: Matcher[], limit = 4) {
  const out: string[] = []
  for (const m of matchers) {
    if (m.patterns.some((p) => p.test(text))) out.push(m.id)
    if (out.length >= limit) break
  }
  return out
}
