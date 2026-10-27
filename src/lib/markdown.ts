/**
 * A small, safe Markdown subset for research notes: headings, lists, quotes,
 * code blocks, tables, emphasis, inline code and links. It produces a plain
 * data structure that components render as React elements, so user text is
 * never injected as HTML. Links are limited to http(s).
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "rule" }

function safeHref(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
      ? u.toString()
      : null
  } catch {
    return null
  }
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const push = (t: string) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last?.type === "text") last.text += t
    else out.push({ type: "text", text: t })
  }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    let m: RegExpMatchArray | null
    if ((m = rest.match(/^`([^`]+)`/))) {
      out.push({ type: "code", text: m[1] })
    } else if ((m = rest.match(/^\*\*(.+?)\*\*/))) {
      out.push({ type: "strong", children: parseInline(m[1]) })
    } else if (
      (m = rest.match(/^\*([^*\s][^*]*?)\*/)) ||
      (m = rest.match(/^_([^_\s][^_]*?)_(?![A-Za-z0-9])/))
    ) {
      out.push({ type: "em", children: parseInline(m[1]) })
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      const href = safeHref(m[2])
      if (href) out.push({ type: "link", href, children: parseInline(m[1]) })
      else push(m[0])
    } else if ((m = rest.match(/^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/))) {
      const href = safeHref(m[0])
      if (href)
        out.push({
          type: "link",
          href,
          children: [{ type: "text", text: m[0] }],
        })
      else push(m[0])
    } else {
      const next = rest.slice(1).search(/[`*_[h]/)
      const take = next === -1 ? rest.length : next + 1
      push(rest.slice(0, take))
      i += take
      continue
    }
    i += m[0].length
  }
  return out
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => parseInline(c.trim()))

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === "") {
      i++
      continue
    }
    if (line.startsWith("```")) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```"))
        body.push(lines[i++])
      i++
      blocks.push({ type: "code", text: body.join("\n") })
      continue
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      blocks.push({
        type: "heading",
        level: h[1].length as 1 | 2 | 3,
        children: parseInline(h[2]),
      })
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ type: "rule" })
      i++
      continue
    }
    if (
      line.trim().startsWith("|") &&
      lines[i + 1]?.trim().match(/^\|?\s*:?-{2,}/)
    ) {
      const header = cells(line)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && lines[i].trim().startsWith("|"))
        rows.push(cells(lines[i++]))
      blocks.push({ type: "table", header, rows })
      continue
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i]))
        body.push(lines[i++].replace(/^>\s?/, ""))
      blocks.push({ type: "quote", children: parseInline(body.join(" ")) })
      continue
    }
    const listMatch = line.match(/^\s*([-*]|\d+[.)])\s+/)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1])
      const items: Inline[][] = []
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*]|\d+[.)])\s+(.*)$/)
        if (!m || /\d/.test(m[1]) !== ordered) break
        items.push(parseInline(m[2]))
        i++
      }
      blocks.push({ type: "list", ordered, items })
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|```|>\s?|\s*([-*]|\d+[.)])\s+)/.test(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i++].trim())
    }
    if (para.length)
      blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) })
    else i++
  }
  return blocks
}

/** Plain text of a note body, for search snippets. */
export function plainText(source: string) {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
