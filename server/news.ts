/**
 * News aggregation service. Publisher RSS feeds do not allow cross-origin
 * browser requests, so CoinWave fetches them server-side (a Vercel function
 * in production, a Vite middleware in development) and returns JSON.
 *
 * Only headlines, short summaries and links are passed through; readers are
 * always sent to the publisher for the full article.
 */

import type { IncomingMessage, ServerResponse } from "node:http"

import { parseFeed, type NewsItem } from "./rss"
import type { NewsPayload, SourceStatus } from "./types"

export type { NewsPayload, SourceStatus }

export const FEEDS = [
  {
    id: "coindesk",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
  },
  {
    id: "cointelegraph",
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
  },
  { id: "decrypt", name: "Decrypt", url: "https://decrypt.co/feed" },
  { id: "theblock", name: "The Block", url: "https://www.theblock.co/rss.xml" },
  {
    id: "bitcoinmagazine",
    name: "Bitcoin Magazine",
    url: "https://bitcoinmagazine.com/.rss/full/",
  },
  {
    id: "cryptoslate",
    name: "CryptoSlate",
    url: "https://cryptoslate.com/feed/",
  },
] as const

const TTL = 5 * 60_000
/** Real feeds are well under 1 MB; anything far larger is refused. */
const MAX_FEED_BYTES = 5_000_000
const MAX_AGE = 7 * 86_400_000
let cache: { at: number; payload: NewsPayload } | null = null
let inflight: Promise<NewsPayload> | null = null

async function fetchFeed(feed: (typeof FEEDS)[number]) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "CoinWaveNewsReader/1.0",
        accept:
          "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const declared = Number(res.headers.get("content-length"))
    if (declared > MAX_FEED_BYTES) throw new Error("Feed too large")
    const text = await res.text()
    if (text.length > MAX_FEED_BYTES) throw new Error("Feed too large")
    return parseFeed(text, feed)
  } finally {
    clearTimeout(timer)
  }
}

export async function aggregate(now = Date.now()): Promise<NewsPayload> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed))
  const seen = new Set<string>()
  const items: NewsItem[] = []
  const sources: SourceStatus[] = FEEDS.map((feed, i) => {
    const r = results[i]
    if (r.status === "rejected") {
      return {
        id: feed.id,
        name: feed.name,
        ok: false,
        count: 0,
        error: String(r.reason?.message ?? r.reason),
      }
    }
    let count = 0
    for (const item of r.value) {
      if (
        seen.has(item.link) ||
        now - item.publishedAt > MAX_AGE ||
        item.publishedAt > now + 3_600_000
      )
        continue
      seen.add(item.link)
      items.push(item)
      count++
    }
    return { id: feed.id, name: feed.name, ok: true, count, error: null }
  })
  items.sort((a, b) => b.publishedAt - a.publishedAt)
  return { fetchedAt: now, items: items.slice(0, 300), sources }
}

export async function getNews(): Promise<NewsPayload> {
  if (cache && Date.now() - cache.at < TTL) return cache.payload
  if (!inflight) {
    inflight = aggregate()
      .then((payload) => {
        if (payload.sources.some((s) => s.ok))
          cache = { at: Date.now(), payload }
        return payload
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Node-style handler shared by the Vercel function and the dev server. */
export async function handleNews(req: IncomingMessage, res: ServerResponse) {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405
    res.setHeader("allow", "GET, HEAD")
    res.end()
    return
  }
  try {
    const payload = await getNews()
    const anyOk = payload.sources.some((s) => s.ok)
    res.statusCode = anyOk ? 200 : 502
    res.setHeader("content-type", "application/json; charset=utf-8")
    res.setHeader(
      "cache-control",
      anyOk ? "public, s-maxage=300, stale-while-revalidate=600" : "no-store"
    )
    res.end(JSON.stringify(payload))
  } catch (error) {
    res.statusCode = 500
    res.setHeader("content-type", "application/json; charset=utf-8")
    res.setHeader("cache-control", "no-store")
    res.end(
      JSON.stringify({ error: String((error as Error)?.message ?? error) })
    )
  }
}
