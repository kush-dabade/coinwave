import { describe, expect, it } from "vitest"

import {
  createBackup,
  describeSection,
  mergeSection,
  parseBackup,
  type BackupData,
} from "./backup"
import type { Transaction } from "./portfolio"
import { DEFAULT_SETTINGS, type Note, type WatchlistsData } from "./workspace"

const tx = (id: string, partial: Partial<Transaction> = {}): Transaction => ({
  id,
  assetId: "bitcoin",
  symbol: "BTC",
  name: "Bitcoin",
  image: null,
  side: "buy",
  quantity: 1,
  price: 100,
  date: "2024-01-01",
  createdAt: 1,
  ...partial,
})

const note = (id: string, updatedAt: number, title = id): Note => ({
  id,
  kind: "note",
  title,
  body: "",
  tags: [],
  assetIds: [],
  collectionId: null,
  links: [],
  source: null,
  pinned: false,
  createdAt: 0,
  updatedAt,
  revisions: [],
})

const lists = (...l: WatchlistsData["lists"]): WatchlistsData => ({
  version: 1,
  lists: l,
  defaultId: l[0]?.id ?? "default",
})
const item = (assetId: string) => ({ assetId, note: "", addedAt: 0 })

describe("parseBackup", () => {
  it("round-trips a backup made by createBackup", () => {
    const data: Partial<BackupData> = {
      settings: { ...DEFAULT_SETTINGS, marketPageSize: 50 },
      portfolio: { version: 2, transactions: [tx("a")], sample: false },
      screens: [
        {
          id: "s1",
          name: "Large caps",
          conditions: "mcap>1e9",
          sort: "",
          createdAt: 1,
        },
      ],
    }
    const result = parseBackup(
      JSON.stringify(createBackup(data, 1700000000000))
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.exportedAt).toBe(1700000000000)
    expect(result.backup.data.settings?.marketPageSize).toBe(50)
    expect(result.backup.data.portfolio?.transactions).toHaveLength(1)
    expect(result.backup.data.screens?.[0].name).toBe("Large caps")
    expect(result.backup.dropped).toEqual({})
  })

  it("rejects invalid JSON, foreign files and newer versions with a reason", () => {
    expect(parseBackup("{nope")).toMatchObject({
      ok: false,
      error: expect.stringContaining("JSON"),
    })
    expect(parseBackup(JSON.stringify({ holdings: [] }))).toMatchObject({
      ok: false,
      error: expect.stringContaining("isn’t a CoinWave backup"),
    })
    expect(
      parseBackup(
        JSON.stringify({ format: "coinwave-backup", version: 99, data: {} })
      )
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("newer version"),
    })
    expect(
      parseBackup(
        JSON.stringify({ format: "coinwave-backup", version: 1, data: {} })
      )
    ).toMatchObject({ ok: false })
  })

  it("drops invalid records and reports how many", () => {
    const text = JSON.stringify({
      format: "coinwave-backup",
      version: 1,
      data: {
        portfolio: {
          transactions: [
            tx("a"),
            { assetId: "x", side: "buy", quantity: -1, price: 1 },
            "junk",
          ],
        },
        alerts: {
          alerts: [
            { id: "1", kind: "price_above", assetId: "bitcoin", threshold: 1 },
            { id: "2", kind: "teleport" },
          ],
        },
      },
    })
    const result = parseBackup(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.data.portfolio?.transactions).toHaveLength(1)
    expect(result.backup.data.alerts?.alerts).toHaveLength(1)
    expect(result.backup.dropped).toEqual({ portfolio: 2, alerts: 1 })
  })

  it("only includes sections present in the file and never invents an empty watchlist", () => {
    const result = parseBackup(
      JSON.stringify({
        format: "coinwave-backup",
        version: 1,
        data: { journal: { theses: [] }, watchlists: { lists: [] } },
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.backup.data)).toEqual(["journal"])
  })
})

describe("mergeSection", () => {
  it("skips duplicate transactions by id and by content", () => {
    const current = {
      version: 2 as const,
      transactions: [tx("a"), tx("b", { date: "2024-02-01" })],
      sample: false,
    }
    const incoming = {
      version: 2 as const,
      transactions: [
        tx("a"),
        tx("z", { date: "2024-02-01" }),
        tx("c", { date: "2024-03-01" }),
      ],
      sample: false,
    }
    const out = mergeSection("portfolio", current, incoming)
    expect(out).toMatchObject({ ok: true, added: 1, skipped: 2 })
    if (out.ok)
      expect(out.value.transactions.map((t) => t.id)).toEqual(["a", "b", "c"])
  })

  it("refuses a merge that would oversell and never mixes in sample data", () => {
    const current = {
      version: 2 as const,
      transactions: [tx("a")],
      sample: false,
    }
    const sell = {
      version: 2 as const,
      transactions: [
        tx("s", { side: "sell", quantity: 5, date: "2024-01-05" }),
      ],
      sample: false,
    }
    expect(mergeSection("portfolio", current, sell)).toMatchObject({
      ok: false,
      error: expect.stringContaining("sell more BTC"),
    })

    const sample = {
      version: 2 as const,
      transactions: [tx("x", { date: "2023-01-01" })],
      sample: true,
    }
    expect(mergeSection("portfolio", current, sample)).toMatchObject({
      ok: true,
      added: 0,
      skipped: 1,
      value: current,
    })

    const fromSample = mergeSection("portfolio", sample, current)
    expect(fromSample).toMatchObject({ ok: true, added: 1 })
    if (fromSample.ok)
      expect(fromSample.value).toEqual({
        version: 2,
        transactions: [tx("a")],
        sample: false,
      })
  })

  it("keeps the newer copy of a research note", () => {
    const current = {
      version: 1 as const,
      notes: [note("n1", 10, "old"), note("n2", 50, "mine")],
      collections: [],
    }
    const incoming = {
      version: 1 as const,
      notes: [note("n1", 20, "new"), note("n2", 40, "theirs"), note("n3", 1)],
      collections: [],
    }
    const out = mergeSection("research", current, incoming)
    expect(out).toMatchObject({ ok: true, added: 1, updated: 1, skipped: 1 })
    if (out.ok)
      expect(out.value.notes.map((n) => n.title)).toEqual(["new", "mine", "n3"])
  })

  it("unions watchlist items into lists with the same id", () => {
    const current = lists({
      id: "l1",
      name: "Core",
      createdAt: 0,
      items: [item("bitcoin")],
    })
    const incoming = lists(
      {
        id: "l1",
        name: "Core",
        createdAt: 0,
        items: [item("bitcoin"), item("ethereum")],
      },
      { id: "l2", name: "DeFi", createdAt: 0, items: [item("aave")] }
    )
    const out = mergeSection("watchlists", current, incoming)
    expect(out).toMatchObject({ ok: true, added: 1, updated: 1 })
    if (!out.ok) return
    expect(
      out.value.lists.map((l) => [l.id, l.items.map((i) => i.assetId)])
    ).toEqual([
      ["l1", ["bitcoin", "ethereum"]],
      ["l2", ["aave"]],
    ])
    expect(out.value.defaultId).toBe("l1")
    // The input is not mutated.
    expect(current.lists[0].items).toHaveLength(1)
  })
})

describe("describeSection", () => {
  it("summarises contents for the import preview", () => {
    expect(
      describeSection("portfolio", {
        version: 2,
        transactions: [tx("a")],
        sample: true,
      })
    ).toBe("1 transaction (sample data)")
    expect(
      describeSection(
        "watchlists",
        lists({
          id: "l",
          name: "x",
          createdAt: 0,
          items: [item("a"), item("b")],
        })
      )
    ).toBe("1 list, 2 assets")
    expect(describeSection("journal", { version: 1, theses: [] })).toBe(
      "0 theses, 0 journal entries"
    )
  })
})
