import { useMemo, useState } from "react"
import { ArrowRight, BellRing, ExternalLink } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { AssetIcon } from "@/components/data/AssetIcon"
import { Change } from "@/components/data/Change"
import { MarketMap } from "@/components/data/MarketMap"
import { Sparkline } from "@/components/data/Sparkline"
import { EmptyState, ErrorNotice, Skeleton } from "@/components/data/states"
import { AssetCell } from "@/components/data/table"
import { Pane } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Badge, Select } from "@/components/ui/controls"
import {
  isFailing,
  useCategories,
  useFearGreed,
  useGlobalMarket,
  useNews,
  useQuotes,
  useSparklines,
  useUniverse,
} from "@/hooks/queries"
import { portfolioActions } from "@/hooks/use-portfolio"
import { usePortfolioValuation } from "@/hooks/use-portfolio-valuation"
import { useMediaQuery, useNow } from "@/hooks/use-ui"
import {
  alertDistance,
  describeAlert,
  formatDistance,
  formatObserved,
  isAssetAlert,
  observedValue,
  type Alert,
} from "@/lib/alerts"
import {
  direction,
  formatAge,
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShare,
  todayISO,
} from "@/lib/format"
import { aggregateCap, breadth, movers } from "@/lib/market"
import { buildMatchers, groupStories, tagAssets } from "@/lib/news"
import { T } from "@/lib/table"
import { cn, toneClass } from "@/lib/utils"
import { moveSince, thesesDueForReview } from "@/lib/workspace"
import {
  alertActions,
  useAlerts,
  useJournal,
  useRecentAssets,
  useResearch,
  useSettings,
  useWatchlists,
} from "@/stores"
import type { Asset } from "@/services/coingecko"

function Stat({
  label,
  value,
  sub,
  loading,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  loading?: boolean
  className?: string
}) {
  return (
    <div className={cn("min-w-0 bg-surface px-3 py-2.5", className)}>
      <dt className="truncate text-[0.6875rem] text-ink-3">{label}</dt>
      <dd className="mt-0.5">
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <>
            <span className="figure num block truncate text-lg leading-6 text-ink">
              {value}
            </span>
            {sub && (
              <span className="block truncate text-[0.6875rem] text-ink-3">
                {sub}
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  )
}

export function PulseWidget() {
  const universe = useUniverse()
  const global = useGlobalMarket()
  const fg = useFearGreed()
  const assets = useMemo(() => universe.data ?? [], [universe.data])
  const agg = useMemo(() => aggregateCap(assets), [assets])
  const b24 = useMemo(() => breadth(assets, "change24h"), [assets])
  const b7 = useMemo(() => breadth(assets, "change7d"), [assets])
  const loading = universe.isPending && !isFailing(universe)
  const gLoading = global.isPending && !isFailing(global)
  const unknown = assets.length === 0

  return (
    <section
      aria-label="Market pulse"
      className="overflow-hidden rounded-md border border-rule"
    >
      {isFailing(universe) && (
        <ErrorNotice
          error={universe.failureReason}
          onRetry={() => universe.refetch()}
          title="Market prices couldn’t be loaded"
          className="rounded-none border-0 border-b"
        />
      )}
      <dl className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Top 250 market cap"
          loading={loading}
          value={unknown ? "—" : formatCompactMoney(agg.cap)}
          sub={
            unknown ? (
              "Unavailable"
            ) : (
              <>
                <Change value={agg.change} /> 24h
              </>
            )
          }
        />
        <Stat
          label="24h volume"
          loading={gLoading}
          value={formatCompactMoney(global.data?.totalVolume)}
          sub="All tracked assets"
        />
        <Stat
          label="BTC dominance"
          loading={gLoading}
          value={formatShare(global.data?.btcDominance)}
          sub={`ETH ${formatShare(global.data?.ethDominance)}`}
        />
        <Stat
          label="Rising, 24h"
          loading={loading}
          value={b24.total ? `${b24.up}/${b24.total}` : "—"}
          sub={
            b24.total ? `Median ${formatPercent(b24.median)}` : "Unavailable"
          }
        />
        <Stat
          label="Rising, 7d"
          loading={loading}
          value={b7.total ? `${b7.up}/${b7.total}` : "—"}
          sub={b7.total ? `Median ${formatPercent(b7.median)}` : "Unavailable"}
        />
        <Stat
          label="Fear & Greed"
          loading={fg.isPending && !isFailing(fg)}
          value={fg.data ? `${fg.data.value} · ${fg.data.label}` : "—"}
          sub={
            fg.data?.previous
              ? `Yesterday ${fg.data.previous.value}`
              : "Alternative.me, daily"
          }
        />
      </dl>
    </section>
  )
}

export function MajorsWidget() {
  const universe = useUniverse()
  const ids = ["bitcoin", "ethereum"]
  const sparks = useSparklines(ids)
  const assets = ids
    .map((id) => universe.data?.find((a) => a.id === id))
    .filter((a): a is Asset => !!a)
  return (
    <Pane title="Bitcoin & Ethereum" subtitle="Price, last 7 days" flush>
      {assets.length === 0 ? (
        <div className="p-3">
          {universe.isPending ? (
            <Skeleton className="h-24" />
          ) : (
            <p className="text-ink-3">Unavailable.</p>
          )}
        </div>
      ) : (
        // A container: the sparkline only shows when the pane is wide enough
        // for it beside the price (the pane is a third of the row on desktop).
        <ul className="@container divide-y divide-rule">
          {assets.map((a) => (
            <li key={a.id}>
              <Link
                to={`/markets/${a.id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2/60"
              >
                <AssetIcon src={a.image} symbol={a.symbol} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{a.name}</p>
                  <p
                    className="num truncate text-base font-semibold text-ink"
                    title={formatPrice(a.price)}
                  >
                    {formatPrice(a.price)}
                  </p>
                </div>
                <Sparkline
                  values={sparks[a.id] ?? []}
                  width={96}
                  height={32}
                  className="hidden @min-[23rem]:block"
                />
                <dl className="grid w-20 shrink-0 grid-cols-[auto_1fr] gap-x-2 text-right text-[0.6875rem]">
                  <dt className="text-ink-3">24h</dt>
                  <dd>
                    <Change value={a.change24h} />
                  </dd>
                  <dt className="text-ink-3">7d</dt>
                  <dd>
                    <Change value={a.change7d} />
                  </dd>
                  <dt className="text-ink-3">30d</dt>
                  <dd>
                    <Change value={a.change30d} />
                  </dd>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pane>
  )
}

export function PortfolioWidget() {
  const navigate = useNavigate()
  const { transactions, sample, positions, summary, pricesLoading } =
    usePortfolioValuation()
  return (
    <Pane
      title="Portfolio"
      subtitle={
        sample ? "Sample data, not real holdings" : "Valued at current prices"
      }
      actions={
        transactions.length > 0 && (
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Open <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        )
      }
    >
      {transactions.length === 0 ? (
        <div className="text-[0.8125rem] text-ink-2">
          <p>
            Record purchases and sales to see value, today’s move and returns.
            Data stays in this browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                navigate("/portfolio", { state: { addTransaction: true } })
              }
            >
              Add a transaction
            </Button>
            <Button
              size="sm"
              onClick={() => {
                portfolioActions.loadSample()
                navigate("/portfolio")
              }}
            >
              Explore a sample
            </Button>
          </div>
        </div>
      ) : (
        <>
          {pricesLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <p className="figure text-2xl text-ink">
              {formatMoney(summary.value)}
            </p>
          )}
          <dl className="mt-2 grid grid-cols-3 gap-2 text-[0.6875rem]">
            <div>
              <dt className="text-ink-3">Today</dt>
              <dd
                className={cn(
                  "num text-[0.8125rem]",
                  toneClass(summary.change24hValue)
                )}
              >
                {formatMoney(summary.change24hValue, { signed: true })}
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Unrealised</dt>
              <dd
                className={cn(
                  "num text-[0.8125rem]",
                  toneClass(summary.unrealizedPnL)
                )}
              >
                {formatMoney(summary.unrealizedPnL, { signed: true })}
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Total return</dt>
              <dd
                className={cn(
                  "num text-[0.8125rem]",
                  toneClass(summary.totalPnL)
                )}
              >
                {formatMoney(summary.totalPnL, { signed: true })}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 space-y-1.5">
            {positions.slice(0, 4).map((p) => (
              <li
                key={p.assetId}
                className="flex items-center gap-2 text-[0.8125rem]"
              >
                <AssetIcon src={p.image} symbol={p.symbol} size={16} />
                <span className="flex-1 truncate text-ink">{p.name}</span>
                <span
                  className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${p.weight ?? 0}%` }}
                  />
                </span>
                <span className="num w-12 text-right text-ink-2">
                  {formatShare(p.weight)}
                </span>
              </li>
            ))}
          </ul>
          {summary.unpriced.length > 0 && (
            <p className="mt-2 text-xs text-warn">
              {summary.value === null
                ? "Current prices are unavailable."
                : `${summary.unpriced.join(", ")} excluded: no current price.`}
            </p>
          )}
        </>
      )}
    </Pane>
  )
}

/** Active alerts ranked by how close they are to triggering. */
function useNearestAlerts(active: Alert[]) {
  const ids = useMemo(
    () => [...new Set(active.flatMap((a) => (a.assetId ? [a.assetId] : [])))],
    [active]
  )
  const { assets } = useQuotes(ids)
  const portfolio = usePortfolioValuation()
  return useMemo(
    () =>
      active
        .map((a) => {
          const value = observedValue(a, {
            asset: a.assetId ? (assets.get(a.assetId) ?? null) : null,
            portfolioValue: isAssetAlert(a.kind)
              ? null
              : portfolio.summary.value,
          })
          return { alert: a, value, distance: alertDistance(a, value) }
        })
        .sort(
          (x, y) =>
            Math.abs(x.distance?.value ?? Infinity) -
            Math.abs(y.distance?.value ?? Infinity)
        ),
    [active, assets, portfolio.summary.value]
  )
}

export function AlertsWidget() {
  const { alerts, events } = useAlerts()
  const now = useNow(30_000)
  const triggered = alerts.filter((a) => a.status === "triggered")
  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === "active"),
    [alerts]
  )
  const active = activeAlerts.length
  const nearest = useNearestAlerts(activeAlerts)
  return (
    <Pane
      title="Alerts"
      subtitle={`${active} active · checked while CoinWave is open`}
      actions={
        <Link
          to="/alerts"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Manage <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      }
    >
      {alerts.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-2">
          No alerts yet.{" "}
          <Link to="/alerts?new=1" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          for a price, % move, volume or portfolio value.
        </p>
      ) : triggered.length === 0 ? (
        <div className="text-[0.8125rem] text-ink-2">
          <p>Nothing has triggered.</p>
          {nearest.length > 0 && (
            <>
              <p className="eyebrow mt-3 mb-1">Closest to triggering</p>
              <ul className="divide-y divide-rule">
                {nearest.slice(0, 4).map(({ alert: a, value, distance }) => (
                  <li key={a.id} className="flex items-baseline gap-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">
                        {describeAlert(a)}
                      </span>
                      <span className="text-xs text-ink-3">
                        Now{" "}
                        {value === null ? "—" : formatObserved(a.kind, value)}
                      </span>
                    </span>
                    <span
                      className="num text-xs text-ink-2"
                      title={
                        distance?.unit === "pp"
                          ? "Percentage points from the threshold"
                          : "Move needed to reach the threshold"
                      }
                    >
                      {formatDistance(distance)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {events[0] && (
            <p className="mt-2 text-xs text-ink-3">
              Last triggered {formatAge(events[0].at, now)}: {events[0].message}
            </p>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {triggered.slice(0, 4).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2 text-[0.8125rem]"
              >
                <BellRing
                  className="mt-0.5 size-3.5 shrink-0 text-warn"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  {a.assetId ? (
                    <Link
                      to={`/markets/${a.assetId}`}
                      className="text-ink hover:underline"
                    >
                      {describeAlert(a)}
                    </Link>
                  ) : (
                    <span className="text-ink">{describeAlert(a)}</span>
                  )}
                  <span className="block text-xs text-ink-3">
                    {formatAge(a.triggeredAt, now)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => alertActions.dismissAll()}
          >
            Mark all as seen
          </Button>
        </>
      )}
    </Pane>
  )
}

export function WatchlistWidget() {
  const { lists, defaultList } = useWatchlists()
  const [listId, setListId] = useState<string | null>(null)
  const list = lists.find((l) => l.id === listId) ?? defaultList
  const ids = useMemo(() => list?.items.map((i) => i.assetId) ?? [], [list])
  const { assets, isLoading } = useQuotes(ids)
  const sparks = useSparklines(ids)
  return (
    <Pane
      title="Watchlist"
      flush
      actions={
        <>
          {lists.length > 1 && (
            <Select
              aria-label="Watchlist to show"
              value={list?.id}
              onChange={(e) => setListId(e.target.value)}
              className="w-36"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
          <Link
            to={`/watchlists?list=${list?.id ?? ""}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Open <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </>
      }
    >
      {ids.length === 0 ? (
        <p className="p-3 text-[0.8125rem] text-ink-2">
          This list is empty. Use the star on any asset in{" "}
          <Link to="/markets" className="text-accent hover:underline">
            Markets
          </Link>{" "}
          to add it.
        </p>
      ) : (
        // Columns appear as the pane widens (it is half the row on desktop).
        <div className="@container">
          <table className={T.table}>
            <caption className="sr-only">{list?.name}</caption>
            <thead>
              <tr>
                <th scope="col" className={cn(T.th, "text-left")}>
                  Asset
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  Price
                </th>
                <th scope="col" className={cn(T.th, "text-right")}>
                  24h
                </th>
                <th
                  scope="col"
                  className={cn(
                    T.th,
                    "hidden text-right @min-[22rem]:table-cell"
                  )}
                >
                  7d
                </th>
                <th
                  scope="col"
                  className={cn(T.th, "hidden @min-[30rem]:table-cell")}
                >
                  <span className="sr-only">7-day trend</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ids.slice(0, 10).map((id) => {
                const a = assets.get(id)
                return (
                  <tr key={id} className={T.trHover}>
                    <td className={T.td}>
                      {a ? (
                        <AssetCell
                          id={a.id}
                          name={a.name}
                          symbol={a.symbol}
                          image={a.image}
                        />
                      ) : isLoading ? (
                        <Skeleton className="h-4 w-28" />
                      ) : (
                        <span className="text-ink-3">{id} · unavailable</span>
                      )}
                    </td>
                    <td className={cn(T.td, "num text-right text-ink")}>
                      {formatPrice(a?.price)}
                    </td>
                    <td className={cn(T.td, "text-right")}>
                      <Change value={a?.change24h} />
                    </td>
                    <td
                      className={cn(
                        T.td,
                        "hidden text-right @min-[22rem]:table-cell"
                      )}
                    >
                      <Change value={a?.change7d} />
                    </td>
                    <td className={cn(T.td, "hidden @min-[30rem]:table-cell")}>
                      <Sparkline
                        values={sparks[id] ?? []}
                        width={80}
                        height={22}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Pane>
  )
}

function MoverBars({
  title,
  assets,
  max,
}: {
  title: string
  assets: Asset[]
  max: number
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 px-3 text-[0.6875rem] font-semibold tracking-[0.04em] text-ink-3 uppercase">
        {title}
      </h3>
      {assets.length === 0 ? (
        <p className="px-3 py-2 text-[0.8125rem] text-ink-3">None right now.</p>
      ) : (
        <ol>
          {assets.map((a) => (
            <li key={a.id}>
              <Link
                to={`/markets/${a.id}`}
                className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-2 px-3 py-1.5 hover:bg-surface-2/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AssetIcon src={a.image} symbol={a.symbol} size={16} />
                  <span className="mono truncate text-ink">{a.symbol}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2.5 rounded-r-[2px]",
                      direction(a.change24h) === "down" ? "bg-down" : "bg-up"
                    )}
                    style={{
                      width: `${(Math.abs(a.change24h ?? 0) / max) * 65}%`,
                      minWidth: 2,
                    }}
                  />
                  <Change value={a.change24h} className="text-xs" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function MoversWidget() {
  const universe = useUniverse()
  const { moversMinCap } = useSettings()
  const m = useMemo(
    () => movers(universe.data ?? [], moversMinCap),
    [universe.data, moversMinCap]
  )
  const max = Math.max(
    ...[...m.gainers, ...m.losers].map((a) => Math.abs(a.change24h ?? 0)),
    1
  )
  return (
    <Pane
      title="Biggest movers"
      subtitle={`24h, assets above ${formatCompactMoney(moversMinCap)} market cap`}
      flush
      bodyClassName="py-2"
    >
      {universe.isPending ? (
        <div className="p-3">
          <Skeleton className="h-40" />
        </div>
      ) : (
        // Side by side only when the pane is wide enough for readable bars.
        <div className="@container">
          <div className="grid gap-2 @min-[34rem]:grid-cols-2">
            <MoverBars title="Gainers" assets={m.gainers} max={max} />
            <MoverBars title="Losers" assets={m.losers} max={max} />
          </div>
        </div>
      )}
    </Pane>
  )
}

export function ResearchWidget() {
  const { theses } = useJournal()
  const { notes } = useResearch()
  const universe = useUniverse()
  const now = useNow(60_000)
  const due = thesesDueForReview(theses, todayISO())
  const decisions = theses
    .flatMap((t) =>
      t.entries
        .filter((e) => e.kind === "decision" && e.assetId)
        .map((e) => ({ t, e }))
    )
    .sort((a, b) => b.e.at - a.e.at)
    .slice(0, 3)
  const recentNotes = [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
  const empty = !due.length && !decisions.length && !recentNotes.length
  return (
    <Pane
      title="Research"
      subtitle="Reviews due, recent decisions and notes"
      actions={
        <Link
          to="/journal"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Journal <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      }
    >
      {empty ? (
        <p className="text-[0.8125rem] text-ink-2">
          Write a{" "}
          <Link to="/journal" className="text-accent hover:underline">
            thesis
          </Link>{" "}
          or a{" "}
          <Link to="/research" className="text-accent hover:underline">
            research note
          </Link>{" "}
          to track ideas, decisions and reviews here.
        </p>
      ) : (
        <div className="space-y-3 text-[0.8125rem]">
          {due.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Due for review</p>
              <ul className="space-y-1">
                {due.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Badge tone="warn">Review</Badge>
                    <Link
                      to={`/journal/${t.id}`}
                      className="truncate text-ink hover:underline"
                    >
                      {t.title || "Untitled thesis"}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs text-ink-3">
                      {formatDate(t.reviewBy)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {decisions.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Recent decisions</p>
              <ul className="space-y-1">
                {decisions.map(({ t, e }) => {
                  const a = universe.data?.find((x) => x.id === e.assetId)
                  const move = moveSince(e.priceAtEntry, a?.price ?? null)
                  return (
                    <li key={e.id} className="flex items-center gap-2">
                      <Badge tone="accent">{e.decision ?? "decision"}</Badge>
                      <Link
                        to={`/journal/${t.id}`}
                        className="truncate text-ink hover:underline"
                      >
                        {a?.symbol ?? e.assetId}
                      </Link>
                      <span className="text-xs text-ink-3">
                        {formatAge(e.at, now)}
                      </span>
                      <span className="ml-auto text-xs">
                        {move === null ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <>
                            <Change value={move} />{" "}
                            <span className="text-ink-3">since</span>
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {recentNotes.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Recent notes</p>
              <ul className="space-y-1">
                {recentNotes.map((n) => (
                  <li key={n.id} className="flex items-center gap-2">
                    <Link
                      to={`/research?note=${n.id}`}
                      className="truncate text-ink hover:underline"
                    >
                      {n.title || "Untitled note"}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs text-ink-3">
                      {formatAge(n.updatedAt, now)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Pane>
  )
}

export function NewsWidget() {
  const news = useNews()
  const universe = useUniverse()
  const now = useNow(60_000)
  const matchers = useMemo(
    () => buildMatchers((universe.data ?? []).slice(0, 120)),
    [universe.data]
  )
  const groups = useMemo(
    () => groupStories(news.data?.items ?? []).slice(0, 6),
    [news.data]
  )
  const symbolOf = useMemo(
    () => new Map((universe.data ?? []).map((a) => [a.id, a.symbol])),
    [universe.data]
  )
  return (
    <Pane
      title="Latest news"
      subtitle={
        news.data
          ? `${news.data.sources.filter((s) => s.ok).length} publishers · updated ${formatAge(news.data.fetchedAt, now)}`
          : "Publisher RSS feeds"
      }
      actions={
        <Link
          to="/news"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          All news <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      }
      flush
    >
      {news.isPending ? (
        <div className="p-3">
          <Skeleton className="h-40" />
        </div>
      ) : news.isError || !news.data ? (
        <p className="p-3 text-[0.8125rem] text-ink-3">
          The news service is unavailable right now.
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {groups.map(({ lead, related }) => {
            const tags = tagAssets(lead.title, matchers, 3)
            return (
              <li key={lead.id} className="px-3 py-2">
                <a
                  href={lead.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group block text-[0.8125rem] leading-5 text-ink hover:underline"
                >
                  {lead.title}
                  <ExternalLink
                    className="ml-1 inline size-3 text-ink-3 opacity-0 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (opens {lead.source})</span>
                </a>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-3">
                  <span>{lead.source}</span>
                  <span>{formatAge(lead.publishedAt, now)}</span>
                  {related.length > 0 && <span>+{related.length} more</span>}
                  {tags.map((id) => (
                    <Link
                      key={id}
                      to={`/markets/${id}`}
                      className="mono rounded bg-surface-2 px-1 text-ink-2 hover:text-ink"
                    >
                      {symbolOf.get(id)}
                    </Link>
                  ))}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Pane>
  )
}

export function RecentWidget() {
  const recent = useRecentAssets()
  const { assets } = useQuotes(recent)
  return (
    <Pane title="Recently viewed" flush>
      {recent.length === 0 ? (
        <p className="p-3 text-[0.8125rem] text-ink-3">
          Assets you open appear here.
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {recent.slice(0, 8).map((id) => {
            const a = assets.get(id)
            return (
              <li key={id}>
                <Link
                  to={`/markets/${id}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-[0.8125rem] hover:bg-surface-2/60"
                >
                  <AssetIcon
                    src={a?.image}
                    symbol={a?.symbol ?? "?"}
                    size={16}
                  />
                  <span className="flex-1 truncate text-ink">
                    {a?.name ?? id}
                  </span>
                  <span className="num text-ink-2">
                    {formatPrice(a?.price)}
                  </span>
                  <Change
                    value={a?.change24h}
                    className="w-16 text-right text-xs"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Pane>
  )
}

export function SectorsWidget() {
  const categories = useCategories()
  const rows = useMemo(
    () =>
      (categories.data ?? [])
        .filter((c) => (c.marketCap ?? 0) > 5e9 && c.change24h !== null)
        .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
        .slice(0, 10)
        .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0)),
    [categories.data]
  )
  const max = Math.max(...rows.map((r) => Math.abs(r.change24h ?? 0)), 1)
  return (
    <Pane
      title="Sector performance"
      subtitle="24h market-cap change, 10 largest CoinGecko categories"
      actions={
        <Link
          to="/intelligence"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Intelligence <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      }
    >
      {categories.isPending ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-3">
          Category data is unavailable right now.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-2 text-[0.8125rem]"
            >
              <span className="truncate text-ink-2" title={c.name}>
                {c.name}
              </span>
              <span className="relative h-2.5" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-rule-strong" />
                <span
                  className={cn(
                    "absolute inset-y-0",
                    (c.change24h ?? 0) >= 0
                      ? "left-1/2 rounded-r-[2px] bg-up"
                      : "right-1/2 rounded-l-[2px] bg-down"
                  )}
                  style={{
                    width: `${(Math.abs(c.change24h ?? 0) / max) * 50}%`,
                  }}
                />
              </span>
              <Change value={c.change24h} className="text-right text-xs" />
            </li>
          ))}
        </ul>
      )}
    </Pane>
  )
}

export function MapWidget() {
  const universe = useUniverse()
  const wide = useMediaQuery("(min-width: 640px)")
  return (
    <Pane title="Market map" subtitle="Area: market cap · colour: 24h change">
      {universe.data ? (
        <MarketMap assets={universe.data} maxTiles={wide ? 40 : 20} />
      ) : (
        <EmptyState title="Market map unavailable">
          It appears once prices load.
        </EmptyState>
      )}
    </Pane>
  )
}
