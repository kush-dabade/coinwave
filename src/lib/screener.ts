/**
 * Asset screener: a catalogue of real, documented fields and a small
 * condition engine. An asset with no value for a field never passes a
 * filter on that field: unknown is not zero.
 */

import type { Asset } from "@/services/coingecko"

/** Metrics derived from 60 days of daily candles (the optional history scan). */
export type HistoryMetrics = {
  /** % below the highest daily high of the last 30 days (≤ 0). */
  fromHigh30d: number | null
  /** % above the lowest daily low of the last 30 days (≥ 0). */
  fromLow30d: number | null
  /** Latest full day's volume divided by the average of the prior 30 days. */
  volumeRatio30d: number | null
  /** Annualised volatility of the last 30 daily returns (%). */
  volatility30d: number | null
}

export type ScreenRow = Asset & {
  volToMcap: number | null
  rs7d: number | null
  rs30d: number | null
  rs1y: number | null
  circulatingPct: number | null
  range24hPos: number | null
} & Partial<HistoryMetrics>

export type FieldKey =
  | "marketCap"
  | "volume24h"
  | "volToMcap"
  | "price"
  | "rank"
  | "change1h"
  | "change24h"
  | "change7d"
  | "change30d"
  | "change200d"
  | "change1y"
  | "rs7d"
  | "rs30d"
  | "rs1y"
  | "athChange"
  | "range24hPos"
  | "circulatingPct"
  | "fdv"
  | "fromHigh30d"
  | "fromLow30d"
  | "volumeRatio30d"
  | "volatility30d"

export type Unit = "usd" | "pct" | "ratio" | "rank" | "price"

export type Field = {
  key: FieldKey
  label: string
  short: string
  unit: Unit
  group:
    | "Size"
    | "Performance"
    | "Relative strength"
    | "Valuation & supply"
    | "History scan"
  /** "history" fields need the optional candle scan to be run. */
  source: "market" | "history"
  help: string
}

export const FIELDS: Field[] = [
  {
    key: "marketCap",
    label: "Market cap",
    short: "Mkt cap",
    unit: "usd",
    group: "Size",
    source: "market",
    help: "Price × circulating supply (CoinGecko).",
  },
  {
    key: "volume24h",
    label: "24h volume",
    short: "Vol 24h",
    unit: "usd",
    group: "Size",
    source: "market",
    help: "Reported trading volume over 24 hours across exchanges.",
  },
  {
    key: "volToMcap",
    label: "Volume / market cap",
    short: "Turnover",
    unit: "pct",
    group: "Size",
    source: "market",
    help: "24h volume as a share of market cap: how actively the asset is traded relative to its size.",
  },
  {
    key: "rank",
    label: "Market cap rank",
    short: "Rank",
    unit: "rank",
    group: "Size",
    source: "market",
    help: "Position by market cap.",
  },
  {
    key: "price",
    label: "Price",
    short: "Price",
    unit: "price",
    group: "Size",
    source: "market",
    help: "Last price in USD.",
  },
  {
    key: "change1h",
    label: "1h change",
    short: "1h",
    unit: "pct",
    group: "Performance",
    source: "market",
    help: "Price change over the last hour.",
  },
  {
    key: "change24h",
    label: "24h change",
    short: "24h",
    unit: "pct",
    group: "Performance",
    source: "market",
    help: "Price change over 24 hours.",
  },
  {
    key: "change7d",
    label: "7d change",
    short: "7d",
    unit: "pct",
    group: "Performance",
    source: "market",
    help: "Price change over 7 days.",
  },
  {
    key: "change30d",
    label: "30d change",
    short: "30d",
    unit: "pct",
    group: "Performance",
    source: "market",
    help: "Price change over 30 days.",
  },
  {
    key: "change200d",
    label: "200d change",
    short: "200d",
    unit: "pct",
    group: "Performance",
    source: "market",
    help: "Price change over 200 days.",
  },
  {
    key: "change1y",
    label: "1y change",
    short: "1y",
    unit: "pct",
    group: "Performance",
    source: "market",
    help: "Price change over 1 year.",
  },
  {
    key: "rs7d",
    label: "vs Bitcoin, 7d",
    short: "vs BTC 7d",
    unit: "pct",
    group: "Relative strength",
    source: "market",
    help: "7d change minus Bitcoin's 7d change, in percentage points. Positive = outperforming BTC.",
  },
  {
    key: "rs30d",
    label: "vs Bitcoin, 30d",
    short: "vs BTC 30d",
    unit: "pct",
    group: "Relative strength",
    source: "market",
    help: "30d change minus Bitcoin's 30d change, in percentage points.",
  },
  {
    key: "rs1y",
    label: "vs Bitcoin, 1y",
    short: "vs BTC 1y",
    unit: "pct",
    group: "Relative strength",
    source: "market",
    help: "1y change minus Bitcoin's 1y change, in percentage points.",
  },
  {
    key: "athChange",
    label: "From all-time high",
    short: "From ATH",
    unit: "pct",
    group: "Valuation & supply",
    source: "market",
    help: "How far the price is below its all-time high (0% = at the high).",
  },
  {
    key: "range24hPos",
    label: "Position in 24h range",
    short: "24h range",
    unit: "pct",
    group: "Valuation & supply",
    source: "market",
    help: "Where the price sits between the 24h low (0%) and high (100%).",
  },
  {
    key: "circulatingPct",
    label: "Circulating / max supply",
    short: "Float",
    unit: "pct",
    group: "Valuation & supply",
    source: "market",
    help: "Share of the maximum supply already circulating. Empty for assets without a max supply.",
  },
  {
    key: "fdv",
    label: "Fully diluted value",
    short: "FDV",
    unit: "usd",
    group: "Valuation & supply",
    source: "market",
    help: "Price × total or max supply.",
  },
  {
    key: "fromHigh30d",
    label: "From 30-day high",
    short: "From 30d high",
    unit: "pct",
    group: "History scan",
    source: "history",
    help: "How far the latest close is below the highest daily high of the last 30 days (Binance candles).",
  },
  {
    key: "fromLow30d",
    label: "Above 30-day low",
    short: "Above 30d low",
    unit: "pct",
    group: "History scan",
    source: "history",
    help: "How far the latest close is above the lowest daily low of the last 30 days.",
  },
  {
    key: "volumeRatio30d",
    label: "Volume vs 30-day average",
    short: "Vol ratio",
    unit: "ratio",
    group: "History scan",
    source: "history",
    help: "Latest full day's Binance volume divided by its average over the prior 30 days. 2.0× = twice the usual volume.",
  },
  {
    key: "volatility30d",
    label: "30-day volatility",
    short: "Vol 30d",
    unit: "pct",
    group: "History scan",
    source: "history",
    help: "Annualised standard deviation of the last 30 daily returns.",
  },
]

export const FIELD_MAP = Object.fromEntries(
  FIELDS.map((f) => [f.key, f])
) as Record<FieldKey, Field>

export function enrich(
  assets: Asset[],
  history?: Map<string, HistoryMetrics>
): ScreenRow[] {
  const btc = assets.find((a) => a.id === "bitcoin")
  const rel = (v: number | null, b: number | null | undefined) =>
    v !== null && b !== null && b !== undefined ? v - b : null
  return assets.map((a) => ({
    ...a,
    volToMcap:
      a.volume24h !== null && a.marketCap
        ? (a.volume24h / a.marketCap) * 100
        : null,
    rs7d: a.id === "bitcoin" ? null : rel(a.change7d, btc?.change7d),
    rs30d: a.id === "bitcoin" ? null : rel(a.change30d, btc?.change30d),
    rs1y: a.id === "bitcoin" ? null : rel(a.change1y, btc?.change1y),
    circulatingPct:
      a.circulatingSupply && a.maxSupply
        ? Math.min(100, (a.circulatingSupply / a.maxSupply) * 100)
        : null,
    range24hPos:
      a.price !== null &&
      a.high24h !== null &&
      a.low24h !== null &&
      a.high24h > a.low24h
        ? Math.min(
            100,
            Math.max(0, ((a.price - a.low24h) / (a.high24h - a.low24h)) * 100)
          )
        : null,
    ...(history?.get(a.id) ?? {}),
  }))
}

export type Op = "gt" | "lt" | "between"

export type Condition = { field: FieldKey; op: Op; a: number; b?: number }

export function value(row: ScreenRow, field: FieldKey): number | null {
  const v = row[field]
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export function matches(row: ScreenRow, c: Condition) {
  const v = value(row, c.field)
  if (v === null) return false
  if (c.op === "gt") return v > c.a
  if (c.op === "lt") return v < c.a
  const lo = Math.min(c.a, c.b ?? c.a)
  const hi = Math.max(c.a, c.b ?? c.a)
  return v >= lo && v <= hi
}

export function screen(rows: ScreenRow[], conditions: Condition[]) {
  return rows.filter((row) => conditions.every((c) => matches(row, c)))
}

export function usesHistory(conditions: Condition[]) {
  return conditions.some((c) => FIELD_MAP[c.field]?.source === "history")
}

/** Parses "1.5B", "250m", "12k", "-3.5", "2x" into a number. */
export function parseHuman(text: string): number | null {
  const m = text
    .trim()
    .replace(/[,$%\s]/g, "")
    .match(/^(-?\d*\.?\d+)([kmbtx]?)$/i)
  if (!m) return null
  const n = Number(m[1])
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, x: 1, "": 1 }[
    m[2].toLowerCase() as "k"
  ]
  return Number.isFinite(n) ? n * mult : null
}

// --- URL encoding: "change30d.gt.10,marketCap.gt.1e9,athChange.between.-50.-10"

export function encodeConditions(conditions: Condition[]) {
  return conditions
    .map((c) =>
      [c.field, c.op, c.a, ...(c.op === "between" ? [c.b ?? c.a] : [])].join(
        "."
      )
    )
    .join(",")
}

/** Screener URL query for a saved screen (conditions plus its sort). */
export function savedScreenQuery(screen: { conditions: string; sort: string }) {
  const params = new URLSearchParams(screen.sort)
  params.set("f", screen.conditions)
  return params
}

export function decodeConditions(text: string | null): Condition[] {
  if (!text) return []
  const out: Condition[] = []
  for (const part of text.split(",")) {
    // Numbers may be negative and contain dots, so split on known ops.
    const m = part.match(
      /^([a-zA-Z0-9]+)\.(gt|lt|between)\.(-?[\d.e+]+)(?:\.(-?[\d.e+]+))?$/
    )
    if (!m || !(m[1] in FIELD_MAP)) continue
    const a = Number(m[3])
    const b = m[4] !== undefined ? Number(m[4]) : undefined
    if (!Number.isFinite(a) || (b !== undefined && !Number.isFinite(b)))
      continue
    out.push({
      field: m[1] as FieldKey,
      op: m[2] as Op,
      a,
      ...(m[2] === "between" ? { b: b ?? a } : {}),
    })
  }
  return out
}

export type Preset = {
  id: string
  name: string
  description: string
  conditions: Condition[]
  sort: { field: FieldKey; dir: "asc" | "desc" }
}

export const PRESETS: Preset[] = [
  {
    id: "outperforming-btc",
    name: "Outperforming Bitcoin (30d)",
    description: "Assets over $1B whose 30-day change beats Bitcoin's.",
    conditions: [
      { field: "rs30d", op: "gt", a: 0 },
      { field: "marketCap", op: "gt", a: 1e9 },
    ],
    sort: { field: "rs30d", dir: "desc" },
  },
  {
    id: "strongest-7d",
    name: "Strongest large caps (7d)",
    description: "Assets over $10B ranked by 7-day change.",
    conditions: [{ field: "marketCap", op: "gt", a: 1e10 }],
    sort: { field: "change7d", dir: "desc" },
  },
  {
    id: "weakest-30d",
    name: "Weakest over 30 days",
    description: "Assets over $500M with the worst 30-day change.",
    conditions: [
      { field: "marketCap", op: "gt", a: 5e8 },
      { field: "change30d", op: "lt", a: 0 },
    ],
    sort: { field: "change30d", dir: "asc" },
  },
  {
    id: "high-turnover",
    name: "High turnover",
    description:
      "24h volume above 15% of market cap: unusually active trading for the asset's size.",
    conditions: [
      { field: "volToMcap", op: "gt", a: 15 },
      { field: "marketCap", op: "gt", a: 2e8 },
    ],
    sort: { field: "volToMcap", dir: "desc" },
  },
  {
    id: "near-ath",
    name: "Within 10% of all-time high",
    description: "Assets trading close to their all-time high.",
    conditions: [{ field: "athChange", op: "gt", a: -10 }],
    sort: { field: "athChange", dir: "desc" },
  },
  {
    id: "deep-drawdown",
    name: "Deep drawdown, still large",
    description:
      "More than 80% below the all-time high but still over $500M in market cap.",
    conditions: [
      { field: "athChange", op: "lt", a: -80 },
      { field: "marketCap", op: "gt", a: 5e8 },
    ],
    sort: { field: "athChange", dir: "asc" },
  },
  {
    id: "low-float",
    name: "Low float",
    description:
      "Less than half of the maximum supply circulating: future supply can dilute holders.",
    conditions: [{ field: "circulatingPct", op: "lt", a: 50 }],
    sort: { field: "circulatingPct", dir: "asc" },
  },
  {
    id: "unusual-volume",
    name: "Unusual volume (history scan)",
    description:
      "Yesterday's Binance volume at least twice its 30-day average.",
    conditions: [{ field: "volumeRatio30d", op: "gt", a: 2 }],
    sort: { field: "volumeRatio30d", dir: "desc" },
  },
  {
    id: "near-30d-high",
    name: "Near 30-day high (history scan)",
    description:
      "Latest close within 3% of the highest high of the last 30 days.",
    conditions: [{ field: "fromHigh30d", op: "gt", a: -3 }],
    sort: { field: "fromHigh30d", dir: "desc" },
  },
  {
    id: "near-30d-low",
    name: "Near 30-day low (history scan)",
    description:
      "Latest close within 3% of the lowest low of the last 30 days.",
    conditions: [{ field: "fromLow30d", op: "lt", a: 3 }],
    sort: { field: "fromLow30d", dir: "asc" },
  },
]

/**
 * History metrics from daily candles (oldest first). The current, still
 * forming day is excluded so "yesterday" is a complete day.
 */
export function historyMetrics(
  candles: { t: number; h: number; l: number; c: number; v: number | null }[],
  now = Date.now()
): HistoryMetrics {
  const today = new Date(now).toISOString().slice(0, 10)
  const complete = candles.filter(
    (c) => new Date(c.t).toISOString().slice(0, 10) < today
  )
  const last30 = complete.slice(-30)
  const empty = {
    fromHigh30d: null,
    fromLow30d: null,
    volumeRatio30d: null,
    volatility30d: null,
  }
  if (last30.length < 30) return empty
  const close = last30[last30.length - 1].c
  const high = Math.max(...last30.map((c) => c.h))
  const low = Math.min(...last30.map((c) => c.l))
  const prior = complete
    .slice(-31, -1)
    .map((c) => c.v)
    .filter((v): v is number => v !== null && v > 0)
  const lastVol = last30[last30.length - 1].v
  const avg = prior.length === 30 ? prior.reduce((a, b) => a + b, 0) / 30 : null
  const rets: number[] = []
  for (let i = 1; i < last30.length; i++)
    rets.push(last30[i].c / last30[i - 1].c - 1)
  const m = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(
    rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1)
  )
  return {
    fromHigh30d: high > 0 ? (close / high - 1) * 100 : null,
    fromLow30d: low > 0 ? (close / low - 1) * 100 : null,
    volumeRatio30d: avg && lastVol !== null ? lastVol / avg : null,
    volatility30d: sd * Math.sqrt(365) * 100,
  }
}
