import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { LineChart } from "@/components/charts/LineChart"
import { Change } from "@/components/data/Change"
import { MarketMap } from "@/components/data/MarketMap"
import { ErrorNotice, Skeleton } from "@/components/data/states"
import { SortHeader } from "@/components/data/table"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { Badge, Segmented } from "@/components/ui/controls"
import {
  isFailing,
  useCategories,
  useDefiTvl,
  useFearGreed,
  useGlobalMarket,
  useStablecoinIds,
  useStablecoinSupply,
  useUniverse,
} from "@/hooks/queries"
import { useMediaQuery, usePageTitle } from "@/hooks/use-ui"
import {
  formatCompactMoney,
  formatPercent,
  formatShare,
  isNum,
} from "@/lib/format"
import { PERIODS, aggregateCap, breadth } from "@/lib/market"
import { dayKey, mean, median } from "@/lib/stats"
import { T, nextSort } from "@/lib/table"
import { cn } from "@/lib/utils"
import type { Asset, PricePoint } from "@/services/coingecko"

function changeOver(series: PricePoint[], days: number) {
  if (series.length < 2) return null
  const last = series[series.length - 1]
  const target = last.t - days * 86_400_000
  const past = [...series].reverse().find((p) => p.t <= target)
  return past && past.p > 0 ? (last.p / past.p - 1) * 100 : null
}

function lastYear(series: PricePoint[]) {
  const cutoff = Date.now() - 365 * 86_400_000
  return series.filter((p) => p.t >= cutoff)
}

type Observation = {
  title: string
  detail: string
  rule: string
  source: string
  tone: "up" | "down" | "neutral"
}

export default function IntelligencePage() {
  usePageTitle("Market Intelligence")
  const universe = useUniverse()
  const global = useGlobalMarket()
  const fg = useFearGreed()
  const stable = useStablecoinSupply()
  const tvl = useDefiTvl()
  const categories = useCategories()
  const stableIds = useStablecoinIds()
  const wide = useMediaQuery("(min-width: 640px)")
  const [exStables, setExStables] = useState<"all" | "ex">("ex")
  const [sort, setSort] = useState<{
    key: "marketCap" | "change24h" | "volume24h"
    dir: "asc" | "desc"
  }>({ key: "marketCap", dir: "desc" })

  const assets = useMemo(() => universe.data ?? [], [universe.data])
  const core = useMemo(
    () =>
      exStables === "ex" ? assets.filter((a) => !stableIds.has(a.id)) : assets,
    [assets, exStables, stableIds]
  )
  const btc = assets.find((a) => a.id === "bitcoin")
  const eth = assets.find((a) => a.id === "ethereum")
  const agg = useMemo(() => aggregateCap(assets), [assets])

  const breadthRows = useMemo(
    () => PERIODS.map((p) => ({ ...p, b: breadth(core, p.key) })),
    [core]
  )
  const medianOf = (key: (typeof PERIODS)[number]["key"], list: Asset[]) => {
    const v = list.map((a) => a[key]).filter(isNum)
    return v.length ? median(v) : null
  }
  const alts = useMemo(() => core.filter((a) => a.id !== "bitcoin"), [core])

  const stableYear = useMemo(() => lastYear(stable.data ?? []), [stable.data])
  const tvlYear = useMemo(() => lastYear(tvl.data ?? []), [tvl.data])
  const stableNow = stable.data?.[stable.data.length - 1]?.p ?? null
  const stableShare =
    stableNow && global.data?.totalMarketCap
      ? (stableNow / global.data.totalMarketCap) * 100
      : null
  const fgHistory = fg.data?.history ?? []
  const fg30 =
    fgHistory.length >= 30
      ? mean(fgHistory.slice(-30).map((r) => r.value))
      : null

  const observations: Observation[] = useMemo(() => {
    const out: Observation[] = []
    const b7 = breadth(core, "change7d")
    if (b7.pctUp !== null) {
      const state =
        b7.pctUp > 60
          ? "Broad advance"
          : b7.pctUp < 40
            ? "Broad decline"
            : "Mixed market"
      out.push({
        title: `${state} over 7 days`,
        detail: `${b7.up} of ${b7.total} assets rose (${b7.pctUp.toFixed(0)}%); median move ${formatPercent(b7.median)}.`,
        rule: "Above 60% rising = broad advance; below 40% = broad decline.",
        source: `CoinGecko, top 250${exStables === "ex" ? " excluding stablecoins" : ""}`,
        tone: b7.pctUp > 60 ? "up" : b7.pctUp < 40 ? "down" : "neutral",
      })
    }
    const altMedian = medianOf("change30d", alts)
    if (btc && isNum(btc.change30d) && altMedian !== null) {
      const gap = btc.change30d - altMedian
      out.push({
        title:
          gap > 5
            ? "Bitcoin leading altcoins (30d)"
            : gap < -5
              ? "Altcoins leading Bitcoin (30d)"
              : "Bitcoin and altcoins moving together (30d)",
        detail: `Bitcoin ${formatPercent(btc.change30d)} vs median altcoin ${formatPercent(altMedian)} (gap ${gap > 0 ? "+" : ""}${gap.toFixed(1)} pp).`,
        rule: "A gap above 5 percentage points either way counts as leadership.",
        source: "CoinGecko, top 250",
        tone: "neutral",
      })
    }
    const s30 = changeOver(stable.data ?? [], 30)
    if (s30 !== null) {
      out.push({
        title:
          s30 > 1
            ? "Stablecoin supply expanding"
            : s30 < -1
              ? "Stablecoin supply contracting"
              : "Stablecoin supply flat",
        detail: `Total USD stablecoins ${formatCompactMoney(stableNow)}, ${formatPercent(s30)} over 30 days.`,
        rule: "Above +1% in 30 days = expanding; below −1% = contracting. Growing supply is often read as more dollars available on-chain.",
        source: "DefiLlama",
        tone: s30 > 1 ? "up" : s30 < -1 ? "down" : "neutral",
      })
    }
    if (fg.data && fg30 !== null) {
      out.push({
        title: `Sentiment: ${fg.data.label} (${fg.data.value})`,
        detail: `${fg.data.value > fg30 + 5 ? "Above" : fg.data.value < fg30 - 5 ? "Below" : "Near"} its 30-day average of ${fg30.toFixed(0)}.`,
        rule: "Compared with the index’s own 30-day mean (±5 points = near).",
        source: "Alternative.me Fear & Greed Index",
        tone: "neutral",
      })
    }
    return out
  }, [core, alts, btc, stable.data, stableNow, fg.data, fg30, exStables])

  const sectorRows = useMemo(() => {
    const rows = (categories.data ?? []).filter(
      (c) => (c.marketCap ?? 0) >= 1e9
    )
    const f = sort.dir === "asc" ? 1 : -1
    return rows.sort(
      (a, b) => f * ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity))
    )
  }, [categories.data, sort])

  const dominance = useMemo(() => {
    const d = global.data?.dominance ?? {}
    const entries = Object.entries(d)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const shown = entries.reduce((s, [, v]) => s + v, 0)
    return [...entries, ["Other", Math.max(0, 100 - shown)] as [string, number]]
  }, [global.data])

  return (
    <Page>
      <PageHeader
        title="Market Intelligence"
        description="Breadth, leadership, sentiment and liquidity. Observations follow stated rules on stated data; they describe conditions and don’t predict prices."
        actions={
          <Segmented
            label="Universe"
            size="sm"
            value={exStables}
            onChange={setExStables}
            options={[
              { value: "ex", label: "Excl. stablecoins" },
              { value: "all", label: "All 250" },
            ]}
          />
        }
      />
      {isFailing(universe) && (
        <ErrorNotice
          error={universe.failureReason}
          onRetry={() => universe.refetch()}
          title="Market data couldn’t be loaded"
          className="mb-3"
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Pane
          title="Observations"
          subtitle="Each one shows its metric, rule and source"
        >
          {observations.length === 0 ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="space-y-3">
              {observations.map((o) => (
                <li key={o.title}>
                  <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        o.tone === "up"
                          ? "bg-up"
                          : o.tone === "down"
                            ? "bg-down"
                            : "bg-ink-3"
                      )}
                      aria-hidden="true"
                    />
                    {o.title}
                  </p>
                  <p className="text-[0.8125rem] text-ink-2">{o.detail}</p>
                  <p className="text-[0.6875rem] text-ink-3">
                    Rule: {o.rule} Source: {o.source}.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Pane>

        <Pane
          title="Breadth"
          subtitle={`Share of ${core.length} assets rising, by period`}
          flush
        >
          <table className={T.table}>
            <caption className="sr-only">Market breadth by period</caption>
            <thead>
              <tr>
                <th scope="col" className={cn(T.th, "text-left")}>
                  Period
                </th>
                <th scope="col" className={cn(T.th, "text-left")}>
                  Rising
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  Up / down
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  Median
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden text-right sm:table-cell")}
                >
                  BTC
                </th>
              </tr>
            </thead>
            <tbody>
              {breadthRows.map(({ key, label, b }) => (
                <tr key={key} className={T.tr}>
                  <th
                    scope="row"
                    className={cn(T.td, "text-left font-normal text-ink-2")}
                  >
                    {label}
                  </th>
                  <td className={cn(T.td, "w-[40%]")}>
                    <span className="flex items-center gap-2">
                      <span
                        className="flex h-2 flex-1 overflow-hidden rounded-full bg-down/70"
                        aria-hidden="true"
                      >
                        <span
                          className="h-full bg-up"
                          style={{ width: `${b.pctUp ?? 0}%` }}
                        />
                      </span>
                      <span className="num w-10 text-right text-ink">
                        {b.pctUp === null ? "—" : `${b.pctUp.toFixed(0)}%`}
                      </span>
                    </span>
                  </td>
                  <td className={cn(T.td, "num text-right text-ink-2")}>
                    {b.up} / {b.down}
                  </td>
                  <td className={cn(T.td, "text-right")}>
                    <Change value={b.median} />
                  </td>
                  <td className={cn(T.td, "hidden text-right sm:table-cell")}>
                    <Change value={btc?.[key]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pane>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Pane title="Leadership" subtitle="Return by period">
          <table className={T.table}>
            <caption className="sr-only">
              Bitcoin, Ethereum and the median asset compared
            </caption>
            <thead>
              <tr>
                <th scope="col" className={cn(T.th, "text-left")}>
                  Period
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  BTC
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  ETH
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "text-right")}
                  title="Median of the selected universe excluding Bitcoin"
                >
                  Median alt
                </th>
              </tr>
            </thead>
            <tbody>
              {PERIODS.slice(1).map(({ key, label }) => (
                <tr key={key} className={T.tr}>
                  <th
                    scope="row"
                    className={cn(T.td, "text-left font-normal text-ink-2")}
                  >
                    {label}
                  </th>
                  <td className={cn(T.td, "text-right")}>
                    <Change value={btc?.[key]} />
                  </td>
                  <td className={cn(T.td, "text-right")}>
                    <Change value={eth?.[key]} />
                  </td>
                  <td className={cn(T.td, "text-right")}>
                    <Change value={medianOf(key, alts)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pane>
        <Pane
          title="Dominance"
          subtitle="Share of total crypto market cap (CoinGecko)"
        >
          {global.data ? (
            <>
              <div
                className="flex h-3 gap-[2px] overflow-hidden rounded"
                aria-hidden="true"
              >
                {dominance.map(([k, v], i) => (
                  <span
                    key={k}
                    style={{
                      flexGrow: v,
                      background:
                        k === "Other"
                          ? "var(--series-other)"
                          : `var(--series-${(i % 6) + 1})`,
                    }}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.8125rem]">
                {dominance.map(([k, v], i) => (
                  <li key={k} className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{
                        background:
                          k === "Other"
                            ? "var(--series-other)"
                            : `var(--series-${(i % 6) + 1})`,
                      }}
                      aria-hidden="true"
                    />
                    <span className="mono flex-1 text-ink-2">{k}</span>
                    <span className="num text-ink">{formatShare(v)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.6875rem] text-ink-3">
                Total market cap{" "}
                {formatCompactMoney(global.data.totalMarketCap)}. Top 250 sum:{" "}
                {formatCompactMoney(agg.cap)} (<Change value={agg.change} />{" "}
                24h, computed from constituents).
              </p>
            </>
          ) : (
            <Skeleton className="h-32" />
          )}
        </Pane>
        <Pane
          title="Stablecoin liquidity"
          subtitle="Total USD-pegged supply (DefiLlama)"
        >
          {stable.data ? (
            <dl className="grid grid-cols-2 gap-3 text-[0.8125rem]">
              <div>
                <dt className="text-[0.6875rem] text-ink-3">Supply</dt>
                <dd className="num text-lg font-semibold">
                  {formatCompactMoney(stableNow)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-ink-3">
                  Share of market cap
                </dt>
                <dd className="num text-lg font-semibold">
                  {formatShare(stableShare)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-ink-3">30 days</dt>
                <dd>
                  <Change value={changeOver(stable.data, 30)} />
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-ink-3">90 days</dt>
                <dd>
                  <Change value={changeOver(stable.data, 90)} />
                </dd>
              </div>
            </dl>
          ) : isFailing(stable) ? (
            <p className="text-[0.8125rem] text-ink-3">
              DefiLlama is unavailable right now.
            </p>
          ) : (
            <Skeleton className="h-28" />
          )}
        </Pane>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Pane
          title="Fear & Greed, 1 year"
          subtitle="Alternative.me, daily (0 = extreme fear, 100 = extreme greed)"
        >
          {fgHistory.length > 1 ? (
            <LineChart
              series={[
                {
                  id: "fg",
                  label: "Index",
                  points: fgHistory.map((r) => ({
                    t: r.timestamp,
                    v: r.value,
                  })),
                },
              ]}
              format="index"
              baseline={50}
              height="h-[220px]"
              summary={`Fear and Greed index ${fg.data?.value} today; 30-day average ${fg30?.toFixed(0)}.`}
            />
          ) : (
            <Skeleton className="h-[220px]" />
          )}
        </Pane>
        <Pane title="Stablecoin supply, 1 year" subtitle="DefiLlama">
          {stableYear.length > 1 ? (
            <LineChart
              series={[
                {
                  id: "s",
                  label: "Supply",
                  points: stableYear.map((p) => ({ t: p.t, v: p.p })),
                },
              ]}
              format="compact"
              area
              height="h-[220px]"
              summary={`Stablecoin supply now ${formatCompactMoney(stableNow)}.`}
            />
          ) : (
            <Skeleton className="h-[220px]" />
          )}
        </Pane>
        <Pane
          title="DeFi total value locked, 1 year"
          subtitle="DefiLlama, all chains"
        >
          {tvlYear.length > 1 ? (
            <LineChart
              series={[
                {
                  id: "t",
                  label: "TVL",
                  points: tvlYear.map((p) => ({ t: p.t, v: p.p })),
                },
              ]}
              format="compact"
              area
              height="h-[220px]"
              summary={`DeFi TVL ${formatCompactMoney(tvlYear[tvlYear.length - 1].p)} as of ${dayKey(tvlYear[tvlYear.length - 1].t)}.`}
            />
          ) : isFailing(tvl) ? (
            <p className="text-[0.8125rem] text-ink-3">
              DefiLlama is unavailable right now.
            </p>
          ) : (
            <Skeleton className="h-[220px]" />
          )}
        </Pane>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Pane
          title="Sectors and narratives"
          subtitle="CoinGecko categories above $1B · categories overlap"
          flush
        >
          {categories.data ? (
            <div className="max-h-[480px] overflow-y-auto">
              <table className={T.table}>
                <caption className="sr-only">Category performance</caption>
                <thead className={T.thead}>
                  <tr>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Category
                    </th>
                    <SortHeader
                      label="Mkt cap"
                      srLabel="Market cap"
                      sortKey="marketCap"
                      sort={sort}
                      onSort={(k) => setSort(nextSort(sort, k))}
                    />
                    <SortHeader
                      label="24h"
                      srLabel="24 hour market cap change"
                      sortKey="change24h"
                      sort={sort}
                      onSort={(k) => setSort(nextSort(sort, k))}
                    />
                    <SortHeader
                      label="Vol 24h"
                      srLabel="24 hour volume"
                      sortKey="volume24h"
                      sort={sort}
                      onSort={(k) => setSort(nextSort(sort, k))}
                      className="hidden sm:table-cell"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sectorRows.map((c) => (
                    <tr key={c.id} className={T.trHover}>
                      <td className={cn(T.td, "w-1/2 max-w-0")}>
                        <Link
                          to={`/markets?view=category&cat=${c.id}`}
                          className="block truncate text-ink hover:underline"
                          title={c.name}
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className={cn(T.td, "num text-right text-ink-2")}>
                        {formatCompactMoney(c.marketCap)}
                      </td>
                      <td className={cn(T.td, "text-right")}>
                        <Change value={c.change24h} />
                      </td>
                      <td
                        className={cn(
                          T.td,
                          "num hidden text-right text-ink-2 sm:table-cell"
                        )}
                      >
                        {formatCompactMoney(c.volume24h)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isFailing(categories) ? (
            <p className="p-3 text-[0.8125rem] text-ink-3">
              Categories are unavailable right now.
            </p>
          ) : (
            <div className="p-3">
              <Skeleton className="h-64" />
            </div>
          )}
        </Pane>
        <Pane
          title="Market map"
          subtitle="Area: market cap · colour: 24h change"
          actions={<Badge>{wide ? "Top 50" : "Top 24"}</Badge>}
        >
          {assets.length ? (
            <MarketMap assets={assets} maxTiles={wide ? 50 : 24} />
          ) : (
            <Skeleton className="h-[340px]" />
          )}
        </Pane>
      </div>
    </Page>
  )
}
