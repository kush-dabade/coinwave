import { describe, expect, it } from "vitest"

import { parseInline, parseMarkdown, plainText } from "./markdown"

describe("parseInline", () => {
  it("parses emphasis, code and links", () => {
    expect(parseInline("a **b** *c* `d` [e](https://x.com)")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
      { type: "text", text: " " },
      {
        type: "link",
        href: "https://x.com/",
        children: [{ type: "text", text: "e" }],
      },
    ])
  })

  it("never produces unsafe links", () => {
    const out = parseInline("[click](javascript:alert(1)) and data:text/html,x")
    expect(out.some((n) => n.type === "link")).toBe(false)
    expect(
      out.map((n) => (n.type === "text" ? n.text : "")).join("")
    ).toContain("[click](javascript:alert(1))")
  })

  it("autolinks bare URLs without trailing punctuation", () => {
    const out = parseInline("see https://example.com/a, then go")
    const link = out.find((n) => n.type === "link")
    expect(link && link.type === "link" && link.href).toBe(
      "https://example.com/a"
    )
  })

  it("leaves HTML as literal text", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)>" },
    ])
  })
})

describe("parseMarkdown", () => {
  it("parses headings, lists, quotes, code and rules", () => {
    const blocks = parseMarkdown(
      "# Title\n\n- one\n- two\n\n1. a\n2. b\n\n> quoted\n\n```\ncode\n```\n\n---\n\nPara\ncontinues"
    )
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "list",
      "list",
      "quote",
      "code",
      "rule",
      "paragraph",
    ])
    expect(blocks[1].type === "list" && blocks[1].items.length).toBe(2)
    expect(blocks[2].type === "list" && blocks[2].ordered).toBe(true)
    expect(blocks[4].type === "code" && blocks[4].text).toBe("code")
  })

  it("parses tables (as used by saved comparisons)", () => {
    const blocks = parseMarkdown(
      "| Asset | Return |\n| --- | --- |\n| BTC | +5% |\n| ETH | −2% |"
    )
    expect(blocks).toHaveLength(1)
    const t = blocks[0]
    expect(t.type).toBe("table")
    if (t.type === "table") {
      expect(t.header).toHaveLength(2)
      expect(t.rows).toHaveLength(2)
    }
  })

  it("extracts plain text for search", () => {
    expect(plainText("# Hi **there**\n- [a](https://x.y)")).toBe(
      "Hi there a https://x.y"
    )
  })
})
