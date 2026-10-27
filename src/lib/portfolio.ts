/**
 * Portfolio accounting.
 *
 * Holdings are derived from a ledger of buy/sell transactions using the
 * average-cost method:
 *   - a buy adds quantity and its cost to the position;
 *   - a sell removes quantity at the current average cost, and the
 *     difference between sale proceeds and that cost is realised P&L.
 *
 * Assets are keyed by CoinGecko id, never by ticker: tickers are not unique
 * (several unrelated tokens trade as "BTC").
 *
 * Everything here is pure so it can be unit tested.
 */

import { isNum } from "./format"

export type Side = "buy" | "sell"

export type Transaction = {
  id: string
  assetId: string
  symbol: string
  name: string
  image: string | null
  side: Side
  /** Units of the asset, always > 0. */
  quantity: number
  /** USD per unit, >= 0. */
  price: number
  /**
   * Trading fee in USD (optional, >= 0). Added to cost basis on a buy and
   * deducted from proceeds on a sale.
   */
  fee?: number
  /** Local calendar date YYYY-MM-DD; null when unknown (imported data). */
  date: string | null
  createdAt: number
  note?: string
}

export type PortfolioData = {
  version: 2
  transactions: Transaction[]
  /** True while the ledger holds the bundled sample, not the user's data. */
  sample: boolean
}

/** Quantities below this are treated as zero (float dust from sells). */
const DUST = 1e-12

export function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    // Unknown dates sort first: they predate anything the user entered.
    const da = a.date ?? ""
    const db = b.date ?? ""
    if (da !== db) return da < db ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export type LedgerPosition = {
  assetId: string
  symbol: string
  name: string
  image: string | null
  quantity: number
  /** Cost of the quantity still held. */
  costBasis: number
  realizedPnL: number
  feesPaid: number
  /** Sells that exceeded holdings (only possible with inconsistent data). */
  oversold: boolean
  transactionCount: number
}

export function buildLedger(
  transactions: Transaction[]
): Map<string, LedgerPosition> {
  const positions = new Map<string, LedgerPosition>()
  for (const tx of sortTransactions(transactions)) {
    let pos = positions.get(tx.assetId)
    if (!pos) {
      pos = {
        assetId: tx.assetId,
        symbol: tx.symbol,
        name: tx.name,
        image: tx.image,
        quantity: 0,
        costBasis: 0,
        realizedPnL: 0,
        feesPaid: 0,
        oversold: false,
        transactionCount: 0,
      }
      positions.set(tx.assetId, pos)
    }
    pos.transactionCount += 1
    const fee = tx.fee ?? 0
    pos.feesPaid += fee
    if (tx.side === "buy") {
      pos.quantity += tx.quantity
      pos.costBasis += tx.quantity * tx.price + fee
      continue
    }
    const sold = Math.min(tx.quantity, pos.quantity)
    if (tx.quantity - pos.quantity > DUST) pos.oversold = true
    if (sold <= 0) continue
    const avgCost = pos.costBasis / pos.quantity
    // A sale's fee reduces its proceeds (pro-rated if the sale was capped).
    const saleFee = fee * (sold / tx.quantity)
    pos.realizedPnL += sold * (tx.price - avgCost) - saleFee
    pos.costBasis -= sold * avgCost
    pos.quantity -= sold
    if (pos.quantity < DUST) {
      pos.quantity = 0
      pos.costBasis = 0
    }
  }
  return positions
}

/** Quantity of an asset held at the end of `date` (inclusive). */
export function quantityHeldOn(
  transactions: Transaction[],
  assetId: string,
  date: string,
  excludeId?: string
) {
  const relevant = transactions.filter(
    (tx) =>
      tx.assetId === assetId && tx.id !== excludeId && (tx.date ?? "") <= date
  )
  return buildLedger(relevant).get(assetId)?.quantity ?? 0
}

/**
 * The first point at which selling would exceed holdings for an asset, if
 * any. Used to validate a new/edited transaction or a deletion against the
 * whole ledger, not just the balance on one day.
 */
export function findOversell(
  transactions: Transaction[],
  assetId: string
): { date: string | null; shortBy: number } | null {
  let quantity = 0
  for (const tx of sortTransactions(
    transactions.filter((t) => t.assetId === assetId)
  )) {
    quantity += tx.side === "buy" ? tx.quantity : -tx.quantity
    if (quantity < -DUST * Math.max(1, tx.quantity)) {
      return { date: tx.date, shortBy: -quantity }
    }
  }
  return null
}

/** The first asset among `assetIds` whose ledger sells more than it holds. */
export function findAnyOversell(
  transactions: Transaction[],
  assetIds: Iterable<string>
) {
  for (const assetId of new Set(assetIds)) {
    const short = findOversell(transactions, assetId)
    if (short) return { assetId, ...short }
  }
  return null
}

export type Quote = {
  price: number | null
  change24h: number | null
  priceChange24h: number | null
  name?: string
  symbol?: string
  image?: string | null
}

export type Position = LedgerPosition & {
  avgCost: number | null
  price: number | null
  value: number | null
  unrealizedPnL: number | null
  unrealizedPct: number | null
  change24hPct: number | null
  /** USD change in this position's value over the last 24h. */
  change24hValue: number | null
  /** Share of the priced portfolio value (0-100). */
  weight: number | null
}

export type PortfolioSummary = {
  /** Null when open positions exist but none can be priced (unknown, not $0). */
  value: number | null
  /** Cost basis of open positions that have a price. */
  costBasis: number
  unrealizedPnL: number | null
  unrealizedPct: number | null
  realizedPnL: number
  totalPnL: number | null
  /** 24h change over positions whose 24h move is known. */
  change24hValue: number | null
  change24hPct: number | null
  /** Priced positions with no known 24h move; excluded from the 24h figures. */
  change24hExcluded: string[]
  openCount: number
  /** Open positions without a current price; excluded from totals. */
  unpriced: string[]
  /** 1 / Σw² — how many equal-sized positions the allocation behaves like. */
  effectivePositions: number | null
}

function dayChangeValue(quantity: number, quote: Quote): number | null {
  if (isNum(quote.priceChange24h)) return quantity * quote.priceChange24h
  if (isNum(quote.price) && isNum(quote.change24h) && quote.change24h > -100) {
    return quantity * (quote.price - quote.price / (1 + quote.change24h / 100))
  }
  return null
}

export function valuePortfolio(
  transactions: Transaction[],
  quotes: Map<string, Quote>
): { positions: Position[]; closed: Position[]; summary: PortfolioSummary } {
  const ledger = buildLedger(transactions)
  const all: Position[] = []
  for (const pos of ledger.values()) {
    const quote = quotes.get(pos.assetId)
    const price = quote && isNum(quote.price) ? quote.price : null
    const open = pos.quantity > 0
    const value = open && price !== null ? pos.quantity * price : null
    const unrealizedPnL = value !== null ? value - pos.costBasis : null
    all.push({
      ...pos,
      name: quote?.name ?? pos.name,
      symbol: quote?.symbol ?? pos.symbol,
      image: quote?.image ?? pos.image,
      avgCost: open ? pos.costBasis / pos.quantity : null,
      price,
      value,
      unrealizedPnL,
      unrealizedPct:
        unrealizedPnL !== null && pos.costBasis > 0
          ? (unrealizedPnL / pos.costBasis) * 100
          : null,
      change24hPct: quote && isNum(quote.change24h) ? quote.change24h : null,
      change24hValue:
        open && quote ? dayChangeValue(pos.quantity, quote) : null,
      weight: null,
    })
  }

  const positions = all.filter((p) => p.quantity > 0)
  const closed = all.filter((p) => p.quantity === 0)
  const priced = positions.filter((p) => p.value !== null)
  const value = priced.reduce((sum, p) => sum + (p.value ?? 0), 0)
  for (const p of priced)
    p.weight = value > 0 ? ((p.value ?? 0) / value) * 100 : null

  const costBasis = priced.reduce((sum, p) => sum + p.costBasis, 0)
  const unrealizedPnL = value - costBasis
  const realizedPnL = all.reduce((sum, p) => sum + p.realizedPnL, 0)
  const withDay = priced.filter((p) => isNum(p.change24hValue))
  const change24hValue =
    withDay.length > 0
      ? withDay.reduce((sum, p) => sum + (p.change24hValue ?? 0), 0)
      : null
  const dayBase = withDay.reduce((sum, p) => sum + (p.value ?? 0), 0)
  const valueYesterday =
    change24hValue !== null ? dayBase - change24hValue : null
  const weights = priced.map((p) => (p.weight ?? 0) / 100)
  const hhi = weights.reduce((sum, w) => sum + w * w, 0)

  positions.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  closed.sort((a, b) => a.name.localeCompare(b.name))

  // Holding assets without a single price means the value is unknown.
  const unknown = positions.length > 0 && priced.length === 0

  return {
    positions,
    closed,
    summary: {
      value: unknown ? null : value,
      costBasis,
      unrealizedPnL: unknown ? null : unrealizedPnL,
      unrealizedPct:
        !unknown && costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : null,
      realizedPnL,
      totalPnL: unknown ? null : unrealizedPnL + realizedPnL,
      change24hValue,
      change24hPct:
        valueYesterday !== null && valueYesterday > 0 && change24hValue !== null
          ? (change24hValue / valueYesterday) * 100
          : null,
      change24hExcluded: priced
        .filter((p) => !isNum(p.change24hValue))
        .map((p) => p.symbol || p.name),
      openCount: positions.length,
      unpriced: positions
        .filter((p) => p.value === null)
        .map((p) => p.symbol || p.name),
      effectivePositions: hhi > 0 ? 1 / hhi : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Persistence: validation, legacy migration, sample data

export function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Accepts only well-formed transactions; anything else is dropped. */
export function sanitizeTransaction(raw: unknown): Transaction | null {
  if (!raw || typeof raw !== "object") return null
  const t = raw as Record<string, unknown>
  const quantity = Number(t.quantity)
  const price = Number(t.price)
  if (typeof t.assetId !== "string" || t.assetId === "") return null
  if (t.side !== "buy" && t.side !== "sell") return null
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(price) || price < 0) return null
  const date =
    typeof t.date === "string" && DATE_RE.test(t.date) ? t.date : null
  const fee = Number(t.fee)
  return {
    id: typeof t.id === "string" && t.id ? t.id : newId(),
    assetId: t.assetId,
    symbol: typeof t.symbol === "string" ? t.symbol : "",
    name: typeof t.name === "string" && t.name ? t.name : t.assetId,
    image: typeof t.image === "string" ? t.image : null,
    side: t.side,
    quantity,
    price,
    ...(Number.isFinite(fee) && fee > 0 ? { fee } : {}),
    date,
    createdAt: Number.isFinite(Number(t.createdAt)) ? Number(t.createdAt) : 0,
    note: typeof t.note === "string" ? t.note : undefined,
  }
}

/** Ticker → CoinGecko id for the 20 assets the previous version supported. */
const LEGACY_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  DOT: "polkadot",
  // The previous version used "polygon", which is not a CoinGecko id.
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  UNI: "uniswap",
  ATOM: "cosmos",
  XLM: "stellar",
  NEAR: "near",
  ICP: "internet-computer",
  APT: "aptos",
}

/**
 * Converts holdings saved by the previous version ({symbol, amount, avgPrice})
 * into opening buy transactions. Purchase dates were never recorded, so they
 * are imported as unknown rather than invented.
 */
export function migrateLegacyHoldings(
  raw: unknown,
  now = Date.now()
): Transaction[] {
  if (!Array.isArray(raw)) return []
  const out: Transaction[] = []
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return
    const h = item as Record<string, unknown>
    const symbol = typeof h.symbol === "string" ? h.symbol.toUpperCase() : ""
    const assetId = LEGACY_IDS[symbol]
    const quantity = Number(h.amount)
    const price = Number(h.avgPrice)
    if (!assetId || !Number.isFinite(quantity) || quantity <= 0) return
    out.push({
      id: newId(),
      assetId,
      symbol,
      name: symbol,
      image: null,
      side: "buy",
      quantity,
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      date: null,
      createdAt: now + index,
      note: "Imported from an earlier version of CoinWave (purchase date not recorded).",
    })
  })
  return out
}

/**
 * The sample ledger shown when someone wants to explore before entering
 * their own data. Always flagged as sample in the UI.
 */
export function sampleTransactions(now = Date.now()): Transaction[] {
  const base = { image: null, createdAt: now }
  const rows: Omit<Transaction, "id" | "image" | "createdAt">[] = [
    {
      assetId: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      side: "buy",
      quantity: 3,
      price: 2000,
      date: "2023-11-02",
    },
    {
      assetId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      side: "buy",
      quantity: 0.5,
      price: 40000,
      date: "2024-01-15",
    },
    {
      assetId: "solana",
      symbol: "SOL",
      name: "Solana",
      side: "buy",
      quantity: 10,
      price: 100,
      date: "2024-02-10",
    },
    {
      assetId: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      side: "sell",
      quantity: 1,
      price: 3500,
      date: "2024-03-12",
    },
  ]
  return rows.map((row, i) => ({
    ...row,
    ...base,
    id: newId(),
    createdAt: now + i,
  }))
}

/** CSV export of the ledger (RFC 4180 quoting). */
export function transactionsToCSV(transactions: Transaction[]) {
  const header = [
    "date",
    "side",
    "asset_id",
    "symbol",
    "name",
    "quantity",
    "price_usd",
    "total_usd",
    "fee_usd",
    "note",
  ]
  const quote = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const lines = sortTransactions(transactions).map((tx) =>
    [
      tx.date ?? "",
      tx.side,
      tx.assetId,
      tx.symbol,
      tx.name,
      String(tx.quantity),
      String(tx.price),
      String(tx.quantity * tx.price),
      String(tx.fee ?? 0),
      tx.note ?? "",
    ]
      .map(quote)
      .join(",")
  )
  return [header.join(","), ...lines].join("\n") + "\n"
}

/** Splits one CSV line, honouring RFC 4180 quoting. */
function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** Splits CSV text into records, allowing newlines inside quoted fields. */
function csvRecords(text: string): string[] {
  const records: string[] = []
  let cur = ""
  let quotes = 0
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    cur = cur ? `${cur}\n${line}` : line
    quotes += (line.match(/"/g) ?? []).length
    if (quotes % 2 === 0) {
      if (cur.trim() !== "") records.push(cur)
      cur = ""
      quotes = 0
    }
  }
  if (cur.trim() !== "") records.push(cur)
  return records
}

export type CSVImportResult = {
  transactions: Transaction[]
  errors: { line: number; message: string }[]
}

/**
 * Parses transactions from CSV in CoinWave's export format (columns are
 * matched by header name, so column order does not matter). Every row is
 * validated; invalid rows are reported, never silently dropped or guessed.
 */
export function parseTransactionsCSV(
  text: string,
  now = Date.now()
): CSVImportResult {
  const records = csvRecords(text)
  const errors: CSVImportResult["errors"] = []
  if (records.length === 0)
    return {
      transactions: [],
      errors: [{ line: 1, message: "The file is empty." }],
    }
  const header = splitCSVLine(records[0]).map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  for (const required of [
    "date",
    "side",
    "asset_id",
    "quantity",
    "price_usd",
  ]) {
    if (col(required) < 0)
      errors.push({ line: 1, message: `Missing column "${required}".` })
  }
  if (errors.length) return { transactions: [], errors }

  const transactions: Transaction[] = []
  records.slice(1).forEach((record, i) => {
    const line = i + 2
    const cells = splitCSVLine(record)
    const get = (name: string) =>
      col(name) >= 0 ? (cells[col(name)] ?? "").trim() : ""
    const date = get("date")
    const side = get("side").toLowerCase()
    const quantity = Number(get("quantity"))
    const price = Number(get("price_usd"))
    const feeText = get("fee_usd")
    const fee = feeText === "" ? 0 : Number(feeText)
    const problems: string[] = []
    if (date !== "" && !DATE_RE.test(date))
      problems.push("date must be YYYY-MM-DD or empty")
    if (side !== "buy" && side !== "sell")
      problems.push('side must be "buy" or "sell"')
    if (!get("asset_id")) problems.push("asset_id is required")
    if (!Number.isFinite(quantity) || quantity <= 0)
      problems.push("quantity must be a positive number")
    if (!Number.isFinite(price) || price < 0)
      problems.push("price_usd must be zero or more")
    if (!Number.isFinite(fee) || fee < 0)
      problems.push("fee_usd must be zero or more")
    if (problems.length) {
      errors.push({ line, message: problems.join("; ") })
      return
    }
    transactions.push({
      id: newId(),
      assetId: get("asset_id"),
      symbol: get("symbol").toUpperCase(),
      name: get("name") || get("asset_id"),
      image: null,
      side: side as Side,
      quantity,
      price,
      ...(fee > 0 ? { fee } : {}),
      date: date || null,
      createdAt: now + i,
      note: get("note") || undefined,
    })
  })
  return { transactions, errors }
}

/** Identity of a transaction for duplicate detection on import. */
export function transactionKey(tx: Transaction) {
  return [
    tx.date ?? "",
    tx.side,
    tx.assetId,
    tx.quantity,
    tx.price,
    tx.fee ?? 0,
  ].join("|")
}
