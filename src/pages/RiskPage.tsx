import { useMemo, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"

import { LineChart } from "@/components/charts/LineChart"
import { Change } from "@/components/data/Change"
import { EmptyState, Skeleton } from "@/components/data/states"
import { Page, PageHeader, Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge, Segmented, Select } from "@/components/ui/controls"
import { Input } from "@/components/ui/input"
import { ScrollRegion } from "@/components/data/table"
import { useDailyCloses, useQuotes, useStablecoinIds } from "@/hooks/queries"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import { useNow, usePageTitle } from "@/hooks/use-ui"
import { formatMoney, formatPercent, formatShare, isNum } from "@/lib/format"
import {
  applyShocks,
  assetRisk,
  betaShock,
  concentration,
  correlationMatrix,
  simulateWeights,
  type Holding,
} from "@/lib/risk"
import { dayKey, MIN_OBSERVATIONS, sinceDay } from "@/lib/stats"
import { T } from "@/lib/table"
import { cn, toneClass } from "@/lib/utils"
import { fetchAssetProfile, type Asset } from "@/services/coingecko"
import { useWatchlists } from "@/stores"

function Kind({ kind }: { kind: "observed" | "scenario" | "estimate" }) {
  return (
    <Badge
      tone={
        kind === "observed"
          ? "neutral"
          : kind === "scenario"
            ? "accent"
            : "warn"
      }
    >
      {kind}
    </Badge>
  )
}

const GENERIC =
  /ecosystem|portfolio|binance|coinbase|launchpad|alleged|fan token|holdings|made in|index|world liberty|ftx|smart contract platform/i
const NOTIONAL = 10_000

export default function RiskPage() {
  usePageTitle("Risk Lab")
  const portfolio = usePortfolioValuation()
  const { lists } = useWatchlists()
  const [params, setParams] = useSearchParams()
  const subject = params.get("subject") ?? "portfolio"
  const setSubject = (v: string) =>
    setParams(v === "portfolio" ? {} : { subject: v }, { replace: true })
  const list = lists.find((l) => l.id === subject)
  const ids = useMemo(
    () =>
      list
        ? list.items.map((i) => i.assetId)
        : portfolio.positions.map((p) => p.assetId),
    [list, portfolio.positions]
  )
  const quotes = useQuotes([...ids, "bitcoin"])
  const stablecoins = useStablecoinIds()

  const holdings: Holding[] = useMemo(() => {
    if (list) {
      return ids
        .map((id) => quotes.assets.get(id))
        .filter((a): a is Asset => !!a)
        .map((a, _, all) => ({
          assetId: a.id,
          symbol: a.symbol,
          name: a.name,
          value: NOTIONAL / all.length,
        }))
    }
    return portfolio.positions
      .filter((p) => isNum(p.value) && p.value! > 0)
      .map((p) => ({
        assetId: p.assetId,
        symbol: p.symbol,
        name: p.name,
        value: p.value!,
      }))
  }, [list, ids, quotes.assets, portfolio.positions])

  const total = holdings.reduce((s, h) => s + h.value, 0)
  const conc = concentration(holdings.map((h) => h.value))
  const closeAssets = useMemo(
    () =>
      [
        ...holdings.map((h) => quotes.assets.get(h.assetId)),
        quotes.assets.get("bitcoin"),
      ].filter((a): a is Asset => !!a),
    [holdings, quotes.assets]
  )
  const closes = useDailyCloses(closeAssets)
  const now = useNow(3_600_000)
  const yearAgo = dayKey(now - 365 * 86_400_000)
  const btc = closes.series.get("bitcoin")
  const risks = useMemo(
    () =>
      holdings.map((h) => {
        const s = closes.series.get(h.assetId)
        return s ? assetRisk(h.assetId, s, btc) : null
      }),
    [holdings, closes.series, btc]
  )
  const matrix = useMemo(
    () =>
      correlationMatrix(
        holdings.map((h) => h.assetId),
        closes.series
      ),
    [holdings, closes.series]
  )
  const sim = useMemo(
    () =>
      closes.loading.length
        ? null
        : simulateWeights(
            holdings.map((h) => ({
              assetId: h.assetId,
              symbol: h.symbol,
              weight: h.value,
            })),
            // The past year, like the rest of the page.
            new Map(
              [...closes.series].map(([id, s]) => [id, sinceDay(s, yearAgo)])
            )
          ),
    [holdings, closes.series, closes.loading.length, yearAgo]
  )

  const profiles = useQueries({
    queries: holdings.slice(0, 15).map((h) => ({
      queryKey: ["profile", h.assetId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAssetProfile(h.assetId, signal),
      staleTime: 6 * 60 * 60_000,
      gcTime: 24 * 60 * 60_000,
      retry: 1,
    })),
  })
  const sectors = useMemo(() => {
    const m = new Map<string, number>()
    holdings.slice(0, 15).forEach((h, i) => {
      const p = profiles[i]?.data
      const cat = stablecoins.has(h.assetId)
        ? "Stablecoins"
        : p
          ? (p.categories.find((c) => !GENERIC.test(c)) ?? "Unclassified")
          : "Loading…"
      m.set(cat, (m.get(cat) ?? 0) + h.value)
    })
    const rest = holdings.slice(15).reduce((s, h) => s + h.value, 0)
    if (rest > 0) m.set("Not classified (beyond 15 largest)", rest)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `profiles` changes identity every render
  }, [holdings, stablecoins, profiles.map((p) => p.dataUpdatedAt).join(",")])

  const exposure = useMemo(() => {
    const by = (pred: (h: Holding) => boolean) =>
      holdings.filter(pred).reduce((s, h) => s + h.value, 0)
    const btcV = by((h) => h.assetId === "bitcoin")
    const ethV = by((h) => h.assetId === "ethereum")
    const stV = by((h) => stablecoins.has(h.assetId))
    return [
      { label: "Bitcoin", value: btcV },
      { label: "Ethereum", value: ethV },
      { label: "Stablecoins", value: stV },
      { label: "Everything else", value: total - btcV - ethV - stV },
    ]
  }, [holdings, stablecoins, total])

  const [mode, setMode] = useState<"btc" | "uniform" | "custom">("btc")
  const [shock, setShock] = useState(-20)
  const [custom, setCustom] = useState<Record<string, string>>({})
  const stress = useMemo(
    () =>
      applyShocks(holdings, (h) => {
        if (mode === "uniform") return shock
        if (mode === "custom") {
          const v = Number(custom[h.assetId])
          return custom[h.assetId] !== undefined &&
            custom[h.assetId] !== "" &&
            Number.isFinite(v)
            ? Math.max(-100, v)
            : null
        }
        const r = risks[holdings.indexOf(h)]
        return h.assetId === "bitcoin"
          ? shock
          : stablecoins.has(h.assetId)
            ? 0
            : betaShock(shock, r?.betaToBtc ?? null)
      }),
    [holdings, mode, shock, custom, risks, stablecoins]
  )

  const empty = holdings.length === 0
  const subjectLabel = list
    ? `${list.name} (equal weights, $${NOTIONAL.toLocaleString()} notional)`
    : portfolio.sample
      ? "Sample portfolio"
      : "Your portfolio"

  return (
    <Page>
      <PageHeader
        title="Risk Lab"
        description="Concentration, exposure and historical risk of a set of holdings, plus scenarios you define. Descriptions of the past and of your assumptions, not forecasts."
        actions={
          <Select
            aria-label="Analyse"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-56"
          >
            <option value="portfolio">Portfolio</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                Watchlist: {l.name}
              </option>
            ))}
          </Select>
        }
        meta={<span>Analysing: {subjectLabel}</span>}
      />

      {empty ? (
        <EmptyState
          title={
            list
              ? `${list.name} has no assets with prices`
              : "No priced holdings to analyse"
          }
          action={
            list ? (
              <Button asChild size="sm">
                <Link to="/markets">Add assets</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="primary">
                <Link to="/portfolio">Go to Portfolio</Link>
              </Button>
            )
          }
        >
          {list
            ? "Add assets to this watchlist, or choose another subject."
            : "Record transactions in your portfolio, or analyse a watchlist instead."}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Pane title="Concentration" actions={<Kind kind="observed" />}>
              <dl className="grid grid-cols-2 gap-3 text-[0.8125rem]">
                <div>
                  <dt className="text-[0.6875rem] text-ink-3">
                    Largest holding
                  </dt>
                  <dd className="num text-lg font-semibold">
                    {formatShare(conc?.top1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] text-ink-3">
                    Top 3 holdings
                  </dt>
                  <dd className="num text-lg font-semibold">
                    {formatShare(conc?.top3)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] text-ink-3">
                    Effective positions
                  </dt>
                  <dd className="num text-lg font-semibold">
                    {conc ? conc.effectiveN.toFixed(1) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] text-ink-3">HHI</dt>
                  <dd className="num text-lg font-semibold">
                    {conc ? conc.hhi.toFixed(3) : "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[0.6875rem] text-ink-3">
                Effective positions = 1 / Σ weight²: how many equal-sized
                holdings the allocation behaves like. HHI above 0.25 is highly
                concentrated.
              </p>
            </Pane>
            <Pane title="Exposure" actions={<Kind kind="observed" />}>
              <ul className="space-y-1.5 text-[0.8125rem]">
                {exposure.map((e) => (
                  <li
                    key={e.label}
                    className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2"
                  >
                    <span className="text-ink-2">{e.label}</span>
                    <span
                      className="h-2 overflow-hidden rounded-full bg-surface-2"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full bg-accent"
                        style={{
                          width: `${total ? (e.value / total) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="num text-right text-ink">
                      {formatShare(total ? (e.value / total) * 100 : null)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.6875rem] text-ink-3">
                Stablecoins as classified by CoinGecko.
              </p>
            </Pane>
            <Pane
              title="Sector exposure"
              subtitle="First specific CoinGecko category of each holding"
              actions={<Kind kind="observed" />}
            >
              <ul className="space-y-1.5 text-[0.8125rem]">
                {sectors.slice(0, 7).map(([name, v]) => (
                  <li
                    key={name}
                    className="grid grid-cols-[minmax(0,1fr)_5rem_3.5rem] items-center gap-2"
                  >
                    <span className="truncate text-ink-2" title={name}>
                      {name}
                    </span>
                    <span
                      className="h-2 overflow-hidden rounded-full bg-surface-2"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full bg-[var(--series-3)]"
                        style={{ width: `${(v / total) * 100}%` }}
                      />
                    </span>
                    <span className="num text-right text-ink">
                      {formatShare((v / total) * 100)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.6875rem] text-ink-3">
                Categories overlap and are assigned by CoinGecko; treat them as
                a rough guide.
              </p>
            </Pane>
          </div>

          <Pane
            title="Historical risk by asset"
            subtitle={`Daily closes, last 365 days · needs ${MIN_OBSERVATIONS}+ observations`}
            actions={<Kind kind="observed" />}
            flush
          >
            <ScrollRegion
              label="Historical risk by asset"
              className="overflow-y-hidden"
            >
              <table className={T.table}>
                <caption className="sr-only">
                  Historical risk statistics by asset
                </caption>
                <thead className={T.thead}>
                  <tr>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Asset
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Weight
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Vol 90d
                    </th>
                    <th
                      scope="col"
                      className={cn(T.th, "hidden text-right sm:table-cell")}
                    >
                      Vol 1y
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Max DD 1y
                    </th>
                    <th
                      scope="col"
                      className={cn(T.th, "hidden text-right md:table-cell")}
                    >
                      Beta vs BTC
                    </th>
                    <th
                      scope="col"
                      className={cn(T.th, "hidden text-right md:table-cell")}
                    >
                      Corr. BTC
                    </th>
                    <th
                      scope="col"
                      className={cn(T.th, "hidden text-right lg:table-cell")}
                    >
                      Days
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => {
                    const r = risks[i]
                    return (
                      <tr key={h.assetId} className={T.tr}>
                        <td className={T.td}>
                          <Link
                            to={`/markets/${h.assetId}`}
                            className="font-medium text-ink hover:underline"
                          >
                            {h.name}
                          </Link>{" "}
                          <span className="mono text-[0.6875rem] text-ink-3">
                            {h.symbol}
                          </span>
                        </td>
                        <td className={cn(T.td, "num text-right text-ink-2")}>
                          {formatShare((h.value / total) * 100)}
                        </td>
                        {closes.loading.includes(h.assetId) ? (
                          <td colSpan={6} className={T.td}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ) : (
                          <>
                            <td className={cn(T.td, "num text-right text-ink")}>
                              {formatPercent(r?.volatility90d, {
                                signed: false,
                                digits: 0,
                              })}
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "num hidden text-right text-ink-2 sm:table-cell"
                              )}
                            >
                              {formatPercent(r?.volatility1y, {
                                signed: false,
                                digits: 0,
                              })}
                            </td>
                            <td className={cn(T.td, "text-right")}>
                              <Change value={r?.maxDrawdown1y} digits={1} />
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "num hidden text-right text-ink-2 md:table-cell"
                              )}
                            >
                              {r?.betaToBtc == null
                                ? "—"
                                : r.betaToBtc.toFixed(2)}
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "num hidden text-right text-ink-2 md:table-cell"
                              )}
                            >
                              {r?.correlationToBtc == null
                                ? "—"
                                : r.correlationToBtc.toFixed(2)}
                            </td>
                            <td
                              className={cn(
                                T.td,
                                "num hidden text-right text-ink-3 lg:table-cell"
                              )}
                            >
                              {r?.observations ?? 0}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollRegion>
            {closes.failed.length > 0 && (
              <p className="border-t border-rule px-3 py-2 text-xs text-warn">
                No price history for {closes.failed.join(", ")}.
              </p>
            )}
          </Pane>

          <div className="grid gap-3 xl:grid-cols-2">
            <Pane
              title="Today’s weights over the past year"
              subtitle="Historical simulation, rebalanced daily"
              actions={<Kind kind="observed" />}
            >
              {sim ? (
                <>
                  <dl className="mb-2 grid grid-cols-3 gap-2 text-[0.8125rem] sm:grid-cols-6">
                    <div>
                      <dt className="text-[0.6875rem] text-ink-3">Return</dt>
                      <dd>
                        <Change value={sim.totalReturn} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-3">
                        Volatility
                      </dt>
                      <dd className="num">
                        {formatPercent(sim.volatility, {
                          signed: false,
                          digits: 0,
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-3">
                        Max drawdown
                      </dt>
                      <dd>
                        <Change value={sim.maxDrawdown} digits={1} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-3">Worst day</dt>
                      <dd>
                        <Change value={sim.worstDay} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-3">
                        5% worst days
                      </dt>
                      <dd>
                        <Change value={sim.p5Day} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-3">Best day</dt>
                      <dd>
                        <Change value={sim.bestDay} />
                      </dd>
                    </div>
                  </dl>
                  <LineChart
                    series={[
                      {
                        id: "sim",
                        label: "Simulated index",
                        points: sim.index.map((p) => ({
                          t: Date.parse(p.day),
                          v: p.value - 100,
                        })),
                      },
                    ]}
                    format="percent"
                    baseline={0}
                    area
                    height="h-[220px]"
                    summary={`If today's weights had been held for ${sim.days} days, the return would have been ${formatPercent(sim.totalReturn)} with a maximum drawdown of ${formatPercent(sim.maxDrawdown)}.`}
                  />
                  <p className="mt-2 text-[0.6875rem] text-ink-3">
                    What today’s allocation would have experienced over{" "}
                    {sim.days} days, using only days where every asset had a
                    price
                    {sim.missing.length
                      ? `; excludes ${sim.missing.join(", ")} (no history)`
                      : ""}
                    . It is not your actual return (see Portfolio → Performance)
                    and doesn’t predict future results. “5% worst days” means
                    one day in twenty was at least this bad.
                  </p>
                </>
              ) : closes.loading.length ? (
                <Skeleton className="h-64" />
              ) : (
                <p className="text-[0.8125rem] text-ink-3">
                  Not enough shared price history (needs {MIN_OBSERVATIONS}+
                  days where every asset has a price).
                </p>
              )}
            </Pane>

            <Pane
              title="Correlation of daily returns"
              subtitle="Last 365 days"
              actions={<Kind kind="observed" />}
            >
              {holdings.length < 2 ? (
                <p className="text-[0.8125rem] text-ink-3">
                  Needs at least two assets.
                </p>
              ) : (
                <ScrollRegion
                  label="Correlation matrix"
                  className="overflow-y-hidden"
                >
                  <table className="border-separate border-spacing-0.5 text-[0.6875rem]">
                    <caption className="sr-only">Correlation matrix</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="sr-only">
                          Asset
                        </th>
                        {holdings.slice(0, 10).map((h) => (
                          <th
                            key={h.assetId}
                            scope="col"
                            className="mono px-1 font-medium text-ink-3"
                          >
                            {h.symbol}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.slice(0, 10).map((h, i) => (
                        <tr key={h.assetId}>
                          <th
                            scope="row"
                            className="mono pr-1 text-right font-medium text-ink-3"
                          >
                            {h.symbol}
                          </th>
                          {matrix[i].slice(0, 10).map((v, j) => (
                            <td
                              key={j}
                              className="num h-8 w-11 rounded-sm text-center text-ink"
                              style={{
                                background:
                                  v === null
                                    ? "var(--surface-2)"
                                    : `color-mix(in srgb, var(${v >= 0 ? "--series-1" : "--series-2"}) ${Math.round(Math.abs(v) * 70)}%, var(--surface))`,
                              }}
                            >
                              {v === null ? "—" : v.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {holdings.length > 10 && (
                    <p className="mt-1 text-[0.6875rem] text-ink-3">
                      Showing the 10 largest holdings.
                    </p>
                  )}
                </ScrollRegion>
              )}
              <p className="mt-2 text-[0.6875rem] text-ink-3">
                High correlations mean holdings tend to fall together:
                diversification across them is weaker than the count suggests.
              </p>
            </Pane>
          </div>

          <Pane
            title="Stress test"
            subtitle="What happens to today’s value under price moves you choose"
            actions={<Kind kind={mode === "btc" ? "estimate" : "scenario"} />}
          >
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <Segmented
                label="Scenario type"
                value={mode}
                onChange={setMode}
                options={[
                  {
                    value: "btc",
                    label: "Bitcoin beta",
                    title:
                      "Bitcoin moves; each asset follows by its measured beta",
                  },
                  {
                    value: "uniform",
                    label: "Uniform",
                    title: "Every asset moves by the same percentage",
                  },
                  {
                    value: "custom",
                    label: "Per asset",
                    title: "Set a move for each asset",
                  },
                ]}
              />
              {mode !== "custom" && (
                <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
                  {mode === "btc" ? "Bitcoin" : "All assets"}
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    step={5}
                    value={shock}
                    onChange={(e) => setShock(Number(e.target.value))}
                    className="w-40 accent-[var(--accent)]"
                    aria-label="Shock size in percent"
                  />
                  <span
                    className={cn("num w-12 font-semibold", toneClass(shock))}
                  >
                    {formatPercent(shock, { digits: 0 })}
                  </span>
                </label>
              )}
            </div>
            <dl className="mb-3 grid grid-cols-3 gap-3 text-[0.8125rem]">
              <div>
                <dt className="text-[0.6875rem] text-ink-3">Value now</dt>
                <dd className="num text-lg font-semibold">
                  {formatMoney(stress.before)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-ink-3">Value after</dt>
                <dd className="num text-lg font-semibold">
                  {formatMoney(stress.after)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-ink-3">Change</dt>
                <dd
                  className={cn(
                    "num text-lg font-semibold",
                    toneClass(stress.change)
                  )}
                >
                  {formatMoney(stress.change, { signed: true })} (
                  {formatPercent(stress.changePct)})
                </dd>
              </div>
            </dl>
            <ScrollRegion
              label="Stress test by asset"
              className="overflow-y-hidden"
            >
              <table className={T.table}>
                <caption className="sr-only">Stress test by asset</caption>
                <thead>
                  <tr>
                    <th scope="col" className={cn(T.th, "text-left")}>
                      Asset
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Value
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      Move
                    </th>
                    <th scope="col" className={cn(T.th, "text-right")}>
                      After
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stress.rows.map((r) => (
                    <tr key={r.assetId} className={T.tr}>
                      <td className={cn(T.td, "text-ink")}>{r.symbol}</td>
                      <td className={cn(T.td, "num text-right text-ink-2")}>
                        {formatMoney(r.value)}
                      </td>
                      <td className={cn(T.td, "text-right")}>
                        {mode === "custom" ? (
                          <Input
                            aria-label={`Move for ${r.symbol} in percent`}
                            inputMode="decimal"
                            value={custom[r.assetId] ?? ""}
                            onChange={(e) =>
                              setCustom((c) => ({
                                ...c,
                                [r.assetId]: e.target.value,
                              }))
                            }
                            placeholder="%"
                            className="num ml-auto h-7 w-20 text-right"
                          />
                        ) : r.shockPct === null ? (
                          <span className="text-xs text-ink-3">no beta</span>
                        ) : (
                          <Change value={r.shockPct} digits={1} />
                        )}
                      </td>
                      <td className={cn(T.td, "num text-right text-ink")}>
                        {formatMoney(r.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
            <p className="mt-2 text-[0.6875rem] leading-5 text-ink-3">
              {mode === "btc"
                ? "Estimate: each asset moves by its historical beta × Bitcoin’s move (stablecoins held flat). Betas are unstable and rise in crashes, when correlations approach 1, so real losses can be larger."
                : mode === "uniform"
                  ? "Scenario: every holding moves by the same percentage."
                  : "Scenario: enter a move for each asset. Assets left blank are unchanged and listed below."}
              {stress.unshocked.length > 0 &&
                ` Unchanged in this scenario: ${stress.unshocked.join(", ")}.`}
            </p>
          </Pane>

          <p className="text-[0.6875rem] leading-5 text-ink-3">
            Volatility is the annualised standard deviation of daily returns
            (√365). It treats up and down moves alike and understates crypto’s
            tendency to crash suddenly; maximum drawdown and the worst days
            shown above describe that tail better. Exchange, custody,
            smart-contract, regulatory and liquidity risks are not captured by
            price statistics at all.
          </p>
        </div>
      )}
    </Page>
  )
}
