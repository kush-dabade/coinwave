import { describe, expect, it } from "vitest"

import {
  buildLedger,
  findOversell,
  migrateLegacyHoldings,
  parseTransactionsCSV,
  quantityHeldOn,
  sanitizeTransaction,
  sortTransactions,
  transactionKey,
  transactionsToCSV,
  valuePortfolio,
  type Quote,
  type Transaction,
} from "./portfolio"

let seq = 0
function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "side" | "quantity" | "price">
): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    assetId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    image: null,
    date: "2024-01-01",
    createdAt: seq,
    ...partial,
  }
}

const quote = (
  price: number | null,
  change24h: number | null = null,
  priceChange24h: number | null = null
): Quote => ({
  price,
  change24h,
  priceChange24h,
})

describe("buildLedger (average cost)", () => {
  it("averages cost across buys", () => {
    const ledger = buildLedger([
      tx({ side: "buy", quantity: 1, price: 100 }),
      tx({ side: "buy", quantity: 3, price: 200, date: "2024-01-02" }),
    ])
    const btc = ledger.get("bitcoin")!
    expect(btc.quantity).toBe(4)
    expect(btc.costBasis).toBe(700)
    expect(btc.realizedPnL).toBe(0)
  })

  it("realises P&L on sells at the average cost and keeps the average for the rest", () => {
    const ledger = buildLedger([
      tx({ side: "buy", quantity: 2, price: 100 }),
      tx({ side: "buy", quantity: 2, price: 300, date: "2024-01-02" }),
      tx({ side: "sell", quantity: 1, price: 400, date: "2024-01-03" }),
    ])
    const btc = ledger.get("bitcoin")!
    // avg cost 200; selling 1 @ 400 realises +200
    expect(btc.realizedPnL).toBeCloseTo(200)
    expect(btc.quantity).toBe(3)
    expect(btc.costBasis).toBeCloseTo(600)
  })

  it("orders by date, not by entry order", () => {
    const ledger = buildLedger([
      tx({
        side: "sell",
        quantity: 1,
        price: 50,
        date: "2024-02-01",
        createdAt: 1,
      }),
      tx({
        side: "buy",
        quantity: 1,
        price: 10,
        date: "2024-01-01",
        createdAt: 2,
      }),
    ])
    const btc = ledger.get("bitcoin")!
    expect(btc.oversold).toBe(false)
    expect(btc.quantity).toBe(0)
    expect(btc.realizedPnL).toBeCloseTo(40)
  })

  it("closes a position cleanly despite floating point dust", () => {
    const ledger = buildLedger([
      tx({ side: "buy", quantity: 0.1, price: 10 }),
      tx({ side: "buy", quantity: 0.2, price: 10 }),
      tx({ side: "sell", quantity: 0.3, price: 20, date: "2024-01-02" }),
    ])
    const btc = ledger.get("bitcoin")!
    expect(btc.quantity).toBe(0)
    expect(btc.costBasis).toBe(0)
    expect(btc.oversold).toBe(false)
    expect(btc.realizedPnL).toBeCloseTo(3)
  })

  it("flags (and caps) sells that exceed holdings", () => {
    const ledger = buildLedger([
      tx({ side: "buy", quantity: 1, price: 10 }),
      tx({ side: "sell", quantity: 2, price: 20, date: "2024-01-02" }),
    ])
    const btc = ledger.get("bitcoin")!
    expect(btc.oversold).toBe(true)
    expect(btc.quantity).toBe(0)
    expect(btc.realizedPnL).toBeCloseTo(10)
  })

  it("puts unknown (imported) dates before dated entries", () => {
    const ledger = buildLedger([
      tx({
        side: "sell",
        quantity: 1,
        price: 20,
        date: "2020-01-01",
        createdAt: 1,
      }),
      tx({ side: "buy", quantity: 1, price: 10, date: null, createdAt: 2 }),
    ])
    expect(ledger.get("bitcoin")!.oversold).toBe(false)
  })
})

describe("oversell validation", () => {
  const ledger = [
    tx({ side: "buy", quantity: 1, price: 10, date: "2024-01-01" }),
    tx({ side: "sell", quantity: 1, price: 10, date: "2024-03-01" }),
  ]

  it("reports quantity held on a date", () => {
    expect(quantityHeldOn(ledger, "bitcoin", "2024-02-01")).toBe(1)
    expect(quantityHeldOn(ledger, "bitcoin", "2024-03-01")).toBe(0)
    expect(quantityHeldOn(ledger, "bitcoin", "2023-12-31")).toBe(0)
  })

  it("catches a sale that breaks a later sale", () => {
    const candidate = tx({
      side: "sell",
      quantity: 0.5,
      price: 10,
      date: "2024-02-01",
    })
    expect(quantityHeldOn(ledger, "bitcoin", "2024-02-01")).toBe(1)
    const problem = findOversell([...ledger, candidate], "bitcoin")
    expect(problem).not.toBeNull()
    expect(problem!.date).toBe("2024-03-01")
    expect(problem!.shortBy).toBeCloseTo(0.5)
  })

  it("catches deleting a buy that a later sale depends on", () => {
    expect(findOversell(ledger.slice(1), "bitcoin")).not.toBeNull()
    expect(findOversell(ledger, "bitcoin")).toBeNull()
  })
})

describe("valuePortfolio", () => {
  const transactions = [
    tx({
      side: "buy",
      quantity: 3,
      price: 2000,
      assetId: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      date: "2023-11-02",
    }),
    tx({ side: "buy", quantity: 0.5, price: 40000, date: "2024-01-15" }),
    tx({
      side: "sell",
      quantity: 1,
      price: 3500,
      assetId: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      date: "2024-03-12",
    }),
  ]

  it("separates market movement (24h) from investment performance", () => {
    const quotes = new Map<string, Quote>([
      ["bitcoin", quote(60000, 10, null)],
      ["ethereum", quote(3000, -5, -150)],
    ])
    const { positions, summary } = valuePortfolio(transactions, quotes)

    expect(summary.value).toBeCloseTo(0.5 * 60000 + 2 * 3000)
    expect(summary.costBasis).toBeCloseTo(20000 + 4000)
    expect(summary.unrealizedPnL).toBeCloseTo(36000 - 24000)
    expect(summary.realizedPnL).toBeCloseTo(1500)
    expect(summary.totalPnL).toBeCloseTo(12000 + 1500)
    expect(summary.unrealizedPct).toBeCloseTo(50)

    // BTC: +10% means yesterday 54545.45; ETH uses the absolute change.
    const btcDay = 0.5 * (60000 - 60000 / 1.1)
    const ethDay = 2 * -150
    expect(summary.change24hValue).toBeCloseTo(btcDay + ethDay)
    expect(summary.change24hPct).toBeCloseTo(
      ((btcDay + ethDay) / (36000 - btcDay - ethDay)) * 100
    )

    expect(positions.map((p) => p.assetId)).toEqual(["bitcoin", "ethereum"])
    expect(positions[0].weight! + positions[1].weight!).toBeCloseTo(100)
  })

  it("never values a missing price as zero", () => {
    const quotes = new Map<string, Quote>([["bitcoin", quote(60000, 1)]])
    const { positions, summary } = valuePortfolio(transactions, quotes)
    const eth = positions.find((p) => p.assetId === "ethereum")!
    expect(eth.value).toBeNull()
    expect(eth.unrealizedPnL).toBeNull()
    expect(summary.unpriced).toEqual(["ETH"])
    // Totals cover priced positions only, so cost basis excludes ETH too.
    expect(summary.value).toBeCloseTo(30000)
    expect(summary.costBasis).toBeCloseTo(20000)
    expect(summary.unrealizedPnL).toBeCloseTo(10000)
  })

  it("reports value as unknown when no holding can be priced", () => {
    const { summary } = valuePortfolio(transactions, new Map())
    expect(summary.value).toBeNull()
    expect(summary.unrealizedPnL).toBeNull()
    expect(summary.totalPnL).toBeNull()
    expect(summary.change24hValue).toBeNull()
    // Realised P&L does not depend on current prices.
    expect(summary.realizedPnL).toBeCloseTo(1500)
    expect([...summary.unpriced].sort()).toEqual(["BTC", "ETH"])
  })

  it("computes the 24h move over known positions and names the rest", () => {
    const quotes = new Map<string, Quote>([
      ["bitcoin", quote(60000, null, null)],
      ["ethereum", quote(3000, null, 30)],
    ])
    const { summary } = valuePortfolio(transactions, quotes)
    expect(summary.change24hValue).toBeCloseTo(60)
    // Percentage is relative to the positions included (ETH: 6000 now, 5940 before).
    expect(summary.change24hPct).toBeCloseTo((60 / 5940) * 100)
    expect(summary.change24hExcluded).toEqual(["BTC"])
  })

  it("reports no 24h move when none is known", () => {
    const quotes = new Map<string, Quote>([
      ["bitcoin", quote(60000)],
      ["ethereum", quote(3000)],
    ])
    const { summary } = valuePortfolio(transactions, quotes)
    expect(summary.change24hValue).toBeNull()
    expect(summary.change24hPct).toBeNull()
  })

  it("handles an empty ledger", () => {
    const { positions, summary } = valuePortfolio([], new Map())
    expect(positions).toEqual([])
    expect(summary.value).toBe(0)
    expect(summary.unrealizedPct).toBeNull()
    expect(summary.change24hValue).toBeNull()
    expect(summary.effectivePositions).toBeNull()
  })

  it("computes effective number of positions", () => {
    const quotes = new Map<string, Quote>([
      ["bitcoin", quote(12000)],
      ["ethereum", quote(3000)],
    ])
    // 6000 vs 6000 → two equal positions
    const { summary } = valuePortfolio(transactions, quotes)
    expect(summary.effectivePositions).toBeCloseTo(2)
  })

  it("moves fully sold assets to closed positions with their realised P&L", () => {
    const { positions, closed } = valuePortfolio(
      [
        tx({ side: "buy", quantity: 1, price: 10 }),
        tx({ side: "sell", quantity: 1, price: 15, date: "2024-02-01" }),
      ],
      new Map([["bitcoin", quote(20)]])
    )
    expect(positions).toHaveLength(0)
    expect(closed).toHaveLength(1)
    expect(closed[0].realizedPnL).toBeCloseTo(5)
    expect(closed[0].value).toBeNull()
  })
})

describe("persistence helpers", () => {
  it("migrates legacy holdings without inventing dates", () => {
    const migrated = migrateLegacyHoldings([
      { symbol: "BTC", amount: 0.5, avgPrice: 40000 },
      { symbol: "matic", amount: 100, avgPrice: 0.8 },
      { symbol: "XXX", amount: 1, avgPrice: 1 },
      { symbol: "ETH", amount: Number.NaN, avgPrice: 1 },
      { symbol: "SOL", amount: -1, avgPrice: 1 },
    ])
    expect(
      migrated.map((t) => [t.assetId, t.quantity, t.price, t.date])
    ).toEqual([
      ["bitcoin", 0.5, 40000, null],
      ["matic-network", 100, 0.8, null],
    ])
    expect(migrateLegacyHoldings("garbage")).toEqual([])
  })

  it("rejects malformed stored transactions", () => {
    expect(
      sanitizeTransaction({
        assetId: "bitcoin",
        side: "buy",
        quantity: "abc",
        price: 1,
      })
    ).toBeNull()
    expect(
      sanitizeTransaction({
        assetId: "bitcoin",
        side: "hold",
        quantity: 1,
        price: 1,
      })
    ).toBeNull()
    expect(
      sanitizeTransaction({ assetId: "", side: "buy", quantity: 1, price: 1 })
    ).toBeNull()
    const ok = sanitizeTransaction({
      assetId: "bitcoin",
      side: "sell",
      quantity: "2",
      price: 5,
      date: "bad",
    })
    expect(ok).toMatchObject({
      assetId: "bitcoin",
      side: "sell",
      quantity: 2,
      price: 5,
      date: null,
    })
  })

  it("exports CSV with quoting", () => {
    const csv = transactionsToCSV([
      tx({ side: "buy", quantity: 2, price: 5, note: 'Note, with "quotes"' }),
    ])
    expect(csv.split("\n")[1]).toBe(
      '2024-01-01,buy,bitcoin,BTC,Bitcoin,2,5,10,0,"Note, with ""quotes"""'
    )
  })

  it("round-trips through CSV import, including fees and quoted notes", () => {
    const original = [
      tx({
        side: "buy",
        quantity: 2,
        price: 5,
        fee: 0.5,
        note: 'Multi\nline, "quoted"',
      }),
      tx({ side: "sell", quantity: 1, price: 9, date: "2024-02-01" }),
      tx({ side: "buy", quantity: 3, price: 1, date: null }),
    ]
    const { transactions, errors } = parseTransactionsCSV(
      transactionsToCSV(original)
    )
    expect(errors).toEqual([])
    expect(transactions.map(transactionKey)).toEqual(
      sortTransactions(original).map(transactionKey)
    )
    expect(transactions.find((t) => t.fee)?.note).toBe('Multi\nline, "quoted"')
  })

  it("reports invalid CSV rows with line numbers instead of guessing", () => {
    const csv = [
      "date,side,asset_id,quantity,price_usd",
      "2024-01-01,buy,bitcoin,1,100",
      "01/02/2024,buy,bitcoin,1,100",
      "2024-01-03,hold,bitcoin,-1,abc",
    ].join("\n")
    const { transactions, errors } = parseTransactionsCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(errors.map((e) => e.line)).toEqual([3, 4])
    expect(errors[1].message).toMatch(/side/)
    expect(parseTransactionsCSV("foo,bar\n1,2").errors[0].message).toMatch(
      /Missing column/
    )
  })
})

describe("fees", () => {
  it("adds buy fees to cost basis and deducts sale fees from proceeds", () => {
    const ledger = buildLedger([
      tx({ side: "buy", quantity: 2, price: 100, fee: 4 }),
      tx({ side: "sell", quantity: 1, price: 150, fee: 2, date: "2024-02-01" }),
    ])
    const btc = ledger.get("bitcoin")!
    // avg cost = (200 + 4) / 2 = 102; realised = 150 − 102 − 2 = 46
    expect(btc.realizedPnL).toBeCloseTo(46)
    expect(btc.costBasis).toBeCloseTo(102)
    expect(btc.feesPaid).toBeCloseTo(6)
  })
})
