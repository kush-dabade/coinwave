/**
 * Reconstructs a portfolio's daily value from its transaction ledger and
 * daily closing prices. Nothing is estimated: a day's value is the sum of
 * quantities held at the end of that day times that day's close.
 *
 * - Transactions apply at the end of their calendar date. Entries with an
 *   unknown date (imported from older versions) are treated as held from the
 *   start of the window.
 * - Assets without any price history in the window are excluded entirely
 *   (their trades too) and listed, rather than valued at zero.
 * - Performance is a time-weighted return (TWR): each day's return strips out
 *   that day's purchases and sales, so adding money is not mistaken for gains.
 */

import { annualizedVolatility, maxDrawdown, type DailySeries } from "./stats"
import { sortTransactions, type Transaction } from "./portfolio"

export type HistoryPoint = {
  day: string
  value: number
  /** Cumulative net cash put in: purchases (with fees) minus sale proceeds. */
  invested: number
  /** Time-weighted performance index, 100 at the first day with holdings. */
  index: number | null
  flow: number
}

export type Attribution = {
  assetId: string
  symbol: string
  name: string
  startValue: number
  endValue: number
  netFlows: number
  /** Gain over the window: value change minus net money added. */
  contribution: number
}

export type PortfolioHistory = {
  points: HistoryPoint[]
  excluded: { assetId: string; symbol: string }[]
  attribution: Attribution[]
  metrics: {
    twr: number | null
    volatility: number | null
    maxDrawdown: number | null
    bestDay: { day: string; pct: number } | null
    worstDay: { day: string; pct: number } | null
    days: number
  }
}

const DAY = 86_400_000

function addDays(day: string, n: number) {
  return new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10)
}

/** Close for `day`, carrying the last close forward over gaps of up to 3 days. */
function closeOn(series: DailySeries, day: string) {
  for (let back = 0; back <= 3; back++) {
    const v = series.get(addDays(day, -back))
    if (v !== undefined) return v
  }
  return undefined
}

function cash(tx: Transaction) {
  const gross = tx.quantity * tx.price
  const fee = tx.fee ?? 0
  return tx.side === "buy" ? gross + fee : -(gross - fee)
}

export function reconstructHistory(
  transactions: Transaction[],
  prices: Map<string, DailySeries>,
  window: { start: string; end: string }
): PortfolioHistory {
  const sorted = sortTransactions(transactions)
  const excludedIds = new Set(
    sorted.filter((t) => !prices.get(t.assetId)?.size).map((t) => t.assetId)
  )
  const included = sorted.filter((t) => !excludedIds.has(t.assetId))
  const meta = new Map(
    sorted.map((t) => [t.assetId, { symbol: t.symbol, name: t.name }])
  )

  const qty = new Map<string, number>()
  const flowsByAsset = new Map<string, number>()
  let invested = 0
  let cursor = 0
  // Everything dated before the window (or undated) forms the opening position.
  while (
    cursor < included.length &&
    (included[cursor].date ?? "") < window.start
  ) {
    const tx = included[cursor]
    qty.set(
      tx.assetId,
      (qty.get(tx.assetId) ?? 0) +
        (tx.side === "buy" ? tx.quantity : -tx.quantity)
    )
    invested += cash(tx)
    cursor++
  }

  const points: HistoryPoint[] = []
  // Opening position valued at the first day's close, before that day's trades.
  const startValues = new Map<string, number>()
  for (const [assetId, q] of qty) {
    const close = closeOn(prices.get(assetId)!, window.start)
    if (q > 1e-12 && close !== undefined) startValues.set(assetId, q * close)
  }
  const endValues = new Map<string, number>()
  let prevValue = 0
  let index: number | null = null
  const dailyReturns: { day: string; r: number }[] = []

  for (let day = window.start; day <= window.end; day = addDays(day, 1)) {
    // Holding nothing before today's trades (and not the window's opening
    // position): today's return is measured on the cash put in.
    const startsEmpty =
      prevValue === 0 &&
      day !== window.start &&
      ![...qty.values()].some((q) => q > 1e-12)
    const openingEmpty =
      day === window.start && ![...qty.values()].some((q) => q > 1e-12)
    let flow = 0
    while (cursor < included.length && included[cursor].date === day) {
      const tx = included[cursor]
      qty.set(
        tx.assetId,
        (qty.get(tx.assetId) ?? 0) +
          (tx.side === "buy" ? tx.quantity : -tx.quantity)
      )
      const c = cash(tx)
      flow += c
      flowsByAsset.set(tx.assetId, (flowsByAsset.get(tx.assetId) ?? 0) + c)
      cursor++
    }
    invested += flow

    let value = 0
    for (const [assetId, q] of qty) {
      if (q <= 1e-12) continue
      const close = closeOn(prices.get(assetId)!, day)
      if (close === undefined) continue
      const v = q * close
      value += v
      endValues.set(assetId, v)
    }
    for (const assetId of qty.keys())
      if ((qty.get(assetId) ?? 0) <= 1e-12) endValues.set(assetId, 0)

    if (prevValue > 0) {
      const r = (value - flow) / prevValue - 1
      index = (index ?? 100) * (1 + r)
      dailyReturns.push({ day, r })
    } else if ((startsEmpty || openingEmpty) && flow > 0 && value > 0) {
      // Bought from nothing: performance from the purchase price to the close.
      const r = value / flow - 1
      index = (index ?? 100) * (1 + r)
      dailyReturns.push({ day, r })
    } else if (value > 0 && index === null) {
      index = 100
    }
    points.push({ day, value, invested, index, flow })
    prevValue = value
  }

  const attribution: Attribution[] = [...meta.entries()]
    .filter(([assetId]) => !excludedIds.has(assetId))
    .map(([assetId, m]) => {
      const startValue = startValues.get(assetId) ?? 0
      const endValue = endValues.get(assetId) ?? 0
      const netFlows = flowsByAsset.get(assetId) ?? 0
      return {
        assetId,
        ...m,
        startValue,
        endValue,
        netFlows,
        contribution: endValue - startValue - netFlows,
      }
    })
    .filter((a) => a.startValue !== 0 || a.endValue !== 0 || a.netFlows !== 0)
    .sort((a, b) => b.contribution - a.contribution)

  // The index starts at 100 before its first return.
  const indexValues = [100, ...points.map((p) => p.index)].filter(
    (v): v is number => v !== null
  )
  const sortedReturns = [...dailyReturns].sort((a, b) => a.r - b.r)
  const dd = maxDrawdown(indexValues)

  return {
    points,
    excluded: [...excludedIds].map((assetId) => ({
      assetId,
      symbol: meta.get(assetId)?.symbol ?? assetId,
    })),
    attribution,
    metrics: {
      twr:
        indexValues.length >= 2
          ? (indexValues[indexValues.length - 1] / indexValues[0] - 1) * 100
          : null,
      volatility: annualizedVolatility(dailyReturns.map((d) => d.r)),
      maxDrawdown: dd ? dd.pct : null,
      bestDay: sortedReturns.length
        ? {
            day: sortedReturns[sortedReturns.length - 1].day,
            pct: sortedReturns[sortedReturns.length - 1].r * 100,
          }
        : null,
      worstDay: sortedReturns.length
        ? { day: sortedReturns[0].day, pct: sortedReturns[0].r * 100 }
        : null,
      days: dailyReturns.length,
    },
  }
}
