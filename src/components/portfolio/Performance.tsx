import { useMemo } from "react"

import { LineChart } from "@/components/charts/LineChart"
import { Change } from "@/components/data/Change"
import { EmptyState, Skeleton } from "@/components/data/states"
import { Pane } from "@/components/layout/Page"
import { useDailyCloses, useQuotes } from "@/hooks/queries"
import { useNow } from "@/hooks/use-ui"
import { formatDate, formatMoney, formatPercent } from "@/lib/format"
import { reconstructHistory } from "@/lib/portfolio-history"
import { dayKey } from "@/lib/stats"
import { cn, toneClass } from "@/lib/utils"
import type { Transaction } from "@/lib/portfolio"
import { T } from "@/lib/table"
import type { Asset } from "@/services/coingecko"

const BENCHMARKS = ["bitcoin", "ethereum"]

export function Performance({ transactions }: { transactions: Transaction[] }) {
  const ids = useMemo(
    () => [...new Set([...transactions.map((t) => t.assetId), ...BENCHMARKS])],
    [transactions]
  )
  const { assets, isLoading: quotesLoading } = useQuotes(ids)
  const list = useMemo(
    () => ids.map((id) => assets.get(id)).filter((a): a is Asset => !!a),
    [ids, assets]
  )
  const closes = useDailyCloses(list)

  // Hourly clock: the window only moves when the day changes.
  const now = useNow(3_600_000)
  const span = useMemo(() => {
    const end = dayKey(now - 86_400_000)
    const earliestAllowed = dayKey(now - 364 * 86_400_000)
    const dated = transactions
      .map((t) => t.date)
      .filter((d): d is string => !!d)
      .sort()
    const hasUndated = transactions.some((t) => !t.date)
    const first = hasUndated || dated.length === 0 ? earliestAllowed : dated[0]
    return {
      start: first < earliestAllowed ? earliestAllowed : first,
      end,
      truncated: first < earliestAllowed,
    }
  }, [transactions, now])

  const portfolioIds = useMemo(
    () => new Set(transactions.map((t) => t.assetId)),
    [transactions]
  )
  // Assets CoinGecko doesn't know never get a quote: they count as "no history",
  // not as still loading.
  const pending =
    quotesLoading ||
    [...portfolioIds].some(
      (id) => assets.has(id) && closes.loading.includes(id)
    )

  const history = useMemo(() => {
    if (pending) return null
    const prices = new Map(
      [...closes.series].filter(([id]) => portfolioIds.has(id))
    )
    return reconstructHistory(transactions, prices, span)
  }, [pending, closes.series, portfolioIds, transactions, span])

  const firstHeld = history?.points.find((p) => p.index !== null)?.day ?? null
  const benchmarks = useMemo(() => {
    if (!firstHeld) return []
    return BENCHMARKS.map((id) => {
      const s = closes.series.get(id)
      if (!s) return null
      const days = [...s.keys()]
        .filter((d) => d >= firstHeld && d <= span.end)
        .sort()
      const base = s.get(days[0])
      if (!base) return null
      return {
        id,
        label: assets.get(id)?.symbol ?? id,
        points: days.map((d) => ({
          t: Date.parse(d),
          v: (s.get(d)! / base - 1) * 100,
        })),
        dashed: true,
      }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  }, [firstHeld, closes.series, span.end, assets])

  if (transactions.length === 0) return null
  if (!history) return <Skeleton className="h-96" />

  const held = history.points.filter((p) => p.index !== null)
  if (held.length < 2) {
    return (
      <EmptyState title="Not enough history yet">
        Performance needs at least two days of holdings with known prices. It
        will appear as days pass.
      </EmptyState>
    )
  }
  const twrSeries = {
    id: "portfolio",
    label: "Portfolio (TWR)",
    points: held.map((p) => ({ t: Date.parse(p.day), v: p.index! - 100 })),
  }
  const total = history.attribution.reduce((s, a) => s + a.contribution, 0)

  return (
    <div className="space-y-3">
      {(history.excluded.length > 0 || span.truncated) && (
        <div className="rounded-md border border-rule bg-warn-soft px-3 py-2 text-xs text-warn">
          {history.excluded.length > 0 && (
            <p>
              No daily price history for{" "}
              {history.excluded.map((e) => e.symbol || e.assetId).join(", ")}:
              excluded from history, returns and attribution.
            </p>
          )}
          {span.truncated && (
            <p>
              Free price data covers the last 365 days, so history before{" "}
              {formatDate(span.start)} isn’t shown; earlier holdings start at
              that date.
            </p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Time-weighted return",
            value: <Change value={history.metrics.twr} />,
            sub: `Since ${formatDate(firstHeld)}`,
          },
          {
            label: "Volatility (annualised)",
            value: formatPercent(history.metrics.volatility, { signed: false }),
            sub: `${history.metrics.days} daily returns`,
          },
          {
            label: "Max drawdown",
            value: <Change value={history.metrics.maxDrawdown} />,
            sub: "Largest fall from a high",
          },
          {
            label: "Best day",
            value: <Change value={history.metrics.bestDay?.pct} />,
            sub: formatDate(history.metrics.bestDay?.day),
          },
          {
            label: "Worst day",
            value: <Change value={history.metrics.worstDay?.pct} />,
            sub: formatDate(history.metrics.worstDay?.day),
          },
          {
            label: "Gain in span",
            value: (
              <span className={toneClass(total)}>
                {formatMoney(total, { signed: true })}
              </span>
            ),
            sub: "Value change minus money added",
          },
        ].map((m) => (
          <div key={m.label} className="bg-surface px-3 py-2.5">
            <dt className="text-[0.6875rem] text-ink-3">{m.label}</dt>
            <dd className="num mt-0.5 text-base font-semibold">{m.value}</dd>
            <dd className="text-[0.6875rem] text-ink-3">{m.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 xl:grid-cols-2">
        <Pane
          title="Value and net invested"
          subtitle="Daily, at each day’s close (UTC)"
        >
          <LineChart
            series={[
              {
                id: "value",
                label: "Value",
                points: history.points.map((p) => ({
                  t: Date.parse(p.day),
                  v: p.value,
                })),
              },
              {
                id: "invested",
                label: "Net invested",
                points: history.points.map((p) => ({
                  t: Date.parse(p.day),
                  v: p.invested,
                })),
                dashed: true,
              },
            ]}
            format="money"
            area
            summary={`Portfolio value from ${formatMoney(held[0].value)} to ${formatMoney(held[held.length - 1].value)}; net invested ${formatMoney(history.points[history.points.length - 1].invested)}.`}
          />
        </Pane>
        <Pane
          title="Return versus benchmarks"
          subtitle="Time-weighted: purchases and sales don’t count as performance"
        >
          <LineChart
            series={[twrSeries, ...benchmarks]}
            format="percent"
            baseline={0}
            summary={`Time-weighted return ${formatPercent(history.metrics.twr)}; ${benchmarks.map((b) => `${b.label} ${formatPercent(b.points[b.points.length - 1]?.v)}`).join(", ")} over the same period.`}
          />
        </Pane>
      </div>

      <Pane
        title="Attribution"
        subtitle={`Contribution to gain since ${formatDate(span.start)}, net of purchases and sales`}
        flush
      >
        <table className={T.table}>
          <caption className="sr-only">Gain contribution by asset</caption>
          <thead className={T.thead}>
            <tr>
              <th scope="col" className={cn(T.th, "text-left")}>
                Asset
              </th>
              <th
                scope="col"
                className={cn(T.th, "hidden text-right sm:table-cell")}
              >
                Start value
              </th>
              <th
                scope="col"
                className={cn(T.th, "hidden text-right sm:table-cell")}
              >
                Net added
              </th>
              <th scope="col" className={cn(T.th, "text-right")}>
                End value
              </th>
              <th scope="col" className={cn(T.th, "text-right")}>
                Contribution
              </th>
              <th scope="col" className={cn(T.th, "hidden w-40 md:table-cell")}>
                <span className="sr-only">Share</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {history.attribution.map((a) => {
              const max = Math.max(
                ...history.attribution.map((x) => Math.abs(x.contribution)),
                1
              )
              return (
                <tr key={a.assetId} className={T.tr}>
                  <td className={cn(T.td, "font-medium text-ink")}>
                    {assets.get(a.assetId)?.name ?? a.name}
                  </td>
                  <td
                    className={cn(
                      T.td,
                      "num hidden text-right text-ink-2 sm:table-cell"
                    )}
                  >
                    {formatMoney(a.startValue)}
                  </td>
                  <td
                    className={cn(
                      T.td,
                      "num hidden text-right text-ink-2 sm:table-cell"
                    )}
                  >
                    {formatMoney(a.netFlows, { signed: true })}
                  </td>
                  <td className={cn(T.td, "num text-right text-ink-2")}>
                    {formatMoney(a.endValue)}
                  </td>
                  <td
                    className={cn(
                      T.td,
                      "num text-right font-medium",
                      toneClass(a.contribution)
                    )}
                  >
                    {formatMoney(a.contribution, { signed: true })}
                  </td>
                  <td
                    className={cn(T.td, "hidden md:table-cell")}
                    aria-hidden="true"
                  >
                    <span className="relative block h-2">
                      <span className="absolute inset-y-0 left-1/2 w-px bg-rule-strong" />
                      <span
                        className={cn(
                          "absolute inset-y-0",
                          a.contribution >= 0
                            ? "left-1/2 bg-up"
                            : "right-1/2 bg-down"
                        )}
                        style={{
                          width: `${(Math.abs(a.contribution) / max) * 50}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Pane>

      <p className="text-[0.6875rem] leading-5 text-ink-3">
        Rebuilt from your transactions and daily closing prices (Binance USDT
        pairs, or CoinGecko where Binance has no pair). Trades apply at the end
        of their date; entries without a date count as held from the start. Fees
        are included in cash flows. Transfers between your own wallets aren’t
        recorded and have no effect; deposits of crypto acquired elsewhere
        should be entered as buys at their cost. The time-weighted return
        removes the effect of when you added or withdrew money; it is the return
        of the strategy, not of your dollars. Past performance says nothing
        about future returns.
      </p>
    </div>
  )
}
