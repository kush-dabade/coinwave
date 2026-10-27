/**
 * Minimal, dependency-free RSS 2.0 / Atom parser for news headlines.
 * Extracts only what CoinWave displays: title, link, date, a plain-text
 * summary, categories and an image. Anything it cannot read safely is
 * skipped rather than guessed.
 */

export type NewsItem = {
  id: string
  title: string
  link: string
  source: string
  sourceId: string
  publishedAt: number
  summary: string
  categories: string[]
  image: string | null
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  euro: "€",
  pound: "£",
}

export function decodeEntities(text: string) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10)
        return Number.isFinite(n) && n > 0 && n < 0x110000
          ? String.fromCodePoint(n)
          : match
      }
      return NAMED[code.toLowerCase()] ?? match
    }
  )
}

function unwrap(raw: string) {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return cdata ? cdata[1] : decodeEntities(raw)
}

export function toPlainText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Feed summaries often repeat the publisher and headline before the text and
 * end with "The post … appeared first on …" boilerplate. Strip both so the
 * summary adds something the headline doesn't.
 */
export function cleanSummary(text: string, title: string, source: string) {
  let out = text.trim()
  const lower = (s: string) => s.toLowerCase()
  if (source && lower(out).startsWith(lower(source)))
    out = out.slice(source.length).trim()
  // Only a full headline (4+ words) is treated as a repeat, not a word that
  // happens to start the summary.
  if (title.split(/\s+/).length >= 4 && lower(out).startsWith(lower(title)))
    out = out
      .slice(title.length)
      .replace(/^[\s:.\-–—]+/, "")
      .trim()
  out = out
    .replace(
      /\s*(The|This) post .{0,400}? (first appeared|appeared first) on .{0,120}?\.?$/i,
      ""
    )
    .trim()
  return out
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return (
    cut
      .slice(0, Math.max(cut.lastIndexOf(" "), max - 20))
      .replace(/[\s,;:.]+$/, "") + "…"
  )
}

function tag(block: string, name: string) {
  const m = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")
  )
  return m ? unwrap(m[1]).trim() : null
}

function attr(block: string, name: string, attribute: string) {
  const m = block.match(
    new RegExp(`<${name}\\s[^>]*${attribute}="([^"]+)"`, "i")
  )
  return m ? decodeEntities(m[1]) : null
}

function httpUrl(value: string | null) {
  if (!value) return null
  try {
    const u = new URL(value.trim())
    return u.protocol === "https:" || u.protocol === "http:"
      ? u.toString()
      : null
  } catch {
    return null
  }
}

/** Stable short id derived from the article URL. */
export function hashId(text: string) {
  let h = 5381
  for (let i = 0; i < text.length; i++)
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function parseFeed(
  xml: string,
  source: { id: string; name: string }
): NewsItem[] {
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    []
  const items: NewsItem[] = []
  for (const block of blocks) {
    const title = toPlainText(tag(block, "title") ?? "")
    const link =
      httpUrl(tag(block, "link")) ?? httpUrl(attr(block, "link", "href"))
    const dateText =
      tag(block, "pubDate") ??
      tag(block, "published") ??
      tag(block, "updated") ??
      tag(block, "dc:date")
    const publishedAt = dateText ? Date.parse(dateText) : NaN
    if (!title || !link || !Number.isFinite(publishedAt)) continue
    const description =
      tag(block, "description") ??
      tag(block, "summary") ??
      tag(block, "content:encoded") ??
      ""
    const categories = [
      ...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi),
    ]
      .map((m) => toPlainText(unwrap(m[1])))
      .concat(
        [...block.matchAll(/<category\s[^>]*term="([^"]+)"/gi)].map((m) =>
          decodeEntities(m[1])
        )
      )
      .filter(Boolean)
    const image =
      httpUrl(attr(block, "media:content", "url")) ??
      httpUrl(attr(block, "media:thumbnail", "url")) ??
      (/<enclosure[^>]*type="image/i.test(block)
        ? httpUrl(attr(block, "enclosure", "url"))
        : null)
    items.push({
      id: hashId(link),
      title: truncate(title, 300),
      link,
      source: source.name,
      sourceId: source.id,
      publishedAt,
      summary: truncate(
        cleanSummary(toPlainText(description), title, source.name),
        320
      ),
      categories: [...new Set(categories)].slice(0, 8),
      image,
    })
  }
  return items
}
