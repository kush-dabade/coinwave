import { useMemo, useState } from "react"
import { BookmarkPlus, Plus, X } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { LineChart } from "@/components/charts/LineChart"
import { Change } from "@/components/data/Change"
import { EmptyState, Skeleton } from "@/components/data/states"
import { AssetCell } from "@/components/data/table"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { AssetPicker } from "@/components/portfolio/AssetPicker"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Segmented,
} from "@/components/ui/controls"
import { useDailyCloses, useQuotes } from "@/hooks/queries"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import { formatCompactMoney, formatPercent, formatPrice } from "@/lib/format"
import { T } from "@/lib/table"
import {
  annualizedVolatility,
  beta,
  correlation,
  dayKey,
  maxDrawdown,
  MIN_OBSERVATIONS,
  pairedReturns,
  periodReturn,
  seriesReturns,
  sinceDay,
  type DailySeries,
} from "@/lib/stats"
import { cn } from "@/lib/utils"
import { researchActions } from "@/stores"
import type { Asset } from "@/services/coingecko"

const RANGES = [
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "180", label: "180D" },
  { value: "365", label: "1Y" },
] as const

function corrColor(v: number | null) {
  if (v === null) return "var(--surface-2)"
  const a = Math.min(1, Math.abs(v))
  return v >= 0
    ? `color-mix(in srgb, var(--series-1) ${Math.round(a * 70)}%, var(--surface))`
    : `color-mix(in srgb, var(--series-2) ${Math.round(a * 70)}%, var(--surface))`
}

export default function ComparePage() {
  usePageTitle("Compare")
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const ids = useMemo(
    () =>
      [
        ...new Set(
          (params.get("ids") ?? "bitcoin,ethereum,solana")
            .split(",")
            .filter(Boolean)
        ),
      ].slice(0, 6),
    [params]
  )
  const days = Number(
    RANGES.find((r) => r.value === params.get("range"))?.value ?? "90"
  )
  const now = useNow(3_600_000)
  const windowStart = dayKey(now - days * 86_400_000)

  const setIds = (next: string[]) => {
    const p = new URLSearchParams(params)
    p.set("ids", next.join(","))
    setParams(p, { replace: true })
  }

  const withBtc = useMemo(
    () => (ids.includes("bitcoin") ? ids : [...ids, "bitcoin"]),
    [ids]
  )
  const { assets, isLoading } = useQuotes(withBtc)
  const list = useMemo(
    () => withBtc.map((id) => assets.get(id)).filter((a): a is Asset => !!a),
    [withBtc, assets]
  )
  const closes = useDailyCloses(list)
  const fromCoinGecko = ids
    .filter((id) => closes.sources.get(id) === "coingecko")
    .map((id) => assets.get(id)?.symbol ?? id)

  const ranged = useMemo(() => {
    const m = new Map<string, DailySeries>()
    for (const [id, s] of closes.series) m.set(id, sinceDay(s, windowStart))
    return m
  }, [closes.series, windowStart])

  const chartSeries = useMemo(
    () =>
      ids
        .map((id) => {
          const s = ranged.get(id)
          const a = assets.get(id)
          if (!s || s.size < 2 || !a) return null
          const daysSorted = [...s.keys()].sort()
          const first = s.get(daysSorted[0])!
          return {
            id,
            label: a.symbol,
            points: daysSorted.map((d) => ({
              t: Date.parse(d),
              v: (s.get(d)! / first - 1) * 100,
            })),
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [ids, ranged, assets]
  )

  const btc = ranged.get("bitcoin")
  const stats = useMemo(
    () =>
      ids.map((id) => {
        const s = ranged.get(id)
        if (!s)
          return {
            id,
            ret: null,
            vol: null,
            dd: null,
            beta: null,
            obs: 0,
            starts: null as string | null,
          }
        const values = [...s.keys()].sort().map((d) => s.get(d)!)
        const pr = btc && id !== "bitcoin" ? pairedReturns(s, btc) : null
        return {
          id,
          ret: periodReturn(s),
          vol: annualizedVolatility(seriesReturns(s)),
          dd: values.length >= 2 ? (maxDrawdown(values)?.pct ?? null) : null,
          beta: id === "bitcoin" ? 1 : pr ? beta(pr.a, pr.b) : null,
          obs: seriesReturns(s).length,
          starts: [...s.keys()].sort()[0] ?? null,
        }
      }),
    [ids, ranged, btc]
  )

  const matrix = useMemo(
    () =>
      ids.map((a) =>
        ids.map((b) => {
          if (a === b) return { v: 1, n: null as number | null }
          const sa = ranged.get(a)
          const sb = ranged.get(b)
          if (!sa || !sb) return { v: null, n: 0 }
          const pr = pairedReturns(sa, sb)
          return { v: correlation(pr.a, pr.b), n: pr.a.length }
        })
      ),
    [ids, ranged]
  )

  const rangeLabel =
    RANGES.find((r) => Number(r.value) === days)?.label ?? `${days}D`
  const loading = isLoading || closes.loading.length > 0

  const saveToResearch = () => {
    const lines = [
      `Comparison over ${rangeLabel} (daily closes, ${new Date().toISOString().slice(0, 10)}).`,
      "",
      "| Asset | Return | Ann. volatility | Max drawdown | Beta vs BTC |",
      "| --- | --- | --- | --- | --- |",
      ...stats.map((s) => {
        const a = assets.get(s.id)
        return `| ${a?.name ?? s.id} | ${formatPercent(s.ret)} | ${formatPercent(s.vol, { signed: false })} | ${formatPercent(s.dd)} | ${s.beta === null ? "—" : s.beta.toFixed(2)} |`
      }),
    ]
    const note = researchActions.createNote({
      kind: "comparison",
      title: `Compare: ${ids.map((id) => assets.get(id)?.symbol ?? id).join(" vs ")} (${rangeLabel})`,
      body: lines.join("\n"),
      assetIds: ids,
      links: [
        {
          url: `${window.location.origin}/compare?ids=${ids.join(",")}&range=${days}`,
          title: "Open this comparison",
        },
      ],
    })
    toast("Comparison saved to Research", {
      action: {
        label: "Open",
        onClick: () => navigate(`/research?note=${note.id}`),
      },
    })
  }

  return (
    <Page>
      <PageHeader
        title="Compare"
        description="Performance indexed to each asset’s first close in the window, with risk statistics from the same daily data."
        actions={
          <>
            <Segmented
              label="Window"
              size="sm"
              value={String(days)}
              onChange={(v) =>
                setParams(
                  new URLSearchParams({ ids: ids.join(","), range: v }),
                  { replace: true }
                )
              }
              options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
            />
            <Button
              size="sm"
              onClick={saveToResearch}
              disabled={stats.every((s) => s.ret === null)}
            >
              <BookmarkPlus aria-hidden="true" /> Save to research
            </Button>
          </>
        }
      />

      <div
        className="mb-3 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Assets being compared"
      >
        {ids.map((id, i) => {
          const a = assets.get(id)
          return (
            <span
              key={id}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-rule-strong bg-surface pr-1 pl-2.5 text-[0.8125rem] text-ink"
            >
              <span
                className="h-0.5 w-3 rounded"
                style={{ background: `var(--series-${(i % 6) + 1})` }}
                aria-hidden="true"
              />
              {a?.name ?? id}
              <button
                type="button"
                disabled={ids.length <= 1}
                aria-label={`Remove ${a?.name ?? id}`}
                onClick={() => setIds(ids.filter((x) => x !== id))}
                className="inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-40"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          )
        })}
        {ids.length < 6 && (
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <Button size="sm">
                <Plus aria-hidden="true" /> Add asset
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-2">
              <AssetPicker
                inputId="compare-add"
                value={null}
                suggestedIds={[]}
                onChange={(a) => {
                  if (a) {
                    setIds([...ids.filter((x) => x !== a.id), a.id])
                    setAdding(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Pane
          title={`Performance, ${rangeLabel}`}
          subtitle="% change from each asset’s first close in the window"
        >
          {chartSeries.length > 0 ? (
            <LineChart
              series={chartSeries}
              format="percent"
              baseline={0}
              height="h-[340px]"
              summary={`Indexed performance over ${rangeLabel}: ${stats.map((s) => `${assets.get(s.id)?.symbol ?? s.id} ${formatPercent(s.ret)}`).join(", ")}.`}
            />
          ) : loading ? (
            <Skeleton className="h-[340px]" />
          ) : (
            <EmptyState title="No price history">
              Daily prices couldn’t be loaded for these assets.
            </EmptyState>
          )}
          {closes.failed.length > 0 && (
            <p className="mt-2 text-xs text-warn">
              No history for:{" "}
              {closes.failed
                .map((id) => assets.get(id)?.symbol ?? id)
                .join(", ")}
              .
            </p>
          )}
          {stats.some((s) => s.starts && s.starts > windowStart) && (
            <p className="mt-2 text-xs text-ink-3">
              Shorter history:{" "}
              {stats
                .filter((s) => s.starts && s.starts > windowStart)
                .map((s) => `${assets.get(s.id)?.symbol} from ${s.starts}`)
                .join(", ")}
              .
            </p>
          )}
        </Pane>

        <Pane
          title="Correlation of daily returns"
          subtitle={`${rangeLabel} · needs ${MIN_OBSERVATIONS}+ shared days`}
        >
          {ids.length < 2 ? (
            <p className="text-[0.8125rem] text-ink-3">Add another asset.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0.5 text-xs">
                <caption className="sr-only">
                  Correlation matrix of daily returns
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sr-only">
                      Asset
                    </th>
                    {ids.map((id) => (
                      <th
                        key={id}
                        scope="col"
                        className="mono px-1 pb-1 font-medium text-ink-3"
                      >
                        {assets.get(id)?.symbol ?? id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ids.map((a, i) => (
                    <tr key={a}>
                      <th
                        scope="row"
                        className="mono pr-1.5 text-right font-medium text-ink-3"
                      >
                        {assets.get(a)?.symbol ?? a}
                      </th>
                      {matrix[i].map((cell, j) => (
                        <td
                          key={ids[j]}
                          className="num h-9 w-12 rounded-sm text-center text-ink"
                          style={{ background: corrColor(cell.v) }}
                          title={
                            cell.n !== null
                              ? `${cell.n} paired daily returns`
                              : undefined
                          }
                        >
                          {cell.v === null ? "—" : cell.v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[0.6875rem] text-ink-3">
            1 = move together, 0 = unrelated, −1 = opposite. Correlations change
            over time and break down in stress.
          </p>
        </Pane>
      </div>

      <Pane title="Side by side" className="mt-3" flush>
        <div className="overflow-x-auto">
          <table className={T.table}>
            <caption className="sr-only">Comparison metrics</caption>
            <thead className={T.thead}>
              <tr>
                <th scope="col" className={cn(T.th, "text-left")}>
                  Asset
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  Price
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  Mkt cap
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right md:table-cell")}
                >
                  FDV
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right md:table-cell")}
                >
                  Vol 24h
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  24h
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  30d
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right lg:table-cell")}
                >
                  1y
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  {rangeLabel} return
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right sm:table-cell")}
                  title="Annualised, from daily returns (√365)"
                >
                  Volatility
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right sm:table-cell")}
                >
                  Max drawdown
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right lg:table-cell")}
                >
                  Beta vs BTC
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right xl:table-cell")}
                >
                  Days
                </th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id, i) => {
                const a = assets.get(id)
                const s = stats[i]
                return (
                  <tr key={id} className={T.tr}>
                    <td className={T.td}>
                      {a ? (
                        <AssetCell
                          id={a.id}
                          name={a.name}
                          symbol={a.symbol}
                          image={a.image}
                        />
                      ) : (
                        <span className="text-ink-3">{id}</span>
                      )}
                    </td>
                    <td className={cn(T.td, "num text-right text-ink")}>
                      {formatPrice(a?.price)}
                    </td>
                    <td className={cn(T.td, "num text-right text-ink-2")}>
                      {formatCompactMoney(a?.marketCap)}
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-2 md:table-cell"
                      )}
                    >
                      {formatCompactMoney(a?.fdv)}
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-2 md:table-cell"
                      )}
                    >
                      {formatCompactMoney(a?.volume24h)}
                    </td>
                    <td className={cn(T.td, "text-right")}>
                      <Change value={a?.change24h} />
                    </td>
                    <td className={cn(T.td, "text-right")}>
                      <Change value={a?.change30d} />
                    </td>
                    <td className={cn(T.td, "hidden text-right lg:table-cell")}>
                      <Change value={a?.change1y} />
                    </td>
                    <td className={cn(T.td, "text-right font-medium")}>
                      <Change value={s.ret} />
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-2 sm:table-cell"
                      )}
                    >
                      {formatPercent(s.vol, { signed: false, digits: 0 })}
                    </td>
                    <td className={cn(T.td, "hidden text-right sm:table-cell")}>
                      <Change value={s.dd} digits={1} />
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-2 lg:table-cell"
                      )}
                    >
                      {s.beta === null ? "—" : s.beta.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "num hidden text-right text-ink-3 xl:table-cell"
                      )}
                    >
                      {s.obs}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-rule px-3 py-2 text-[0.6875rem] text-ink-3">
          Daily closes from Binance (USDT pairs) where available, otherwise
          CoinGecko
          {fromCoinGecko.length > 0 &&
            ` (used for ${fromCoinGecko.join(", ")})`}
          . Volatility is the annualised standard deviation of daily returns;
          drawdown is the largest fall from a previous high within the window;
          beta measures sensitivity to Bitcoin’s daily moves. Statistics need at
          least {MIN_OBSERVATIONS} observations and describe the past only.
        </p>
      </Pane>
    </Page>
  )
}
